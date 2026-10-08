#!/usr/bin/env python3
"""Generate a FIXTURE ONLY archive offline. HAR/HEF/ONNX bytes are not valid models.

Repeatable procedure, unique attempts: no SDK, subprocess compiler or storage calls.
Usage: .venv/bin/python scripts/generate_compile_diagnostics_fixture.py --out PATH
"""
from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
from sack_train_ml import compile_diagnostics as diagnostics


def generate(root: Path) -> diagnostics.ReadyArchive:
    from PIL import Image

    root.mkdir(parents=True, exist_ok=True)
    (root / 'README.md').write_text(
        '# FIXTURE ONLY — NOT a real Hailo archive/model run\n\n'
        'Native/quantized HAR and HEF/ONNX are placeholder bytes, not SDK-loadable.\n'
        'Calibration images are generated valid images. Hashes are computed from bytes.\n'
        'Regenerate with scripts/generate_compile_diagnostics_fixture.py --out this-directory.\n'
    )
    inputs = root / 'fixture-inputs'
    inputs.mkdir(exist_ok=True)
    calib = inputs / 'calibration'
    calib.mkdir(exist_ok=True)
    for name, color in [('z.png', (255, 0, 0)), ('a.jpeg', (0, 255, 0)), ('m.jpg', (0, 0, 255))]:
        Image.new('RGB', (7, 3), color).save(calib / name)
    onnx = inputs / 'FIXTURE.onnx'
    onnx.write_bytes(b'FIXTURE ONLY NOT A VALID ONNX')
    attempt = diagnostics.begin(root, run_id='FIXTURE-run', semver='0.0.0-fixture', onnx=onnx,
                                requested={'evidence_kind': 'FIXTURE', 'model': 'FIXTURE-model',
                                           'target': 'hailo8l', 'calib_n': 512, 'input_size': 8,
                                           'notice': 'NOT a real valid Hailo archive/model run'})
    journal = diagnostics.attach(attempt.directory)
    for stage in ['native', 'quantized']:
        path = attempt.directory / (stage + '.har')
        path.write_bytes(f'FIXTURE ONLY {stage} HAR PLACEHOLDER; NOT SDK LOADABLE\n'.encode())
        journal.saved(stage, path)
    journal.script('FIXTURE ONLY: no model script was executed\n', applied=False)
    spec = importlib.util.spec_from_file_location('fixture_calibration_loader', ROOT / 'scripts/compile_clientrunner.py')
    child = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(child)
    child.load_calib(str(calib), 512, 8, journal=journal)
    hef = attempt.directory / 'model.hef'
    hef.write_bytes(b'FIXTURE ONLY HEF PLACEHOLDER; NOT SDK LOADABLE\n')
    journal.saved('hef', hef)
    ready = diagnostics.finalize(attempt, returncode=0, stdout='FIXTURE ONLY\nlast stdout\n',
                                 stderr='FIXTURE ONLY\nlast stderr\n')
    diagnostics.record_persistence(ready, {'status': 'local_only', 'destination': 'offline fixture directory',
                                         'verification': 'FIXTURE only; no Drive/R2 verification'})
    (root / 'latest-fixture.json').write_text(__import__('json').dumps({
        'evidence_kind': 'FIXTURE', 'manifest': str(ready.path.parent / 'manifest.json'),
        'zip': str(ready.path), 'sha256': ready.sha256, 'size_bytes': ready.size_bytes,
        'calibration_images': str(calib),
    }, indent=2) + '\n')
    return ready


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    ready = generate(args.out)
    print('FIXTURE ONLY manifest:', ready.path.parent / 'manifest.json')
    print('FIXTURE ONLY archive:', ready.path)
