# Sack Detector Accuracy Improvement Plan

## 1. เป้าหมายของระบบ

เป้าหมายหลักไม่ใช่ทำให้ Object Detection ถูก 100% ทุกเฟรม แต่คือทำให้ระบบนับกระสอบปลายทางมีความแม่นยำสูงที่สุด

### Target KPI

- Count Accuracy ต่อเที่ยวงาน: `>= 99%`
- Count Error: `< 1%`
- Overcount ต่อ 1,000 กระสอบ: ต่ำที่สุด
- Undercount ต่อ 1,000 กระสอบ: ต่ำที่สุด
- Exact Count Accuracy: จำนวนเที่ยวที่นับถูกเป๊ะ
- HEF FPS และ Latency ต้องอยู่ในระดับที่ใช้งานจริงได้

---

## 2. แยกปัญหาออกเป็น 5 ส่วน

ระบบจริงประกอบด้วย:

```text
Camera
  -> Object Detection
  -> Object Tracking
  -> Counting Logic
  -> HEF Deployment
  -> Final Count
```

ต้องตรวจให้ได้ก่อนว่าความผิดพลาดเกิดจากส่วนใด

### 2.1 Detection Error

- ไม่เจอกระสอบจริง
- ตรวจสิ่งอื่นเป็นกระสอบ
- Confidence ต่ำเกินไป
- กระสอบถูกบังแล้ว detection หาย

### 2.2 Localization Error

- Bounding box เล็กเกินไป
- Bounding box ใหญ่เกินไป
- Bounding box แกว่งระหว่างแต่ละเฟรม
- Bounding box ครอบวัตถุไม่สม่ำเสมอ

### 2.3 Tracking Error

- Track ID หาย
- Track ID เปลี่ยน
- กระสอบหนึ่งใบมีหลาย Track ID
- กระสอบสองใบถูกมองเป็น Track เดียว

### 2.4 Counting Error

- นับซ้ำ
- นับไม่ครบ
- นับผิดทิศทาง
- Bounding box แกว่งข้ามเส้นไปมา
- กระสอบออกจากภาพแล้วกลับเข้ามาถูกนับใหม่

### 2.5 Deployment Error

- `.pt` ตรวจได้ แต่ `.hef` ตรวจไม่ได้
- Confidence ระหว่าง `.pt` และ `.hef` ต่างกันมาก
- Bounding box หลัง quantization ผิดเพี้ยน
- Preprocessing ของ HEF ไม่ตรงกับตอน train

---

## 3. Phase 1: สร้าง Baseline และ Ground Truth

ก่อนเทรนโมเดลรอบใหม่ ต้องวัดระบบปัจจุบันให้ชัดเจน

### สิ่งที่ต้องเตรียม

- วิดีโอหน้างานจริง 10-20 วิดีโอ
- กระสอบจริงรวมอย่างน้อย 1,000-3,000 ใบ
- มีหลายช่วงเวลาและหลายสภาพแสง
- มี Ground Truth จำนวนกระสอบจริง
- ระบุเวลาที่กระสอบแต่ละใบข้ามจุดนับ
- ระบุเหตุการณ์ยาก เช่น บังกัน ซ้อนกัน หรืออยู่ริมภาพ

### Metrics ที่ต้องวัด

#### Detection

- Precision
- Recall
- F1-score
- mAP50
- mAP75
- mAP50-95
- False Positive
- False Negative

#### Tracking

- ID Switch
- Track Lost
- Track Fragmentation
- Duplicate Track

#### Counting

- Actual Count
- Predicted Count
- Count Error
- Absolute Count Error
- Overcount
- Undercount
- Count Accuracy

สูตร Count Accuracy:

```text
Count Accuracy = 1 - |Predicted Count - Actual Count| / Actual Count
```

---

## 4. Phase 2: สร้าง Error Taxonomy

นำทุก error ที่พบมาแบ่งหมวด

### False Negative

```text
FN-OCCLUDED
FN-SMALL
FN-BLUR
FN-BRIGHT
FN-DARK
FN-EDGE
FN-STACKED
FN-DEFORMED
FN-HEF
```

### False Positive

```text
FP-WHITE-SHIRT
FP-WALL
FP-PLASTIC
FP-CONTAINER
FP-DUST
FP-REFLECTION
FP-PARTIAL-OBJECT
```

### Tracking Error

