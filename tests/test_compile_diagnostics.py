"""Offline evidence tests. Every SDK operation below is a fake, never a model run."""
from __future__ import annotations

import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
from types import SimpleNamespace
import zipfile

import numpy as np
from PIL import Image
import pytest

from sack_train_ml import compile_diagnostics as cd
from sack_train_ml import hailo_pipeline as hp

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('fixture_clientrunner', ROOT / 'scripts/compile_clientrunner.py')
child = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(child)


def images(root):
    root.mkdir(parents=True, exist_ok=True)
    for name, color in [('z.png', (255, 0, 0)), ('a.jpeg', (0, 255, 0)), ('m.jpg', (0, 0, 255))]:
        Image.new('RGB', (7, 3), color).save(root / name)
    return root


@pytest.fixture
def compile_fixture(tmp_path, monkeypatch):
    onnx = tmp_path / 'FIXTURE.onnx'
    onnx.write_bytes(b'FIXTURE NOT A VALID ONNX')
    calib = images(tmp_path / 'staging')
    calls, tensors = [], []
    state = {'failure': None}

    class Runner:
        def __init__(self, **kw): calls.append(('init', kw))
        def translate_onnx_model(self, *a, **kw): calls.append(('parse', kw))
        def save_har(self, path):
            stage = 'native' if Path(path).name == 'native.har' else 'quantized'
            Path(path).write_bytes(('FIXTURE ' + stage + ' HAR').encode())
            if state['failure'] == 'interrupted-' + stage:
                raise RuntimeError('interrupted save ' + stage)
            calls.append(('saved', stage))
        def load_model_script(self, script): calls.append(('script', script))
        def optimize(self, tensor):
            tensors.append(tensor.copy())
            if state['failure'] == 'optimize': raise RuntimeError('fixture optimize failed')
        def compile(self):
            if state['failure'] == 'compile': raise RuntimeError('fixture compile failed')
            return b'FIXTURE HEF'

    monkeypatch.setitem(sys.modules, 'hailo_sdk_client', SimpleNamespace(ClientRunner=Runner, __version__='fixture-sdk-1'))
    monkeypatch.setattr(child.metadata, 'version', lambda name: 'fixture-dfc-1')
    monkeypatch.setattr(child, 'detect_head', lambda *a, **kw: ('yolov11', 'detection', 'onchip', ['fixture-head']))
    monkeypatch.setattr(child, 'derive_bbox_decoders', lambda *a: [{'stride': s} for s in [8, 16, 32]])

    def fake_run(cmd, **kw):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            if state['failure'] == 'early':
                return subprocess.CompletedProcess(cmd, 1, 'fixture before import\nlast stdout\n', 'ModuleNotFoundError: fixture SDK\nlast stderr\n')
            with pytest.MonkeyPatch.context() as argv_patch:
                argv_patch.setattr(sys, 'argv', cmd[1:])
                try:
                    child.main()
                    rc = 0
                except Exception as exc:
                    print(str(exc), file=sys.stderr)
                    rc = 1
        return subprocess.CompletedProcess(cmd, rc, out.getvalue() + 'last stdout\n', err.getvalue() + 'last stderr\n')

    monkeypatch.setattr(hp.subprocess, 'run', fake_run)
    def compile(**kw):
        return hp.compile_onnx_to_hef(onnx, calib, tmp_path / 'durable', 'fixture_model', 'fake-python',
                                      input_size=8, calib_n=512, run_id='fixture-run', semver='1.2.3', **kw)
    return SimpleNamespace(compile=compile, state=state, onnx=onnx, calib=calib, calls=calls, tensors=tensors)


def verify_archive(archive):
    assert cd.digest(archive.path)['sha256'] == archive.sha256
    with zipfile.ZipFile(archive.path) as z:
        assert z.testzip() is None
        m = json.loads(z.read('manifest.json'))
        for stage, detail in m['stages'].items():
            if detail['status'] == 'completed' and stage != 'hef':
                data = z.read(detail['file'])
                assert hashlib.sha256(data).hexdigest() == detail['sha256']
                assert len(data) == detail['size_bytes']
        assert 'last stdout' in z.read('stdout.log').decode()
        assert 'last stderr' in z.read('stderr.log').decode()
        assert not any(n.endswith(('.hef', '.onnx', '.jpg', '.png', '.jpeg')) for n in z.namelist())
        return m, z.namelist()


def test_complete_compile_and_exact_calibration(compile_fixture):
    f = compile_fixture
    art = f.compile()
    m, members = verify_archive(art.diagnostics)
    assert m['outcome']['status'] == 'succeeded'
    assert m['stages']['full_precision']['status'] == 'not_used'
    assert m['sdk']['version'] == 'fixture-sdk-1'
    assert m['sdk_internal_settings']['value'] is None
    assert m['source_onnx']['sha256'] == hashlib.sha256(f.onnx.read_bytes()).hexdigest()
    assert m['stages']['hef']['sha256'] == hashlib.sha256(art.hef_path.read_bytes()).hexdigest()
    c = m['calibration']
    assert c['requested_count'] == 512 and c['actual_count'] == 3
    assert [r['name'] for r in c['selected']] == ['a.jpeg', 'm.jpg', 'z.png']
    for r in c['selected']:
        assert r['sha256'] == hashlib.sha256((f.calib / r['name']).read_bytes()).hexdigest()
    expected = np.stack([np.asarray(child.letterbox(Image.open(f.calib / n).convert('RGB'), 8), np.float32)
                         for n in ['a.jpeg', 'm.jpg', 'z.png']])
    np.testing.assert_array_equal(f.tensors[0], expected)
    assert 'model.alls' in members and 'nms_config.json' in members and 'calibration.json' in members
    assert m['model_script']['applied'] is True


@pytest.mark.parametrize('failure,completed', [('early', []), ('optimize', ['native']),
                         ('compile', ['native', 'quantized']), ('interrupted-native', []),
                         ('interrupted-quantized', ['native'])])
