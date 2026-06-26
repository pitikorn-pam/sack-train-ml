#!/usr/bin/env python
"""ONNX -> HAR (parse) -> quantize+calibrate (HAR) -> HEF, via DFC ClientRunner.

Custom YOLOv11s 2-class {Person,Sack}, Hailo-8L. Matches the edge contract:
uint8 640 letterbox input (on-chip /255), on-chip NMS, 2 classes.

IMPORTANT: this script imports ``hailo_sdk_client`` (the Hailo Dataflow
Compiler). DFC pins numpy/scipy/tensorflow versions that conflict with the
torch/ultralytics training environment, so it MUST be run inside the dedicated
DFC virtualenv as a *subprocess* — never imported into the training kernel.
``hailo_pipeline.compile_onnx_to_hef`` shells out to this file for exactly that
reason. The notebook ``compile_run.ipynb`` runs the same recipe inline.

Proven end-to-end: the HEF this produces loads + runs on a real Pi5 + Hailo-8L
at ~38 FPS (verified via ``hailortcli parse-hef`` + ``hailortcli run``).

The four version-specific DFC traps this script clears (see the loom-oracle
learning ``2026-06-23_onnx-to-hef-clientrunner-gotchas``):
  1. nms_postprocess needs explicit ``bbox_decoders`` (auto-derived from the HN).
  2. Layer Noise Analysis crashes on full LAT -> ``optimization_level=0`` skips it
     (basic quant; production wants calib>=1024 + opt_level 2).
  3. ``compile()`` raises ``KeyError: 'USER'`` on Colab root -> set USER env.
  4. ``hailo_platform`` (HailoRT) is not in the DFC venv -> verify on the device.
"""
import argparse
import glob
import json
import os

import numpy as np
from PIL import Image


