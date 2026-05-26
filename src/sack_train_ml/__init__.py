"""sack-train-ml package — BSCP sack detector training pipeline.

Public surface:
    from sack_train_ml.contracts import RunConfig, ArtifactRecord, ReleaseManifest
    from sack_train_ml.supabase_client import RegistryClient
    from sack_train_ml.dataset import validate_dataset
    from sack_train_ml.training import train_yolo
    from sack_train_ml.evaluation import gate_check
    from sack_train_ml.export_onnx import export_onnx
    from sack_train_ml.hailo_pipeline import compile_hef
    from sack_train_ml.release import assemble_bundle, build_manifest
"""

__all__ = [
    "contracts",
    "supabase_client",
    "dataset",
    "training",
    "evaluation",
    "export_onnx",
    "hailo_pipeline",
    "release",
]