```text
ID-SWITCH
ID-LOST
ID-DUPLICATE
TRACK-FRAGMENT
TRACK-MERGE
```

### Counting Error

```text
COUNT-DUPLICATE
COUNT-MISSED
COUNT-WRONG-DIRECTION
COUNT-JITTER
COUNT-REENTRY
```

### ตารางสรุป Error

| Error Type | จำนวน | กระทบ Count | Priority | แนวทางแก้ |
|---|---:|---:|---:|---|
| FN-OCCLUDED | - | สูง | สูง | เพิ่มข้อมูล occlusion |
| FP-WHITE-SHIRT | - | กลาง | กลาง | เพิ่ม hard negative |
| ID-SWITCH | - | สูง | สูง | ปรับ tracker |
| COUNT-JITTER | - | สูง | สูง | ใช้ zone และ hysteresis |

---

## 5. Phase 3: ปรับปรุง Dataset

### 5.1 ห้ามสุ่ม Split เป็นราย Frame

วิดีโอเดียวกันห้ามกระจายอยู่ทั้ง Train และ Validation

ตัวอย่างที่ถูกต้อง:

```text
Train:
- Video Day 1-6

Validation:
- Video Day 7

Test:
- Video Day 8-9
```

ควร Split ตาม:

- Video ID
- วันถ่าย
- เที่ยวรถ
- มุมกล้อง
- สภาพแสง
- สถานที่

### 5.2 ลดข้อมูลซ้ำ

ไม่ควร extract ทุกเฟรมแล้วนำทั้งหมดไป train

แนวทาง:

- Sampling ทุก 0.5-1 วินาที
- เพิ่ม sampling รอบเหตุการณ์ยาก
- ตัดภาพที่เหมือนกันมากออก
- ใช้ perceptual hash หรือ image embedding ช่วย deduplicate

### 5.3 Annotation Guideline

กำหนดมาตรฐานเดียวกันทั้ง Dataset

- ครอบเฉพาะส่วนของกระสอบที่มองเห็น
- ไม่เดาส่วนที่ถูกบัง
- ไม่ครอบมือ แขน หรือเสื้อ
- Bounding box ต้องชิดวัตถุ
- กระสอบสองใบต้องแยกสอง box
- วัตถุริมภาพยัง annotate หากระบุได้
- กำหนด policy สำหรับวัตถุที่มองเห็นน้อยมาก
- ตรวจ missing label และ duplicate label

### 5.4 Hard Positive

เพิ่มภาพที่โมเดลตรวจพลาดจริง

- กระสอบถูกคนบัง
- กระสอบซ้อนกัน
- กระสอบขนาดเล็ก
- กระสอบริมภาพ
- Motion blur
- แดดจัด
- เงามืด
- กระสอบพับหรือเสียรูป

### 5.5 Hard Negative

เพิ่มภาพที่โมเดลเคยตรวจผิด

- เสื้อขาว
- ผ้าใบขาว
- ผนังขาว
- พื้นสะท้อน
- ถุงพลาสติก
- ฝุ่น
- แสงแฟลร์
- ตู้คอนเทนเนอร์
- คนเดินผ่านโดยไม่ถือกระสอบ

ภาพ Negative ไม่ต้องมี Bounding box และใช้ label file ว่าง

---

## 6. Phase 4: Controlled Experiments

ห้ามเปลี่ยนหลายตัวแปรพร้อมกัน ต้องเปลี่ยนทีละกลุ่มเพื่อรู้ว่าอะไรทำให้ดีขึ้น

### Experiment Group A: Annotation

| Experiment | Dataset | Model | Resolution |
|---|---|---|---:|
| A01 | Dataset เดิม | YOLO11n | 512 |
| A02 | Clean Annotation | YOLO11n | 512 |

วัตถุประสงค์: ตรวจว่าคุณภาพ label มีผลมากแค่ไหน

### Experiment Group B: Dataset

| Experiment | Dataset |
|---|---|
| B01 | Clean Baseline |
| B02 | Baseline + Hard Negative |
| B03 | B02 + Occlusion |
| B04 | B03 + Difficult Lighting |

### Experiment Group C: Model และ Resolution

| Experiment | Model | Image Size |
|---|---|---:|
| C01 | YOLO11n | 512 |
| C02 | YOLO11s | 512 |
| C03 | YOLO11s | 640 |
| C04 | YOLO11m | 640 |