def test_partial_stages_are_successful_saves_only(compile_fixture, failure, completed):
    f = compile_fixture
    f.state['failure'] = failure
    with pytest.raises(cd.CompileFailure) as exc: f.compile()
    m, members = verify_archive(exc.value.archive)
    assert m['outcome']['status'] == 'partial'
    assert [s for s in ['native', 'quantized'] if m['stages'][s]['status'] == 'completed'] == completed
    for s in ['native', 'quantized']:
        assert (s + '.har' in members) == (s in completed)
    if failure == 'early':
        assert m['sdk']['version'] is None and m['sdk']['reason']
        assert m['calibration']['actual_count'] is None


def test_source_hash_mismatch_fails_before_sdk(compile_fixture):
    f = compile_fixture
    with pytest.raises(cd.CompileFailure, match='source ONNX hash mismatch') as exc:
        f.compile(source_onnx_sha='0' * 64)
    assert not f.calls
    with zipfile.ZipFile(exc.value.archive.path) as z:
        m = json.loads(z.read('manifest.json'))
        assert m['source_onnx']['sha256'] == hashlib.sha256(f.onnx.read_bytes()).hexdigest()
        assert m['stages']['native']['status'] != 'completed'


def test_unique_retries_survive_staging_cleanup(compile_fixture):
    f = compile_fixture
    a, b = f.compile().diagnostics, f.compile().diagnostics
    assert a.path != b.path
    original = a.path.read_bytes()
    shutil.rmtree(f.calib)
    verify_archive(a)
    assert a.path.read_bytes() == original
    assert (a.path.parent / 'native.har').read_bytes() == b'FIXTURE native HAR'


def test_finalization_failure_retains_directory_and_original_error(compile_fixture, monkeypatch):
    f = compile_fixture
    f.state['failure'] = 'optimize'
    monkeypatch.setattr(cd.zipfile.ZipFile, 'testzip', lambda self: 'native.har')
    with pytest.raises(cd.RetentionError) as exc: f.compile()
    assert 'optimize failed' in str(exc.value) and 'retention' in str(exc.value).lower()
    assert (exc.value.attempt_dir / 'native.har').exists()
    assert not (exc.value.attempt_dir / 'compile-diagnostics.zip').exists()


def test_redaction_and_immutable_zip_receipt(tmp_path):
    src = tmp_path / 'fixture.onnx'; src.write_bytes(b'fixture')
    a = cd.begin(tmp_path, run_id='r', semver='1', onnx=src, requested={'model': 'fixture'})
    logs = 'first\nAuthorization: Bearer secret-bearer\napi_key=dummy-key\nhttps://r2.test/object?X-Amz-Signature=dummy-sig&X-Amz-Credential=dummy-id\nknown-value\nlast\n'
    ready = cd.finalize(a, returncode=1, stdout=logs, stderr='stderr\n', known_secrets=['known-value'])
    original = ready.path.read_bytes()
    with zipfile.ZipFile(ready.path) as z:
        text = z.read('stdout.log').decode()
        for sentinel in ['secret-bearer', 'dummy-key', 'dummy-sig', 'dummy-id', 'known-value']: assert sentinel not in text
        assert 'first\n' in text and 'last\n' in text
    cd.record_persistence(ready, {'status': 'failed', 'error': 'token=dummy-key'})
    receipt = json.loads((ready.path.parent / 'persistence.json').read_text())
    assert receipt['archive']['sha256'] == ready.sha256 and receipt['status'] == 'failed'
    assert ready.path.read_bytes() == original

@pytest.mark.parametrize('sdk_failure,upload_failure', [(None, None), ('optimize', None),
                        ('compile', None), (None, 'compile_diagnostics'),
                        ('compile', 'compile_diagnostics'), (None, 'hef')])
def test_run_persists_diagnostic_independently(compile_fixture, monkeypatch, tmp_path, sdk_failure, upload_failure):
    sys.path.insert(0, str(ROOT / 'scripts'))
    import train_for_run as train
    from sack_train_ml.supabase_client import UploadedArtifact
    f = compile_fixture
    f.state['failure'] = sdk_failure
    attempted, uploads, local, steps = [], {}, {}, []
    wheel = tmp_path / 'tools' / Path(train.contract.dfc_wheel_key()).name
    wheel.parent.mkdir(); wheel.write_bytes(b'FIXTURE WHEEL')
    monkeypatch.setattr(train, 'REPO_ROOT', tmp_path)
    monkeypatch.setattr(hp, 'ensure_dfc_venv', lambda *a: 'fake-python')
    monkeypatch.setattr(hp, 'build_calib_dir', lambda *a, **k: f.calib)
    class Client:
        key = 'dummy-known-key'
        callback_secret = 'dummy-known-secret'
        def log_step(self, *args): steps.append(args)
        def upload_artifact(self, path, *, kind, run_id, semver, **kw):
            attempted.append((kind, semver, Path(path).read_bytes()))
            if kind == upload_failure: raise RuntimeError('fixture upload failed token=dummy-upload-secret')
            d = cd.digest(Path(path))
            return UploadedArtifact(kind, f'runs/{run_id}/{semver}.{train.contract.artifact_extension(kind)}',
                                    d['size_bytes'], 'sha256:' + d['sha256'])
    cfg = SimpleNamespace(compile_options={'compile_hef': True}, export_options={}, classes=['person','sack'], input_size=[8,8,3])
    reason = train._maybe_compile_hef(config=cfg, client=Client(), run_id='fixture-run', semver='1.2.3',
                onnx_path=f.onnx, onnx_sha='sha256:' + cd.digest(f.onnx)['sha256'],
                dataset_yaml=tmp_path / 'unused.yaml', save_dir=tmp_path / 'run', git_sha='fixture',
                uploads=uploads, retained_artifacts=local)
    assert ('compile_diagnostics' in uploads) == (upload_failure != 'compile_diagnostics')
    assert local['compile_diagnostics'].exists()
    diagnostic = next(a for a in attempted if a[0] == 'compile_diagnostics')
    assert diagnostic[1].startswith('1.2.3-compile-')
    receipt = json.loads((local['compile_diagnostics'].parent / 'persistence.json').read_text())
    assert receipt['status'] == ('failed' if upload_failure == 'compile_diagnostics' else 'uploaded')
    if receipt['status'] == 'uploaded': assert receipt['key'] == uploads['compile_diagnostics'].key
    if sdk_failure or upload_failure:
        assert reason
        if sdk_failure: assert sdk_failure in reason
        if upload_failure: assert 'upload failed' in reason
    else:
        assert reason is None
        assert uploads['hef'].key == 'runs/fixture-run/1.2.3.hef'
    if sdk_failure: assert not any(a[0] == 'hef' for a in attempted)
    assert 'dummy-upload-secret' not in json.dumps(receipt) + str(reason)


