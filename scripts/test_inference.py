#!/usr/bin/env python3
"""test_inference.py — sanity-check a trained .pt against an image / folder / video.

Two ways to pick the model:
    1. ``--model path/to/best.pt``                              (local file)
    2. ``--version <semver>`` or ``--version latest``           (pull from R2 via Supabase)

Input:
    --input <path>        single image, folder of images, or a video file

Examples:
    python scripts/test_inference.py                            # fully interactive
    python scripts/test_inference.py --model runs/foo/best.pt --input bus.jpg
    python scripts/test_inference.py --version latest --input frames/
    python scripts/test_inference.py --version 1.0.0-83484090 --input clip.mp4 --conf 0.3

Outputs annotated images/video next to the input under ``predictions/<timestamp>/``.
Env needed for remote model pull: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}
VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--model", help="Path to a local .pt file")
    p.add_argument("--version", help="Semver (or 'latest') to pull from R2")
    p.add_argument("--input", help="Image / folder / video to run inference on")
    p.add_argument("--conf", type=float, default=0.25, help="Confidence threshold (default 0.25)")
    p.add_argument("--iou", type=float, default=0.45, help="IoU threshold for NMS (default 0.45)")
    p.add_argument("--imgsz", type=int, default=640, help="Inference image size (default 640)")
    p.add_argument("--device", default=None,
                   help="cuda, cpu, mps, or specific cuda id (default: auto)")
    p.add_argument("--out", default=None, help="Output directory (default predictions/<ts>)")
    p.add_argument("--show", action="store_true",
                   help="Display annotated frames live via OpenCV (press q to stop)")
    p.add_argument("--no-save", action="store_true",
                   help="Don't write annotated outputs to disk")
    args = p.parse_args(argv)

    model_path = _resolve_model(args)
    input_path = _resolve_input(args)

    if args.out:
        out_dir = Path(args.out)
    else:
        ts = datetime.now().strftime("%Y%m%d-%H%M%S")
        out_dir = REPO_ROOT / "predictions" / ts
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n→ model:  {model_path}")
    print(f"→ input:  {input_path}")
    print(f"→ output: {out_dir}")
    print(f"→ conf={args.conf} iou={args.iou} imgsz={args.imgsz}")

    from ultralytics import YOLO  # type: ignore
    model = YOLO(str(model_path))

    sources = _expand_input(input_path)
    print(f"→ {len(sources)} source(s) to process\n")

    save = not args.no_save
    summary = []
    for src in sources:
        if args.show:
            n_det, n_frames = _stream_predict(
                model, src, out_dir, args.conf, args.iou, args.imgsz, args.device, save,
            )
        else:
            results = model.predict(
                source=str(src),
                conf=args.conf,
                iou=args.iou,
                imgsz=args.imgsz,
                device=args.device,
                project=str(out_dir),
                name=src.stem if src.is_file() else "batch",
                save=save,
                save_txt=False,
                exist_ok=True,
                stream=True,
                verbose=False,
            )
            n_det = 0
            n_frames = 0
            for r in results:
                if r.boxes is not None:
                    n_det += int(r.boxes.shape[0])
                n_frames += 1
        summary.append((src, n_det, n_frames))
        print(f"  {src.name:<60s} → {n_det} detection(s) across {n_frames} frame(s)")

    if save:
        print(f"\nannotated outputs saved under: {out_dir}")
    return 0


def _stream_predict(model, src: Path, out_dir: Path, conf: float, iou: float,
                    imgsz: int, device, save: bool) -> tuple[int, int]:
    """Live OpenCV display loop. Returns (total_detections, n_frames)."""
    try:
        import cv2  # type: ignore
    except ImportError:
        raise SystemExit("--show requires opencv-python. install: pip install opencv-python")

    name = src.stem if src.is_file() else "batch"
    out_sub = out_dir / name
    if save:
        out_sub.mkdir(parents=True, exist_ok=True)

    results = model.predict(
        source=str(src),
        conf=conf,
        iou=iou,
        imgsz=imgsz,
        device=device,
        stream=True,
        verbose=False,
    )

    writer = None
    n_det = 0
    n_frames = 0
    window = f"sack-train-ml · {src.name} (q to quit)"
    cv2.namedWindow(window, cv2.WINDOW_NORMAL)
    for r in results:
        frame = r.plot()  # BGR np.ndarray with boxes drawn
        if r.boxes is not None:
            n_det += int(r.boxes.shape[0])
        n_frames += 1

        if save:
            if src.suffix.lower() in VIDEO_EXTS:
                if writer is None:
                    h, w = frame.shape[:2]
                    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
                    writer = cv2.VideoWriter(str(out_sub / f"{src.stem}.mp4"), fourcc, 25.0, (w, h))
                writer.write(frame)
            else:
                cv2.imwrite(str(out_sub / f"frame_{n_frames:06d}.jpg"), frame)

        cv2.imshow(window, frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    if writer:
        writer.release()
    cv2.destroyAllWindows()
    return n_det, n_frames


# ---------------------------------------------------------------------------
# resolution helpers
# ---------------------------------------------------------------------------

def _resolve_model(args: argparse.Namespace) -> Path:
    if args.model:
        p = Path(args.model).expanduser().resolve()
        if not p.exists():
            raise SystemExit(f"--model not found: {p}")
        return p

    if args.version:
        return _pull_version(args.version)

    # Interactive
    print("Pick a model source:")
    print("  1) local .pt file")
    print("  2) pull from R2 (latest version)")
    print("  3) pull from R2 (specific semver)")
    choice = input("[1/2/3]: ").strip() or "1"

    if choice == "1":
        path = input("Local .pt path: ").strip()
        if not path:
            raise SystemExit("model path required")
        p = Path(path).expanduser().resolve()
        if not p.exists():
            raise SystemExit(f"not found: {p}")
        return p

    if choice == "2":
        return _pull_version("latest")

    if choice == "3":
        sv = input("Semver (e.g. 1.0.0-83484090): ").strip()
        if not sv:
            raise SystemExit("semver required")
        return _pull_version(sv)

    raise SystemExit("invalid choice")


def _resolve_input(args: argparse.Namespace) -> Path:
    if args.input:
        p = Path(args.input).expanduser().resolve()
        if not p.exists():
            raise SystemExit(f"--input not found: {p}")
        return p
    raw = input("Input (image / folder / video): ").strip()
    if not raw:
        raise SystemExit("input required")
    p = Path(raw).expanduser().resolve()
    if not p.exists():
        raise SystemExit(f"not found: {p}")
    return p


def _expand_input(path: Path) -> list[Path]:
    """Return list of sources. YOLO can take a folder directly, but we expand
    to give per-item summary stats."""
    if path.is_file():
        return [path]
    if path.is_dir():
        imgs = [p for p in sorted(path.iterdir())
                if p.is_file() and p.suffix.lower() in IMAGE_EXTS]
        if imgs:
            # process as one batch directory rather than per-image so YOLO
            # writes them into a single `batch/` output folder
            return [path]
        raise SystemExit(f"no images found in {path}")
    raise SystemExit(f"unsupported input: {path}")


# ---------------------------------------------------------------------------
# R2 / Supabase model pull
# ---------------------------------------------------------------------------

def _pull_version(semver: str) -> Path:
    from sack_train_ml.supabase_client import RegistryClient

    client = RegistryClient()
    if semver == "latest":
        rows = client._rest(  # type: ignore[attr-defined]
            "GET",
            "/rest/v1/versions?select=id,semver,artifacts,created_at&order=created_at.desc&limit=1",
        )
    else:
        rows = client._rest(  # type: ignore[attr-defined]
            "GET",
            f"/rest/v1/versions?semver=eq.{semver}&select=id,semver,artifacts,created_at&limit=1",
        )
    if not rows:
        raise SystemExit(f"no version found for {semver!r}")

    v = rows[0]
    artifacts = v.get("artifacts") or {}
    pt = artifacts.get("pytorch") or {}
    r2_key = pt.get("key")
    if not r2_key:
        raise SystemExit(f"version {v['semver']} has no pytorch artifact")

    print(f"→ pulling {v['semver']} ({r2_key})")
    resp = client._call_edge("download-artifact", {"r2_key": r2_key})  # type: ignore[attr-defined]
    url = resp.get("download_url")
    if not url:
        raise SystemExit("download-artifact returned no url")

    cache_dir = REPO_ROOT / "predictions" / "_models"
    cache_dir.mkdir(parents=True, exist_ok=True)
    local = cache_dir / f"{v['semver']}.pt"
    if not local.exists():
        with urlopen(url, timeout=120) as r, open(local, "wb") as f:
            while True:
                chunk = r.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
        print(f"   cached at {local}")
    else:
        print(f"   (using cached {local})")
    return local


if __name__ == "__main__":
    raise SystemExit(main())
