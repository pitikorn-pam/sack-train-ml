#!/usr/bin/env python
"""Does DFC give the classification heads a sigmoid, or must our ALLS emit it?

Hailo's own `yolov11s.alls` carries three `change_output_activation(<cls_conv>, sigmoid)`
lines. The ALLS this repo generates carries none, and the YOLOv8 NMS op in HailoRT 4.20.0
applies no sigmoid of its own — it compares the dequantized class value directly against
`nms_scores_th`. So if DFC does not insert the activation for us, every HEF this repo has
produced has been feeding raw logits into a threshold that expects probabilities.

This answers that question and nothing else. It reuses the real compile recipe from
`compile_clientrunner.py` rather than restating it, so the answer describes the pipeline
that actually runs.

MUST run inside the DFC virtualenv (see notebooks/probe_cls_activation.ipynb):
    /content/hailo_venv/bin/python scripts/probe_cls_activation.py --onnx best.onnx

Quantization quality is irrelevant here — this is a question about the graph — so a
handful of calibration images is enough, and synthetic noise will do if none are supplied.
"""
import argparse
import glob
import json
import os
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compile_clientrunner import derive_bbox_decoders, detect_head, letterbox  # noqa: E402


def load_calib(calib_dir: str | None, n: int, size: int) -> np.ndarray:
    """Real frames when available; otherwise noise. Either answers a graph question."""
    if calib_dir:
        from PIL import Image
        files = sorted(
            glob.glob(f"{calib_dir}/*.jpg") + glob.glob(f"{calib_dir}/*.jpeg") + glob.glob(f"{calib_dir}/*.png")
        )[:n]
        if files:
            arr = np.zeros((len(files), size, size, 3), np.float32)
            for i, f in enumerate(files):
                arr[i] = np.asarray(letterbox(Image.open(f).convert("RGB"), size), np.float32)
            print(f"calib: {len(files)} real images from {calib_dir}")
            return arr
    print(f"calib: {n} synthetic frames (no images supplied — fine for a graph question)")
    return np.random.randint(0, 256, (n, size, size, 3)).astype(np.float32)


def print_output_activations(runner, stage: str) -> dict[str, str]:
    hn = runner.get_hn()
    hn = json.loads(hn) if isinstance(hn, str) else hn
    layers = hn["layers"]
    found: dict[str, str] = {}
    print(f"\n--- output layers {stage} ---")
    for _name, layer in layers.items():
        if layer.get("type") != "output_layer":
            continue
        src_name = layer["input"][0]
        src = layers[src_name]
        act = str(src.get("activation"))
        shape = src["output_shapes"][0]
        channels = shape[-1]
        role = "cls" if channels < 16 else "box"
        found[src_name] = act
        print(f"  {src_name:<52} {role}  channels={channels:<4} activation={act}")
    return found


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--onnx", required=True)
    ap.add_argument("--work", default="/content/probe")
    ap.add_argument("--calib", default=None, help="optional dir of real frames")
    ap.add_argument("--calib-n", type=int, default=8)
    ap.add_argument("--hw", default="hailo8l")
    ap.add_argument("--net", default="probe")
    ap.add_argument("--size", type=int, default=640)
    ap.add_argument("--classes", type=int, default=2)
    ap.add_argument("--scores-th", type=float, default=0.20)
    ap.add_argument("--iou-th", type=float, default=0.70)
    ap.add_argument("--max-per-class", type=int, default=50)
    ap.add_argument("--reg-len", type=int, default=16)
    a = ap.parse_args()
    os.makedirs(a.work, exist_ok=True)
    os.environ.setdefault("USER", "hailo")  # Colab runs as root without $USER -> compile KeyError

    from hailo_sdk_client import ClientRunner

    family, task, nms_mode, end_nodes = detect_head(a.onnx)
    print(f"detected: family={family} task={task} nms={nms_mode}")
    if nms_mode != "onchip":
        print("this model does not take the on-chip NMS path, so the question does not apply to it")
        return 1

    # ---- parse ----
    runner = ClientRunner(hw_arch=a.hw)
    runner.translate_onnx_model(
        a.onnx, a.net,
        start_node_names=["images"], end_node_names=end_nodes,
        net_input_shapes={"images": [1, 3, a.size, a.size]},
    )
    before = print_output_activations(runner, "after parse (before any model script)")

    # ---- the SAME model script the pipeline uses ----
    bbox_decoders = derive_bbox_decoders(runner, a.size)
    nms = {
        "nms_scores_th": a.scores_th, "nms_iou_th": a.iou_th,
        "image_dims": [a.size, a.size], "max_proposals_per_class": a.max_per_class,
        "classes": a.classes, "regression_length": a.reg_len,
        "background_removal": False, "bbox_decoders": bbox_decoders,
    }
    nms_json = f"{a.work}/nms_config.json"
    json.dump(nms, open(nms_json, "w"), indent=2)
    alls = (
        "model_optimization_flavor(optimization_level=0, compression_level=0)\n"
        "normalization1 = normalization([0.0,0.0,0.0],[255.0,255.0,255.0])\n"
        f'nms_postprocess("{nms_json}", meta_arch=yolov8, engine=cpu)\n'
    )
    print("\n--- model script applied (identical to the pipeline's) ---\n" + alls)
    runner.load_model_script(alls)

    # ---- optimize: the stage where change_output_activation would take effect ----
    runner.optimize(load_calib(a.calib, a.calib_n, a.size))
    after = print_output_activations(runner, "after optimize (the stage that matters)")

    har = f"{a.work}/{a.net}_probe.har"
    runner.save_har(har)
    print(f"\nHAR saved: {har}")
    print("Recover the model script DFC built for itself with:")
    print(f"  hailo har extract {har} --auto-model-script-path {a.work}/effective.alls")

    # ---- verdict ----
    cls_layers = {n: act for n, act in after.items() if "cv3" in n or "cv4" in n}
    if not cls_layers:  # fall back to channel count if the naming differs
        cls_layers = {n: act for n, act in after.items() if n in before}
    sigmoids = [n for n, act in after.items() if "sigmoid" in act.lower()]

    print("\n================ VERDICT ================")
    if sigmoids:
        print(f"DFC DID apply a sigmoid to {len(sigmoids)} output layer(s):")
        for n in sigmoids:
            print(f"  {n}")
        print("→ our ALLS does not need change_output_activation. Hypothesis closed;")
        print("  the INT8 investigation stays on optimization_level.")
    else:
        print("NO output layer carries a sigmoid after optimize.")
        print("→ our generated ALLS MUST emit change_output_activation(<cls_conv>, sigmoid),")
        print("  and every HEF built by this repo so far has been feeding raw logits into a")
        print("  threshold that expects probabilities.")
    print("=========================================")
    print("\nPaste this whole output back — the raw lines above are the evidence, not this summary.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