def test_missing_sdk_version_is_unknown(compile_fixture, monkeypatch):
    sys.modules['hailo_sdk_client'].__version__ = None
    monkeypatch.setattr(child.metadata, 'version', lambda *a: (_ for _ in ()).throw(child.metadata.PackageNotFoundError()))
    m, _ = verify_archive(compile_fixture.compile().diagnostics)
    assert m['sdk']['version'] is None and m['sdk']['reason']
    assert m['compiler']['version'] is None and m['compiler']['reason']


def test_launch_failure_still_has_logs_and_no_har(compile_fixture, monkeypatch):
    monkeypatch.setattr(hp.subprocess, 'run', lambda *a, **k: (_ for _ in ()).throw(OSError('fixture cannot launch')))
    with pytest.raises(cd.CompileFailure) as exc: compile_fixture.compile()
    with zipfile.ZipFile(exc.value.archive.path) as z:
        assert b'cannot launch' in z.read('stderr.log')
        assert not any(n.endswith('.har') for n in z.namelist())
        assert json.loads(z.read('manifest.json'))['outcome']['returncode'] is None


def test_journal_closes_and_archive_cannot_be_overwritten(tmp_path):
    src = tmp_path / 'fixture.onnx'; src.write_bytes(b'fixture')
    attempt = cd.begin(tmp_path, onnx=src, run_id=None, semver=None, requested={})
    ready = cd.finalize(attempt, returncode=1, stdout='one', stderr='two')
    original = ready.path.read_bytes()
    with pytest.raises(RuntimeError, match='finalized'): cd.attach(attempt.directory)
    with pytest.raises(cd.RetentionError, match='overwrite'): cd.finalize(attempt, returncode=0, stdout='new', stderr='new')
    assert ready.path.read_bytes() == original


def test_receipt_write_failure_is_surfaced(tmp_path, monkeypatch):
    src = tmp_path / 'fixture.onnx'; src.write_bytes(b'fixture')
    a = cd.begin(tmp_path, onnx=src, run_id=None, semver=None, requested={})
    ready = cd.finalize(a, returncode=1, stdout='', stderr='')
    monkeypatch.setattr(cd, '_json', lambda *a: (_ for _ in ()).throw(OSError('receipt disk full')))
    with pytest.raises(OSError, match='receipt disk full'): cd.record_persistence(ready, {'status': 'uploaded', 'key': 'runs/r/fixture.zip'})
    assert ready.path.exists()


def test_calibration_truncation_keeps_sorted_original_selection(compile_fixture):
    f = compile_fixture
    # Invoke only the unchanged calibration loader; never optimize a real input.
    attempt = cd.begin(f.onnx.parent / 'selection', onnx=f.onnx, run_id=None, semver=None, requested={'calib_n': 2})
    tensor = child.load_calib(str(f.calib), 2, 8, cd.attach(attempt.directory))
    c = json.loads((attempt.directory / 'calibration.json').read_text())
    assert c['actual_count'] == 2 and [r['name'] for r in c['selected']] == ['a.jpeg', 'm.jpg']
    assert tensor.dtype == np.float32 and tensor.shape == (2, 8, 8, 3)


def test_fixture_generator_is_offline_repeatable_and_hash_verifiable(tmp_path):
    spec = importlib.util.spec_from_file_location('fixture_generator', ROOT / 'scripts/generate_compile_diagnostics_fixture.py')
    generator = importlib.util.module_from_spec(spec); spec.loader.exec_module(generator)
    a, b = generator.generate(tmp_path), generator.generate(tmp_path)
    assert a.path != b.path
    m, _ = verify_archive(a)
    assert m['requested']['evidence_kind'] == 'FIXTURE'
    for row in m['calibration']['selected']:
        image = tmp_path / 'fixture-inputs/calibration' / row['name']
        Image.open(image).verify()
        assert cd.digest(image)['sha256'] == row['sha256']
    with zipfile.ZipFile(a.path) as z:
        assert json.loads(z.read('calibration.json')) == m['calibration']
        assert b'FIXTURE ONLY' in z.read('native.har')


@pytest.mark.parametrize('failure', [None, 'compile'])
def test_actual_diagnostic_bytes_are_in_release_bundle(compile_fixture, failure):
    from sack_train_ml.release import assemble_bundle, build_manifest
    f = compile_fixture; f.state['failure'] = failure
    try:
        archive = f.compile().diagnostics
    except cd.CompileFailure as exc:
        archive = exc.archive
    manifest = build_manifest('1.2.3', 'fixture', 'r', None, {}, {}, ['sack'], [8,8,3], 'detection', 'boxes')
    bundle = assemble_bundle(f.onnx.parent / 'release', {'compile_diagnostics': archive.path}, None, None, manifest)
    assert (bundle / 'compile-diagnostics.zip').read_bytes() == archive.path.read_bytes()
    shutil.rmtree(f.calib)
    with zipfile.ZipFile(bundle / 'compile-diagnostics.zip') as z:
        assert z.read('quantized.har') == b'FIXTURE quantized HAR'


