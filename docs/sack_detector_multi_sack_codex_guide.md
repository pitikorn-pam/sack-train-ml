# Sack Detector: Multi-Sack Carrying Improvement Plan

## Purpose

This document defines the next major development milestone for the sack-counting system.

The current system mainly detects and counts one 50 kg sack carried by one person. The next version must support:

- 20 kg sacks
- 25 kg sacks
- 50 kg sacks
- One sack per person
- Two sacks stacked or carried together by one person
- Partial and heavy occlusion
- Different carrying postures
- Different worker strength and movement behavior
- Reliable final count on Hailo HEF deployment

The primary objective is not perfect detection in every frame.

The primary objective is:

```text
Final event-level sack count accuracy >= 99%
```

## 1. Core Problem Definition

The new problem is no longer only object detection.

It is:

```text
Video
  -> Person Detection
  -> Sack Instance Detection
  -> Tracking
  -> Person-Sack Association
  -> Temporal Evidence Aggregation
  -> Crossing Event Detection
  -> Quantity Estimation
  -> Final Count
```

The system must answer:

```text
How many sacks is this person carrying when crossing the counting zone?
```

Expected output per crossing event:

```json
{
  "event_id": "evt_000123",
  "person_track_id": 17,
  "estimated_sack_count": 2,
  "direction": "IN",
  "confidence": 0.94,
  "timestamp": "2026-07-12T10:20:30+07:00"
}
```

## 2. Main Design Principle

Do not count sacks only from the frame where the person crosses the line.

A double-carry case may look like this:

```text
Frame 1-10:
Two sacks are visible.

Frame 11-20:
One sack becomes heavily occluded.

Frame 21:
The person crosses the counting line.

Frame 21 detection:
Only one sack is visible.
```

The correct behavior is:

```text
Use evidence from the entire track history.
Estimate that the person carries two sacks.
Count +2 when the crossing event is confirmed.
```

## 3. Class Design

### Initial Recommended Classes

Keep the object detection classes simple:

```yaml
names:
  0: person
  1: sack
```

Do not immediately create:

```yaml
sack_20kg
sack_25kg
sack_50kg
```

Reasons:

- Weight may not be visually distinguishable.
- Bag shapes may deform while being carried.
- Printed labels may be hidden.
- Splitting classes reduces samples per class.
- The primary objective is quantity counting, not weight classification.

Store weight as metadata instead.

Example metadata:

```json
{
  "video_id": "video_025",
  "session_id": "session_20260712_am",
  "weight_kg": 25,
  "carried_sacks": 2,
  "carry_mode": "stacked_shoulder",
  "occlusion_level": "heavy",
  "lighting": "direct_sunlight"
}
```

Weight classification can be added later as a separate classifier if required.

## 4. Dataset Unit

Do not treat image count as the primary measure of dataset size.

The main unit must be:

```text
Independent crossing event
```

Bad dataset example:

```text
10 crossing events
400 frames per event
4,000 images
```

Better dataset example:

```text
500 crossing events
8 informative frames per event
4,000 images
```

The second dataset is more useful because it contains more independent behavior variation.

Track these dataset statistics:

```text
Number of images
Number of sack instances
Number of person instances
Number of independent crossing events
Number of videos
Number of sessions
Number of recording days
Number of unique workers
Number of single-carry events
Number of double-carry events
Number of heavy-occlusion events
Number of negative events
```

## 5. Dataset Scenario Matrix

The dataset must be balanced by operational scenario.

| Weight | Quantity | Carry Pattern | Difficulty |
|---|---:|---|---|
| 50 kg | 1 | Shoulder | Baseline |
| 25 kg | 1 | Shoulder / front carry | Normal |
| 20 kg | 1 | Shoulder / front carry | Normal |
| 25 kg | 2 | Stacked | Hard |
| 20 kg | 2 | Stacked | Hard |
| 20 + 25 kg | 2 | Mixed stack | Hard |
| Any | 1-2 | Partial occlusion | Hard |
| Any | 1-2 | Heavy occlusion | Very hard |
| Any | 1-2 | Motion blur | Hard |
| Any | 1-2 | Direct sunlight | Hard |
| Any | 1-2 | Shadow / low contrast | Hard |
| Any | 0 | Person without sack | Negative |

