# 03 — Every trainable model, and which ones can reach a Hailo-8L HEF

Research findings for ticket `issues/03-model-catalogue.md`.

Valid for **ultralytics 8.4.56** (`/Users/pitikorn/Work/BSCP/sack-train-ml/.venv/lib/python3.14/site-packages/ultralytics/__init__.py`), torch 2.12.0, onnx 1.21.0.
Compile-script behaviour is that of `scripts/compile_clientrunner.py` at the commit read on 2026-09-03.

## Headline

**46** detect/segment checkpoints are trainable by `model.train()` and are candidates for this dropdown.
Of those, **26** get past `detect_head()` today and **only 5** (`yolo11{n,s,m,l,x}.pt`, detection) get the correct on-chip NMS.
**20** fail outright at parse time because the detect head is not at `model.23`.

The single blocking fact: **the `/model.23/` prefix is hardcoded** (`scripts/compile_clientrunner.py:91-96`) and the head index is **not** `23` across families.

A second, smaller fact: the script's on-chip-NMS gate is **narrower than Hailo's own**.
Hailo compiles YOLOv8, YOLOv9c, YOLOv10 *and* YOLO11 with the same `meta_arch=yolov8` (§3c); this script grants it to YOLO11 only.

| family | head index | verified how |
|---|---|---|
| YOLOv8 (all tasks) | `model.22` | real ONNX export |
| YOLOv9 t/s/m/c | `model.22` | real ONNX export (t), module probe (s/m/c) |
| YOLOv9 e | `model.42` | module probe + ONNX export |
| YOLOv10 | `model.23` | real ONNX export |
| YOLO11 (all tasks) | `model.23` | real ONNX export |
| YOLO12 | `model.21` | real ONNX export |
| YOLO26 | `model.23` | real ONNX export |