@pytest.mark.parametrize('failure', [None, 'compile', 'early'])
def test_notebook_compile_cell_finalizes_before_assertion(compile_fixture, monkeypatch, failure):
    f = compile_fixture; f.state['failure'] = failure
    fake_child_run = hp.subprocess.run
    class Process:
        def __init__(self, cmd, **kw):
            cmd = [x for x in cmd if x != '-u']
            result = fake_child_run(cmd)
            self.returncode = result.returncode
            self.stdout = io.StringIO(result.stdout)
            self.stderr = io.StringIO(result.stderr)
        def wait(self, **kw): return self.returncode
    monkeypatch.setattr(subprocess, 'Popen', Process)
    monkeypatch.setattr(subprocess, 'run', lambda cmd, **kw: subprocess.CompletedProcess(
        cmd, 0, 'FIXTURE SDK preflight passed\n', ''))
    n = json.loads((ROOT / 'notebooks/compile_run.ipynb').read_text())
    scope = {'REPO_DIR': ROOT, 'Path': Path, 'WORK': str(f.onnx.parent / 'fake-Drive'),
             'ONNX_PATH': str(f.onnx), 'CALIB_DIR': str(f.calib), 'NET_NAME': 'fixture',
             'HW_ARCH': 'hailo8l', 'INPUT_SIZE': 8, 'NUM_CLASSES': 2, 'CALIB_N': 512,
             'NMS_SCORES_TH': .20, 'NMS_IOU_TH': .70, 'MAX_PER_CLASS': 50,
             'REG_LENGTH': 16, 'SOURCE_COMMIT': 'fixture-export', 'COMPILE_COMMIT': 'fixture-compile',
             'VENV': '/fixture', 'COMPILE_SCRIPT': ROOT / 'scripts/compile_clientrunner.py',
             'HEF_PATH': 'stale-hef-must-not-be-used'}
    code = ''.join(n['cells'][19]['source'])
    if failure:
        with pytest.raises(AssertionError, match='partial'): exec(compile(code, 'fixture-notebook', 'exec'), scope)
        assert scope['HEF_PATH'] is None
    else:
        exec(compile(code, 'fixture-notebook', 'exec'), scope)
        assert Path(scope['HEF_PATH']).parent == scope['ATTEMPT'].directory
    ready = scope['DIAGNOSTICS']
    m, _ = verify_archive(ready)
    assert m['requested']['source_export_commit'] == 'fixture-export'
    assert m['requested']['compile_commit'] == 'fixture-compile'
    assert (ready.path.parent / 'persistence.json').exists()
    assert m['outcome']['status'] == ('partial' if failure else 'succeeded')


@pytest.mark.parametrize('failure', [None, 'compile', 'preflight'])
def test_cli_prints_retained_path_without_storage(compile_fixture, monkeypatch, capsys, failure):
    spec = importlib.util.spec_from_file_location('fixture_compile_cli', ROOT / 'scripts/compile_hef.py')
    cli = importlib.util.module_from_spec(spec); spec.loader.exec_module(cli)
    f = compile_fixture
    f.state['failure'] = 'compile' if failure == 'compile' else None
    def bootstrap(*args):
        if failure == 'preflight': raise RuntimeError('fixture bootstrap failed')
        return 'fake-python'
    monkeypatch.setattr(cli, 'ensure_dfc_venv', bootstrap)
    rc = cli.main(['--onnx', str(f.onnx), '--wheel', 'fixture.whl', '--calib-dir', str(f.calib),
                   '--out-dir', str(f.onnx.parent / 'cli'), '--size', '8'])
    logs = capsys.readouterr()
    assert rc == (1 if failure else 0)
    assert 'compile-diagnostics.zip' in logs.out + logs.err
    archive_path = next((f.onnx.parent / 'cli').glob('compile-attempts/*/compile-diagnostics.zip'))
    with zipfile.ZipFile(archive_path) as z:
        m = json.loads(z.read('manifest.json'))
        assert m['outcome']['status'] == ('partial' if failure else 'succeeded')
        if failure == 'preflight': assert not any(n.endswith('.har') for n in z.namelist())


def test_known_secrets_and_auth_fields_never_enter_manifest(tmp_path):
    src=tmp_path/'fixture.onnx';src.write_bytes(b'fixture')
    a=cd.begin(tmp_path, onnx=src, run_id='r', semver='1',
               requested={'note': 'dummy-known-secret', 'authorization': 'dummy-auth',
                          'nested': {'api_key': 'dummy-api', 'link': 'https://fixture.invalid/?sig=dummy-signed'}},
               known_secrets=('dummy-known-secret',))
    ready=cd.finalize(a,returncode=1,stdout='dummy-known-secret',stderr='')
    with zipfile.ZipFile(ready.path) as z:
        data=z.read('manifest.json').decode()+z.read('stdout.log').decode()
        for secret in ['dummy-known-secret','dummy-auth','dummy-api','dummy-signed']:assert secret not in data
        assert 'authorization' not in json.loads(z.read('manifest.json'))['requested']


def test_zero_exit_without_journaled_stages_is_partial(compile_fixture,monkeypatch):
    monkeypatch.setattr(hp.subprocess,'run',lambda cmd,**kw:subprocess.CompletedProcess(cmd,0,'exit zero',''))
    with pytest.raises(cd.CompileFailure,match='without completed stage evidence') as exc:compile_fixture.compile()
    with zipfile.ZipFile(exc.value.archive.path) as z:
        assert json.loads(z.read('manifest.json'))['outcome']['status']=='partial'
        assert not any(n.endswith('.har') for n in z.namelist())


