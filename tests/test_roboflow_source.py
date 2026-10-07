from pathlib import Path

def test_local_import_endpoint_and_downloader_are_removed():
    root = Path(__file__).resolve().parents[1]
    assert not (root / 'apps/api/roboflow_import.py').exists()
    assert '/api/lab/datasets/roboflow' not in (root / 'apps/api/lab_server.py').read_text()

import io
import json
import sys
import traceback
import zipfile
from types import SimpleNamespace
from urllib.error import HTTPError, URLError
from email.message import Message
from urllib.parse import parse_qs, urlsplit
from unittest.mock import Mock

import pytest
from sack_train_ml import roboflow as rf
from sack_train_ml.contracts import RunConfig, ReleaseManifest
from sack_train_ml.supabase_client import RegistryClient, RegistryError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import train_for_run as train

SOURCE = dict(kind='roboflow', workspace='workspace', project='sack', version=2, format='yolov11')
COMMON = dict(source_weights='yolo11s.pt', input_size=[640,640,3], task='detection', output_kind='detection-boxes')
YAML = b'train: ../train/images\nval: ../valid/images\nnames: {1: sack, 0: "bag, white"}\nnc: 2\n'

class Response(io.BytesIO):
    def __init__(self, body, status=200):
        super().__init__(body)
        self.status = status

def archive(text=YAML, extra=None):
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w') as z:
        z.writestr('data.yaml', text)
        z.writestr('train/images/a.jpg', b'image')
        z.writestr('valid/images/a.jpg', b'image')
        if extra: z.writestr(*extra)
    return b.getvalue()

@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    monkeypatch.setattr(rf._OPENER, 'open', lambda *a, **kw: pytest.fail('real Roboflow network forbidden'))

@pytest.fixture
def prepared(tmp_path, monkeypatch):
    responses = [Response(b'{}', 202), Response(b'{"export":{"link":"https://app.roboflow.com/ds/example"}}'), Response(archive())]
    calls = []
    def fake(request, timeout):
        calls.append(request.full_url)
        return responses.pop(0)
    monkeypatch.setattr(rf._OPENER, 'open', fake)
    monkeypatch.setattr(rf.time, 'sleep', lambda _: None)
    root = rf.prepare_dataset(SOURCE, 'sentinel-secret', tmp_path / 'prepared')
    assert len(calls) == 3
    assert '/workspace/sack/2/yolov11?' in calls[0]
    return root

def test_direct_download_normalizes_yaml_and_stores_only_source_and_actual_names(prepared):
    data = rf.load_yaml((prepared/'data.yaml').read_text())
    assert data['train'] == 'train/images' and data['path'] == str(prepared)
    assert rf.ordered_classes(data) == ['bag, white', 'sack']
    assert json.loads((prepared/'.roboflow-source.json').read_text()) == SOURCE
    for p in prepared.rglob('*'):
        if p.is_file(): assert b'sentinel-secret' not in p.read_bytes()

@pytest.mark.parametrize('bad', [None, {}, {**SOURCE, 'api_key':'sentinel-secret'}, {**SOURCE,'version':True}, {**SOURCE,'version':0}, {**SOURCE,'version':1.5}, {**SOURCE,'format':[]}, {**SOURCE,'workspace':'../x'}])
def test_reference_validation_is_strict_and_safe(bad):
    with pytest.raises(ValueError) as e: rf.validate_source(bad)
    assert 'sentinel-secret' not in str(e.value)

