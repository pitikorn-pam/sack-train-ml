"""One list of artifact kinds, five places that used to hold a copy of it.

They had already drifted, in both directions and with real consequences:

  * `contracts.py`'s Literal omitted `effective_config` while `train_for_run.py`
    uploaded exactly that kind;
  * `download-artifact`'s allow-list omitted its `.json` extension, so the third
    provenance layer could be written and never read;
  * `release.py`'s bundle-name map omitted it too, so it would have landed in a release
    bundle under a temp-file name;
  * `Models.tsx` never listed it, so no download button was rendered.

`contracts/param-schema.json::artifactKinds` is now the source. This test holds every
remaining copy to it — by reading each file as text, because four of the five are not
Python and none of them can be imported here.

    pytest tests/test_artifact_kinds.py
"""
from __future__ import annotations

import re
import typing
from pathlib import Path

import pytest

from sack_train_ml import contract
from sack_train_ml import contracts as contracts_module

ROOT = Path(__file__).resolve().parents[1]
SHARED_TS = ROOT / "supabase" / "functions" / "_shared" / "artifacts.ts"
DOWNLOAD_TS = ROOT / "supabase" / "functions" / "download-artifact" / "index.ts"
MODELS_TSX = ROOT / "apps" / "web" / "src" / "sections" / "Models.tsx"


@pytest.fixture(scope="module")
def kinds() -> dict[str, dict[str, str]]:
    return contract.artifact_kinds()


def test_the_schema_declares_every_kind_with_what_each_consumer_needs(kinds):
    assert kinds, "artifactKinds is empty"
    for kind, spec in kinds.items():
        for field in ("extension", "contentType", "bundleName"):
            assert spec.get(field), f"{kind} has no {field}"


def test_python_literal_matches_the_schema(kinds):
    literal = set(typing.get_args(contracts_module.ArtifactKind))
    assert literal == set(kinds), (
        "contracts.ArtifactKind and the schema disagree — a kind the pipeline uploads "
        "but the Literal omits type-checks as an error, and one it omits in the other "
        f"direction is unreachable. schema={sorted(kinds)} literal={sorted(literal)}"
    )


def test_shared_edge_module_matches_the_schema(kinds):
    src = SHARED_TS.read_text()

    declared = set(re.findall(r'"([a-z_]+)"', re.search(r"export type ArtifactKind =([^;]+);", src).group(1)))
    assert declared == set(kinds), f"_shared/artifacts.ts ArtifactKind: {sorted(declared)}"

    ext_block = re.search(r"ARTIFACT_EXTENSIONS[^{]*\{([^}]*)\}", src).group(1)
    extensions = dict(re.findall(r"(\w+):\s*\"([^\"]+)\"", ext_block))
    assert extensions == {k: v["extension"] for k, v in kinds.items()}

    ct_block = re.search(r"ARTIFACT_CONTENT_TYPES[^{]*\{([^}]*)\}", src).group(1)
    content_types = dict(re.findall(r"(\w+):\s*\"([^\"]+)\"", ct_block))
    assert content_types == {k: v["contentType"] for k, v in kinds.items()}


def test_the_download_allow_list_admits_every_extension_the_upload_path_writes(kinds):
    """The regression that made `effective_config` write-only, pinned."""
    src = DOWNLOAD_TS.read_text()
    key_re_src = re.search(r"const KEY_RE = /(.+)/;", src).group(1)
    key_re = re.compile(key_re_src.replace("\\/", "/"))
    for kind, spec in kinds.items():
        key = f"runs/abc-123/v1.0.0.{spec['extension']}"
        assert key_re.match(key), f"{kind} is uploadable but not downloadable: {key}"


def test_the_download_allow_list_still_refuses_what_it_should(kinds):
    src = DOWNLOAD_TS.read_text()
    key_re = re.compile(re.search(r"const KEY_RE = /(.+)/;", src).group(1).replace("\\/", "/"))
    for bad in ("runs/abc/../../etc/passwd.pt", "tools/hailo/wheel.whl", "runs/abc/x.exe"):
        assert not key_re.match(bad), f"should have been refused: {bad}"


def test_the_models_page_offers_a_download_for_every_kind(kinds):
    src = MODELS_TSX.read_text()
    listed = set(re.findall(r'"([a-z_]+)"', re.search(r"const artifactKinds = \[([^\]]+)\]", src).group(1)))
    assert listed == set(kinds), (
        "Models.tsx renders download buttons from its own list — a kind missing here is "
        f"uploaded, stored, downloadable, and invisible. listed={sorted(listed)}"
    )


def test_release_bundle_names_come_from_the_schema_not_a_copy():
    """release.py used to hold a fifth copy. It must now derive."""
    src = (ROOT / "src" / "sack_train_ml" / "release.py").read_text()
    assert "artifact_kinds()" in src, "release.py no longer derives its bundle names"
    assert '"best.pt"' not in src, "release.py still hard-codes a bundle name"