def test_changed_stage_bytes_cannot_be_archived_as_complete(tmp_path):
    src=tmp_path/'fixture.onnx';src.write_bytes(b'fixture')
    a=cd.begin(tmp_path,onnx=src,run_id=None,semver=None,requested={})
    native=a.directory/'native.har';native.write_bytes(b'complete-fixture')
    cd.attach(a.directory).saved('native',native)
    native.write_bytes(b'changed')
    with pytest.raises(cd.RetentionError,match='bytes changed'):cd.finalize(a,returncode=1,stdout='',stderr='')
    assert native.read_bytes()==b'changed' and not (a.directory/'compile-diagnostics.zip').exists()


@pytest.mark.parametrize('failure', [None, 'compile', 'diagnostic-upload', 'diagnostic-receipt', 'compile-and-receipt', 'archive'])
def test_mocked_run_main_retains_zip_and_metadata_without_real_pipeline(compile_fixture, monkeypatch, failure):
    """Every training/export/eval/SDK/storage/status operation is an offline mock."""
    sys.path.insert(0,str(ROOT/'scripts'))
    import train_for_run as train
    from sack_train_ml.supabase_client import UploadedArtifact
    f=compile_fixture;f.state['failure']='compile' if failure in ('compile','compile-and-receipt','archive') else None
    if failure in ('diagnostic-receipt','compile-and-receipt'):
        monkeypatch.setattr(cd,'record_persistence',lambda *a,**kw:(_ for _ in ()).throw(OSError('fixture receipt disk full')))
    if failure=='archive':
        monkeypatch.setattr(cd.zipfile.ZipFile,'testzip',lambda *a:'native.har')
    root=f.onnx.parent/'fake-run-repo'
    wheel=root/'tools'/Path(train.contract.dfc_wheel_key()).name
    wheel.parent.mkdir(parents=True);wheel.write_bytes(b'FIXTURE WHEEL')
    save=root/'runs/fixture-run';(save/'weights').mkdir(parents=True)
    (save/'weights/best.pt').write_bytes(b'FIXTURE PT NOT A MODEL')
    cfg=SimpleNamespace(compile_options={'compile_hef':True},export_options={},classes=['person','sack'],
                         input_size=[8,8,3],hyperparameters={},source_weights='fixture',dataset_source=None,
                         task='detection',output_kind='detection-boxes')
    versions,states,errors=[],[],[]
    class Client:
        key='dummy-key';callback_secret='dummy-secret'
        def load_run_config(self,*a,**kw):return cfg,{'model_line_id':'fixture-line'}
        def mark_running(self,*a):states.append('running-mock')
        def log_step(self,*a):pass
        def upload_artifact(self,path,*,kind,run_id,semver,**kw):
            if kind=='compile_diagnostics' and failure=='diagnostic-upload':raise RuntimeError('fixture upload failure')
            identity=cd.digest(Path(path))
            return UploadedArtifact(kind,f'runs/{run_id}/{semver}.{train.contract.artifact_extension(kind)}',
                                    identity['size_bytes'],'sha256:'+identity['sha256'])
        def create_version(self,**kw):versions.append(kw);return {'semver':kw['semver'],'id':'fixture-version'}
        def finalize_run(self,*a,**kw):
            states.append(kw['status']);errors.append(kw.get('error',''))
    monkeypatch.setattr(train,'RegistryClient',Client)
    monkeypatch.setattr(train,'REPO_ROOT',root)
    monkeypatch.setattr(train,'_current_git_sha',lambda *a:'fixture-commit')
    monkeypatch.setattr(train,'check_toolchain',lambda *a:{})
    monkeypatch.setattr(train.contract,'check_run_hyperparameters',lambda *a:[])
    monkeypatch.setattr(train,'_materialize_dataset',lambda *a:root/'fixture.yaml')
    monkeypatch.setattr(train,'validate_dataset',lambda *a:SimpleNamespace(train_images=3,val_images=3))
    monkeypatch.setattr(train,'train_yolo',lambda **kw:SimpleNamespace(trainer=SimpleNamespace(save_dir=save,args=SimpleNamespace())))
    effective=save/'effective-config.json';effective.write_text('{}')
    monkeypatch.setattr(train,'_write_effective_config',lambda *a:effective)
    monkeypatch.setattr(train,'_eval_fp32',lambda *a:{})
    monkeypatch.setattr(train,'export_onnx',lambda *a,**kw:f.onnx)
    monkeypatch.setattr(hp,'ensure_dfc_venv',lambda *a:'fake-python')
    monkeypatch.setattr(hp,'build_calib_dir',lambda *a,**kw:f.calib)
    rc=train.main(['--run-id','fixture-run'])
    assert rc==(1 if failure else 0)
    assert states==['running-mock','failed' if failure else 'succeeded']
    assert len(versions)==1
    version=versions[0]
    assert version['semver']=='1.0.0-fixture-'
    if failure=='archive':
        assert 'compile_diagnostics' not in version['metadata'] and 'compile_diagnostics' not in version['artifacts']
        attempt=next((save/'hef/compile-attempts').iterdir())
        assert (attempt/'native.har').read_bytes()==b'FIXTURE native HAR'
        assert not (attempt/'compile-diagnostics.zip').exists()
        assert 'compile failed' in errors[-1] and 'retention failed' in errors[-1]
        return
    if failure in ('diagnostic-receipt','compile-and-receipt'):
        assert 'receipt failed' in errors[-1]
        if failure=='compile-and-receipt':assert 'fixture compile failed' in errors[-1]
    m=version['metadata']['compile_diagnostics']
    local=Path(m['local_path'])
    assert local.read_bytes()==(save/'release/compile-diagnostics.zip').read_bytes()
    assert m['sha256']==cd.digest(local)['sha256']
    assert (m['key'] is None)==(failure=='diagnostic-upload')
    if m['key'] is not None:assert m['key']==version['artifacts']['compile_diagnostics'].key
    assert 'pytorch' in version['artifacts'] and 'onnx' in version['artifacts']