Recommended initial event targets:

```text
Single 50 kg:       100-200 independent events
Single 25 kg:       100-200 independent events
Single 20 kg:       100-200 independent events
Double 25 kg:       100-200 independent events
Double 20 kg:       100-200 independent events
Mixed double:       100+ independent events
Heavy occlusion:    100+ independent events
Negative events:    100+ independent events
```

These are starting targets, not fixed requirements.

Use learning curves to determine whether more data is still improving performance.

## 6. Frame Sampling Policy

Do not extract hundreds of consecutive near-identical frames from every video.

Recommended strategy:

### Base Sampling

```text
1 frame every 0.5-1.0 seconds
```

### Event Sampling

Sample more densely around:

- Sack entering the frame
- Two sacks becoming separately visible
- Stacking
- Partial occlusion
- Heavy occlusion
- Entering counting zone
- Crossing
- Leaving counting zone
- Track loss
- Track ID switch
- Low-confidence detections
- False positives
- False negatives

Recommended:

```text
5-12 informative frames per crossing event
```

Use additional frames only when they add new visual information.

## 7. Annotation Policy

### Core Rule

```text
One physical sack = one annotation instance
```

Two stacked sacks must be labeled as two separate instances.

Incorrect:

```text
One bounding box around the entire stack
```

Correct:

```text
One bounding box for sack A
One bounding box for sack B
```

Even if the boxes overlap heavily, they must remain separate instances.

### Occlusion Policy

Suggested metadata:

```text
none
light
medium
heavy
fully_occluded
```

Suggested visible-ratio groups:

```text
0.75-1.00
0.50-0.75
0.25-0.50
< 0.25
```

Recommended rules:

- Annotate visible sacks separately when their visible regions can be identified.
- Do not invent a bounding box for a sack with zero visible pixels.
- Keep event-level ground truth even if one sack becomes fully hidden in some frames.
- Use the same policy across the entire dataset.
- Audit missing labels carefully in double-carry scenes.

## 8. Train, Validation, and Test Split

Never randomly split adjacent frames from the same video.

Incorrect:

```text
video_01_frame_001 -> train
video_01_frame_002 -> validation
video_01_frame_003 -> train
```

Correct:

```text
Video/session A -> train
Video/session B -> validation
Video/session C -> test
```

Split by:

- Video ID
- Session ID
- Recording day
- Worker group
- Camera setup
- Lighting condition

A single crossing event must exist in only one split.

## 9. Golden Test Set

Create a locked test set that is never used for training.

Recommended structure:

| Scenario | Events | Actual Sacks |
|---|---:|---:|
| 50 kg single | 100 | 100 |
| 25 kg single | 100 | 100 |
| 20 kg single | 100 | 100 |
| 25 kg double | 100 | 200 |
| 20 kg double | 100 | 200 |
| Mixed double | 50 | 100 |
| Heavy occlusion | 50 | 100 |
| Negative crossings | 50 | 0 |

The test set should contain:

- Unseen videos
- Unseen sessions
- Preferably unseen workers
- Multiple lighting conditions
- Different carrying styles
- Different walking speeds
- Different levels of overlap and occlusion

## 10. Detection and NMS

Stacked sacks may produce highly overlapping bounding boxes.

Standard NMS can incorrectly remove one valid detection.

The system must test multiple NMS IoU values:

```text
0.50
0.60
0.70
0.75
0.80
0.85
```

Risk of low NMS IoU:

```text
Two real overlapping sacks
-> one detection is suppressed
-> undercount
```

Risk of high NMS IoU:

```text
Duplicate predictions for one sack
-> duplicates remain
-> overcount
```

Select NMS parameters using double-carry count accuracy, not only mAP.

## 11. Tracking Design

Required track types:

```text
person_track
sack_track
```

Each track should store:

```python
track_id
class_id
first_seen
last_seen
age_frames
bbox_history
centroid_history
confidence_history
velocity_history
direction
counted
lost_frames
```

Recommended tracker experiments:

```text
ByteTrack
BoT-SORT
```

Tune:

```text
track_high_thresh
track_low_thresh
new_track_thresh
match_thresh
track_buffer
```