@pytest.mark.parametrize('field,value', [
    ('workspace', 'sentinel-secret'),
    ('workspace', 'prefix-sentinel-secret-suffix'),
    ('project', 'sentinel-secret'),
    ('project', 'prefix-sentinel-secret-suffix'),
])
def test_known_source_credentials_rejected_before_download_staging_or_registry(field, value, tmp_path, monkeypatch):
    key = 'sentinel-secret'
    source = {**SOURCE, field: value}
    destination = tmp_path / 'fresh-parent' / 'prepared'
    responses = [Response(b'{"export":{"link":"https://app.roboflow.com/ds/x"}}'), Response(archive())]
    opener = Mock(side_effect=responses)
    staging = Mock(wraps=rf.tempfile.TemporaryDirectory)
    monkeypatch.setattr(rf, '_open', opener)
    monkeypatch.setattr(rf.tempfile, 'TemporaryDirectory', staging)
    client = RegistryClient(supabase_url='https://mock.invalid', service_role_key='mock', callback_secret='mock')
    fetch = Mock(return_value={'id': 'mock-run', 'config_yaml': {**COMMON, 'dataset_source': source}})
    update = Mock(return_value=[{'id': 'mock-run', 'config_yaml': {**COMMON, 'dataset_source': source, 'classes': ['bag, white', 'sack']}}])
    monkeypatch.setattr(client, 'fetch_run', fetch)
    monkeypatch.setattr(client, '_rest', update)
    with pytest.raises(ValueError) as error:
        root = rf.prepare_dataset(source, key, destination)
        client.load_run_config('mock-run', dataset_dir=str(root))
    message = ''.join(traceback.format_exception(error.value))
    assert key not in message and value not in message
    opener.assert_not_called()
    staging.assert_not_called()
    assert not destination.parent.exists()
    assert not destination.exists()
    assert not list(tmp_path.rglob('.roboflow-source.json'))
    assert not list(tmp_path.rglob('data.yaml'))
    fetch.assert_not_called()
    update.assert_not_called()

@pytest.mark.parametrize('names,nc', [([],0), ({1:'sack'},1), ({'0':'sack'},1), ({True:'sack'},1), (['sack'],2), (['sack'],True), ([''],1), ([3],1), (['sack','sack'],2)])
def test_never_invents_names_or_accepts_bad_ids_or_nc(names,nc):
    with pytest.raises(ValueError): rf.ordered_classes({'names':names,'nc':nc})

def test_list_names_retain_yaml_order_and_mapping_is_numeric_order():
    assert rf.ordered_classes({'names':['sack','person']}) == ['sack','person']
    assert rf.ordered_classes({'names':{1:'sack',0:'person'},'nc':2}) == ['person','sack']

@pytest.mark.parametrize('text', ['names: {0: first, 0: second}', 'names: [sack]\ndownload: malicious()', 'names: [sack]\napi_key: sentinel-secret', '!!python/object/apply:os.system [echo nope]'])
def test_unsafe_yaml_is_rejected_without_input_echo(text):
    with pytest.raises(ValueError) as e: rf.load_yaml(text)
    assert 'sentinel-secret' not in str(e.value)

@pytest.mark.parametrize('extra', [('../escape',b'x'),('/absolute',b'x'),('README',b'sentinel-secret'),('nested/data.yaml',YAML)])
def test_archive_boundaries(extra):
    with pytest.raises(ValueError): rf.validate_archive(io.BytesIO(archive(extra=extra)), 'sentinel-secret')

ESCAPED_KEY = ''.join(f'\\u{ord(c):04x}' for c in 'sentinel-secret')
DECODED_SECRET_YAMLS = [
    f'train: ../train/images\nval: ../valid/images\nnames: ["bag-{ESCAPED_KEY}-white"]\n',
    f'train: ../train/images\nval: ../valid/images\nnames: {{0: "{ESCAPED_KEY}"}}\n',
    YAML.decode() + f'metadata: {{nested: {{description: "prefix-{ESCAPED_KEY}-suffix"}}}}\n',
    YAML.decode() + f'metadata: {{nested: {{"{ESCAPED_KEY}": harmless}}}}\n',
    YAML.decode() + f'metadata: {{nested: [harmless, {{values: ["{ESCAPED_KEY}"]}}]}}\n',
]

@pytest.mark.parametrize('text', DECODED_SECRET_YAMLS)
def test_decoded_yaml_credentials_are_rejected_before_resolving_classes(text, monkeypatch):
    assert 'sentinel-secret' not in text
    key = 'sentinel-secret'
    classes = Mock(wraps=rf.ordered_classes)
    monkeypatch.setattr(rf, 'ordered_classes', classes)
    with pytest.raises(ValueError) as error:
        rf.validate_archive(io.BytesIO(archive(text.encode())), key)
    assert 'sentinel-secret' not in ''.join(traceback.format_exception(error.value))
    classes.assert_not_called()