# Correction regressions: actual source/caller execution with fake SDK/subprocess only.
def _correction_notebook_scope(f):
    return {'REPO_DIR': ROOT, 'Path': Path, 'WORK': str(f.onnx.parent / 'correction-Drive'),
            'ONNX_PATH': str(f.onnx), 'CALIB_DIR': str(f.calib), 'NET_NAME': 'fixture',
            'HW_ARCH': 'hailo8l', 'INPUT_SIZE': 8, 'NUM_CLASSES': 2, 'CALIB_N': 512,
            'NMS_SCORES_TH': .20, 'NMS_IOU_TH': .70, 'MAX_PER_CLASS': 50,
            'REG_LENGTH': 16, 'SOURCE_COMMIT': 'fixture-export', 'COMPILE_COMMIT': 'fixture-compile',
            'VENV': '/fixture', 'COMPILE_SCRIPT': ROOT / 'scripts/compile_clientrunner.py',
            'ATTEMPT': 'OLD_ATTEMPT', 'ATTEMPT_DIR': 'OLD_ATTEMPT_DIR', 'OUT_HEF': 'OLD_OUT_HEF',
            'HEF_PATH': 'OLD_HEF', 'DIAGNOSTICS': 'OLD_DIAGNOSTICS.zip',
            'r': SimpleNamespace(returncode=0, stdout='OLD cached preflight', stderr='')}


def _correction_cell(index, scope):
    n = json.loads((ROOT / 'notebooks/compile_run.ipynb').read_text())
    exec(compile(''.join(n['cells'][index]['source']), f'correction-notebook-cell-{index}', 'exec'), scope)


def _correction_fake_notebook(f, monkeypatch, *, preflight_rc=0):
    child_run = hp.subprocess.run
    events = []
    begin, finalize = cd.begin, cd.finalize
    def tracked_begin(*args, **kwargs):
        events.append('begin')
        return begin(*args, **kwargs)
    def tracked_finalize(*args, **kwargs):
        events.append('finalize')
        return finalize(*args, **kwargs)
    def preflight(cmd, **kwargs):
        assert '-c' in cmd, 'only fake SDK preflight is permitted here'
        events.append('preflight')
        return subprocess.CompletedProcess(cmd, preflight_rc, 'FIXTURE preflight stdout\n',
                                           'FIXTURE SDK unavailable\n' if preflight_rc else '')
    class Process:
        def __init__(self, cmd, **kwargs):
            events.append('compile')
            result = child_run([part for part in cmd if part != '-u'])
            self.stdout, self.stderr = io.StringIO(result.stdout), io.StringIO(result.stderr)
            self.returncode = result.returncode
        def wait(self, **kwargs): return self.returncode
    monkeypatch.setattr(cd, 'begin', tracked_begin)
    monkeypatch.setattr(cd, 'finalize', tracked_finalize)
    monkeypatch.setattr(subprocess, 'run', preflight)
    monkeypatch.setattr(subprocess, 'Popen', Process)
    return events


@pytest.mark.parametrize('failure', ['begin', 'finalize', 'import'])
def test_correction_notebook_clears_handles_before_failure(compile_fixture, monkeypatch, failure):
    f = compile_fixture
    scope = _correction_notebook_scope(f)
    _correction_fake_notebook(f, monkeypatch)
    if failure == 'begin':
        monkeypatch.setattr(cd, 'begin', lambda *a, **k: (_ for _ in ()).throw(OSError('FIXTURE begin failure')))
    elif failure == 'finalize':
        monkeypatch.setattr(cd, 'finalize', lambda *a, **k: (_ for _ in ()).throw(OSError('FIXTURE finalize failure')))
    else:
        import builtins
        real_import = builtins.__import__
        def fail_import(name, *args, **kwargs):
            if name == 'sack_train_ml.compile_diagnostics': raise ImportError('FIXTURE helper import failure')
            return real_import(name, *args, **kwargs)
        monkeypatch.setattr(builtins, '__import__', fail_import)
    with pytest.raises((OSError, ImportError)):
        _correction_cell(19, scope)
    assert scope['HEF_PATH'] is None and scope['DIAGNOSTICS'] is None
    for handle in ['ATTEMPT', 'ATTEMPT_DIR', 'OUT_HEF']:
        assert not str(scope[handle]).startswith('OLD_')
        if failure in ('begin', 'import'): assert scope[handle] is None


@pytest.mark.parametrize('failure', ['begin', 'finalize', 'preflight'])
def test_correction_failed_retry_cannot_reuse_success(compile_fixture, monkeypatch, failure):
    f = compile_fixture
    scope = _correction_notebook_scope(f)
    _correction_fake_notebook(f, monkeypatch)
    _correction_cell(19, scope)
    old_zip, old_hef = scope['DIAGNOSTICS'].path, Path(scope['HEF_PATH'])
    old_bytes = old_zip.read_bytes()
    if failure == 'begin':
        monkeypatch.setattr(cd, 'begin', lambda *a, **k: (_ for _ in ()).throw(OSError('FIXTURE retry begin failure')))
    elif failure == 'finalize':
        monkeypatch.setattr(cd, 'finalize', lambda *a, **k: (_ for _ in ()).throw(OSError('FIXTURE retry finalize failure')))
    else:
        monkeypatch.setattr(subprocess, 'run', lambda cmd, **kw: subprocess.CompletedProcess(cmd, 1, '', 'FIXTURE retry preflight failed\n'))
    with pytest.raises((OSError, AssertionError)):
        _correction_cell(19, scope)
    assert scope['HEF_PATH'] is None
    if failure != 'preflight': assert scope['DIAGNOSTICS'] is None
    else: assert scope['DIAGNOSTICS'].path != old_zip
    assert old_zip.read_bytes() == old_bytes and old_hef.exists()