The main objective is to preserve sack identity during temporary occlusion.

## 12. Person-Sack Association

Each sack track should be associated with a person track.

Example:

```json
{
  "person_track_id": 17,
  "associated_sack_tracks": [52, 61],
  "estimated_sack_count": 2
}
```

Association signals:

- Bounding box proximity
- Bounding box overlap
- Relative position to torso or shoulder
- Similar motion direction
- Similar velocity
- Co-existence over multiple frames
- Sack track located inside or near person region
- Sack disappearing while still attached to the same person track

The association should not be decided from one frame.

Use temporal scoring.

Example conceptual score:

```text
association_score =
    proximity_score
  + motion_similarity
  + overlap_score
  + duration_score
```

## 13. Temporal Evidence Aggregation

For every person track, keep a history of sack evidence.

Example:

```python
person_state = {
    "person_track_id": 17,
    "visible_sack_counts": [1, 2, 2, 2, 1, 1, 1],
    "associated_sack_ids": {52, 61},
    "max_visible_sacks": 2,
    "temporal_mode": 2,
    "estimated_sack_count": 2
}
```

Recommended evidence:

- Maximum visible sack count
- Median visible sack count
- Number of frames with two sacks visible
- Unique associated sack track IDs
- Maximum confidence per sack
- Median confidence
- Track duration
- Motion consistency
- Person-sack association stability

Example decision rule:

```text
If two unique sack tracks were associated with the same person
for at least N frames,
then preserve estimated_sack_count = 2
even if one sack becomes temporarily hidden.
```

## 14. Crossing State Machine

Do not use a single-line centroid crossing alone.

Use zones:

```text
Zone A
  -> Transition Zone
  -> Zone B
```

Person state:

```text
NEW
SEEN_IN_A
APPROACHING
CROSSING
CONFIRMED_IN_B
COUNTED
LOST
```

Count only when:

1. Person track was observed in Zone A.
2. Direction is valid.
3. Person enters Zone B.
4. Person remains in Zone B for N frames.
5. The crossing event has not been counted.
6. Estimated sack quantity is stable.

Example result:

```python
if person.state == "CONFIRMED_IN_B" and not person.counted:
    total_count += person.estimated_sack_count
    person.counted = True
```

## 15. Auxiliary Person Load Classifier

For heavy occlusion, add an optional second model.

Input:

```text
Crop of tracked person
```

Output:

```text
0 sacks
1 sack
2 sacks
```

Recommended architecture:

```text
Sack detector
+
Person load classifier
+
Temporal fusion
```

Do not rely on the classifier alone.

Suggested fusion:

```text
Detector max visible sacks = 2
Classifier temporal majority = 2
Final estimate = 2
```

Fallback example:

```text
Current detector result = 1
Earlier detector result = 2
Classifier majority = 2
Final estimate = 2
```

## 16. Instance Segmentation POC

Add a controlled experiment comparing:

```text
Object Detection
vs
Instance Segmentation
```

Segmentation may help when:

- Two sacks overlap heavily
- Bounding boxes overlap too much
- Sack shapes are irregular
- Centroid from bounding box is unstable

Compare:

| Model | Single Recall | Double Recall | Count Accuracy | HEF FPS |
|---|---:|---:|---:|---:|
| Detection | - | - | - | - |
| Segmentation | - | - | - | - |

Do not replace detection in production until:

- HEF conversion works
- FPS is acceptable
- Count accuracy clearly improves
- Postprocessing is stable

## 17. Camera and Scene Constraints

If two sacks become one silhouette for the entire crossing sequence, the model may not have enough visual evidence.

Possible engineering solutions:

- Move camera to a more side-facing angle
- Move counting zone to a clearer region
- Use an oblique camera angle
- Increase distance from the subject
- Add a second camera
- Use earlier frames before full occlusion
- Control the walking path

Camera placement should be treated as part of the ML system.

Do not assume model scaling alone can solve invisible information.

## 18. Metrics

### Detection Metrics

```text
Precision
Recall
mAP50
mAP75
mAP50-95
False positives
False negatives
```

### Scenario Metrics

```text
Single-sack recall
Double-sack instance recall
Heavy-occlusion recall
Both-sacks-detected rate
At-least-once both visible rate
Double-carry undercount rate
```

