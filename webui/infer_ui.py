"""Sack Inference WebUI — manual video-inference playground (รุบทาง / rough prototype).

Upload a video, pick a .pt model, tune conf / NMS-IoU / classes with sliders, run
detection, watch + download the annotated mp4. Runs the trained .pt on Mac (MPS/CPU)
— a CONFIG-EXPLORATION tool, not the Hailo edge deploy-truth path.

Install:  pip install -e ".[webui]"      (gradio is an optional extra, not a
                                         pipeline dependency — it was previously
                                         undeclared, so this could not run at all)
Run:      python webui/infer_ui.py
Then open the printed http://127.0.0.1:7860 in a browser.

Loom Oracle (AI), 2026-08-09.
"""
import subprocess
import tempfile
from pathlib import Path

import cv2
import gradio as gr
from ultralytics import YOLO

MODELS_DIR = Path("/Users/pitikorn/Work/BSCP/vdo_train/Models")
DEFAULT_PT = str(MODELS_DIR / "04-08-26-model_DET_11/1.0.0-b05c28ae.pt")
COLORS = {0: (255, 0, 255), 1: (0, 255, 255)}   # person = magenta, sack = yellow (BGR)
NAMES = {0: "person", 1: "sack"}

_cache = {}


def _load(model_path):
    if model_path not in _cache:
        _cache[model_path] = YOLO(model_path)
    return _cache[model_path]


def list_models():
    found = sorted(str(p) for p in MODELS_DIR.rglob("*.pt"))
    return found or [DEFAULT_PT]


def run(video, model_path, conf, iou, do_person, do_sack, stride, device, progress=gr.Progress()):
    if not video:
        return None, "อัพโหลดวิดีโอก่อน"
    classes = ([0] if do_person else []) + ([1] if do_sack else [])
    if not classes:
        return None, "เลือกอย่างน้อย 1 class (person / sack)"

    model = _load(model_path)
    cap = cv2.VideoCapture(video)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0

    raw = tempfile.mktemp(suffix=".mp4")
    writer = cv2.VideoWriter(raw, cv2.VideoWriter_fourcc(*"mp4v"), fps / max(1, stride), (w, h))

    fi = -1
    n_written = 0
    max_sack = 0
    sum_sack = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        fi += 1
        if fi % stride != 0:
            continue
        if total:
            progress(min(1.0, fi / total), desc=f"frame {fi}/{total}")
        res = model.predict(frame, conf=conf, iou=iou, classes=classes, device=device, verbose=False)[0]
        n_sack = 0
        for b in res.boxes:
            c = int(b.cls)
            cf = float(b.conf)
            x1, y1, x2, y2 = map(int, b.xyxy[0])
            col = COLORS.get(c, (0, 255, 0))
            cv2.rectangle(frame, (x1, y1), (x2, y2), col, 2)
            cv2.putText(frame, f"{NAMES.get(c, c)} {cf:.2f}", (x1, max(12, y1 - 4)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, col, 1)
            if c == 1:
                n_sack += 1
        cv2.putText(frame, f"conf>={conf:.2f}  iou={iou:.2f}  stride={stride}  f{fi}",
                    (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 255), 2)
        writer.write(frame)
        n_written += 1
        max_sack = max(max_sack, n_sack)
        sum_sack += n_sack
    cap.release()
    writer.release()

    # transcode to browser-friendly h264
    out = tempfile.mktemp(suffix=".mp4")
    subprocess.run(["ffmpeg", "-y", "-i", raw, "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    "-crf", "20", "-movflags", "+faststart", out], capture_output=True)

    avg = sum_sack / max(1, n_written)
    summary = (f"model: {Path(model_path).name}\n"
               f"เฟรมประมวลผล {n_written} (จากทั้งหมด {total}, stride {stride})\n"
               f"sack สูงสุด/เฟรม: {max_sack}  |  เฉลี่ย: {avg:.1f}\n"
               f"conf≥{conf}  iou(NMS)={iou}  classes={classes}  device={device}")
    return out, summary


with gr.Blocks(title="Sack Inference WebUI") as demo:
    gr.Markdown("# Sack Inference WebUI (รุบทาง)\nอัพโหลดวิดีโอ → ปรับ config → detect → ดู/ดาวน์โหลด mp4. "
                "รันบน .pt (Mac) = เครื่องมือสำรวจ config, ไม่ใช่ Hailo edge deploy-truth.")
    with gr.Row():
        with gr.Column(scale=1):
            video = gr.Video(label="วิดีโอ input")
            model_path = gr.Dropdown(list_models(), value=DEFAULT_PT, label="model (.pt)", allow_custom_value=True)
            conf = gr.Slider(0.05, 0.95, value=0.25, step=0.05, label="conf threshold (detection floor)")
            iou = gr.Slider(0.1, 0.95, value=0.70, step=0.05, label="NMS IoU (สูง = เก็บกล่องซ้อน)")
            with gr.Row():
                do_person = gr.Checkbox(value=True, label="person (magenta)")
                do_sack = gr.Checkbox(value=True, label="sack (yellow)")
            stride = gr.Slider(1, 10, value=2, step=1, label="frame stride (สูง = เร็วขึ้น, หยาบขึ้น)")
            device = gr.Radio(["mps", "cpu"], value="mps", label="device")
            btn = gr.Button("Run detection", variant="primary")
        with gr.Column(scale=1):
            out_video = gr.Video(label="ผลลัพธ์ (ดาวน์โหลดได้)")
            out_text = gr.Textbox(label="สรุป", lines=4)
    btn.click(run, [video, model_path, conf, iou, do_person, do_sack, stride, device], [out_video, out_text])


if __name__ == "__main__":
    demo.launch(server_name="127.0.0.1", server_port=7860, show_error=True)