def test_correction_sdk_preflight_is_retained_and_fresh(compile_fixture, monkeypatch):
    f = compile_fixture
    scope = _correction_notebook_scope(f)
    events = _correction_fake_notebook(f, monkeypatch, preflight_rc=1)
    _correction_cell(13, scope)  # Preparation cell must not block outside retention.
    assert events == []
    with pytest.raises(AssertionError, match='partial'):
        _correction_cell(19, scope)
    assert events == ['begin', 'preflight', 'finalize']
    assert scope['HEF_PATH'] is None and not f.calls
    archive = scope['DIAGNOSTICS']
    with zipfile.ZipFile(archive.path) as z:
        m = json.loads(z.read('manifest.json'))
        assert m['outcome']['status'] == 'partial' and m['outcome']['returncode'] == 1
        assert b'FIXTURE SDK unavailable' in z.read('stderr.log')
        assert b'FIXTURE preflight stdout' in z.read('stdout.log')
        assert not any(name.endswith('.har') for name in z.namelist())
    assert archive.path.parent != Path('OLD_ATTEMPT_DIR')


def test_correction_sdk_attribute_does_not_measure_compiler(tmp_path):
    src = tmp_path / 'fixture.onnx'; src.write_bytes(b'FIXTURE')
    attempt = cd.begin(tmp_path, onnx=src, run_id=None, semver=None, requested={})
    cd.attach(attempt.directory).inputs(sdk_version='client-attr-only')
    m = json.loads((attempt.directory / 'manifest.json').read_text())
    assert m['sdk']['version'] == 'client-attr-only'
    assert m['compiler']['version'] is None and m['compiler']['reason']


@pytest.mark.parametrize('sdk_version,compiler_version', [('fixture-sdk-attr', 'fixture-dfc-distribution'),
                                                        ('fixture-sdk-only', None), (None, None),
                                                        (None, 'fixture-dfc-only')])
def test_correction_versions_have_independent_evidence(compile_fixture, monkeypatch, sdk_version, compiler_version):
    sys.modules['hailo_sdk_client'].__version__ = sdk_version
    measured = []
    def version(name):
        measured.append(name)
        assert name == 'hailo_dataflow_compiler'
        if compiler_version is None: raise child.metadata.PackageNotFoundError(name)
        return compiler_version
    monkeypatch.setattr(child.metadata, 'version', version)
    m, _ = verify_archive(compile_fixture.compile().diagnostics)
    assert measured == ['hailo_dataflow_compiler']
    assert m['sdk']['version'] == sdk_version and m['compiler']['version'] == compiler_version
    assert m['sdk']['source'] == 'hailo_sdk_client.__version__'
    assert m['compiler']['source'] == 'importlib.metadata.version(hailo_dataflow_compiler)'
    for key, value in [('sdk', sdk_version), ('compiler', compiler_version)]:
        assert (m[key]['reason'] is not None) == (value is None)


def test_correction_fixture_versions_are_unmeasured(tmp_path):
    spec = importlib.util.spec_from_file_location('corrected_fixture_generator', ROOT / 'scripts/generate_compile_diagnostics_fixture.py')
    generator = importlib.util.module_from_spec(spec); spec.loader.exec_module(generator)
    archive = generator.generate(tmp_path)
    with zipfile.ZipFile(archive.path) as z:
        m = json.loads(z.read('manifest.json'))
        assert m['evidence_kind'] == 'FIXTURE'
        for key in ['sdk', 'compiler']:
            assert m[key]['version'] is None and 'FIXTURE' in m[key]['reason']
            assert m[key]['source'] is None


def _correction_native_attempt(tmp_path):
    src = tmp_path / 'fixture.onnx'; src.write_bytes(b'FIXTURE')
    attempt = cd.begin(tmp_path, onnx=src, run_id=None, semver=None, requested={'calib_n': 512})
    native = attempt.directory / 'native.har'; native.write_bytes(b'FIXTURE native HAR')
    journal = cd.attach(attempt.directory); journal.saved('native', native)
    selected = [{'name': 'fixture.jpg', 'sha256': hashlib.sha256(b'fixture').hexdigest(), 'size_bytes': 7}]
    return attempt, journal, selected


def test_correction_uncommitted_calibration_fails_closed(compile_fixture, monkeypatch):
    f = compile_fixture
    attempt, journal, selected = _correction_native_attempt(f.onnx.parent)
    real_json = cd._json
    with monkeypatch.context() as patch:
        def interrupted(path, value):
            if path.name == 'manifest.json': raise OSError('FIXTURE interrupted calibration commit')
            real_json(path, value)
        patch.setattr(cd, '_json', interrupted)
        with pytest.raises(OSError, match='interrupted'):
            journal.calibration(selected, requested_count=512, preprocessing={'fixture': True})
    raw = (attempt.directory / 'calibration.json').read_bytes()
    assert json.loads(raw)['actual_count'] == 1
    assert json.loads((attempt.directory / 'manifest.json').read_text())['calibration']['actual_count'] is None
    with pytest.raises(cd.RetentionError, match='uncommitted calibration'):
        cd.finalize(attempt, returncode=1, stdout='FIXTURE stdout', stderr='FIXTURE interrupted commit')
    assert (attempt.directory / 'calibration.json').read_bytes() == raw
    assert (attempt.directory / 'native.har').read_bytes() == b'FIXTURE native HAR'
    assert not (attempt.directory / 'compile-diagnostics.zip').exists()