Because the index is the only thing that varies in the *name*, this is a **small change**, not a large one — see [What would close the gap](#5-what-would-close-the-gap-question-3c).

---

## 1. The decision table (the deliverable)

Status vocabulary:

- `onchip-nms` — parses, and gets the correct `meta_arch=yolov8` on-chip NMS.
- `raw-decode` — parses and compiles, but with **no** on-chip NMS; decode must happen on the host.
- `needs-work` — the architecture is compatible in principle, but `detect_head()` aborts today (`SystemExit: derived end-nodes not found`). A hand-passed `--end-nodes` is the existing escape hatch (`compile_clientrunner.py:98-105,160`).
- `not-supported` — no DFL/`cv2`+`cv3` detect head at all; out of scope for this script's recipe.

The **Edge** column is the fact that actually decides deployability and is **not** part of the ticket's status vocabulary — it is added because it changes the recommendation. It records whether `sack-detector-edge` can decode the resulting HEF today.

### 1a. Detection — the rows that matter

| # | filename | family | task | params | trainable | Hailo-8L compile status | Edge decode | note |
|---|---|---|---|---|---|---|---|---|
| 1 | `yolo11n.pt` | YOLO11 | detect | 2.62 M | yes | `onchip-nms` ✅V | ✅ V | the reference path; head at `model.23`, 64-ch DFL box |
| 2 | `yolo11s.pt` | YOLO11 | detect | 9.46 M | yes | `onchip-nms` ✅V | ✅ V | **the deployed model** (v5_new) |
| 3 | `yolo11m.pt` | YOLO11 | detect | 20.11 M | yes | `onchip-nms` ✅V | ✅ V | same head, more capacity |
| 4 | `yolo11l.pt` | YOLO11 | detect | 25.37 M | yes | `onchip-nms` ✅V | ✅ V | large; Hailo-8L capacity risk (§3) |
| 5 | `yolo11x.pt` | YOLO11 | detect | 56.97 M | yes | `onchip-nms` ✅V | ✅ V | very large; Hailo-8L capacity risk (§3) |
| 6 | `yolo26n.pt` | YOLO26 | detect | 2.57 M | yes | `raw-decode` ✅V | ❌ **V** | 4-ch direct box, no DFL → on-chip yolov8 NMS invalid; **edge cannot decode** |
| 7 | `yolo26s.pt` | YOLO26 | detect | 10.01 M | yes | `raw-decode` ✅V | ❌ **V** | same |
| 8 | `yolo26m.pt` | YOLO26 | detect | 21.90 M | yes | `raw-decode` ✅V | ❌ **V** | same |
| 9 | `yolo26l.pt` | YOLO26 | detect | 26.30 M | yes | `raw-decode` I | ❌ V | structure identical to 26n (head `model.23`, `one2one_`) |
| 10 | `yolo26x.pt` | YOLO26 | detect | 58.99 M | yes | `raw-decode` I | ❌ V | same |
| 11 | `yolov10n.pt` | YOLOv10 | detect | 2.78 M | yes | `raw-decode` ✅V | ⚠️ I | parses, but **misidentified as `family=yolo26`**; box IS 64-ch DFL so on-chip is achievable (§5) |
| 12 | `yolov10s.pt` | YOLOv10 | detect | 8.13 M | yes | `raw-decode` I | ⚠️ I | same |
| 13 | `yolov10m.pt` | YOLOv10 | detect | 16.58 M | yes | `raw-decode` I | ⚠️ I | same |
| 14 | `yolov10b.pt` | YOLOv10 | detect | 20.57 M | yes | `raw-decode` I | ⚠️ I | same |
| 15 | `yolov10l.pt` | YOLOv10 | detect | 25.89 M | yes | `raw-decode` I | ⚠️ I | same |
| 16 | `yolov10x.pt` | YOLOv10 | detect | 31.81 M | yes | `raw-decode` I | ⚠️ I | same |
| 17 | `yolov8n.pt` | YOLOv8 | detect | 3.16 M | yes | `needs-work` ✅V | ✅ I | head at **`model.22`** → `SystemExit` today; DFL box, so on-chip works once the index is derived |
| 18 | `yolov8s.pt` | YOLOv8 | detect | 11.17 M | yes | `needs-work` ✅V | ✅ I | same |
| 19 | `yolov8m.pt` | YOLOv8 | detect | 25.90 M | yes | `needs-work` I | ✅ I | same |
| 20 | `yolov8l.pt` | YOLOv8 | detect | 43.69 M | yes | `needs-work` I | ✅ I | same |
| 21 | `yolov8x.pt` | YOLOv8 | detect | 68.23 M | yes | `needs-work` I | ✅ I | same |
| 22 | `yolov9t.pt` | YOLOv9 | detect | 2.13 M | yes | `needs-work` ✅V | ✅ I | head at **`model.22`** |
| 23 | `yolov9s.pt` | YOLOv9 | detect | 7.32 M | yes | `needs-work` I | ✅ I | head at `model.22` |
| 24 | `yolov9m.pt` | YOLOv9 | detect | 20.22 M | yes | `needs-work` I | ✅ I | head at `model.22` |
| 25 | `yolov9c.pt` | YOLOv9 | detect | 25.59 M | yes | `needs-work` ✅V | ✅ I | head at `model.22` |
| 26 | `yolov9e.pt` | YOLOv9 | detect | 58.21 M | yes | `needs-work` ✅V | ✅ I | head at **`model.42`** — a third distinct index |
| 27 | `yolo12n.pt` | YOLO12 | detect | 2.60 M | yes | `needs-work` ✅V | ✅ I | head at **`model.21`**; Hailo *does* publish `yolov12n` for 8L with `meta_arch=yolov8`, but at only 35.9 FPS vs `yolov11n`'s 157 (§3b) |
| 28 | `yolo12s.pt` | YOLO12 | detect | 9.28 M | yes | `needs-work` I | ⚠️ I | head `model.21`; **no Hailo recipe** for s–x (§3b) |
| 29 | `yolo12m.pt` | YOLO12 | detect | 20.20 M | yes | `needs-work` I | ⚠️ I | same |
| 30 | `yolo12l.pt` | YOLO12 | detect | 26.45 M | yes | `needs-work` I | ⚠️ I | same |
| 31 | `yolo12x.pt` | YOLO12 | detect | 59.21 M | yes | `needs-work` I | ⚠️ I | same |

### 1b. Segmentation

| # | filename | family | task | params | trainable | Hailo-8L compile status | Edge decode | note |
|---|---|---|---|---|---|---|---|---|
| 32 | `yolo11n-seg.pt` | YOLO11 | segment | 2.88 M | yes | `raw-decode` ✅V | ✅ V | 10 end-nodes incl. `/model.23/proto/cv3/conv/Conv`; decoded by `V6InstanceBackend` |
| 33 | `yolo11s-seg.pt` | YOLO11 | segment | 10.11 M | yes | `raw-decode` ✅V | ✅ V | **currently in the dropdown**; the working seg path |
| 34 | `yolo11m-seg.pt` | YOLO11 | segment | 22.42 M | yes | `raw-decode` I | ✅ I | same head structure |
| 35 | `yolo11l-seg.pt` | YOLO11 | segment | 27.68 M | yes | `raw-decode` I | ✅ I | same |
| 36 | `yolo11x-seg.pt` | YOLO11 | segment | 62.14 M | yes | `raw-decode` I | ✅ I | same |
| 37 | `yolo26n-seg.pt` | YOLO26 | segment | 3.13 M | yes | `raw-decode` ✅V | ❌ V | parses, but head is `Segment26` with extra `proto.semseg`/`proto.feat_refine` convs the derived end-nodes cut off — **UNVERIFIED** whether the HEF is functionally complete |
| 38 | `yolo26s-seg.pt` | YOLO26 | segment | 11.51 M | yes | `raw-decode` ✅V | ❌ V | **currently in the dropdown**; 4-ch box → no edge decoder |
| 39 | `yolo26m-seg.pt` | YOLO26 | segment | 27.11 M | yes | `raw-decode` I | ❌ V | same |
| 40 | `yolo26l-seg.pt` | YOLO26 | segment | 31.52 M | yes | `raw-decode` I | ❌ V | same |
| 41 | `yolo26x-seg.pt` | YOLO26 | segment | 70.69 M | yes | `raw-decode` I | ❌ V | same |
| 42 | `yolov8n-seg.pt` | YOLOv8 | segment | 3.41 M | yes | `needs-work` ✅V | ✅ I | head at `model.22` → `SystemExit` today |
| 43 | `yolov8s-seg.pt` | YOLOv8 | segment | 11.82 M | yes | `needs-work` I | ✅ I | same |
| 44 | `yolov8m-seg.pt` | YOLOv8 | segment | 27.29 M | yes | `needs-work` I | ✅ I | same |
| 45 | `yolov8l-seg.pt` | YOLOv8 | segment | 46.00 M | yes | `needs-work` I | ✅ I | same |
| 46 | `yolov8x-seg.pt` | YOLOv8 | segment | 71.83 M | yes | `needs-work` I | ✅ I | same |

Legend: **✅V** = verified by running the code / a real ONNX export in this session. **I** = inferred from a same-family sibling whose head index and branch names were verified, plus the verified per-size param count. **⚠️** = inferred, lower confidence, called out in the notes.

> **`yolov9*-seg.pt` cannot be fetched by the installed version — and the docs disagree.**
> `docs.ultralytics.com/models/yolov9/` lists `yolov9c-seg.pt` and `yolov9e-seg.pt`, and the configs `yolov9c-seg.yaml` / `yolov9e-seg.yaml` ship in the package.
> But neither filename is in `GITHUB_ASSETS_NAMES` in 8.4.56, so `model.train()` cannot download either one. Verified: the YOLOv9 assets are exactly `yolov9{t,s,m,c,e}.pt`.
>
> The same conflict applies to `yolov8x-pose-p6.pt` and every `yolo26*-depth.pt` — all documented, none present in 8.4.56's asset list (all four checked programmatically).
>
> **This is the reason the dropdown must be generated against the installed ultralytics version, not transcribed from the docs.** A name that exists only in the docs is exactly the "wrong string in a dropdown is a broken run" failure the ticket names.

### 1c. Do NOT put these in this form

| filename(s) | family | task | trainable | Hailo-8L compile status | why not |
|---|---|---|---|---|---|
| `yolo11{n,s,m,l,x}-pose.pt`, `yolov8*-pose.pt`, `yolo26*-pose.pt` | pose | pose | yes | **`needs-work` — actively dangerous** | ✅V: `detect_head()` classifies `yolo11n-pose` as `task=detection, nms=onchip`. The `cv4` keypoint branch is **silently dropped** and it compiles "successfully" into a HEF with no keypoints. |
| `yolo11*-obb.pt`, `yolov8*-obb.pt`, `yolo26*-obb.pt` | obb | obb | yes | **`needs-work` — same silent drop** | I: OBB head has the same `cv2/cv3/cv4` shape with no `proto`, so the same misclassification applies; the angle branch is cut. |
| `yolo11*-cls.pt`, `yolov8*-cls.pt`, `yolo26*-cls.pt` | classify | classify | yes | `not-supported` | ✅V: head is `Classify` at `model.10` with a single `conv` branch — no `cv2`/`cv3` at all. Also the wrong task for a detector. |
| `yolo26*-sem.pt` | YOLO26 | semantic | yes | `not-supported` | ✅V: head is `SemanticSegment`, task `semantic`. No `cv2.N.2` end-node recipe. |
| `rtdetr-l.pt`, `rtdetr-x.pt` | RT-DETR | detect | yes | `not-supported` | ✅V: transformer decoder, no DFL `cv2`/`cv3` head. `detect_head()` has no recipe. Also not loadable via the `YOLO` class (`NotImplementedError`) — needs `RTDETR`. |
| `yolov8{s,m,l,x}-world.pt`, `-worldv2.pt` | YOLO-World | detect (open-vocab) | caveated | `not-supported` | ✅V: head is `WorldDetect` at `model.22`; requires a text-embedding input, so a single `images` start-node does not describe the graph. Pointless for a fixed 2-class problem. |
| `yoloe-11{s,m,l}-seg.pt`, `yoloe-26*-seg.pt`, `yoloe-v8*-seg.pt` (+ `-pf` variants) | YOLOE | segment (open-vocab) | caveated | `not-supported` | ✅V: head is `YOLOESegment` with branches `cv2, cv3, cv5, proto, savpe` — **no `cv4`**. So `detect_head()` sees `has_cv4=False` → calls it `detection` → assigns **on-chip NMS to a segmentation model**. Would produce a wrong or unparseable graph. |
| `yolov5*u.pt`, `yolov3*.pt`, `yolov6*` | legacy | detect | yes | `needs-work` / UNVERIFIED | Not probed this session. `yolov5nu.pt` etc. are in the asset list and trainable, but the head index was not measured — **UNVERIFIED**. |
| `sam*`, `sam2*`, `mobile_sam.pt`, `FastSAM-*`, `yolo_nas_*` | SAM / NAS | promptable seg / detect | no (SAM/NAS not trainable here) | `not-supported` | Out of scope for a supervised 2-class detector. |

---

## 2. The full trainable catalogue (question 1)

Source of truth for **filenames**: `ultralytics/utils/downloads.py::GITHUB_ASSETS_NAMES` in the installed 8.4.56 — 165 assets, repo `ultralytics/assets`.
This is the authoritative list because it is exactly what the library will auto-download; a name absent from it 404s.
Verified by running:

```
.venv/bin/python -c "from ultralytics.utils.downloads import GITHUB_ASSETS_NAMES as N; print(len(N))"
```

Source of truth for **which architectures exist**: `ultralytics/cfg/models/` (67 YAML files).

| family | dir | detect `.pt` | segment `.pt` | pose `.pt` | obb `.pt` | classify `.pt` | other |
|---|---|---|---|---|---|---|---|
| YOLOv3 | `cfg/models/v3` | (yaml only: `yolov3`, `-tiny`, `-spp`) | — | — | — | — | — |
| YOLOv5 (u) | `cfg/models/v5` | `yolov5{n,s,m,l,x}u.pt`, `yolov5{n,s,m,l,x}6u.pt` | — | — | — | — | — |
| YOLOv6 | `cfg/models/v6` | yaml only (`yolov6.yaml`) | — | — | — | — | — |
| YOLOv8 | `cfg/models/v8` | `yolov8{n,s,m,l,x}.pt` | `yolov8{n,s,m,l,x}-seg.pt` | `yolov8{n,s,m,l,x}-pose.pt` | `yolov8{n,s,m,l,x}-obb.pt` | `yolov8{n,s,m,l,x}-cls.pt` | `-oiv7`, `-world`, `-worldv2`, `yoloe-v8*-seg` |
| YOLOv9 | `cfg/models/v9` | `yolov9{t,s,m,c,e}.pt` | **none** (yaml only) | — | — | — | — |
| YOLOv10 | `cfg/models/v10` | `yolov10{n,s,m,b,l,x}.pt` | — | — | — | — | — |
| YOLO11 | `cfg/models/11` | `yolo11{n,s,m,l,x}.pt` | `yolo11{n,s,m,l,x}-seg.pt` | `yolo11{n,s,m,l,x}-pose.pt` | `yolo11{n,s,m,l,x}-obb.pt` | `yolo11{n,s,m,l,x}-cls.pt` | `yolo11n-grayscale.pt`, `yoloe-11*-seg` |
| YOLO12 | `cfg/models/12` | `yolo12{n,s,m,l,x}.pt` | **none** (yaml only) | none | none | none | — |
| YOLO26 | `cfg/models/26` | `yolo26{n,s,m,l,x}.pt` | `yolo26{n,s,m,l,x}-seg.pt` | `yolo26{n,s,m,l,x}-pose.pt` | `yolo26{n,s,m,l,x}-obb.pt` | `yolo26{n,s,m,l,x}-cls.pt` | `yolo26{n,s,m,l,x}-sem.pt` (semantic), `yoloe-26*-seg` |
| RT-DETR | `cfg/models/rt-detr` | `rtdetr-l.pt`, `rtdetr-x.pt` | — | — | — | — | `-resnet50`, `-resnet101` yaml only |
| YOLOE | `cfg/models/{v8,11,26}` | — | `yoloe-{v8s,v8m,v8l,11s,11m,11l,26n,26s,26m,26l,26x}-seg.pt` + `-pf` | — | — | — | open-vocabulary |

Two spelling rules that a dropdown must get right, both verified against the asset list:

- **The "v" is present for v3/v5/v8/v9/v10 and absent for 11/12/26.** `yolov8s.pt` and `yolo11s.pt`. There is no `yolov11s.pt` and no `yolo8s.pt`.
- **YOLOv9 uses `t,s,m,c,e`, not `n,s,m,l,x`.** There is no `yolov9n.pt` and no `yolov9l.pt`.
- **YOLOv10 has a `b` size** (`yolov10b.pt`) that no other family has.

The `params` column in §1 was measured, not copied: `sum(p.numel() for p in YOLO(<yaml>).model.parameters())` at the default `nc=80`.
A 2-class retrain lands slightly lower (the `cv3` class branch shrinks).

### Tasks per family (what `model.train()` accepts)

Confirmed by loading each config and reading `YOLO(...).task`:
`detect`, `segment`, `pose`, `obb`, `classify` across v8/11/26; YOLO26 adds `semantic` (`yolo26*-sem.pt` → head `SemanticSegment`).
YOLOv9/v10/v12 ship **detect-only** pretrained weights in 8.4.56.

---

## 3. What Hailo supports in principle (question 2)

Two sources, and they agree.

- **Local, and therefore directly checkable:** `hailo_model_zoo-2.18.0-py3-none-any.whl` in `~/Downloads`, unpacked and read. Paths below are inside `hailo_model_zoo/cfg/`.
- **Published docs at master (≈2.19.0):** `github.com/hailo-ai/hailo_model_zoo/blob/master/docs/public_models/HAILO8L/HAILO8L_object_detection.rst` and the sibling `HAILO8/`, `*_instance_segmentation`, `*_pose_estimation` pages. FPS numbers below come from those tables (measured on i5-9400 / PCIe Gen3 x4).

Where the two differ it is because master is newer; that is called out.

### 3a. Hailo-8L vs Hailo-8 — for detection there is no difference

The published HAILO8 and HAILO8L object-detection tables contain **63 models each, with identical names**.
Only FPS differs; float and quantized mAP are the same.
So for detection, "fits Hailo-8 but not Hailo-8L" is **not** a real distinction — the constraint is throughput, not the model list.

The one capacity exclusion found anywhere: **`yolo26l_seg` is published for HAILO8 and absent for HAILO8L** (instance-segmentation tables).

Capacity does show up, but as *compile difficulty* rather than exclusion.
The only YOLO model in the whole zoo that needs a Hailo-8L-specific recipe is `yolov8m`, and what it needs is telling (`alls/hailo8l/base/yolov8m.alls`, read locally):

```
model_optimization_config(calibration, batch_size=2)
post_quantization_optimization(finetune, policy=enabled, learning_rate=0.000025)
resources_param(max_memory_utilization=0.85, max_compute_utilization=1.0, ...)
```

Calibration batch dropped to 2, a quantization-aware finetune added, and the resource allocator explicitly relaxed.
That is a ~26 M-parameter model needing hand-holding to fit 8L.
Read it as the practical ceiling marker for this hardware, and as evidence for the m/l/x warnings in §6.

### 3b. YOLO detection on Hailo-8L — official recipes exist for

Verified in the local wheel (`cfg/networks/*.yaml`, `cfg/alls/generic/*.alls`) and cross-checked against the HAILO8L docs table.
FPS is batch=1 on 8L; mAP is float / quantized.

| zoo name | ultralytics equivalent | float / HW mAP | FPS b=1 (8L) | on-chip NMS? |
|---|---|---|---|---|
| `yolov8n` | `yolov8n.pt` | 37.0 / 36.4 | 202 | ✅ `meta_arch=yolov8` |
| `yolov8s` | `yolov8s.pt` | 44.6 / 43.9 | 110 | ✅ |
| `yolov8m` | `yolov8m.pt` | 49.9 / 49.2 | 51.0 | ✅ (needs the 8L override above) |
| `yolov8l` | `yolov8l.pt` | 52.4 / 51.8 | 26.1 | ✅ |
| `yolov8x` | `yolov8x.pt` | 53.5 / 52.9 | 16.2 | ✅ |
| `yolov9c` | `yolov9c.pt` | 52.6 / 51.0 | 27.2 | ✅ |
| `yolov10n` | `yolov10n.pt` | 38.5 / 36.6 | 150 | ✅ |
| `yolov10s` | `yolov10s.pt` | 45.9 / 44.9 | 87.6 | ✅ |
| `yolov10b` | `yolov10b.pt` | 52.0 / 50.8 | 25.9 | ✅ |
| `yolov10x` | `yolov10x.pt` | 53.7 / 51.8 | 14.3 | ✅ |
| `yolov11n` | `yolo11n.pt` | 39.0 / 37.5 | 157 | ✅ |
| `yolov11s` | `yolo11s.pt` | 46.3 / 45.1 | 92.0 | ✅ ← **this project's path** |
| `yolov11m` | `yolo11m.pt` | 51.1 / 49.9 | 35.3 | ✅ |
| `yolov11l` | `yolo11l.pt` | 52.8 / 52.3 | 21.8 | ✅ |
| `yolov11x` | `yolo11x.pt` | 54.1 / 53.1 | 12.7 | ✅ |
| `yolov12n` | `yolo12n.pt` | 40.5 / 39.2 | 35.9 | ✅ (master only; **absent from local 2.18.0**) |
| `yolo26n` | `yolo26n.pt` | 40.0 / 38.4 | 111 | ❌ NMS-free, host decode |
| `yolo26s` | `yolo26s.pt` | 47.5 / 45.3 | 66.6 | ❌ |
| `yolo26m` | `yolo26m.pt` | 52.3 / 50.6 | 28.6 | ❌ |

Also published for 8L but irrelevant here: `yolov5*` (many variants), `yolov6n`, `yolov7`/`_tiny`/`x`/`e6`, `yolox_*`, `damoyolo_*`, legacy `yolov3`/`yolov4`.

Not published for 8/8L in any size: **`yolov9t/s/m/e`**, **`yolov10m/l`**, **`yolo26l/x` detection**, **`yolov12s/m/l/x`**.
Their absence is not proof they cannot compile — it means Hailo has published no recipe, so a custom ClientRunner flow is on its own.

### 3c. `meta_arch=yolov8` officially covers v8, v9c, v10 and v11 — not just v11

This is the finding that matters most for this repo, and it is verifiable locally:

```
$ grep -rl "meta_arch=yolov8" cfg/alls/ | xargs -n1 basename | sed 's/.alls//' | sort -u
nanodet_repvgg  nanodet_repvgg_a1_640
yolov10b  yolov10n  yolov10s  yolov10x
yolov11l  yolov11m  yolov11n  yolov11s  yolov11x
yolov8l  yolov8m  yolov8n  yolov8s  yolov8s_bbox_decoding_only  yolov8x
yolov9c
```

Master adds `yolov12n` and the `hailo_yolov8*_384_640` / `_480_640` variants.
Every one of these NMS configs is structurally the same: 3 `bbox_decoders`, `regression_length: 16`, `image_dims [640,640]` — only `nms_scores_th` moves (0.2 for v8/v9/v11/v12, 0.3 for v10).

Two direct consequences for `compile_clientrunner.py`:

1. **The repo's on-chip gate is narrower than Hailo's.** `nms_mode = "onchip" if (family == "yolov11" and task == "detection")` (`compile_clientrunner.py:87`) excludes YOLOv8, YOLOv9c and YOLOv10, all three of which Hailo itself compiles with `meta_arch=yolov8`. The condition that actually matters is "16-bin DFL box", not "is YOLO11" — see Fix 2 in §5.
2. **YOLOv10 is explicitly proven to belong on the on-chip path.** `cfg/networks/yolov10n.yaml` sets `device_pre_post_layers: {nms: true}`, `hpp: true`, and its parser nodes are

   ```
   /model.23/one2one_cv2.0/one2one_cv2.0.2/Conv
   /model.23/one2one_cv3.0/one2one_cv3.0.2/Conv   ... (6 total)
   ```

   which are **byte-identical to the end-nodes this repo derives for what it calls "yolo26"** — and `yolov10n.alls` calls `nms_postprocess(..., meta_arch=yolov8)`. So this repo routes YOLOv10 to the raw path while Hailo routes the same six nodes to on-chip NMS. Verified from both the local wheel and the master `.alls` scan.

Two end-node cross-checks worth recording, because they independently validate this repo's derivation:

- `cfg/networks/yolov11s.yaml` parser nodes are exactly `/model.23/cv2.{0,1,2}/cv2.{0,1,2}.2/Conv` + the `cv3` triple — **identical** to what `detect_head()` derives for YOLO11. The repo's recipe matches Hailo's official one node-for-node.
- `cfg/base/yolo26.yaml` parser nodes are exactly the `/model.23/one2one_cv{2,3}.N/...` set — also identical to the repo's YOLO26 derivation.

### 3d. YOLO26 on Hailo is a genuinely different postprocess story

`cfg/base/yolo26.yaml` (local) sets `meta_arch: yolo26`, `device_pre_post_layers: {nms: false, sigmoid: false}`, `hpp: false`, and declares:

```
output_shape: 80x80x80, 40x40x80, 20x20x80, 80x80x4, 40x40x4, 20x20x4
```

An 80-channel class map and a **4-channel** box map per stride — independently confirming the `out_channels=4` measured on the torch head in §4.
None of the twelve `yolo26*.alls` files calls `nms_postprocess` at all.

So Hailo agrees with this repo: YOLO26 cannot use the yolov8 on-chip NMS, and its boxes must be decoded on the host.
Hailo ships that host decoder in the Model Zoo (`meta_arch: yolo26` postprocessing). **This project does not have one** — see the Edge column in §1 and the trap in §6.

Also worth noting for the INT8 concern: the official `yolo26n.alls` is far more aggressive about quantization quality than this repo's default —

```
model_optimization_config(calibration, batch_size=8, calibset_size=1024)
model_optimization_flavor(optimization_level=4, compression_level=0)
post_quantization_optimization(adaround, policy=enabled, batch_size=8)
quantization_param([output_layer1..6], precision_mode=a16_w16)
```

`optimization_level=4`, 1024 calibration images, AdaRound, and **16-bit activations/weights on all six output layers**.
`compile_clientrunner.py` defaults to `--opt-level 0` and `--calib-n 512` with no 16-bit output layers (`compile_clientrunner.py:150,156,199`).
The script's own docstring already flags that production wants `calib>=1024 + opt_level 2` (`:20-21`).
Given the recorded INT8-collapse incident, the gap between the repo default and Hailo's own recipe deserves its own ticket — it is not this ticket's question, so it is noted, not resolved.

One observed difference I could **not** resolve, marked UNVERIFIED: every official YOLO detection `.alls` includes `change_output_activation(convNN, sigmoid)` on the three class convs (e.g. `alls/generic/yolov11s.alls`), and `compile_clientrunner.py` emits no such line. Whether DFC applies the sigmoid implicitly when `meta_arch=yolov8` + explicit `bbox_decoders` are given, or whether this repo's HEF is scoring logits that happen to threshold acceptably, was not determined here. The deployed HEF demonstrably works, so this is a question, not a defect claim.

### 3e. RT-DETR, YOLO-World, YOLOE — nothing for Hailo-8L

- **RT-DETR: absent from the entire Model Zoo.** A recursive scan of the master tree (1291 paths) for `rtdetr`/`rt_detr` returned zero hits. Only plain DETR exists (`detr_resnet_v1_18_bn`, 33.9/31.5 mAP, 23.4 FPS on 8L at 800×800).
- **YOLO-World: in the zoo, but not for this chip.** `cfg/networks/yolo_world_v2s.yaml` exists with `supported_hw_arch: hailo15h, hailo10h`, and it is published only under `HAILO15H_zero_shot_object_detection.rst`. Neither HAILO8 nor HAILO8L has a zero-shot-object-detection page at all.
- **YOLOE: absent.** Zero hits for `yoloe` anywhere in the tree.

### 3f. Segmentation and pose on Hailo-8L

Instance segmentation, published for 8L: `yolov11{n,s,m,l,x}_seg` (32.1→43.8 float mAP-seg, 149→11.3 FPS), `yolov8{n,s,m}_seg` (no l/x), `yolov5{n,s,m,l}_seg`, `yolo26m_seg` and `yolo26x_seg` — **but not `yolo26n_seg`/`yolo26s_seg`**, despite cfg YAMLs existing for n/s/m/l. `yolo26l_seg` is 8-only.

Pose on 8L: **only `yolov8s_pose` and `yolov8m_pose`.** No YOLO11 pose, no YOLO26 pose.

OBB: there is **no** `HAILO8L_oriented_object_detection.rst`. The OBB page exists only under HAILO15H, even though `cfg` carries `yolov11{n,s,m,l,x}_obb.yaml`.

### 3g. Official recipe vs custom ClientRunner — the distinction the ticket asked for

| | has an official Hailo Model Zoo recipe | compilable via this repo's custom ClientRunner flow |
|---|---|---|
| YOLOv8 n–x, detect | ✅ (`yolov8*.alls`, on-chip NMS) | after Fix 1 — nothing else needed |
| YOLOv8 n/s/m, seg | ✅ | after Fix 1 |
| YOLOv9c | ✅ — but from the *WongKinYiu* export, whose parser nodes are opaque (`Conv_1058`, …) not `/model.22/...` | after Fix 1, for the **ultralytics** export |
| YOLOv9 t/s/m/e | ❌ no recipe | after Fix 1, unproven |
| YOLOv10 n/s/b/x | ✅ on-chip NMS | parses today, wrongly on raw; Fix 2 gives it on-chip |
| YOLOv10 m/l | ❌ no recipe | same as its siblings, unproven |
| YOLO11 n–x, detect | ✅ | ✅ **works today** |
| YOLO11 n–x, seg | ✅ | ✅ works today (raw) |
| YOLO12n | ✅ (master only) | after Fix 1 |
| YOLO12 s–x | ❌ no recipe | after Fix 1, unproven |
| YOLO26 n/s/m detect | ✅ but NMS-free — needs a host decoder | compiles raw today; **no decoder on our edge** |
| YOLO26 l/x detect | ❌ no recipe | compiles raw; no decoder |
| pose (v8s/v8m only) | ✅ for `yolov8{s,m}_pose` | ❌ silently mis-compiled (§4) |
| OBB | ❌ not for 8/8L | ❌ silently mis-compiled |
| RT-DETR / YOLO-World / YOLOE | ❌ nothing for 8/8L | ❌ no recipe in this script |

The YOLOv9c row is the one place the Model Zoo does **not** help this repo: Hailo compiled the original YOLOv9 release, not the ultralytics one, so its published node names carry no information about where an ultralytics-exported `yolov9c.pt` puts its head. §1 uses the measured `model.22` instead.

---

## 4. Which parse, which get on-chip NMS, which fail — verified (question 3)

This is the ticket's most important question, and it was answered by **executing** `detect_head()` against real ONNX exports, not by reading it.

Method: build each architecture from its shipped YAML, `model.export(format="onnx", imgsz=640, opset=17)`, then call `compile_clientrunner.detect_head()` on the result.
Building from YAML rather than a downloaded `.pt` changes the weights, not the graph topology or the node names, so it is a valid probe for name-based detection.
Confirmed by cross-checking node names against a real export of the family this repo already ships.

Verbatim result:

```
yolov8n.yaml         SYSEXIT  derived end-nodes not found in ONNX graph (yolov11/detection): ['/model.23/cv2.0/cv2.0.2/Conv', ...]
yolov9t.yaml         SYSEXIT  derived end-nodes not found in ONNX graph (yolov11/detection): ['/model.23/cv2.0/cv2.0.2/Conv', ...]
yolov10n.yaml        OK   family=yolo26   task=detection     nms=raw     n_end=6  e0=/model.23/one2one_cv2.0/one2one_cv2.0.2/Conv
yolo11n.yaml         OK   family=yolov11  task=detection     nms=onchip  n_end=6  e0=/model.23/cv2.0/cv2.0.2/Conv
yolo12n.yaml         SYSEXIT  derived end-nodes not found in ONNX graph (yolov11/detection): ['/model.23/cv2.0/cv2.0.2/Conv', ...]
yolo26n.yaml         OK   family=yolo26   task=detection     nms=raw     n_end=6  e0=/model.23/one2one_cv2.0/one2one_cv2.0.2/Conv
yolo11n-seg.yaml     OK   family=yolov11  task=segmentation  nms=raw     n_end=10 e0=/model.23/cv2.0/cv2.0.2/Conv
yolo26n-seg.yaml     OK   family=yolo26   task=segmentation  nms=raw     n_end=10 e0=/model.23/one2one_cv2.0/one2one_cv2.0.2/Conv
yolo11n-pose.yaml    OK   family=yolov11  task=detection     nms=onchip  n_end=6  e0=/model.23/cv2.0/cv2.0.2/Conv   <-- SILENT WRONG
yolov8n-seg.yaml     SYSEXIT  derived end-nodes not found in ONNX graph (yolov11/segmentation): [...]
```

And the raw node names from a genuine export, which is the proof that the `/model.N/` prefix is the whole problem:

```
### yolo11n -> yolo11n.onnx   total_conv=88
  terminal = /model.23/cv2.0/cv2.0.2/Conv  /model.23/cv2.1/cv2.1.2/Conv  /model.23/cv2.2/cv2.2.2/Conv
             /model.23/cv3.0/cv3.0.2/Conv  /model.23/cv3.1/cv3.1.2/Conv  /model.23/cv3.2/cv3.2.2/Conv
### yolov8n -> yolov8n.onnx   total_conv=64
  terminal = /model.22/cv2.0/cv2.0.2/Conv  /model.22/cv2.1/cv2.1.2/Conv  /model.22/cv2.2/cv2.2.2/Conv
             /model.22/cv3.0/cv3.0.2/Conv  /model.22/cv3.1/cv3.1.2/Conv  /model.22/cv3.2/cv3.2.2/Conv
```

Answers to (a)–(d):

**(a) Parse successfully** — YOLO11 (detect + seg + pose + obb), YOLO26 (detect + seg), YOLOv10 (detect).
Everything else in the dropdown-relevant set aborts.

**(b) Get correct on-chip NMS** — **only YOLO11 detection.**
`nms_mode = "onchip" if (family == "yolov11" and task == "detection")` (`compile_clientrunner.py:87`).

**(c) Fall to the raw path** — YOLO26 detect/seg (correctly: `cv2.N.2` has `out_channels=4`, a direct box, so the yolov8 DFL decode really would be wrong) and YOLO11-seg (correctly).
**YOLOv10 falls to raw incorrectly.** Its `one2one_cv2.N.2` has `out_channels=64` — a 16-bin DFL box, exactly what `meta_arch=yolov8` decodes. It is denied on-chip NMS only because the family test is name-based:

```python
family = "yolo26" if any("one2one_cv2" in c for c in conv_names) else "yolov11"   # :78
```

`v10Detect` also names its one-to-one branch `one2one_cv2`, so **YOLOv10 is indistinguishable from YOLO26 to this code** and gets reported under the wrong family name in the `DETECT {...}` log line (`:182`). Verified: `family=yolo26` printed for `yolov10n`.

**(d) Fail outright** — YOLOv8 (all), YOLOv9 (all), YOLO12 (all), classify (all families), RT-DETR.
Cause is always the same `SystemExit` at `compile_clientrunner.py:100-105`.

### Two silent-wrong-output hazards found (not in the ticket, but they belong in the same decision)

1. **pose and obb compile "successfully" and lose their extra branch.**
   `task` is decided by `has_proto and has_cv4` (`:84`). Pose and OBB have `cv4` but **no** `proto`, so both are labelled `detection`, the `cv4` end-node is never added, and the keypoint/angle head is cut out of the graph. It then also gets on-chip NMS. Verified for `yolo11n-pose`. This produces a HEF that loads and runs and is simply missing the thing the model was trained for — the worst possible failure mode, and a reason to keep pose/obb out of the dropdown rather than mark them `needs-work`.

2. **`derive_bbox_decoders` assumes `nc < 16`.**
   It splits reg from cls by `"reg" if C >= 16 else "cls"` (`:129`). For this project `nc=2`, so reg=64 / cls=2 and it works. For any `nc >= 16` the class branch would be misread as a second box branch. Harmless today; a landmine if the class count ever grows. `assert len(bbox_decoders) == 3` (`:207`) would catch it, but only as an opaque assertion.

### The `Edge decode` column, and the trap it exposes

`sack-detector-edge` has exactly two decoders:

- `detector/src/detector/hailo_backend.py::yolo_postprocess` parses **only** the on-chip-NMS layout — `raw_outputs[0][class_id] → (N,5)` of `[y1,x1,y2,x2,score]` (`hailo_backend.py:289-296`), gated on `FormatOrder.HAILO_NMS*` (`:107-116`).
- `detector/src/detector/v6_instance_backend.py` is a raw decoder, but it is hardcoded to a **64-channel DFL box and a 2-channel class head**: `if 64 not in pair or 2 not in pair: continue`, then `softmax(pair[64].reshape(H, W, 4, 16))` (`v6_instance_backend.py:100-104`).

Consequence, and this is the most consequential finding for the dropdown:

**Every YOLO26 option currently in the form (`yolo26n/s/m.pt`, `yolo26s-seg.pt`) compiles to a HEF that no edge decoder can read.** YOLO26's box conv emits 4 channels, so `V6InstanceBackend` skips every stride (`64 not in pair`) and returns zero detections, while `yolo_postprocess` needs an NMS-format output the raw path does not produce. Nothing in the pipeline reports this — training succeeds, ONNX export succeeds, compile succeeds, and the device counts nothing.

YOLO11-seg is the one raw path that **is** deployable, because `V6InstanceBackend` was written for exactly it.

## 5. What would close the gap (question 3c)

Two independent changes, both small; verified by prototype, not proposed on faith.

**Fix 1 — derive the head index instead of hardcoding it.** Replacing the literal `23` with the max `model.N` that carries a `cv2.S/` conv resolves all six end-nodes for every family probed, including the two exotic indices (`yolov9e` at 42, `yolo12` at 21):

```
yolov8n     head_idx=22  prefix=''          missing=0 OK
yolov9t     head_idx=22  prefix=''          missing=0 OK
yolov9e     head_idx=42  prefix=''          missing=0 OK
yolov10n    head_idx=23  prefix='one2one_'  missing=0 OK
yolo11n     head_idx=23  prefix=''          missing=0 OK
yolo12n     head_idx=21  prefix=''          missing=0 OK
yolo26n     head_idx=23  prefix='one2one_'  missing=0 OK
yolo11n-seg head_idx=23  prefix=''          missing=0 OK
yolov8n-seg head_idx=22  prefix=''          missing=0 OK
yolo26n-seg head_idx=23  prefix='one2one_'  missing=0 OK
```

This is one regex and one `max()`. It converts 20 `needs-work` rows into parseable ones and removes the whole class of "a new ultralytics release renumbered the head" breakage.

**Fix 2 — decide NMS by channel count, not by family name.** The real question is never "is this YOLO26" but "is the box head a 16-bin DFL". The measured terminal box-conv channels:

| model | box conv | `out_channels` | meaning |
|---|---|---|---|
| yolov8n | `model.22.cv2.N.2` | 64 | DFL, reg_len 16 → on-chip valid |
| yolo11n | `model.23.cv2.N.2` | 64 | DFL → on-chip valid (today's path) |
| yolov10n | `model.23.one2one_cv2.N.2` | 64 | DFL → on-chip **would be** valid |
| yolo26n | `model.23.one2one_cv2.N.2` | 4 | direct box → on-chip invalid, raw required |

So `onchip if out_channels == 4 * reg_len else raw` is both simpler than the current family test and correct for all four, and it stops mislabelling YOLOv10 as YOLO26.

Neither fix helps pose/obb, which need the `task` test changed from `has_proto and has_cv4` to something that inspects the branch set, and neither fix gives the edge a decoder for a 4-channel box. Those are separate, larger pieces of work.


---

## 6. Recommendation (question 5)

The problem is a **2-class person+sack detector at 640×640 on a Hailo-8L**, feeding a line-crossing counter whose current target is GT 380.
Detection quality is the known lever; the counting logic has already been measured as not the lever.
That framing makes most of the 46-row table noise.

### Tier 1 — genuinely belongs in the dropdown (5 rows)

`yolo11n.pt`, `yolo11s.pt`, `yolo11m.pt`, `yolo11l.pt`, `yolo11x.pt`

These are the only checkpoints that reach a fully working, on-chip-NMS HEF through the pipeline **as it stands today**, with a proven device path.
`yolo11s.pt` stays the default — it is what is deployed.
`yolo11n` is the honest speed option; `yolo11m` is the honest capacity option and the right first experiment if the ~20-count detection gap is a capacity problem.

`yolo11l` / `yolo11x` should be present but visibly discouraged: 25 M and 57 M parameters on a 13-TOPS INT8 part will cost far more than it returns, and the FPS drop hits the tracker before it helps the detector.

### Tier 2 — worth adding, but only after Fix 1 (10 rows)

`yolov8{n,s,m,l,x}.pt` and `yolov8{n,s,m,l,x}-seg.pt`

YOLOv8 is the best-supported YOLO on Hailo by a wide margin and its head is a plain DFL detect head, so once the head index is derived rather than hardcoded it lands on the same on-chip-NMS path as YOLO11 with no other change.
On 8L the tradeoff against the incumbent is measured and close: **`yolov8s` 110 FPS at 44.6 mAP vs `yolo11s` 92 FPS at 46.3** (§3b) — YOLOv8s buys ~20% throughput for ~1.7 mAP. For a counter that is currently detection-limited, that is a real experiment worth running, not a downgrade.
Until Fix 1 ships these are `needs-work` and must be **disabled in the UI, not merely annotated** — a selectable option that always dies at compile time is a broken run, which is exactly what this spec effort exists to prevent.

`yolo11{n,s,m,l,x}-seg.pt` also belong here as a working-but-niche group: they compile raw and the edge *can* decode them (`V6InstanceBackend`), but segmentation buys nothing for a line-crossing count and costs proto-mask bandwidth every frame.
Keep `yolo11s-seg.pt` for the occlusion experiments that motivated it; there is no reason to expose the other four sizes.

### Traps — trains fine, compiles fine, and still does not work

1. **All five `yolo26*.pt` and all five `yolo26*-seg.pt` — the sharpest trap in the table, and four of them are in the form today.**
   YOLO26's 4-channel direct box means: on-chip NMS is invalid (the script correctly refuses it), *and* neither edge decoder can read the raw output (`v6_instance_backend.py:100` requires a 64-channel DFL box). Every layer reports success and the device counts zero. Either remove them from the dropdown or gate them behind an edge decoder that does not yet exist. Marking them "compile-capable" would be actively false: they compile, and they do not run.

2. **All `*-pose.pt` and `*-obb.pt`.** They compile "successfully" with their keypoint/angle branch silently amputated (§4). Do not offer them.

3. **`yolo12*.pt` — a throughput trap, now measurable.** Hailo does publish `yolov12n` for 8L, so op coverage is not the problem. Throughput is: **35.9 FPS for 40.5 mAP, against `yolov11n`'s 157 FPS for 39.0** (§3b). Four times slower for +1.5 mAP on COCO, on a device that has to keep a tracker fed. The attention backbone quantizes and compiles; it just is not worth its clock on this part. And s/m/l/x have no Hailo recipe at all.

4. **`yolo11x` / `yolov8x` / `yolov9e` on INT8.** Not a compile trap, a quantization trap. This repo already has a recorded incident where a model scoring 0.85–0.97 in FP32 produced a HEF scoring below 0.2 (`../map.md`, "the INT8 collapse"). Larger models have wider activation ranges and more to lose in 8-bit; a bigger checkpoint is the *least* reliable way to close a detection gap on this hardware. Any x/e-size row should carry that warning in the UI, not just in this document.

### What the form should therefore do

Rather than 46 flat options, three groups plus a hard gate:

- **Detection (Hailo-ready)** — the 5 `yolo11*` rows, `yolo11s` default. Selectable.
- **Detection (needs compile-script work)** — the 10 `yolov8*` rows. Rendered, disabled, with the reason shown. They become selectable the day Fix 1 lands.
- **Segmentation (experimental)** — `yolo11s-seg.pt` only.
- Everything else: **not offered.** "Every model that can actually be trained" and "every model that can actually reach the device" are different sets, and the dropdown's job is the second one. Completeness here is served by this document, not by a menu that lets a Colab session burn GPU time on a checkpoint whose HEF cannot be decoded.

The compile-status flag the form renders should be **derived from a single table checked into the repo**, not hand-copied into `NewRun.tsx` — the same defaults-in-two-unlinked-copies problem this spec effort already identified between `NewRun.tsx:45-51` and `training.py:22-33`.

---

## Verification log

Everything marked ✅V in this document came from one of these commands, run in this session against `/Users/pitikorn/Work/BSCP/sack-train-ml/.venv`.

| what | how |
|---|---|
| ultralytics version | `.venv/bin/python -c "import ultralytics; print(ultralytics.__version__)"` → `8.4.56` |
| model config inventory | `find .venv/.../ultralytics/cfg/models -type f` → 67 YAMLs |
| checkpoint filenames | `from ultralytics.utils.downloads import GITHUB_ASSETS_NAMES` → 165 assets |
| head index + branch names per family | `YOLO(<yaml>).model.model[-1].named_modules()`, filtered to `Conv2d` |
| box/class conv channel counts | same probe, reading `out_channels` |
| param counts | `sum(p.numel() for p in YOLO(<yaml>).model.parameters())` at `nc=80` |
| ONNX node names | `YOLO(<yaml>).export(format="onnx", imgsz=640, opset=17, simplify=False)` then `onnx.load(p).graph` |
| `detect_head()` behaviour | imported `scripts/compile_clientrunner.py` via `importlib` and called `detect_head()` on each export |
| generic-head-index prototype | regex `^/model\.(\d+)/(one2one_)?cv2\.(\d)/` + `max()`, checked all 6 end-nodes present |
| edge decoder limits | read `sack-detector-edge/detector/src/detector/hailo_backend.py` and `v6_instance_backend.py` |
| Hailo Model Zoo recipes | unpacked `~/Downloads/hailo_model_zoo-2.18.0-py3-none-any.whl`; read `cfg/networks/*.yaml`, `cfg/base/yolo26.yaml`, `cfg/alls/generic/*.alls`, `cfg/alls/hailo8l/base/yolov8m.alls` |
| `meta_arch=yolov8` coverage | `grep -rl "meta_arch=yolov8" cfg/alls/` in the local wheel, cross-checked against a master-branch scan of the same files |
| Hailo-8L vs 8 model sets, FPS/mAP | `docs/public_models/HAILO8L/*.rst` and `HAILO8/*.rst` at master, fetched and set-diffed |
| docs-vs-installed filename conflicts | `q in GITHUB_ASSETS_NAMES` for `yolov9c-seg.pt`, `yolov9e-seg.pt`, `yolov8x-pose-p6.pt`, `yolo26n-depth.pt` → all `False` |

**Not verified in this session, and flagged as such above:**

- Whether a real `.pt` checkpoint exports an identical graph to a YAML-built one. The topology is the same by construction, and node naming was cross-checked against the family this repo already ships, but no downloaded `.pt` was exported.
- Whether the `yolo26*-seg` HEF is functionally complete, given the `proto.semseg` / `proto.feat_refine` convs that the derived end-nodes cut off.
- Whether `V6InstanceBackend` can drive a YOLOv10/YOLOv8 *detection* raw HEF (it needs the 64-ch + 2-ch pair, which those provide, but it was written for the seg HEF and expects a proto tensor).
- YOLOv3 / YOLOv5u / YOLOv6 head indices — not probed.
- Whether DFC applies the class-output sigmoid implicitly. Every official YOLO `.alls` carries `change_output_activation(..., sigmoid)`; `compile_clientrunner.py` does not (§3d). Open question, not a defect claim.
- Hailo-8L FPS/mAP figures are Hailo's published numbers on an i5-9400 host, not measurements on this project's Pi 5. Use them for ranking, not for capacity planning.
- Whether `yolo26l/x` detection and `yolov9t/s/m/e` compile at all — Hailo publishes no recipe, and none was attempted.
- No compile was actually run. `hailo_sdk_client` is not installed in this venv, so every claim here is about `detect_head()`'s decision and the ONNX graph, **not** about whether the DFC then succeeds.