### Experiment Group D: Augmentation

| Experiment | Augmentation |
|---|---|
| D01 | Minimal |
| D02 | Moderate |
| D03 | Strong |

ควรหลีกเลี่ยง augmentation ที่รุนแรงเกินหน้างานจริง เช่น:

- Perspective สูง
- Mosaic มากเกินไป
- Scale แรง
- HSV เปลี่ยนมาก
- Random crop จนกระสอบขาด

### Experiment Group E: Class Design

| Experiment | Classes |
|---|---|
| E01 | sack เท่านั้น |
| E02 | person + sack |

เลือกจากผลของ Sack Recall และ Final Count Accuracy

---

## 7. Phase 5: ปรับปรุง Tracking และ Counting Logic

### 7.1 ห้ามนับจาก Detection ราย Frame

Flow ที่ควรใช้:

```text
Detection
  -> Tracker ID
  -> Track History
  -> State Machine
  -> Count Event
```

### 7.2 ใช้ Two-Zone Counting

แทนการใช้เส้นเดียว

```text
Zone A
  -> Transition Zone
  -> Zone B
```

ให้นับเมื่อ:

1. Track เคยอยู่ Zone A
2. เคลื่อนผ่าน Transition Zone
3. เข้า Zone B
4. อยู่ Zone B ต่อเนื่องหลายเฟรม
5. เคลื่อนที่ไปในทิศทางที่ถูกต้อง
6. Track ID นี้ยังไม่เคยนับ

### 7.3 Track State

```text
NEW
SEEN_IN_A
CROSSING
CONFIRMED_IN_B
COUNTED
LOST
```

### 7.4 เงื่อนไขช่วยลดการนับผิด

- Minimum Track Age 3-5 เฟรม
- Minimum Movement Distance
- Direction Consistency
- Median Centroid จากหลายเฟรม
- Confirm ใน Zone B อย่างน้อย 3 เฟรม
- Cooldown ต่อ Track ID
- เก็บ Track Memory หลัง detection หายชั่วคราว
- ห้าม Track ที่ COUNTED แล้วนับซ้ำ

### 7.5 Temporal Evidence

ไม่ควรตัดสินจาก Confidence เฟรมเดียว

ใช้ร่วมกัน:

- จำนวนเฟรมที่ตรวจเจอ
- Maximum Confidence
- Median Confidence
- Track Duration
- Movement Direction
- Track Stability

ตัวอย่างเงื่อนไข:

```text
Detected >= 4 frames
Max Confidence >= 0.65
Median Confidence >= 0.40
Movement Direction ถูกต้อง
```

---

## 8. Phase 6: Confidence Threshold Sweep

ทดลองค่า Confidence หลายค่า

```text
0.15
0.20
0.25
0.30
0.35
0.40
0.50
0.60
```

วัดทุกค่าด้วยวิดีโอชุดเดิม

| Confidence | Precision | Recall | Overcount | Undercount | Count Accuracy |
|---:|---:|---:|---:|---:|---:|
| 0.20 | - | - | - | - | - |
| 0.30 | - | - | - | - | - |
| 0.40 | - | - | - | - | - |
| 0.50 | - | - | - | - | - |

เลือกค่าที่ทำให้ Final Count ดีที่สุด ไม่จำเป็นต้องเป็นค่าที่ F1-score สูงที่สุด

---

## 9. Phase 7: PT, ONNX และ HEF Parity Test

ใช้ภาพ Test ชุดเดียวกันกับทุก Runtime

```text
Test Frames
  -> PT Inference
  -> ONNX Inference
  -> HEF Inference
```

เปรียบเทียบ:

- จำนวน Detection
- Class
- Confidence
- Bounding Box
- IoU
- False Positive
- False Negative
- Final Count

### Calibration Dataset สำหรับ HEF

ต้องมีภาพที่ครอบคลุม:

- แดดจัด
- เงามืด
- กระสอบใกล้
- กระสอบไกล
- กระสอบบังกัน
- กระสอบหลายใบ
- Motion blur
- ฝุ่น
- เช้า เที่ยง เย็น

### ตรวจสอบ Preprocessing

- Input Resolution
- RGB หรือ BGR
- Normalization
- Letterbox
- Padding
- Scale
- Quantization
- Output Decode
- NMS

---

## 10. Model Selection Criteria