@pytest.mark.parametrize('text', DECODED_SECRET_YAMLS)
def test_prepare_decoded_yaml_credentials_publish_nothing_and_never_update_registry(text, tmp_path, monkeypatch):
    key = 'sentinel-secret'
    responses = [Response(b'{"export":{"link":"https://app.roboflow.com/ds/x"}}'), Response(archive(text.encode()))]
    monkeypatch.setattr(rf._OPENER, 'open', lambda *a, **kw: responses.pop(0))
    client = RegistryClient(supabase_url='https://mock.invalid', service_role_key='mock', callback_secret='mock')
    monkeypatch.setattr(client, 'fetch_run', lambda _: {'id': 'mock-run', 'config_yaml': {**COMMON, 'dataset_source': SOURCE}})
    update = Mock(return_value=[{'id': 'mock-run', 'config_yaml': {**COMMON, 'dataset_source': SOURCE, 'classes': ['bag, white', 'sack']}}])
    monkeypatch.setattr(client, '_rest', update)
    with pytest.raises(ValueError) as error:
        root = rf.prepare_dataset(SOURCE, key, tmp_path / 'prepared')
        client.load_run_config('mock-run', dataset_dir=str(root))
    assert 'sentinel-secret' not in ''.join(traceback.format_exception(error.value))
    assert not (tmp_path / 'prepared').exists()
    assert not list(tmp_path.rglob('.roboflow-source.json'))
    assert not list(tmp_path.rglob('data.yaml'))
    update.assert_not_called()

@pytest.mark.parametrize('url', ['http://app.roboflow.com/a','https://127.0.0.1/a','https://roboflow.com.evil.test/a','https://user@api.roboflow.com/a','https://app.roboflow.com:444/a','file:///private'])
def test_safe_network_hosts(url):
    with pytest.raises(ValueError): rf.validate_url(url)

def test_redirect_to_untrusted_host_is_never_followed(monkeypatch):
    calls=[]
    def fake(req, timeout):
        calls.append(req.full_url)
        headers=Message(); headers['Location']='https://127.0.0.1/x?api_key=sentinel-secret'
        raise HTTPError(req.full_url,302,'redirect',headers,io.BytesIO())
    monkeypatch.setattr(rf._OPENER,'open',fake)
    with pytest.raises(ValueError): rf._open('https://app.roboflow.com/ds/x',rf.time.monotonic()+10)
    assert len(calls)==1

@pytest.mark.parametrize('name', ['api%5Fkey', '%61pi_key', 'api%5fkey', 'api_key'])
def test_encoded_cross_host_credentials_are_never_requested_or_echoed(name, monkeypatch):
    original = 'https://app.roboflow.com/ds/x'
    calls = []
    def fake(req, timeout):
        calls.append(req.full_url)
        if len(calls) == 1:
            headers = Message(); headers['Location'] = f'https://storage.googleapis.com/review-bucket/x?{name}=sentinel-secret'
            raise HTTPError(req.full_url, 302, 'sentinel-secret', headers, io.BytesIO())
        return Response(b'mock-export')
    monkeypatch.setattr(rf._OPENER, 'open', fake)
    with pytest.raises(ValueError) as error:
        rf._open(original, rf.time.monotonic() + 10)
    assert calls == [original]
    assert 'sentinel-secret' not in ''.join(traceback.format_exception(error.value))

@pytest.mark.parametrize('query', ['api%5Fkey=sentinel-secret', 'api_key=sentinel-secret', 'signed=x&%61pi_key=sentinel-secret', 'api%5Fkey'])
def test_initial_non_roboflow_export_credentials_are_never_requested(query, monkeypatch):
    opener = Mock(return_value=Response(b'mock-export'))
    monkeypatch.setattr(rf._OPENER, 'open', opener)
    with pytest.raises(ValueError) as error:
        rf._open(f'https://storage.googleapis.com/review-bucket/x?{query}', rf.time.monotonic() + 10)
    opener.assert_not_called()
    assert 'sentinel-secret' not in ''.join(traceback.format_exception(error.value))

def test_signed_export_links_and_roboflow_api_credentials_remain_supported(monkeypatch):
    original = 'https://api.roboflow.com/workspace/sack/2/yolov11?api_key=sentinel-secret'
    signed = 'https://storage.googleapis.com/review-bucket/x?X-Goog-Credential=mock&X-Goog-Signature=mock&note=api_key%3Dharmless'
    calls = []
    def fake(req, timeout):
        calls.append(req.full_url)
        if len(calls) == 1:
            headers = Message(); headers['Location'] = signed
            raise HTTPError(req.full_url, 302, 'redirect', headers, io.BytesIO())
        return Response(b'mock-export')
    monkeypatch.setattr(rf._OPENER, 'open', fake)
    with rf._open(original, rf.time.monotonic() + 10) as response:
        assert response.read() == b'mock-export'
    assert calls == [original, signed]