### Event-Level Metrics

```text
Event sack-count accuracy
Exact event accuracy
Overcount
Undercount
Count MAE
Count error per 1,000 sacks
```

### Both-Sacks-Detected Rate

```text
Double-carry events where both sacks are detected
at least once
/
Total double-carry events
```

### Double-Carry Count Accuracy

```text
Double-carry events correctly counted as 2
/
Total double-carry events
```

### Final Count Accuracy

```text
1 - abs(predicted_count - actual_count) / actual_count
```

Report results separately for:

```text
Single carry
Double carry
Heavy occlusion
Overall
```

Do not report only the overall metric.

## 19. Experiment Plan

### Experiment Group A: Dataset

```text
A01: Current dataset
A02: Video-level split
A03: Deduplicated dataset
A04: Hard double-carry cases
A05: Hard negative cases
```

### Experiment Group B: Model

```text
B01: YOLO11n 512
B02: YOLO11s 512
B03: YOLO11s 640
B04: YOLO11m 640
```

### Experiment Group C: NMS

```text
C01: IoU 0.50
C02: IoU 0.60
C03: IoU 0.70
C04: IoU 0.80
C05: IoU 0.85
```

### Experiment Group D: Tracking

```text
D01: ByteTrack baseline
D02: Tuned ByteTrack
D03: BoT-SORT baseline
D04: Tuned BoT-SORT
```

### Experiment Group E: Counting Logic

```text
E01: Single line
E02: Two-zone state machine
E03: Two-zone + minimum track age
E04: Two-zone + temporal evidence
E05: Two-zone + person-sack association
```

### Experiment Group F: Architecture

```text
F01: Detection only
F02: Detection + temporal aggregation
F03: Detection + person-sack association
F04: Detection + load classifier
F05: Instance segmentation POC
```

Only change one experiment group at a time.

## 20. PT, ONNX, and HEF Parity

Every selected model must be evaluated on the same test frames.

```text
PT
ONNX
HEF
```

Compare:

- Detection count
- Class output
- Confidence
- Bounding boxes
- IoU
- NMS behavior
- Sack track continuity
- Final event count

Required HEF checks:

```text
Input resolution
RGB vs BGR
Normalization
Letterbox
Padding
Output decoding
Quantization calibration
NMS
```

The production metric is HEF event-level count accuracy.

## 21. Logging Requirements

For every frame, save structured logs.

Example:

```json
{
  "timestamp": 123.45,
  "frame_id": 3703,
  "persons": [
    {
      "track_id": 17,
      "bbox": [100, 120, 280, 500],
      "state": "CROSSING",
      "estimated_sack_count": 2,
      "associated_sack_ids": [52, 61]
    }
  ],
  "sacks": [
    {
      "track_id": 52,
      "bbox": [160, 180, 260, 320],
      "confidence": 0.83,
      "associated_person_id": 17
    }
  ]
}
```

For each count event, save:

```json
{
  "event_id": "evt_000123",
  "person_track_id": 17,
  "quantity": 2,
  "direction": "IN",
  "evidence_frames": [3620, 3630, 3642, 3703],
  "max_visible_sacks": 2,
  "confidence": 0.94
}
```

This logging is required for error analysis.

## 22. Error Taxonomy

### Detection

```text
FN-SINGLE
FN-SECOND-SACK
FN-OCCLUDED
FN-SMALL
FN-BLUR
FN-BRIGHT
FN-DARK
FP-WHITE-SHIRT
FP-PLASTIC
FP-REFLECTION
```

### Tracking

```text
ID-SWITCH
ID-LOST
ID-DUPLICATE
TRACK-MERGE
TRACK-FRAGMENT
```

### Association

```text
WRONG-PERSON-ASSOCIATION
SACK-NOT-ASSOCIATED
SACK-REASSIGNED
```

### Counting

```text
COUNT-MISSED
COUNT-DUPLICATE
COUNT-WRONG-QUANTITY
COUNT-WRONG-DIRECTION
COUNT-REENTRY
```

### Deployment

```text
PT-HEF-CONFIDENCE-DROP
PT-HEF-BBOX-DIFFERENCE
PT-HEF-MISSING-SECOND-SACK
```