def letterbox(im, size, color=(114, 114, 114)):
    w, h = im.size
    r = min(size / w, size / h)
    nw, nh = round(w * r), round(h * r)
    im = im.resize((nw, nh), Image.BILINEAR)
    cv = Image.new("RGB", (size, size), color)
    cv.paste(im, ((size - nw) // 2, (size - nh) // 2))
    return cv


def load_calib(d, n, size):
    fs = sorted(glob.glob(d + "/*.jpg") + glob.glob(d + "/*.jpeg") + glob.glob(d + "/*.png"))[:n]
    if not fs:
        raise SystemExit("no calib images in " + d)
    a = np.zeros((len(fs), size, size, 3), np.float32)
    for i, f in enumerate(fs):
        a[i] = np.asarray(letterbox(Image.open(f).convert("RGB"), size), np.float32)
    print(f"calib {len(fs)} imgs shape={a.shape} range=[{a.min():.0f},{a.max():.0f}]")
    return a


def derive_bbox_decoders(runner, size):
    """Auto-derive bbox_decoders from the parsed HN.

    DFC 3.33 needs explicit bbox_decoders; ``meta_arch=yolov8`` alone raises
    ``KeyError: 'bbox_decoders'``. Each output_layer maps to its source conv;
    channels (>=16 = box-reg / else cls) and spatial (size//H -> stride) pin the
    three decoders. Derived from the network so a re-export can't break it (the
    conv names get renumbered each export).
    """
    hn = runner.get_hn()
    hn = json.loads(hn) if isinstance(hn, str) else hn
    layers = hn["layers"]
    dec = {}  # stride -> {'reg': conv, 'cls': conv}
    for _name, layer in layers.items():
        if layer.get("type") != "output_layer":
            continue
        src = layer["input"][0]
        sh = layers[src]["output_shapes"][0]  # [-1, H, W, C]
        H, C = sh[1], sh[3]
        stride = size // H
        dec.setdefault(stride, {})["reg" if C >= 16 else "cls"] = src
    decoders = [
        {
            "name": f"bbox_decoder_stride_{s}",
            "stride": s,
            "reg_layer": dec[s]["reg"],
            "cls_layer": dec[s]["cls"],
        }
        for s in sorted(dec)
    ]
    return decoders


def main():
    ap = argparse.ArgumentParser()
    for k in ["onnx", "calib", "out", "work"]:
        ap.add_argument("--" + k, required=True)
    ap.add_argument("--hw", default="hailo8l")
    ap.add_argument("--net", default="yolov11s_sack")
    ap.add_argument("--classes", type=int, default=2)
    ap.add_argument("--size", type=int, default=640)
    ap.add_argument("--calib-n", type=int, default=512)
    ap.add_argument("--scores-th", type=float, default=0.20)
    ap.add_argument("--iou-th", type=float, default=0.70)
    ap.add_argument("--max-per-class", type=int, default=50)
    ap.add_argument("--reg-len", type=int, default=16)
    # 0 = skip LAT bug / fast (basic quant); 2 = production (needs calib >= 1024)
    ap.add_argument("--opt-level", type=int, default=0)
    # end-nodes default to YOLOv11 detect-head pre-DFL convs; override if a
    # re-export renames the graph root (rare — names are stable for model.23).
    ap.add_argument("--start-node", default="images")
    ap.add_argument("--end-nodes", default=",".join([
        "/model.23/cv2.0/cv2.0.2/Conv", "/model.23/cv3.0/cv3.0.2/Conv",  # stride 8
        "/model.23/cv2.1/cv2.1.2/Conv", "/model.23/cv3.1/cv3.1.2/Conv",  # stride 16
        "/model.23/cv2.2/cv2.2.2/Conv", "/model.23/cv3.2/cv3.2.2/Conv",  # stride 32
    ]))
    a = ap.parse_args()
    os.makedirs(a.work, exist_ok=True)
    os.environ.setdefault("USER", "hailo")  # Colab runs as root w/o $USER -> compile KeyError

    from hailo_sdk_client import ClientRunner

    start = a.start_node
    end = [n.strip() for n in a.end_nodes.split(",") if n.strip()]

    # ---- 1) PARSE: onnx -> HAR ----
    runner = ClientRunner(hw_arch=a.hw)
    runner.translate_onnx_model(
        a.onnx, a.net,
        start_node_names=[start], end_node_names=end,
        net_input_shapes={start: [1, 3, a.size, a.size]},
    )
    parsed = f"{a.work}/{a.net}_parsed.har"
    runner.save_har(parsed)
    print("PARSED ->", parsed)

    bbox_decoders = derive_bbox_decoders(runner, a.size)
    print("bbox_decoders:", json.dumps(bbox_decoders, indent=2))
    assert len(bbox_decoders) == 3, f"expected 3 strides, got {len(bbox_decoders)}"

    # ---- 2) model script: normalization (edge feeds raw uint8) + on-chip NMS ----
    nms = {
        "nms_scores_th": a.scores_th, "nms_iou_th": a.iou_th,
        "image_dims": [a.size, a.size], "max_proposals_per_class": a.max_per_class,
        "classes": a.classes, "regression_length": a.reg_len,
        "background_removal": False, "bbox_decoders": bbox_decoders,
    }
    nms_json = f"{a.work}/nms_config.json"
    json.dump(nms, open(nms_json, "w"), indent=2)
    # opt_level 0 = skip Bias Correction + Layer Noise Analysis (LAT bug) -> fast, basic quant
    # production: calib >= 1024 + opt_level 2 (Simple LAT + bias correction, better quant)
    alls = (
        f"model_optimization_flavor(optimization_level={a.opt_level}, compression_level=0)\n"
        f"normalization1 = normalization([0.0,0.0,0.0],[255.0,255.0,255.0])\n"
        f'nms_postprocess("{nms_json}", meta_arch=yolov8, engine=cpu)\n'
    )
    print("--- alls ---\n" + alls)
    runner.load_model_script(alls)

    # ---- 3) QUANTIZE + CALIBRATE: -> quantized HAR ----
    calib = load_calib(a.calib, a.calib_n, a.size)
    runner.optimize(calib)
    quant = f"{a.work}/{a.net}_quantized.har"
    runner.save_har(quant)
    print("QUANTIZED ->", quant)

    # ---- 4) COMPILE -> HEF ----
    hef = runner.compile()
    open(a.out, "wb").write(hef)
    print("HEF ->", a.out, os.path.getsize(a.out), "bytes")


if __name__ == "__main__":
    main()