@pytest.mark.parametrize('failure', [URLError('sentinel-secret'), OSError('https://api.roboflow.com?api_key=sentinel-secret'), HTTPError('https://api.roboflow.com?api_key=sentinel-secret',401,'sentinel-secret',{},None)])
def test_transport_failures_suppress_secret_and_chained_traceback(failure,tmp_path,monkeypatch):
    def fail(*a,**kw): raise failure
    monkeypatch.setattr(rf._OPENER,'open',fail)
    key = 'sentinel-secret'
    with pytest.raises(ValueError) as error: rf.prepare_dataset(SOURCE,key,tmp_path/'data')
    assert 'sentinel-secret' not in ''.join(traceback.format_exception(error.value))
    assert not (tmp_path/'data').exists()

@pytest.mark.parametrize('key',['', 'bad key', '\n', 'x'*513])
def test_credential_failure_does_not_fetch(key,tmp_path):
    with pytest.raises(ValueError,match='Colab Secrets'): rf.prepare_dataset(SOURCE,key,tmp_path/'data')

def test_download_size_limit_is_sanitized_and_publishes_no_directory(tmp_path,monkeypatch):
    responses=[Response(b'{"export":{"link":"https://app.roboflow.com/ds/x"}}'),Response(b'too large')]
    monkeypatch.setattr(rf._OPENER,'open',lambda *a,**kw: responses.pop(0))
    monkeypatch.setattr(rf,'MAX_BUNDLE',1)
    with pytest.raises(ValueError): rf.prepare_dataset(SOURCE,'sentinel-secret',tmp_path/'data')
    assert not (tmp_path/'data').exists()

def test_runconfig_resolves_only_prepared_source_and_training_never_downloads_it(prepared):
    raw={**COMMON,'dataset_source':SOURCE}
    with pytest.raises(ValueError,match='Colab'): RunConfig.from_dict(raw)
    cfg=RunConfig.from_dict(raw,prepared_dataset_dir=str(prepared))
    assert cfg.classes==['bag, white','sack'] and cfg.dataset_source==SOURCE
    client=Mock()
    assert train._materialize_dataset(cfg,client,'run',str(prepared))==prepared/'data.yaml'
    client.download_dataset.assert_not_called()
    with pytest.raises(ValueError,match='Colab'): train._materialize_dataset(cfg,client,'run')

@pytest.mark.parametrize('extra',[{'dataset':'old.yaml'}, {'dataset_bundle':'old.zip'}, {'api_key':'sentinel-secret'}, {'classes':['wrong']}])
def test_conflicting_manual_fields_and_classes_are_refused(prepared,extra):
    with pytest.raises(ValueError): RunConfig.from_dict({**COMMON,'dataset_source':SOURCE,**extra},prepared_dataset_dir=str(prepared))

def test_conflicting_override_cannot_replace_selected_roboflow(prepared,tmp_path):
    other=tmp_path/'manual'; other.mkdir(); (other/'data.yaml').write_text('names: [other]')
    with pytest.raises(ValueError,match='does not match'): RunConfig.from_dict({**COMMON,'dataset_source':SOURCE},prepared_dataset_dir=str(other))
    (prepared/'.roboflow-source.json').write_text(json.dumps({**SOURCE,'version':3}))
    with pytest.raises(ValueError,match='does not match'): RunConfig.from_dict({**COMMON,'dataset_source':SOURCE},prepared_dataset_dir=str(prepared))

def test_manual_local_override_and_r2_yaml_remain_supported(tmp_path,monkeypatch):
    root=tmp_path/'local'; root.mkdir(); (root/'data.yaml').write_text('names: [sack]\ntrain: train/images\nval: valid/images')
    cfg=RunConfig.from_dict({**COMMON,'dataset':'datasets/line/run/data.yaml','classes':['sack']})
    client=Mock(); client.download_dataset.return_value='https://storage.example/yaml'
    assert train._materialize_dataset(cfg,client,'mock',str(root))==root/'data.yaml'
    client.download_dataset.assert_not_called()
    monkeypatch.setattr(train,'REPO_ROOT',tmp_path)
    import urllib.request
    monkeypatch.setattr(urllib.request,'urlopen',lambda *a,**kw:Response(b'names: [sack]'))
    path=train._materialize_dataset(cfg,client,'mock')
    client.download_dataset.assert_called_once_with(cfg.dataset)
    assert path.read_text()=='names: [sack]'

