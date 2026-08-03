"""Training orchestration — YOLO train wrapper with live metric streaming.

This is intentionally thin. It does two things:
    1. Build YOLO ``train_kwargs`` from a ``RunConfig``.
    2. Run ``YOLO(...).train(...)`` with an ``on_fit_epoch_end`` callback that
       streams every metric to Supabase via the ``RegistryClient``.

Heavy lifting (dataset materialization, hardware detection, export, upload)
lives in ``scripts/train_for_run.py``. This module is import-safe even
without ultralytics installed (the YOLO import is deferred).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from .contracts import RunConfig
from .supabase_client import RegistryClient


DEFAULT_TRAIN_KWARGS: dict[str, Any] = {
    "epochs": 100,
    "imgsz": 640,
    "batch": "auto",
    "patience": 20,
    "lr0": 0.001,
}


def _coerce_batch(value: Any) -> Any:
    """ultralytics no longer accepts ``batch="auto"``. Translate friendly
    strings to its native auto-batch sentinel ``-1``; pass numerics through.
    """
    if isinstance(value, str):
        v = value.strip().lower()
        if v in ("auto", "-1", ""):
            return -1
        try:
            return int(v)
        except ValueError:
            try:
                return float(v)
            except ValueError:
                return -1
    return value


def build_train_kwargs(
    config: RunConfig,
    dataset_yaml_path: str | Path,
    project_dir: str | Path,
    run_name: str,
) -> dict[str, Any]:
    kw = dict(DEFAULT_TRAIN_KWARGS)
    kw.update(config.hyperparameters or {})
    kw["data"] = str(dataset_yaml_path)
    kw["project"] = str(project_dir)
    kw["name"] = run_name
    if "batch" in kw:
        kw["batch"] = _coerce_batch(kw["batch"])
    if isinstance(config.input_size, list) and len(config.input_size) >= 2:
        if config.input_size[0] == config.input_size[1]:
            kw["imgsz"] = config.input_size[0]
    return kw


def make_metric_callback(
    client: RegistryClient,
    run_id: str,
    total_epochs: int,
) -> Callable[[Any], None]:
    """Return an ``on_fit_epoch_end(trainer)`` callback for YOLO."""

    def _on_fit_epoch_end(trainer: Any) -> None:  # pragma: no cover - YOLO runtime
        # Telemetry must never abort training. Anything raised in here escapes
        # through ultralytics' callback loop and kills the run mid-epoch — a
        # single 502 from the callback endpoint once discarded 197 finished
        # epochs. The old code was doubly exposed: the handler for a failed
        # log_metrics called log_step, which hits the same dead endpoint.
        epoch = int(getattr(trainer, "epoch", 0))
        try:
            try:
                metrics = dict(getattr(trainer, "metrics", {}) or {})
            except Exception:
                metrics = {}
            progress = (epoch + 1) / max(1, total_epochs) * 100.0
            rows = [
                {"step": epoch, "epoch": epoch, "name": name, "value": float(value)}
                for name, value in metrics.items()
                if _is_number(value)
            ]
            rows.append({"step": epoch, "epoch": epoch, "name": "progress", "value": progress})
            client.log_metrics(run_id, rows)
        except Exception as exc:
            print(f"[warn] metric stream failed at epoch {epoch}: "
                  f"{type(exc).__name__}: {exc} — training continues", flush=True)
            try:
                client.log_step(
                    run_id, 5, "training", "warning",
                    f"metric stream failed at epoch {epoch}: {exc}",
                )
            except Exception:
                pass  # same endpoint is down — don't take the run with it

    return _on_fit_epoch_end


def _is_number(v: Any) -> bool:
    try:
        f = float(v)
        return f == f
    except (TypeError, ValueError):
        return False


def train_yolo(
    config: RunConfig,
    client: RegistryClient,
    run_id: str,
    dataset_yaml_path: str | Path,
    project_dir: str | Path,
    run_name: str,
    resume_from: str | Path | None = None,
) -> Any:
    """Run YOLO training. Returns the YOLO model after training finishes.

    ``resume_from`` continues an interrupted run from a ``last.pt``: ultralytics
    restores the optimizer, scaler, EMA and best_fitness from the checkpoint and
    picks up at the next epoch. The checkpoint's own training args win — epoch
    count and hyperparameters come from it, not from ``config`` — and ``data``
    is only consulted when the dataset path baked into the checkpoint no longer
    exists, which is why it is still passed.

    Raises on training failure — caller is responsible for finalize_run('failed').
    """
    from ultralytics import YOLO  # type: ignore  # deferred

    kwargs = build_train_kwargs(config, dataset_yaml_path, project_dir, run_name)
    epochs = int(kwargs.get("epochs", 100))

    if resume_from:
        ckpt = Path(resume_from).expanduser().resolve()
        if not ckpt.is_file():
            raise FileNotFoundError(f"--resume-from checkpoint not found: {ckpt}")
        model = YOLO(str(ckpt))
        kwargs = {"resume": str(ckpt), "data": str(dataset_yaml_path)}
    else:
        model = YOLO(config.source_weights)

    cb = make_metric_callback(client, run_id, epochs)
    model.add_callback("on_fit_epoch_end", cb)

    if resume_from:
        client.log_step(run_id, 5, "training", "started",
                        f"YOLO train RESUMING from {Path(resume_from).name} · "
                        f"epochs/hyperparams come from the checkpoint")
    else:
        client.log_step(run_id, 5, "training", "started",
                        f"YOLO train starting · epochs={epochs} imgsz={kwargs.get('imgsz')}")
    model.train(**kwargs)
    client.log_step(run_id, 5, "training", "ok", "YOLO train finished")
    return model