@pytest.mark.parametrize('tamper', ['bytes', 'contradiction', 'missing'])
def test_correction_committed_calibration_tampering_fails_closed(tmp_path, tamper):
    attempt, journal, selected = _correction_native_attempt(tmp_path)
    journal.calibration(selected, requested_count=512, preprocessing={'fixture': True})
    path = attempt.directory / 'calibration.json'
    if tamper == 'missing': path.unlink()
    elif tamper == 'bytes': path.write_bytes(path.read_bytes() + b' ')
    else:
        c = json.loads(path.read_text()); c['actual_count'] = 99
        path.write_text(json.dumps(c))
        # Consistency must be checked even if an external edit also changes the identity.
        mpath = attempt.directory / 'manifest.json'; m = json.loads(mpath.read_text())
        if 'calibration_file' in m: m['calibration_file'].update(cd.digest(path))
        mpath.write_text(json.dumps(m))
    raw = path.read_bytes() if path.exists() else None
    with pytest.raises(cd.RetentionError, match='calibration'):
        cd.finalize(attempt, returncode=1, stdout='FIXTURE stdout', stderr='FIXTURE failure')
    assert (path.read_bytes() if path.exists() else None) == raw
    assert (attempt.directory / 'native.har').read_bytes() == b'FIXTURE native HAR'
    assert not (attempt.directory / 'compile-diagnostics.zip').exists()


def test_correction_calibration_member_matches_committed_identity(compile_fixture):
    m, _ = verify_archive(compile_fixture.compile().diagnostics)
    file_identity = m['calibration_file']
    assert file_identity['status'] == 'committed'
    # Inspect actual ZIP member bytes, not only journal flags.
    with zipfile.ZipFile(next((compile_fixture.onnx.parent / 'durable').glob('compile-attempts/*/compile-diagnostics.zip'))) as z:
        data = z.read(file_identity['file'])
        assert len(data) == file_identity['size_bytes']
        assert hashlib.sha256(data).hexdigest() == file_identity['sha256']
        assert json.loads(data) == m['calibration']


@pytest.mark.parametrize('where', ['begin', 'finalize'])
def test_correction_receipt_boundary_redacts_known_values(tmp_path, where):
    from dataclasses import asdict
    sentinel = 'FIXTURE_PRIVATE_VALUE_7Gq9'
    src = tmp_path / 'fixture.onnx'; src.write_bytes(b'FIXTURE')
    attempt = cd.begin(tmp_path, onnx=src, run_id=None, semver=None, requested={},
                       known_secrets=(sentinel,) if where == 'begin' else ())
    ready = cd.finalize(attempt, returncode=1, stdout=sentinel, stderr=sentinel, error=sentinel,
                        known_secrets=(sentinel,) if where == 'finalize' else ())
    original = ready.path.read_bytes()
    cd.record_persistence(ready, {'status': 'failed', 'error': 'upload failed ' + sentinel,
                                 'nested': [{'detail': sentinel, 'link': 'https://fixture.invalid/' + sentinel},
                                            {'link': 'https://fixture.invalid/?signature=' + sentinel}]})
    receipt = (ready.path.parent / 'persistence.json').read_text()
    assert sentinel not in receipt
    assert json.loads(receipt)['error'] == 'upload failed [REDACTED]'
    public = json.dumps(asdict(ready), default=str) + repr(ready) + json.dumps(vars(ready), default=str)
    assert sentinel not in public
    with zipfile.ZipFile(ready.path) as z:
        for name in ['manifest.json', 'stdout.log', 'stderr.log']: assert sentinel.encode() not in z.read(name)
    assert ready.path.read_bytes() == original


@pytest.mark.parametrize('parse_failed', [False, True])
def test_correction_explicit_options_are_supplied_not_observed(compile_fixture, monkeypatch, parse_failed):
    f = compile_fixture
    old_runner = sys.modules['hailo_sdk_client'].ClientRunner
    class Runner(old_runner):
        def translate_onnx_model(self, *args, **kwargs):
            f.calls.append(('parse', kwargs))
            if parse_failed: raise RuntimeError('FIXTURE rejected supplied nodes')
    monkeypatch.setattr(sys.modules['hailo_sdk_client'], 'ClientRunner', Runner)
    detection = []
    def graph(*args, **kwargs):
        detection.append(kwargs)
        return 'yolov11', 'detection', 'onchip', ['graph-derived-candidate']
    monkeypatch.setattr(child, 'detect_head', graph)
    attempt = cd.begin(f.onnx.parent / 'override', onnx=f.onnx, run_id=None, semver=None, requested={})
    cmd = ['fixture-child', '--onnx', str(f.onnx), '--calib', str(f.calib), '--out', str(attempt.directory / 'model.hef'),
           '--work', str(attempt.directory), '--attempt-dir', str(attempt.directory), '--size', '8',
           '--start-node', 'caller-input', '--end-nodes', 'caller-a,caller-b', '--nms', 'raw']
    monkeypatch.setattr(sys, 'argv', cmd)
    if parse_failed:
        with pytest.raises(RuntimeError, match='rejected supplied'): child.main()
    else: child.main()
    m = json.loads((attempt.directory / 'manifest.json').read_text())
    assert m['observed_model']['family'] == 'yolov11' and m['observed_model']['task'] == 'detection'
    assert m['observed_model']['source'] == 'detect_head ONNX graph'
    for key in ['start_node', 'end_nodes', 'nms']: assert key not in m['observed_model']
    assert m['requested']['parse_options'] == {'start_node': 'caller-input', 'end_nodes': ['caller-a', 'caller-b'], 'nms': 'raw'}
    assert m['supplied_options']['start_node']['value'] == 'caller-input'
    assert m['supplied_options']['end_nodes']['value'] == ['caller-a', 'caller-b']
    assert m['supplied_options']['nms']['value'] == 'raw'
    for key in ['start_node', 'end_nodes', 'nms']:
        assert m['supplied_options'][key]['classification'] == 'supplied'
        assert m['supplied_options'][key]['observed'] is False
    actual_parse = next(call[1] for call in f.calls if call[0] == 'parse')
    assert actual_parse['start_node_names'] == ['caller-input'] and actual_parse['end_node_names'] == ['caller-a', 'caller-b']
    assert detection == [{'verify_end_nodes': False}]
    assert m['stages']['native']['status'] == ('not_completed' if parse_failed else 'completed')