def test_manual_r2_bundle_compatibility(tmp_path,monkeypatch):
    cfg=RunConfig.from_dict({**COMMON,'dataset':'datasets/line/run/data.yaml','dataset_bundle':'datasets/line/run/data.zip','classes':['bag, white','sack']})
    client=Mock(); client.download_dataset.side_effect=lambda ref:ref
    monkeypatch.setattr(train,'REPO_ROOT',tmp_path)
    import urllib.request
    monkeypatch.setattr(urllib.request,'urlopen',lambda url,**kw:Response(archive() if url.endswith('.zip') else YAML))
    path=train._materialize_dataset(cfg,client,'mock')
    assert path.exists() and rf.ordered_classes(rf.load_yaml(path.read_text()))==cfg.classes
    assert client.download_dataset.call_count==2

def test_registry_checked_update_preserves_fields_and_happens_before_returning_config(prepared,monkeypatch):
    c=RegistryClient(supabase_url='https://mock.invalid',service_role_key='mock',callback_secret='mock')
    raw={**COMMON,'dataset_source':SOURCE,'hyperparameters':{'epochs':17},'run_name':'original'}
    monkeypatch.setattr(c,'fetch_run',lambda _: {'id':'run','config_yaml':raw})
    calls=[]
    def rest(method,path,body,extra_headers):
        calls.append((method,path,body,extra_headers))
        return [{'id':'run','config_yaml':body['config_yaml']}]
    monkeypatch.setattr(c,'_rest',rest)
    cfg,row=c.load_run_config('run',dataset_dir=str(prepared))
    method,path,body,headers=calls[0]
    assert method=='PATCH' and headers['Prefer']=='return=representation'
    assert json.loads(parse_qs(urlsplit(path).query)['config_yaml'][0][3:])==raw
    assert body['config_yaml']=={**raw,'classes':cfg.classes}
    assert 'dataset' not in body['config_yaml'] and 'sentinel-secret' not in json.dumps(body)
    monkeypatch.setattr(c,'_rest',lambda *a,**kw:[])
    with pytest.raises(RegistryError,match='Training has not started'): c.load_run_config('run',dataset_dir=str(prepared))

def test_registry_update_failure_never_reaches_running_or_training(prepared,monkeypatch):
    c=RegistryClient(supabase_url='https://mock.invalid',service_role_key='mock',callback_secret='mock')
    monkeypatch.setattr(c,'fetch_run',lambda _: {'id':'run','config_yaml':{**COMMON,'dataset_source':SOURCE}})
    def fail(*a,**kw): raise OSError('sentinel-secret')
    monkeypatch.setattr(c,'_rest',fail)
    running=Mock(); monkeypatch.setattr(c,'mark_running',running)
    with pytest.raises(RegistryError) as e: c.load_run_config('run',dataset_dir=str(prepared))
    assert 'sentinel-secret' not in ''.join(traceback.format_exception(e.value))
    running.assert_not_called()

def test_effective_and_release_metadata_include_source_and_resolved_names(prepared,tmp_path):
    cfg=RunConfig.from_dict({**COMMON,'dataset_source':SOURCE},prepared_dataset_dir=str(prepared))
    p=train._write_effective_config(tmp_path,cfg,SimpleNamespace(trainer=SimpleNamespace(args=SimpleNamespace(epochs=1))),{},'local')
    requested=json.loads(p.read_text())['requested']
    assert requested['classes']==cfg.classes and requested['dataset_source']==SOURCE
    manifest=ReleaseManifest(version='mock',model_name='sack',run_id='mock',git_sha='local',artifacts={},class_names=cfg.classes,dataset_source=cfg.dataset_source)
    release=json.loads(manifest.to_json())
    assert release['class_names']==cfg.classes and release['dataset_source']==SOURCE
    assert 'sentinel-secret' not in p.read_text()+manifest.to_json()