อย่าเลือกโมเดลจาก mAP เพียงอย่างเดียว

ให้คะแนนจาก:

| Metric | Priority |
|---|---:|
| HEF Count Accuracy | สูงสุด |
| Undercount | สูง |
| Overcount | สูง |
| Sack Recall | สูง |
| Exact Trip Accuracy | สูง |
| FPS บน Hailo-8L | สูง |
| Latency | กลาง |
| mAP50-95 | กลาง |
| Model Size | กลาง |

---

## 11. Golden Test Set

สร้าง Test Set ที่ห้ามนำกลับไป Train

ควรมี:

- 10-20 วิดีโอ
- กระสอบจริง 1,000-3,000 ใบ
- หลายคน
- หลายช่วงเวลา
- หลายสภาพแสง
- หลายระดับ occlusion
- หลายรูปแบบการถือ
- Ground Truth Crossing Event

ทุก Model Version ต้องทดสอบกับชุดนี้

| Version | Dataset | Model | PT Count | HEF Count | Actual | Error |
|---|---|---|---:|---:|---:|---:|
| V1 | Baseline | YOLO11n-512 | - | - | - | - |
| V2 | Clean Labels | YOLO11s-512 | - | - | - | - |
| V3 | Hard Mining | YOLO11s-640 | - | - | - | - |

---

## 12. ML Development Flow ใหม่

Flow เดิม:

```text
Raw Video
  -> Extract Frames
  -> Append Dataset
  -> Annotate
  -> Train
  -> Compile HEF
  -> Deploy
```

Flow ใหม่:

```text
Production Video
  -> Run Current PT and HEF
  -> Save Detection, Track and Count Logs
  -> Compare with Ground Truth
  -> Classify Errors
  -> Select Informative Frames
  -> Deduplicate
  -> Annotation QA
  -> Controlled Training Experiments
  -> Detection Evaluation
  -> Tracking Evaluation
  -> Counting Evaluation
  -> PT/HEF Parity Test
  -> Shadow Deployment
  -> Promote Best Version
```

---

## 13. ลำดับการทำงานที่แนะนำ

### Priority 1: Measurement

- สร้าง Ground Truth Video
- วัด Count Error
- แยก Detection, Tracking และ Counting Error

### Priority 2: Counting Logic

- เปลี่ยนจาก Single Line เป็น Two-Zone
- ใช้ Track State Machine
- ป้องกัน Count Duplicate
- ใช้ Temporal Validation

### Priority 3: Dataset Quality

- Split ตาม Video
- Audit Annotation
- Deduplicate
- เพิ่ม Hard Positive และ Hard Negative

### Priority 4: Model Experiments

- YOLO11n เทียบ YOLO11s
- 512 เทียบ 640
- Minimal เทียบ Moderate Augmentation
- Sack-only เทียบ Person + Sack

### Priority 5: HEF Optimization

- PT/ONNX/HEF Parity
- ตรวจ Calibration Dataset
- ตรวจ Preprocessing และ NMS

---

## 14. Definition of Done

Model Version ใหม่จะผ่านเมื่อ:

- Count Accuracy บน Golden Test Set ดีกว่า Baseline
- Undercount ไม่เพิ่มขึ้น
- Overcount ไม่เพิ่มขึ้น
- HEF ให้ผลใกล้เคียง PT
- FPS ผ่านข้อกำหนด
- ไม่มี Regression ในสภาพแสงสำคัญ
- ผ่าน Shadow Test หน้างานจริง
- สามารถ Rollback กลับ Model ก่อนหน้าได้

---

## 15. สรุป

การเพิ่มความแม่นยำของ Sack Detector ไม่ควรใช้วิธีเพิ่มภาพและเทรนซ้ำอย่างเดียว

ระบบที่มี Count Accuracy ระดับสูงต้องประกอบด้วย:

```text
Clean Annotation
+ Diverse Dataset
+ Video-Level Split
+ Hard Example Mining
+ Controlled Experiments
+ Stable Tracking
+ Zone-Based Counting
+ Temporal Validation
+ PT/HEF Parity Testing
+ Golden Test Set
```

เป้าหมายที่เหมาะสมคือ:

```text
Detector ไม่จำเป็นต้องถูก 100% ทุกเฟรม
แต่ระบบนับกระสอบต้องผิดน้อยกว่า 1%
```
