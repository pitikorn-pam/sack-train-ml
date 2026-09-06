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
import re

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


def _head_index(conv_names: set[str], prefix: str) -> int:
    """Which ``model.N`` holds the detection head.

    Taken from the graph rather than assumed: the head is the highest ``model.N``
    that owns a ``cv2.*`` branch, which is the box branch every detect head has.
    Falls back to 23 only if nothing matches, so the failure stays recognisable.
    """
    pat = re.compile(rf"^/model\.(\d+)/{re.escape(prefix)}cv2\.\d+/")
    hits = {int(m.group(1)) for c in conv_names if (m := pat.match(c))}
    return max(hits) if hits else 23


def detect_head(onnx_path, verify_end_nodes=True):
    """Auto-detect (family, task, nms_mode, end_nodes) from the ONNX graph.

    YOLOv11 and YOLO26 differ in head structure: YOLO26's one-to-one detect head
    names its convs ``one2one_cv2.N / one2one_cv3.N`` (vs YOLOv11's ``cv2.N / cv3.N``).
    Segmentation adds a mask-coefficient branch (``cv4.N`` / ``one2one_cv4.N``) plus
    a ``/proto/`` conv branch. The pre-DFL box conv also differs: YOLOv11 emits a
    64-ch DFL box (regression_length=16) that the on-chip ``meta_arch=yolov8`` NMS
    can decode; YOLO26 emits a 4-ch direct box, so the yolov8 on-chip NMS decode is
    WRONG for it -> those models must compile on the raw (no on-chip NMS) path.

    Returns (family, task, nms_mode, end_nodes):
      family    : "yolov11" | "yolo26"
      task      : "detection" | "segmentation"
      nms_mode  : "onchip" (yolov11 detection only) | "raw"
      end_nodes : list[str] of pre-head conv names, all verified present in graph.
    """
    import onnx

    model = onnx.load(onnx_path)
    conv_names = {n.name for n in model.graph.node if n.op_type == "Conv"}

    # family: YOLO26 renames the detect head convs with a ``one2one_`` prefix.
    #
    # NOTE this is a *head-style* discriminator, not a version detector. Anything with
    # a classical DFL box head — YOLOv8, YOLOv9, YOLO11, YOLO12 — reports "yolov11",
    # because what the compile actually needs to know is whether the on-chip
    # meta_arch=yolov8 decoder can read the box branch. That decision is right for all
    # of them; the *label* is wrong for v8/v9/v12 and will misreport in meta.yaml.
    # Verified 2026-09-06: yolov8n and yolov9t both parse and take the on-chip path.
    family = "yolo26" if any("one2one_cv2" in c for c in conv_names) else "yolov11"
    prefix = "one2one_" if family == "yolo26" else ""

    # task: segmentation has both a proto branch and a mask-coeff (cv4) branch.
    has_proto = any("/proto/" in c for c in conv_names)
    has_cv4 = any(f"{prefix}cv4" in c for c in conv_names)
    task = "segmentation" if (has_proto and has_cv4) else "detection"

    # nms: on-chip yolov8 NMS only decodes the YOLOv11 DFL box; everything else raw.
    nms_mode = "onchip" if (family == "yolov11" and task == "detection") else "raw"

    # The head is NOT always at model.23. Measured across ten exported architectures:
    # YOLOv8 and YOLOv9t-c put it at model.22, YOLOv9e at model.42, YOLO12 at model.21.
    # Hardcoding 23 is what limited this pipeline to five of forty-six trainable
    # checkpoints, so derive the index from the graph instead — a re-export cannot
    # break it, and neither can a new architecture that follows the same naming.
    head = _head_index(conv_names, prefix)

    end_nodes = []
    for s in (0, 1, 2):
        end_nodes.append(f"/model.{head}/{prefix}cv2.{s}/{prefix}cv2.{s}.2/Conv")
        end_nodes.append(f"/model.{head}/{prefix}cv3.{s}/{prefix}cv3.{s}.2/Conv")
    if task == "segmentation":
        for s in (0, 1, 2):
            end_nodes.append(f"/model.{head}/{prefix}cv4.{s}/{prefix}cv4.{s}.2/Conv")
        end_nodes.append(f"/model.{head}/proto/cv3/conv/Conv")

    # Skip the existence check when the caller will supply --end-nodes explicitly
    # (an override exists precisely for the rename case that would fail this check).
    if verify_end_nodes:
        missing = [n for n in end_nodes if n not in conv_names]
        if missing:
            raise SystemExit(
                f"derived end-nodes not found in ONNX graph ({family}/{task}): {missing}"
            )
    return family, task, nms_mode, end_nodes


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
    # end-nodes are auto-derived from the ONNX graph (family + task aware, see
    # detect_head); pass --end-nodes explicitly only to override a rare rename.
    ap.add_argument("--start-node", default="images")
    ap.add_argument("--end-nodes", default="")
    # nms: auto = on-chip yolov8 NMS for yolov11-detection only, raw otherwise.
    # yolo26 (4-ch direct box) and segmentation must NOT use the yolov8 on-chip NMS.
    ap.add_argument("--nms", choices=["auto", "onchip", "raw"], default="auto")
    a = ap.parse_args()
    os.makedirs(a.work, exist_ok=True)
    os.environ.setdefault("USER", "hailo")  # Colab runs as root w/o $USER -> compile KeyError

    from hailo_sdk_client import ClientRunner

    start = a.start_node

    # Auto-detect head family/task from the ONNX graph, then resolve end-nodes and
    # the NMS mode. Explicit --end-nodes / --nms override the derived values; when
    # end-nodes are given, skip the derived-name existence check (it's the override
    # for exactly the rename case that check would reject).
    explicit_end = [n.strip() for n in a.end_nodes.split(",") if n.strip()]
    family, task, nms_auto, derived_end = detect_head(
        a.onnx, verify_end_nodes=not explicit_end
    )
    end = explicit_end or derived_end
    nms_mode = nms_auto if a.nms == "auto" else a.nms
    print(f"DETECT {json.dumps({'family': family, 'task': task, 'nms': nms_mode, 'end_nodes': end})}")

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

    # ---- 2) model script: normalization (edge feeds raw uint8) [+ on-chip NMS] ----
    # opt_level 0 = skip Bias Correction + Layer Noise Analysis (LAT bug) -> fast, basic quant
    # production: calib >= 1024 + opt_level 2 (Simple LAT + bias correction, better quant)
    alls = (
        f"model_optimization_flavor(optimization_level={a.opt_level}, compression_level=0)\n"
        f"normalization1 = normalization([0.0,0.0,0.0],[255.0,255.0,255.0])\n"
    )
    # On-chip yolov8 NMS is only valid for the YOLOv11 DFL box (16-ch reg). On the
    # raw path we skip nms_postprocess entirely — decode happens off-chip on the edge.
    if nms_mode == "onchip":
        bbox_decoders = derive_bbox_decoders(runner, a.size)
        print("bbox_decoders:", json.dumps(bbox_decoders, indent=2))
        assert len(bbox_decoders) == 3, f"expected 3 strides, got {len(bbox_decoders)}"
        nms = {
            "nms_scores_th": a.scores_th, "nms_iou_th": a.iou_th,
            "image_dims": [a.size, a.size], "max_proposals_per_class": a.max_per_class,
            "classes": a.classes, "regression_length": a.reg_len,
            "background_removal": False, "bbox_decoders": bbox_decoders,
        }
        nms_json = f"{a.work}/nms_config.json"
        json.dump(nms, open(nms_json, "w"), indent=2)
        alls += f'nms_postprocess("{nms_json}", meta_arch=yolov8, engine=cpu)\n'
    else:
        print(f"nms=raw ({family}/{task}) — skipping on-chip nms_postprocess")
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