## 23. Milestones

### M0: Current Baseline

Scope:

```text
50 kg
Single sack
Current detector and counting logic
```

Deliverables:

- Baseline metrics
- Baseline videos
- Current PT and HEF comparison

### M1: Weight Generalization

Scope:

```text
20 kg
25 kg
50 kg
Single carry
```

Target:

```text
Single-carry event count accuracy >= 99%
```

### M2: Visible Double Carry

Scope:

```text
20 kg x2
25 kg x2
Both sacks visually separable
```

Targets:

```text
Both-sacks-detected rate >= 95%
Double-carry event count accuracy >= 98%
```

### M3: Partial Occlusion Double Carry

Scope:

```text
Second sack temporarily hidden
Temporal tracking
Person-sack association
```

Target:

```text
Double-carry event count accuracy >= 99%
```

### M4: Extreme Occlusion

Compare:

```text
Detection
Instance segmentation
Person load classifier
Camera reposition
Multi-camera
```

### M5: Production Acceptance

Targets:

```text
Overall final count error < 1%
No major regression on single-carry cases
HEF result close to PT result
Required FPS achieved
Rollback available
```

## 24. Definition of Done

A model and logic version can be promoted only when:

- Golden test set result improves over baseline.
- Single-carry accuracy does not regress.
- Double-carry undercount decreases.
- Heavy-occlusion performance improves.
- PT, ONNX, and HEF outputs are acceptably close.
- Hailo FPS and latency meet production requirements.
- Count logs and evidence frames are generated.
- Shadow deployment passes.
- Previous model can be restored immediately.

## 25. Recommended Implementation Order

```text
1. Add event-level logging.
2. Create golden test videos.
3. Split dataset by video/session.
4. Add weight and carry metadata.
5. Add double-carry annotations.
6. Implement two-zone person crossing state machine.
7. Add person-sack association.
8. Add temporal sack-count aggregation.
9. Tune NMS for overlapping sacks.
10. Tune tracker parameters.
11. Run model-size and resolution experiments.
12. Compare PT, ONNX, and HEF.
13. Test auxiliary load classifier.
14. Run instance segmentation POC.
15. Evaluate camera angle if extreme occlusion remains unsolved.
```

## 26. Recommended Target Architecture

```text
Camera Frames
      |
      v
Person and Sack Detector
      |
      v
Person Tracker + Sack Tracker
      |
      v
Person-Sack Association
      |
      v
Temporal Evidence Aggregator
      |
      v
Estimated Quantity per Person
      |
      v
Two-Zone Crossing State Machine
      |
      v
Count Event: +1 or +2
      |
      v
MQTT / Database / Dashboard
```

## 27. Codex Tasks

Codex should inspect the existing codebase before editing.

Do not assume current filenames or architecture.

Required tasks:

```text
- Locate detection inference pipeline.
- Locate tracker integration.
- Locate current line-crossing logic.
- Locate MQTT count publishing.
- Identify PT, ONNX, and HEF paths.
- Add structured detection and count-event logging.
- Refactor counting logic into explicit state objects.
- Add person-sack association module.
- Add temporal quantity estimation module.
- Add configuration for zones and thresholds.
- Add replay evaluation mode for recorded videos.
- Add metrics export.
- Add tests for +1 and +2 count events.
- Preserve current single-sack behavior.
```

Suggested module boundaries:

```text
detection/
tracking/
association/
counting/
evaluation/
logging/
config/
```

Suggested interfaces:

```python
class PersonTrackState:
    pass

class SackTrackState:
    pass

class PersonSackAssociator:
    pass

class SackQuantityEstimator:
    pass

class CrossingStateMachine:
    pass

class CountEvent:
    pass
```

## 28. Final Principle

The system must not depend on detecting every sack in every frame.

The correct design is:

```text
Use the best visual evidence from the entire crossing sequence.
Maintain object identity through temporary occlusion.
Associate sacks with the correct person.
Estimate quantity before confirming the crossing event.
Count the event as +1 or +2.
```

The target is not:

```text
Perfect frame-level detection
```

The target is:

```text
Reliable event-level sack counting under real field conditions
```
