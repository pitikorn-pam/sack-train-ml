Creating new Ultralytics Settings v0.0.6 file ✅ 
View Ultralytics Settings with 'yolo settings' or at '/root/.config/Ultralytics/settings.json'
Update Settings with 'yolo settings key=value', i.e. 'yolo settings runs_dir=path/to/dir'. For help see https://docs.ultralytics.com/quickstart/#ultralytics-settings.
Downloading https://github.com/ultralytics/assets/releases/download/v8.4.0/yolo11s-seg.pt to 'yolo11s-seg.pt': 100% ━━━━━━━━━━━━ 19.7MB 347.0MB/s 0.1s
Ultralytics 8.4.95 🚀 Python-3.12.13 torch-2.11.0+cu128 CUDA:0 (NVIDIA L4, 22563MiB)
engine/trainer: agnostic_nms=False, amp=True, angle=1.0, augment=False, auto_augment=randaugment, batch=-1, bgr=0.0, box=7.5, cache=False, cfg=None, classes=None, close_mosaic=10, cls=0.5, cls_pw=0.0, cls_remap=True, compile=False, conf=None, copy_paste=0.0, copy_paste_mode=flip, cos_lr=False, cutmix=0.0, data=/content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/data.yaml, degrees=0.0, deterministic=True, device=, dfl=1.5, dis=6.0, distill_model=None, dnn=False, dropout=0.0, dynamic=False, embed=None, end2end=None, epochs=100, erasing=0.4, exist_ok=False, fliplr=0.5, flipud=0.0, format=torchscript, fraction=1.0, freeze=None, hsv_h=0.015, hsv_s=0.7, hsv_v=0.4, imgsz=640, iou=0.7, keras=False, kobj=1.0, line_width=None, lr0=0.001, lrf=0.01, mask_ratio=4, max_det=300, mixup=0.0, mode=train, model=yolo11s-seg.pt, momentum=0.937, mosaic=1.0, multi_scale=0.0, name=8940629e-520f-45d0-99bd-d1fe43b7e59a, nbs=64, nms=False, opset=None, optimize=False, optimizer=auto, overlap_mask=True, patience=20, perspective=0.0, plots=True, pose=12.0, pretrained=True, profile=False, project=/content/sack-train-ml/runs, quantize=None, rect=False, resume=False, retina_masks=False, rle=1.0, save=True, save_conf=False, save_crop=False, save_dir=/content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a, save_frames=False, save_json=False, save_period=-1, save_txt=False, scale=0.5, seed=0, shear=0.0, show=False, show_boxes=True, show_conf=True, show_labels=True, simplify=True, single_cls=False, source=None, split=val, stream_buffer=False, task=segment, time=None, tracker=tracktrack.yaml, translate=0.1, val=True, verbose=True, vid_stride=1, visualize=False, warmup_bias_lr=0.1, warmup_epochs=3.0, warmup_momentum=0.8, weight_decay=0.0005, workers=8, workspace=None
Downloading https://ultralytics.com/assets/Arial.ttf to '/root/.config/Ultralytics/Arial.ttf': 100% ━━━━━━━━━━━━ 755.1KB 137.0MB/s 0.0s
Overriding model.yaml nc=80 with nc=2

                   from  n    params  module                                       arguments                     
  0                  -1  1       928  ultralytics.nn.modules.conv.Conv             [3, 32, 3, 2]                 
  1                  -1  1     18560  ultralytics.nn.modules.conv.Conv             [32, 64, 3, 2]                
  2                  -1  1     26080  ultralytics.nn.modules.block.C3k2            [64, 128, 1, False, 0.25]     
  3                  -1  1    147712  ultralytics.nn.modules.conv.Conv             [128, 128, 3, 2]              
  4                  -1  1    103360  ultralytics.nn.modules.block.C3k2            [128, 256, 1, False, 0.25]    
  5                  -1  1    590336  ultralytics.nn.modules.conv.Conv             [256, 256, 3, 2]              
  6                  -1  1    346112  ultralytics.nn.modules.block.C3k2            [256, 256, 1, True]           
  7                  -1  1   1180672  ultralytics.nn.modules.conv.Conv             [256, 512, 3, 2]              
  8                  -1  1   1380352  ultralytics.nn.modules.block.C3k2            [512, 512, 1, True]           
  9                  -1  1    656896  ultralytics.nn.modules.block.SPPF            [512, 512, 5]                 
 10                  -1  1    990976  ultralytics.nn.modules.block.C2PSA           [512, 512, 1]                 
 11                  -1  1         0  torch.nn.modules.upsampling.Upsample         [None, 2, 'nearest']          
 12             [-1, 6]  1         0  ultralytics.nn.modules.conv.Concat           [1]                           
 13                  -1  1    443776  ultralytics.nn.modules.block.C3k2            [768, 256, 1, False]          
 14                  -1  1         0  torch.nn.modules.upsampling.Upsample         [None, 2, 'nearest']          
 15             [-1, 4]  1         0  ultralytics.nn.modules.conv.Concat           [1]                           
 16                  -1  1    127680  ultralytics.nn.modules.block.C3k2            [512, 128, 1, False]          
 17                  -1  1    147712  ultralytics.nn.modules.conv.Conv             [128, 128, 3, 2]              
 18            [-1, 13]  1         0  ultralytics.nn.modules.conv.Concat           [1]                           
 19                  -1  1    345472  ultralytics.nn.modules.block.C3k2            [384, 256, 1, False]          
 20                  -1  1    590336  ultralytics.nn.modules.conv.Conv             [256, 256, 3, 2]              
 21            [-1, 10]  1         0  ultralytics.nn.modules.conv.Concat           [1]                           
 22                  -1  1   1511424  ultralytics.nn.modules.block.C3k2            [768, 512, 1, True]           
 23        [16, 19, 22]  1   1474678  ultralytics.nn.modules.head.Segment          [2, 32, 128, 16, None, [128, 256, 512]]
YOLO11s-seg summary: 204 layers, 10,083,062 parameters, 10,083,046 gradients, 33.1 GFLOPs

Remapped 1/2 cls head rows from pretrained weights by class name
Transferred 561/561 items from pretrained weights
Freezing layer 'model.23.dfl.conv.weight'
AMP: running Automatic Mixed Precision (AMP) checks...
Downloading https://github.com/ultralytics/assets/releases/download/v8.4.0/yolo26n.pt to 'yolo26n.pt': 100% ━━━━━━━━━━━━ 5.3MB 352.1MB/s 0.0s
AMP: checks passed ✅
train: Fast image access ✅ (ping: 0.0±0.0 ms, read: 1346.7±505.6 MB/s, size: 40.1 KB)
train: Scanning /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/labels... 3994 images, 132 backgrounds, 0 corrupt: 100% ━━━━━━━━━━━━ 3994/3994 1.1Kit/s 3.6s
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/00_07_06-64_jpg.rf.be872012471b89bff2d586a2ad64b6d9.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/00_07_18-40_jpg.rf.a085a305b0deca1a41a9967ebee4f20a.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/232_jpg.rf.dc47f6bf97d2cc3df3f2b894bff5b9e6.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/334_jpg.rf.3d333e86dabdeb0da22b4d3a14742d6e.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/334_jpg.rf.a751352c785e81bafb51ca8100a5cee7.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/3560_jpg.rf.192fbc06c7985ec0f5a0212c68c9b8e5.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/3560_jpg.rf.cf7635ec0e4bf003e869491f76d90d05.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/edge001_vid2_f004746_jpg.rf.208e2bc48ff27cf832ffed2584cb5127.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame20230404_124905-850474_jpg.rf.07168b690cb8a18651846d093de36e27.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_0061_jpg.rf.e95ea3a8592b3740bb0d4bd944ab8524.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_013500_539-613s_jpg.rf.e89b86dd1a7a9f6689eda6556c97f0ef.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_032670_1089-000s_jpg.rf.55b699140ce12a0b3877f7905bca1c6f.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_049950_1665-000s_jpg.rf.da23c50b56a614f500535680b83ef531.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_049950_1665-000s_jpg.rf.f2d25323b4eeae266253f76516f1c3ed.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_057450_2296-529s_jpg.rf.a5db2c2e9a20a92949b50eec25317bcf.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_063225_2527-184s_jpg.rf.b6394b95a5004830971a6e0825fc3a7b.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_065100_2602-333s_jpg.rf.4c8dcb2cf5dffe8bc5090a976082e829.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_068400_2734-039s_jpg.rf.b20ed6a006ada983b10ebf5647d5bd88.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_068400_2734-039s_jpg.rf.ffa8665f7f748e35be7569c70a7920fe.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_068625_2743-029s_jpg.rf.6d67cb8e5f62f58d92dabc3472ad300d.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_069930_2331-000s_jpg.rf.5978f043de806a050414bb867068a9c7.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_072630_2421-000s_jpg.rf.3198de055568b18765c28c0b238d4c78.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_074880_2496-000s_jpg.rf.1af630cc4dfe5a3d36336cb96b93812b.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_074880_2496-000s_jpg.rf.4a05968009f309ca3afd195e1e76d1a7.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_081000_2700-000s_jpg.rf.49a5a58b38a9aad21d521b05849795a9.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_084870_2829-000s_jpg.rf.af4920abba3755ad4f117dcfdb1beb3b.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_086940_2898-000s_jpg.rf.4a9772be43443a48ef5c6915119e0b0a.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_088350_3531-466s_jpg.rf.7c708af39c3d3d52999562c5ef13d1cf.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_093900_3753-306s_jpg.rf.21e983acc190def200c186401a6a3364.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_117900_4712-618s_jpg.rf.08f7df05078c204da02b30323cbc8706.jpg: 1 duplicate labels removed
train: New cache created: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/labels.cache
albumentations: Blur(p=0.01, blur_limit=(3, 7)), MedianBlur(p=0.01, blur_limit=(3, 7)), ToGray(p=0.01, method='weighted_average', num_output_channels=3), CLAHE(p=0.01, clip_limit=(1.0, 4.0), tile_grid_size=(8, 8))
AutoBatch: Computing optimal batch size for imgsz=640 at 60.0% CUDA memory utilization.
AutoBatch: CUDA:0 (NVIDIA L4) 22.03G total, 0.14G reserved, 0.12G allocated, 21.78G free
      Params      GFLOPs  GPU_mem (GB)  forward (ms) backward (ms)                   input                  output
    10083062       33.08         0.994         78.83           nan        (1, 3, 640, 640)                    list
    10083062       66.16         2.196          38.2           nan        (2, 3, 640, 640)                    list
    10083062       132.3         3.773          38.6           nan        (4, 3, 640, 640)                    list
    10083062       264.6         6.986         47.26           nan        (8, 3, 640, 640)                    list
    10083062       529.2        13.007         64.51           nan       (16, 3, 640, 640)                    list
    10083062        1058        24.734           145           nan       (32, 3, 640, 640)                    list
CUDA out of memory. Tried to allocate 20.00 MiB. GPU 0 has a total capacity of 22.03 GiB of which 15.12 MiB is free. Including non-PyTorch memory, this process has 22.01 GiB memory in use. Of the allocated memory 21.62 GiB is allocated by PyTorch, and 135.82 MiB is reserved by PyTorch but unallocated. If reserved but unallocated memory is large try setting PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True to avoid fragmentation.  See documentation for Memory Management  (https://docs.pytorch.org/docs/stable/notes/cuda.html#optimizing-memory-usage-with-pytorch-cuda-alloc-conf)
AutoBatch: Using batch-size 15 for CUDA:0 12.59G/22.03G (57%) ✅
train: Fast image access ✅ (ping: 0.0±0.0 ms, read: 1375.0±560.8 MB/s, size: 35.4 KB)
train: Scanning /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/labels.cache... 3994 images, 132 backgrounds, 0 corrupt: 100% ━━━━━━━━━━━━ 3994/3994 1.0Git/s 0.0s
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/00_07_06-64_jpg.rf.be872012471b89bff2d586a2ad64b6d9.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/00_07_18-40_jpg.rf.a085a305b0deca1a41a9967ebee4f20a.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/232_jpg.rf.dc47f6bf97d2cc3df3f2b894bff5b9e6.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/334_jpg.rf.3d333e86dabdeb0da22b4d3a14742d6e.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/334_jpg.rf.a751352c785e81bafb51ca8100a5cee7.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/3560_jpg.rf.192fbc06c7985ec0f5a0212c68c9b8e5.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/3560_jpg.rf.cf7635ec0e4bf003e869491f76d90d05.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/edge001_vid2_f004746_jpg.rf.208e2bc48ff27cf832ffed2584cb5127.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame20230404_124905-850474_jpg.rf.07168b690cb8a18651846d093de36e27.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_0061_jpg.rf.e95ea3a8592b3740bb0d4bd944ab8524.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_013500_539-613s_jpg.rf.e89b86dd1a7a9f6689eda6556c97f0ef.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_032670_1089-000s_jpg.rf.55b699140ce12a0b3877f7905bca1c6f.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_049950_1665-000s_jpg.rf.da23c50b56a614f500535680b83ef531.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_049950_1665-000s_jpg.rf.f2d25323b4eeae266253f76516f1c3ed.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_057450_2296-529s_jpg.rf.a5db2c2e9a20a92949b50eec25317bcf.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_063225_2527-184s_jpg.rf.b6394b95a5004830971a6e0825fc3a7b.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_065100_2602-333s_jpg.rf.4c8dcb2cf5dffe8bc5090a976082e829.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_068400_2734-039s_jpg.rf.b20ed6a006ada983b10ebf5647d5bd88.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_068400_2734-039s_jpg.rf.ffa8665f7f748e35be7569c70a7920fe.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_068625_2743-029s_jpg.rf.6d67cb8e5f62f58d92dabc3472ad300d.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_069930_2331-000s_jpg.rf.5978f043de806a050414bb867068a9c7.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_072630_2421-000s_jpg.rf.3198de055568b18765c28c0b238d4c78.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_074880_2496-000s_jpg.rf.1af630cc4dfe5a3d36336cb96b93812b.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_074880_2496-000s_jpg.rf.4a05968009f309ca3afd195e1e76d1a7.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_081000_2700-000s_jpg.rf.49a5a58b38a9aad21d521b05849795a9.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_084870_2829-000s_jpg.rf.af4920abba3755ad4f117dcfdb1beb3b.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_086940_2898-000s_jpg.rf.4a9772be43443a48ef5c6915119e0b0a.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_088350_3531-466s_jpg.rf.7c708af39c3d3d52999562c5ef13d1cf.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_093900_3753-306s_jpg.rf.21e983acc190def200c186401a6a3364.jpg: 1 duplicate labels removed
train: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/train/images/frame_117900_4712-618s_jpg.rf.08f7df05078c204da02b30323cbc8706.jpg: 1 duplicate labels removed
albumentations: Blur(p=0.01, blur_limit=(3, 7)), MedianBlur(p=0.01, blur_limit=(3, 7)), ToGray(p=0.01, method='weighted_average', num_output_channels=3), CLAHE(p=0.01, clip_limit=(1.0, 4.0), tile_grid_size=(8, 8))
val: Fast image access ✅ (ping: 0.0±0.0 ms, read: 815.2±276.3 MB/s, size: 38.3 KB)
val: Scanning /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/valid/labels... 616 images, 11 backgrounds, 0 corrupt: 100% ━━━━━━━━━━━━ 616/616 780.9it/s 0.8s
val: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/valid/images/00_06_07-56_jpg.rf.f8b5e1c11f16b0abfdb9da445dbab8dd.jpg: 1 duplicate labels removed
val: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/valid/images/frame_039240_1308-000s_jpg.rf.bd0a8aedd2bc5143d7651b2d9ff88fbd.jpg: 1 duplicate labels removed
val: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/valid/images/frame_063150_2524-383s_jpg.rf.23040b0e97795e419f7e0bddd94fbfdd.jpg: 1 duplicate labels removed
val: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/valid/images/frame_089775_3588-701s_jpg.rf.89e871d589868bd848e694d6a15660da.jpg: 1 duplicate labels removed
val: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/valid/images/frame_090300_3609-687s_jpg.rf.f8f6d4801fe4725052b018417081699f.jpg: 1 duplicate labels removed
val: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/valid/images/frame_092325_3690-352s_jpg.rf.eb9fde02ccdd313a815cbd21f973ea59.jpg: 1 duplicate labels removed
val: New cache created: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/valid/labels.cache
optimizer: 'optimizer=auto' found, ignoring 'lr0=0.001' and 'momentum=0.937' and determining best 'optimizer', 'lr0' and 'momentum' automatically... 
optimizer: AdamW(lr=0.001667, momentum=0.9) with parameter groups 90 weight(decay=0.0), 101 weight(decay=0.00046875), 100 bias(decay=0.0)
Plotting labels to /content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/labels.jpg... 
Image sizes 640 train, 640 val
Using 8 dataloader workers
Logging results to /content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a
Starting training for 100 epochs...

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
      1/100      4.84G      1.047      2.131      1.206       1.15          0         24        640: 100% ━━━━━━━━━━━━ 267/267 3.1it/s 1:27
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 1.6it/s 12.8s
                   all        616       3174      0.751      0.735       0.77      0.544      0.749      0.733      0.763      0.515

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
      2/100      5.25G      1.135      2.238      1.156      1.184          0         58        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.0it/s 6.9s
                   all        616       3174      0.677       0.69      0.729      0.495      0.678      0.692      0.722      0.453

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
      3/100      5.25G      1.138      2.221      1.116      1.187          0         49        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.9s
                   all        616       3174      0.751      0.732      0.776      0.546      0.752       0.73      0.769      0.533

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
      4/100      5.25G        1.1      2.122      1.059      1.164          0         28        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.0it/s 6.9s
                   all        616       3174      0.836      0.753      0.845      0.617      0.846      0.752      0.836      0.583

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
      5/100      5.25G      1.046       2.04     0.9652      1.132          0         90        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.0it/s 6.9s
                   all        616       3174       0.86      0.789      0.867      0.657      0.866      0.786      0.859      0.628

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
      6/100      5.25G      1.017      1.949     0.9296      1.121          0         18        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.8s
                   all        616       3174      0.867      0.808      0.884       0.69      0.873      0.802      0.877      0.666

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
      7/100      5.25G     0.9813      1.873     0.8761      1.095          0         17        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.0it/s 6.9s
                   all        616       3174       0.88      0.818      0.899      0.711      0.881      0.817      0.893      0.675

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
      8/100      5.25G     0.9568      1.795     0.8389      1.082          0         15        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.0it/s 6.9s
                   all        616       3174      0.876      0.817       0.89       0.72      0.879      0.819      0.887      0.694

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
      9/100      5.25G     0.9243      1.773     0.8131      1.067          0         23        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.8s
                   all        616       3174      0.897      0.831       0.91      0.735      0.898      0.834      0.905      0.686

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     10/100      5.25G     0.9152      1.738     0.7971      1.061          0         25        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.8s
                   all        616       3174      0.914      0.833      0.918      0.742      0.912      0.837      0.914      0.724

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     11/100      5.25G     0.8914      1.706     0.7722      1.051          0         11        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.885      0.864      0.918      0.755      0.886      0.867      0.918      0.725

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     12/100      5.25G     0.8834      1.666      0.766      1.043          0         18        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.891      0.857      0.923      0.756      0.893      0.859      0.921      0.729

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     13/100      5.25G     0.8599      1.639     0.7346      1.032          0         24        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.899      0.841      0.914      0.754        0.9       0.84      0.909      0.716

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     14/100      5.25G      0.857      1.619     0.7346      1.029          0         58        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.8s
                   all        616       3174      0.896      0.869      0.927      0.768      0.902      0.867      0.924      0.737

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     15/100      5.25G     0.8328      1.576     0.7016      1.022          0         41        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.8s
                   all        616       3174       0.91      0.859       0.93       0.78      0.912      0.861      0.926      0.744

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     16/100      5.25G     0.8377      1.586      0.699       1.02          0         35        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.906      0.873      0.934      0.779       0.91      0.873      0.932      0.751

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     17/100      5.25G     0.8096      1.514     0.6852      1.009          0         40        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.921      0.871      0.939       0.79      0.925      0.874      0.936      0.768

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     18/100      5.25G     0.8184      1.535     0.6895      1.014          0         36        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174       0.92      0.869      0.936      0.786      0.924      0.868      0.933      0.749

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     19/100      5.25G     0.7996      1.478     0.6581      1.001          0         13        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.927      0.872      0.944      0.798       0.93      0.875      0.939      0.771

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     20/100      5.25G     0.7998      1.501     0.6533     0.9965          0         31        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.915      0.867      0.936      0.797      0.916      0.871      0.931      0.765

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     21/100      5.25G     0.7945      1.475     0.6603     0.9999          0         45        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174       0.91       0.87      0.937      0.795       0.91      0.873      0.935      0.757

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     22/100      5.25G     0.7799      1.463      0.633     0.9925          0         24        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.917      0.885      0.944      0.805      0.919      0.888      0.942      0.778

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     23/100      5.25G     0.7713      1.414     0.6344     0.9908          0         59        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174       0.94      0.864      0.944       0.81      0.943      0.867      0.938      0.782

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     24/100      5.25G      0.756      1.396     0.6128     0.9782          0         29        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.922      0.877      0.941      0.804      0.924      0.878      0.939      0.779

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     25/100      5.25G     0.7544      1.401      0.615     0.9814          0         42        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.914      0.887      0.943      0.806      0.917       0.89      0.943      0.774

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     26/100      5.25G      0.734      1.339     0.5912     0.9686          0         22        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.922      0.882      0.948      0.816      0.926      0.886      0.945      0.789

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     27/100      5.25G     0.7422      1.379     0.6031     0.9785          0         90        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.911      0.894      0.947      0.824      0.911      0.894      0.944      0.791

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     28/100      5.25G     0.7423      1.357     0.5975     0.9724          0         24        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.926      0.883      0.945      0.814      0.928      0.887      0.943      0.783

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     29/100      5.25G     0.7386      1.367     0.6007     0.9719          0         42        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.923      0.876      0.943      0.817      0.922      0.888      0.943      0.785

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     30/100      5.25G     0.7273      1.349     0.5799     0.9657          0         30        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.925       0.89      0.946      0.821      0.922      0.897      0.946      0.786

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     31/100      5.25G     0.7343      1.359     0.5862     0.9687          0         28        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.921      0.894      0.946      0.827      0.923      0.896      0.945      0.792

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     32/100      5.25G     0.7147      1.304     0.5682     0.9633          0         31        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.921      0.887      0.948      0.825      0.928      0.887      0.947      0.791

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     33/100      5.25G     0.7279      1.366     0.5837     0.9658          0         60        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.901      0.905      0.949      0.828      0.919      0.894      0.947        0.8

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     34/100      5.25G     0.7085      1.303     0.5588     0.9577          0         25        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.8s
                   all        616       3174      0.914      0.898       0.95      0.825      0.918      0.902       0.95      0.788

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     35/100      5.25G     0.6992      1.303     0.5587     0.9543          0         30        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.914      0.902      0.953      0.832      0.918      0.905      0.951      0.793

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     36/100      5.25G     0.7132      1.327      0.568     0.9591          0         38        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.932      0.885      0.952      0.828      0.932      0.887      0.947      0.793

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     37/100      5.25G     0.6967      1.278     0.5502     0.9502          0         32        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.922      0.896       0.95      0.834      0.925        0.9       0.95      0.792

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     38/100      5.25G      0.693      1.269      0.542     0.9493          0         20        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.919      0.904      0.953      0.839      0.935      0.892      0.951      0.807

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     39/100      5.25G     0.6789      1.255     0.5351     0.9445          0         38        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.933      0.897      0.955      0.842      0.938      0.897      0.953      0.811

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     40/100      5.25G     0.6795      1.235      0.534     0.9434          0          6        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.925      0.892      0.953      0.839      0.927      0.895      0.952      0.803

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     41/100      5.25G     0.6751      1.232     0.5232     0.9429          0         42        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174       0.93      0.903      0.954      0.843      0.931      0.904      0.952      0.799

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     42/100      5.25G     0.6779      1.248     0.5361     0.9451          0         16        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174       0.92      0.897      0.951      0.844       0.93      0.897       0.95       0.81

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     43/100      5.25G     0.6743      1.246     0.5217     0.9394          0         89        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.929      0.898      0.955      0.851      0.944      0.894      0.956      0.813

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     44/100      5.25G     0.6621      1.187     0.5136     0.9361          0         22        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.924      0.905      0.951      0.843      0.927      0.909       0.95      0.805

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     45/100      5.25G     0.6784      1.244     0.5289     0.9407          0         24        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.916      0.907      0.956      0.844      0.918      0.908      0.952      0.803

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     46/100      5.25G     0.6655      1.232     0.5207     0.9394          0         36        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.914      0.907      0.953      0.848      0.918      0.912      0.953      0.805

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     47/100      5.25G      0.661      1.184     0.5095     0.9362          0         27        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.924      0.904      0.956      0.849      0.929      0.905      0.956      0.811

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     48/100      5.25G     0.6538      1.187     0.5073     0.9327          0         34        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.934      0.896      0.956       0.85      0.937      0.901      0.955      0.807

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     49/100      5.25G     0.6476      1.179     0.4997     0.9275          0         32        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.921      0.898      0.954      0.849      0.924      0.905      0.953      0.804

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     50/100      5.25G     0.6525      1.186     0.5001     0.9303          0         37        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.937      0.895      0.956      0.853      0.937      0.904      0.958      0.812

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     51/100      5.25G     0.6514      1.168     0.4959     0.9271          0         32        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.932      0.904       0.96      0.854      0.933       0.91      0.957      0.816

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     52/100      5.25G     0.6399      1.167     0.4907     0.9258          0         26        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.925      0.915      0.958      0.857      0.928      0.917      0.956      0.813

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     53/100      5.25G     0.6307      1.151     0.4879      0.921          0          9        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.934      0.898      0.957      0.854      0.932      0.906      0.955       0.81

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     54/100      5.25G     0.6481      1.169     0.4936     0.9274          0         52        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.935      0.897      0.956      0.855      0.936      0.899      0.955      0.813

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     55/100      5.25G     0.6273       1.13     0.4832     0.9212          0        112        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.926      0.899      0.955      0.853      0.928      0.902      0.952      0.814

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     56/100      5.25G     0.6191      1.119     0.4755     0.9206          0         36        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174       0.94      0.885      0.953      0.857      0.939      0.891      0.951      0.815

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     57/100      5.25G     0.6276       1.14     0.4786     0.9202          0         37        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174       0.95      0.893       0.96      0.858       0.95      0.894      0.956      0.814

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     58/100      5.25G     0.6239      1.133     0.4743     0.9186          0         42        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174       0.94      0.891      0.956      0.854      0.943      0.893      0.955      0.819

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     59/100      5.25G     0.6144      1.105     0.4665     0.9143          0         23        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.939      0.898      0.958      0.858      0.944      0.899      0.954      0.815

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     60/100      5.25G     0.6114      1.104      0.464     0.9128          0         42        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174       0.93      0.904      0.959      0.862      0.934      0.907      0.958      0.816

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     61/100      5.25G     0.6115      1.114     0.4635     0.9147          0         43        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.936      0.899      0.959      0.862       0.94      0.904      0.959      0.821

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     62/100      5.25G     0.6065      1.098     0.4606     0.9102          0         44        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.937      0.897      0.959      0.861      0.941      0.901      0.955      0.815

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     63/100      5.25G     0.6166      1.101     0.4593     0.9137          0         84        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.932      0.913       0.96      0.863      0.934      0.914      0.956      0.817

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     64/100      5.25G     0.5934      1.077     0.4509     0.9106          0         36        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.939      0.897      0.958      0.864      0.942      0.899      0.955      0.822

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     65/100      5.25G     0.6024      1.066     0.4511     0.9086          0         86        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.934      0.903      0.958      0.865      0.941      0.903      0.955      0.821

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     66/100      5.25G     0.5852      1.065     0.4414     0.9036          0         26        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.934      0.904      0.959      0.864      0.937      0.906      0.957      0.817

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     67/100      5.25G     0.5894      1.072     0.4403     0.9042          0         35        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174       0.95      0.889      0.958      0.863      0.951      0.892      0.956      0.821

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     68/100      5.25G     0.5926      1.081     0.4444     0.9036          0         54        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.922      0.915      0.959      0.866      0.927      0.913      0.955      0.818

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     69/100      5.25G     0.5862      1.059     0.4362     0.9021          0         25        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.937      0.904      0.959      0.865      0.948      0.902      0.957      0.819

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     70/100      5.25G     0.5914      1.068     0.4404     0.9065          0         61        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.933      0.909      0.959      0.862      0.936      0.909      0.955      0.822

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     71/100      5.25G     0.5839      1.038     0.4351     0.9009          0         43        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.936      0.903      0.958      0.867       0.94      0.906      0.956      0.823

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     72/100      5.25G     0.5806      1.037     0.4292      0.899          0         46        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174       0.93      0.912       0.96      0.868      0.933      0.915      0.958      0.823

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     73/100      5.25G     0.5723      1.033     0.4304      0.896          0         50        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174       0.94        0.9       0.96      0.871      0.942      0.902      0.957      0.825

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     74/100      5.25G      0.578      1.035     0.4263     0.8991          0         23        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.922      0.915      0.958      0.868      0.925      0.917      0.956      0.827

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     75/100      5.25G     0.5729       1.04     0.4262     0.8987          0         11        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.934      0.909      0.959      0.872      0.937      0.912      0.957      0.822

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     76/100      5.25G     0.5703      1.019     0.4186     0.8929          0         52        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.937      0.902      0.957      0.871      0.937      0.905      0.955      0.828

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     77/100      5.25G     0.5632       1.02     0.4192      0.897          0         33        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.941      0.898      0.957      0.872      0.936      0.908      0.956      0.827

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     78/100      5.25G     0.5629       1.01      0.415     0.8957          0         14        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.942        0.9      0.958      0.872      0.944      0.903      0.957      0.827

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     79/100      5.25G     0.5507     0.9865     0.4085     0.8897          0         39        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.937      0.905      0.961      0.872      0.938      0.907      0.958      0.827

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     80/100      5.25G     0.5515      0.993     0.4072      0.889          0         18        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.941      0.905      0.959      0.871      0.943      0.907      0.956      0.825

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     81/100      5.25G     0.5496     0.9858     0.4049     0.8916          0         14        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.945      0.905      0.959      0.872      0.947       0.91      0.957      0.829

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     82/100      5.25G     0.5553     0.9984     0.4047     0.8894          0         14        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.941      0.906      0.958      0.869      0.944       0.91      0.956       0.83

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     83/100      5.25G     0.5446     0.9736     0.3993     0.8872          0         33        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.941      0.906      0.958      0.872      0.945      0.909      0.956      0.829

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     84/100      5.25G     0.5466     0.9813     0.4008     0.8878          0         64        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.944      0.902      0.958      0.872      0.943      0.905      0.955      0.828

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     85/100      5.25G      0.537     0.9682      0.395      0.886          0         32        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.939      0.904      0.959      0.872      0.941      0.908      0.955      0.828

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     86/100      5.25G     0.5365      0.965     0.3962     0.8832          0         19        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.936      0.913      0.959      0.874      0.937      0.914      0.956      0.828

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     87/100      5.25G      0.536     0.9709     0.3925     0.8843          0         21        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.944      0.905      0.959      0.873      0.943      0.911      0.957      0.829

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     88/100      5.25G     0.5327     0.9507     0.3895     0.8833          0         29        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.943      0.906      0.959      0.873      0.944      0.908      0.956       0.83

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     89/100      5.25G      0.527     0.9486     0.3872     0.8821          0         18        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.937      0.907      0.959      0.874      0.941      0.911      0.956      0.829

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     90/100      5.25G     0.5328     0.9549      0.391     0.8862          0         35        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:02
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.935      0.908      0.958      0.875      0.935      0.912      0.955       0.83
Closing dataloader mosaic
albumentations: Blur(p=0.01, blur_limit=(3, 7)), MedianBlur(p=0.01, blur_limit=(3, 7)), ToGray(p=0.01, method='weighted_average', num_output_channels=3), CLAHE(p=0.01, clip_limit=(1.0, 4.0), tile_grid_size=(8, 8))

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     91/100      5.25G     0.4929     0.8684     0.3423     0.8562          0         35        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:03
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.8s
                   all        616       3174      0.938      0.909      0.957      0.874      0.939      0.911      0.955      0.834

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     92/100      5.25G     0.4854     0.8516     0.3381     0.8543          0         33        640: 100% ━━━━━━━━━━━━ 267/267 4.4it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.929      0.913      0.956      0.871      0.931      0.916      0.954      0.827

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     93/100      5.25G     0.4791     0.8342     0.3285     0.8498          0         17        640: 100% ━━━━━━━━━━━━ 267/267 4.3it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.935      0.909      0.956      0.871      0.936      0.912      0.954      0.825

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     94/100      5.25G     0.4747     0.8326     0.3231     0.8461          0         25        640: 100% ━━━━━━━━━━━━ 267/267 4.4it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.933      0.912      0.957      0.873      0.933      0.913      0.954      0.829

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     95/100      5.25G     0.4701     0.8229     0.3214     0.8457          0         20        640: 100% ━━━━━━━━━━━━ 267/267 4.4it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.934      0.911      0.956      0.872      0.935      0.912      0.954      0.829

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     96/100      5.25G      0.467     0.8199     0.3183     0.8466          0         23        640: 100% ━━━━━━━━━━━━ 267/267 4.4it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.7s
                   all        616       3174      0.937      0.907      0.954      0.872      0.937       0.91      0.953       0.83

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     97/100      5.25G     0.4647     0.8165     0.3168     0.8438          0         45        640: 100% ━━━━━━━━━━━━ 267/267 4.4it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.933      0.909      0.954      0.873      0.936      0.911      0.954       0.83

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     98/100      5.25G     0.4623     0.8161     0.3158     0.8429          0         14        640: 100% ━━━━━━━━━━━━ 267/267 4.4it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174       0.94      0.906      0.954      0.872      0.939      0.911      0.954      0.829

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
     99/100      5.25G     0.4568     0.8038     0.3106     0.8431          0         37        640: 100% ━━━━━━━━━━━━ 267/267 4.4it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.2it/s 6.6s
                   all        616       3174      0.941      0.904      0.954      0.873      0.943      0.907      0.954      0.829

      Epoch    GPU_mem   box_loss   seg_loss   cls_loss   dfl_loss   sem_loss  Instances       Size
    100/100      5.25G     0.4566     0.8024     0.3105     0.8415          0         54        640: 100% ━━━━━━━━━━━━ 267/267 4.4it/s 1:01
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 3.1it/s 6.7s
                   all        616       3174      0.941      0.906      0.954      0.874      0.941      0.911      0.954       0.83

100 epochs completed in 2.047 hours.
Optimizer stripped from /content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/weights/last.pt, 20.5MB
Optimizer stripped from /content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/weights/best.pt, 20.5MB

Validating /content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/weights/best.pt...
Ultralytics 8.4.95 🚀 Python-3.12.13 torch-2.11.0+cu128 CUDA:0 (NVIDIA L4, 22563MiB)
YOLO11s-seg summary (fused): 114 layers, 10,067,590 parameters, 0 gradients, 32.8 GFLOPs
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 21/21 2.8it/s 7.5s
                   all        616       3174      0.938      0.908      0.957      0.874      0.939       0.91      0.955      0.835
                Person        489        928      0.941      0.934      0.967      0.896      0.943      0.936      0.968      0.853
                  Sack        562       2246      0.935      0.882      0.947      0.852      0.935      0.883      0.942      0.817
Speed: 0.2ms preprocess, 3.4ms inference, 0.0ms loss, 1.5ms postprocess per image
Results saved to /content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a
Ultralytics 8.4.95 🚀 Python-3.12.13 torch-2.11.0+cu128 CUDA:0 (NVIDIA L4, 22563MiB)
YOLO11s-seg summary (fused): 114 layers, 10,067,590 parameters, 0 gradients, 32.8 GFLOPs
val: Fast image access ✅ (ping: 0.0±0.0 ms, read: 1274.2±435.8 MB/s, size: 38.0 KB)
val: Scanning /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/valid/labels.cache... 616 images, 11 backgrounds, 0 corrupt: 100% ━━━━━━━━━━━━ 616/616 215.3Mit/s 0.0s
val: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/valid/images/00_06_07-56_jpg.rf.f8b5e1c11f16b0abfdb9da445dbab8dd.jpg: 1 duplicate labels removed
val: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/valid/images/frame_039240_1308-000s_jpg.rf.bd0a8aedd2bc5143d7651b2d9ff88fbd.jpg: 1 duplicate labels removed
val: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/valid/images/frame_063150_2524-383s_jpg.rf.23040b0e97795e419f7e0bddd94fbfdd.jpg: 1 duplicate labels removed
val: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/valid/images/frame_089775_3588-701s_jpg.rf.89e871d589868bd848e694d6a15660da.jpg: 1 duplicate labels removed
val: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/valid/images/frame_090300_3609-687s_jpg.rf.f8f6d4801fe4725052b018417081699f.jpg: 1 duplicate labels removed
val: /content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/valid/images/frame_092325_3690-352s_jpg.rf.eb9fde02ccdd313a815cbd21f973ea59.jpg: 1 duplicate labels removed
                 Class     Images  Instances      Box(P          R      mAP50  mAP50-95)     Mask(P          R      mAP50  mAP50-95): 100% ━━━━━━━━━━━━ 39/39 4.5it/s 8.7s
                   all        616       3174      0.938      0.908      0.957      0.874      0.939       0.91      0.955      0.829
                Person        489        928       0.94      0.934      0.967      0.896      0.943      0.937      0.968      0.849
                  Sack        562       2246      0.935      0.883      0.947      0.852      0.935      0.883      0.942      0.809
Speed: 1.0ms preprocess, 6.1ms inference, 0.0ms loss, 1.4ms postprocess per image
Results saved to /content/runs/segment/val
Ultralytics 8.4.95 🚀 Python-3.12.13 torch-2.11.0+cu128 CPU (Intel Xeon CPU @ 2.20GHz)
💡 ProTip: Export to OpenVINO format for best performance on Intel hardware. Learn more at https://docs.ultralytics.com/integrations/openvino/

PyTorch: starting from '/content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/weights/best.pt' with input shape (1, 3, 640, 640) BCHW and output shape(s) ((1, 38, 8400), (1, 32, 160, 160)) (19.6 MB)
requirements: Ultralytics requirements ['onnxruntime', 'onnxslim>=0.1.82'] not found, attempting AutoUpdate...
Using Python 3.12.13 environment at: /usr
Resolved 12 packages in 227ms
Prepared 3 packages in 348ms
Installed 3 packages in 11ms
 + colorama==0.4.6
 + onnxruntime==1.27.0
 + onnxslim==0.1.94

requirements: AutoUpdate success ✅ 1.0s
WARNING ⚠️ requirements: Restart runtime or rerun command for updates to take effect


ONNX: starting export with onnx 1.22.0 opset 17...
ONNX: slimming with onnxslim 0.1.94...
ONNX: export success ✅ 3.2s, saved as '/content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/weights/best.onnx' (38.7 MB)

Export complete (3.6s)
Results saved to /content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/weights/best.onnx
Predict:         yolo predict task=segment model=/content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/weights/best.onnx imgsz=640 
Validate:        yolo val task=segment model=/content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/weights/best.onnx imgsz=640 data=/content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/data.yaml  
Visualize:       https://netron.app
[dfc] creating venv /content/hailo_venv
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.5/5.5 MB 105.6 MB/s eta 0:00:00
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 470.6/470.6 kB 44.3 MB/s eta 0:00:00
[dfc] building venv on interpreter /usr/bin/python3.10 (python 3.10)
created virtual environment CPython3.10.12.final.0-64-x86_64 in 651ms
  creator CPython3Posix(dest=/content/hailo_venv, clear=False, no_vcs_ignore=False, global=False)
  seeder FromAppData(download=False, pip=bundle, setuptools=bundle, via=copy, app_data_dir=/root/.cache/virtualenv)
    added seed packages: pip==26.1.2, setuptools==83.0.0
  activators BashActivator,CShellActivator,FishActivator,NushellActivator,PowerShellActivator,PythonActivator,XonshActivator
Requirement already satisfied: pip in ./hailo_venv/lib/python3.10/site-packages (26.1.2)
Requirement already satisfied: setuptools in ./hailo_venv/lib/python3.10/site-packages (83.0.0)
Collecting wheel
  Using cached wheel-0.47.0-py3-none-any.whl.metadata (2.3 kB)
Collecting packaging>=24.0 (from wheel)
  Using cached packaging-26.2-py3-none-any.whl.metadata (3.5 kB)
Using cached wheel-0.47.0-py3-none-any.whl (32 kB)
Using cached packaging-26.2-py3-none-any.whl (100 kB)
Installing collected packages: packaging, wheel
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2/2 [wheel]
Successfully installed packaging-26.2 wheel-0.47.0
Collecting numpy==1.23.3
  Downloading numpy-1.23.3-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (2.3 kB)
Collecting scipy==1.10.1
  Downloading scipy-1.10.1-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (58 kB)
Collecting pillow
  Downloading pillow-12.3.0-cp310-cp310-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl.metadata (9.1 kB)
Collecting onnx
  Downloading onnx-1.22.0-cp310-cp310-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl.metadata (8.5 kB)
Collecting protobuf>=4.25.1 (from onnx)
  Downloading protobuf-7.35.1-cp310-abi3-manylinux2014_x86_64.whl.metadata (595 bytes)
Collecting typing_extensions>=4.15.0 (from onnx)
  Downloading typing_extensions-4.16.0-py3-none-any.whl.metadata (3.3 kB)
Collecting ml_dtypes>=0.5.4 (from onnx)
  Downloading ml_dtypes-0.5.4-cp310-cp310-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl.metadata (8.9 kB)
Downloading numpy-1.23.3-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (17.1 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 17.1/17.1 MB 157.3 MB/s  0:00:00
Downloading scipy-1.10.1-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (34.4 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 34.4/34.4 MB 178.6 MB/s  0:00:00
Downloading pillow-12.3.0-cp310-cp310-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl (6.9 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.9/6.9 MB 151.1 MB/s  0:00:00
Downloading onnx-1.22.0-cp310-cp310-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl (19.1 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 19.1/19.1 MB 175.5 MB/s  0:00:00
Downloading ml_dtypes-0.5.4-cp310-cp310-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl (5.0 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.0/5.0 MB 158.4 MB/s  0:00:00
Downloading protobuf-7.35.1-cp310-abi3-manylinux2014_x86_64.whl (327 kB)
Downloading typing_extensions-4.16.0-py3-none-any.whl (45 kB)
Installing collected packages: typing_extensions, protobuf, pillow, numpy, scipy, ml_dtypes, onnx
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 7/7 [onnx]
Successfully installed ml_dtypes-0.5.4 numpy-1.23.3 onnx-1.22.0 pillow-12.3.0 protobuf-7.35.1 scipy-1.10.1 typing_extensions-4.16.0
Processing ./sack-train-ml/tools/hailo_dataflow_compiler-3.33.1-py3-none-linux_x86_64.whl
Collecting absl-py (from hailo-dataflow-compiler==3.33.1)
  Downloading absl_py-2.5.0-py3-none-any.whl.metadata (3.3 kB)
Collecting annotated-types==0.4.0 (from hailo-dataflow-compiler==3.33.1)
  Downloading annotated_types-0.4.0-py3-none-any.whl.metadata (13 kB)
Collecting argcomplete (from hailo-dataflow-compiler==3.33.1)
  Downloading argcomplete-3.7.0-py3-none-any.whl.metadata (16 kB)
Collecting contextlib2 (from hailo-dataflow-compiler==3.33.1)
  Downloading contextlib2-21.6.0-py2.py3-none-any.whl.metadata (4.1 kB)
Collecting future (from hailo-dataflow-compiler==3.33.1)
  Downloading future-1.0.0-py3-none-any.whl.metadata (4.0 kB)
Collecting jsonref (from hailo-dataflow-compiler==3.33.1)
  Downloading jsonref-1.1.0-py3-none-any.whl.metadata (2.7 kB)
Collecting jsonschema (from hailo-dataflow-compiler==3.33.1)
  Downloading jsonschema-4.26.0-py3-none-any.whl.metadata (7.6 kB)
Collecting matplotlib==3.5.2 (from hailo-dataflow-compiler==3.33.1)
  Downloading matplotlib-3.5.2-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (6.7 kB)
Collecting networkx==2.8.8 (from hailo-dataflow-compiler==3.33.1)
  Downloading networkx-2.8.8-py3-none-any.whl.metadata (5.1 kB)
Collecting jax==0.5.3 (from hailo-dataflow-compiler==3.33.1)
  Downloading jax-0.5.3-py3-none-any.whl.metadata (22 kB)
Collecting jaxlib==0.5.3 (from hailo-dataflow-compiler==3.33.1)
  Downloading jaxlib-0.5.3-cp310-cp310-manylinux2014_x86_64.whl.metadata (1.2 kB)
Requirement already satisfied: packaging in ./hailo_venv/lib/python3.10/site-packages (from hailo-dataflow-compiler==3.33.1) (26.2)
Collecting pandas (from hailo-dataflow-compiler==3.33.1)
  Downloading pandas-2.3.3-cp310-cp310-manylinux_2_24_x86_64.manylinux_2_28_x86_64.whl.metadata (91 kB)
Requirement already satisfied: Pillow in ./hailo_venv/lib/python3.10/site-packages (from hailo-dataflow-compiler==3.33.1) (12.3.0)
Collecting prompt-toolkit (from hailo-dataflow-compiler==3.33.1)
  Downloading prompt_toolkit-3.0.52-py3-none-any.whl.metadata (6.4 kB)
Collecting pwlf (from hailo-dataflow-compiler==3.33.1)
  Downloading pwlf-2.5.3-py3-none-any.whl.metadata (6.3 kB)
Collecting py (from hailo-dataflow-compiler==3.33.1)
  Downloading py-1.11.0-py2.py3-none-any.whl.metadata (2.8 kB)
Collecting pydantic==2.0.2 (from hailo-dataflow-compiler==3.33.1)
  Downloading pydantic-2.0.2-py3-none-any.whl.metadata (119 kB)
Collecting pydantic-core==2.1.2 (from hailo-dataflow-compiler==3.33.1)
  Downloading pydantic_core-2.1.2-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (5.1 kB)
Collecting pygraphviz (from hailo-dataflow-compiler==3.33.1)
  Downloading pygraphviz-2.0-cp310-cp310-manylinux_2_28_x86_64.whl.metadata (3.4 kB)
Collecting PyYAML (from hailo-dataflow-compiler==3.33.1)
  Downloading pyyaml-6.0.3-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl.metadata (2.4 kB)
Collecting scipy==1.12.0 (from hailo-dataflow-compiler==3.33.1)
  Downloading scipy-1.12.0-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (60 kB)
Collecting tabulate (from hailo-dataflow-compiler==3.33.1)
  Downloading tabulate-0.10.0-py3-none-any.whl.metadata (40 kB)
Collecting verboselogs (from hailo-dataflow-compiler==3.33.1)
  Downloading verboselogs-1.7-py2.py3-none-any.whl.metadata (10 kB)
Collecting testresources (from hailo-dataflow-compiler==3.33.1)
  Downloading testresources-2.1.2-py3-none-any.whl.metadata (15 kB)
Collecting h5py (from hailo-dataflow-compiler==3.33.1)
  Downloading h5py-3.16.0-cp310-cp310-manylinux_2_28_x86_64.whl.metadata (3.0 kB)
Collecting disjoint-set (from hailo-dataflow-compiler==3.33.1)
  Downloading disjoint_set-0.9.0-py3-none-any.whl.metadata (2.6 kB)
Collecting importlib-metadata (from hailo-dataflow-compiler==3.33.1)
  Downloading importlib_metadata-9.0.0-py3-none-any.whl.metadata (4.5 kB)
Collecting grpcio (from hailo-dataflow-compiler==3.33.1)
  Downloading grpcio-1.82.1-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.whl.metadata (3.7 kB)
Collecting six (from hailo-dataflow-compiler==3.33.1)
  Downloading six-1.17.0-py2.py3-none-any.whl.metadata (1.7 kB)
Collecting typing-extensions==4.12.2 (from hailo-dataflow-compiler==3.33.1)
  Downloading typing_extensions-4.12.2-py3-none-any.whl.metadata (3.0 kB)
Requirement already satisfied: wheel in ./hailo_venv/lib/python3.10/site-packages (from hailo-dataflow-compiler==3.33.1) (0.47.0)
Collecting onnx-tf (from hailo-dataflow-compiler==3.33.1)
  Downloading onnx_tf-1.10.0-py3-none-any.whl.metadata (510 bytes)
Collecting pyparsing==2.4.7 (from hailo-dataflow-compiler==3.33.1)
  Downloading pyparsing-2.4.7-py2.py3-none-any.whl.metadata (3.6 kB)
Collecting tqdm (from hailo-dataflow-compiler==3.33.1)
  Downloading tqdm-4.68.4-py3-none-any.whl.metadata (57 kB)
Collecting py-cpuinfo (from hailo-dataflow-compiler==3.33.1)
  Downloading py_cpuinfo-9.0.0-py3-none-any.whl.metadata (794 bytes)
Collecting msgpack (from hailo-dataflow-compiler==3.33.1)
  Downloading msgpack-1.2.1-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl.metadata (8.3 kB)
Collecting prettytable==3.5.0 (from hailo-dataflow-compiler==3.33.1)
  Downloading prettytable-3.5.0-py3-none-any.whl.metadata (24 kB)
Collecting tensorflow-probability==0.20.1 (from hailo-dataflow-compiler==3.33.1)
  Downloading tensorflow_probability-0.20.1-py2.py3-none-any.whl.metadata (13 kB)
Collecting tensorflow==2.18.0 (from hailo-dataflow-compiler==3.33.1)
  Downloading tensorflow-2.18.0-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (4.1 kB)
Collecting keras==3.5.0 (from hailo-dataflow-compiler==3.33.1)
  Downloading keras-3.5.0-py3-none-any.whl.metadata (5.8 kB)
Collecting numpy==1.26.4 (from hailo-dataflow-compiler==3.33.1)
  Downloading numpy-1.26.4-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (61 kB)
Collecting flatbuffers==24.3.25 (from hailo-dataflow-compiler==3.33.1)
  Downloading flatbuffers-24.3.25-py2.py3-none-any.whl.metadata (850 bytes)
Collecting protobuf==3.20.3 (from hailo-dataflow-compiler==3.33.1)
  Downloading protobuf-3.20.3-cp310-cp310-manylinux_2_12_x86_64.manylinux2010_x86_64.whl.metadata (679 bytes)
Collecting onnx==1.16.0 (from hailo-dataflow-compiler==3.33.1)
  Downloading onnx-1.16.0-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (16 kB)
Collecting onnxsim==0.4.36 (from hailo-dataflow-compiler==3.33.1)
  Downloading onnxsim-0.4.36-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (4.3 kB)
Collecting onnxruntime==1.18.0 (from hailo-dataflow-compiler==3.33.1)
  Downloading onnxruntime-1.18.0-cp310-cp310-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl.metadata (4.3 kB)
Collecting safetensors (from hailo-dataflow-compiler==3.33.1)
  Downloading safetensors-0.8.0-cp310-abi3-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (4.2 kB)
Collecting tflite==2.10.0 (from hailo-dataflow-compiler==3.33.1)
  Downloading tflite-2.10.0-py2.py3-none-any.whl.metadata (5.6 kB)
Collecting tensorboard==2.18.0 (from hailo-dataflow-compiler==3.33.1)
  Downloading tensorboard-2.18.0-py3-none-any.whl.metadata (1.6 kB)
Collecting gast<=0.4.0,>=0.3.2 (from hailo-dataflow-compiler==3.33.1)
  Downloading gast-0.4.0-py3-none-any.whl.metadata (1.1 kB)
Collecting xxhash==3.5.0 (from hailo-dataflow-compiler==3.33.1)
  Downloading xxhash-3.5.0-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (12 kB)
Requirement already satisfied: setuptools in ./hailo_venv/lib/python3.10/site-packages (from hailo-dataflow-compiler==3.33.1) (83.0.0)
Collecting ipython (from hailo-dataflow-compiler==3.33.1)
  Downloading ipython-8.39.0-py3-none-any.whl.metadata (5.1 kB)
Collecting jedi (from hailo-dataflow-compiler==3.33.1)
  Downloading jedi-0.20.0-py2.py3-none-any.whl.metadata (23 kB)
Collecting jupyter (from hailo-dataflow-compiler==3.33.1)
  Downloading jupyter-1.1.1-py2.py3-none-any.whl.metadata (2.0 kB)
Collecting parso (from hailo-dataflow-compiler==3.33.1)
  Downloading parso-0.8.7-py2.py3-none-any.whl.metadata (8.2 kB)
Requirement already satisfied: ml_dtypes>=0.4.0 in ./hailo_venv/lib/python3.10/site-packages (from jax==0.5.3->hailo-dataflow-compiler==3.33.1) (0.5.4)
Collecting opt_einsum (from jax==0.5.3->hailo-dataflow-compiler==3.33.1)
  Downloading opt_einsum-3.4.0-py3-none-any.whl.metadata (6.3 kB)
Collecting rich (from keras==3.5.0->hailo-dataflow-compiler==3.33.1)
  Downloading rich-15.0.0-py3-none-any.whl.metadata (18 kB)
Collecting namex (from keras==3.5.0->hailo-dataflow-compiler==3.33.1)
  Downloading namex-0.1.0-py3-none-any.whl.metadata (322 bytes)
Collecting optree (from keras==3.5.0->hailo-dataflow-compiler==3.33.1)
  Downloading optree-0.19.1-cp310-cp310-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl.metadata (32 kB)
Collecting cycler>=0.10 (from matplotlib==3.5.2->hailo-dataflow-compiler==3.33.1)
  Downloading cycler-0.12.1-py3-none-any.whl.metadata (3.8 kB)
Collecting fonttools>=4.22.0 (from matplotlib==3.5.2->hailo-dataflow-compiler==3.33.1)
  Downloading fonttools-4.63.0-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.whl.metadata (118 kB)
Collecting kiwisolver>=1.0.1 (from matplotlib==3.5.2->hailo-dataflow-compiler==3.33.1)
  Downloading kiwisolver-1.5.0-cp310-cp310-manylinux_2_12_x86_64.manylinux2010_x86_64.whl.metadata (5.1 kB)
Collecting python-dateutil>=2.7 (from matplotlib==3.5.2->hailo-dataflow-compiler==3.33.1)
  Downloading python_dateutil-2.9.0.post0-py2.py3-none-any.whl.metadata (8.4 kB)
Collecting coloredlogs (from onnxruntime==1.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading coloredlogs-15.0.1-py2.py3-none-any.whl.metadata (12 kB)
Collecting sympy (from onnxruntime==1.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading sympy-1.14.0-py3-none-any.whl.metadata (12 kB)
Collecting wcwidth (from prettytable==3.5.0->hailo-dataflow-compiler==3.33.1)
  Downloading wcwidth-0.8.2-py3-none-any.whl.metadata (43 kB)
Collecting markdown>=2.6.8 (from tensorboard==2.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading markdown-3.10.2-py3-none-any.whl.metadata (5.1 kB)
Collecting tensorboard-data-server<0.8.0,>=0.7.0 (from tensorboard==2.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading tensorboard_data_server-0.7.2-py3-none-manylinux_2_31_x86_64.whl.metadata (1.1 kB)
Collecting werkzeug>=1.0.1 (from tensorboard==2.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading werkzeug-3.1.8-py3-none-any.whl.metadata (4.0 kB)
Collecting astunparse>=1.6.0 (from tensorflow==2.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading astunparse-1.6.3-py2.py3-none-any.whl.metadata (4.4 kB)
Collecting google-pasta>=0.1.1 (from tensorflow==2.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading google_pasta-0.2.0-py3-none-any.whl.metadata (814 bytes)
Collecting libclang>=13.0.0 (from tensorflow==2.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading libclang-18.1.1-py2.py3-none-manylinux2010_x86_64.whl.metadata (5.2 kB)
Collecting requests<3,>=2.21.0 (from tensorflow==2.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading requests-2.34.2-py3-none-any.whl.metadata (4.8 kB)
Collecting termcolor>=1.1.0 (from tensorflow==2.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading termcolor-3.3.0-py3-none-any.whl.metadata (6.5 kB)
Collecting wrapt>=1.11.0 (from tensorflow==2.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading wrapt-2.2.2-cp310-cp310-manylinux1_x86_64.manylinux_2_28_x86_64.manylinux_2_5_x86_64.whl.metadata (7.4 kB)
Collecting ml_dtypes>=0.4.0 (from jax==0.5.3->hailo-dataflow-compiler==3.33.1)
  Downloading ml_dtypes-0.4.1-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (20 kB)
Collecting tensorflow-io-gcs-filesystem>=0.23.1 (from tensorflow==2.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading tensorflow_io_gcs_filesystem-0.37.1-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (14 kB)
Collecting decorator (from tensorflow-probability==0.20.1->hailo-dataflow-compiler==3.33.1)
  Downloading decorator-5.3.1-py3-none-any.whl.metadata (3.9 kB)
Collecting cloudpickle>=1.3 (from tensorflow-probability==0.20.1->hailo-dataflow-compiler==3.33.1)
  Downloading cloudpickle-3.1.2-py3-none-any.whl.metadata (7.1 kB)
Collecting dm-tree (from tensorflow-probability==0.20.1->hailo-dataflow-compiler==3.33.1)
  Downloading dm_tree-0.1.10-cp310-cp310-manylinux_2_24_x86_64.manylinux_2_28_x86_64.whl.metadata (2.6 kB)
Collecting charset_normalizer<4,>=2 (from requests<3,>=2.21.0->tensorflow==2.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading charset_normalizer-3.4.9-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl.metadata (41 kB)
Collecting idna<4,>=2.5 (from requests<3,>=2.21.0->tensorflow==2.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading idna-3.18-py3-none-any.whl.metadata (6.1 kB)
Collecting urllib3<3,>=1.26 (from requests<3,>=2.21.0->tensorflow==2.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading urllib3-2.7.0-py3-none-any.whl.metadata (6.9 kB)
Collecting certifi>=2023.5.7 (from requests<3,>=2.21.0->tensorflow==2.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading certifi-2026.6.17-py3-none-any.whl.metadata (2.5 kB)
Collecting markupsafe>=2.1.1 (from werkzeug>=1.0.1->tensorboard==2.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading markupsafe-3.0.3-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl.metadata (2.7 kB)
Collecting humanfriendly>=9.1 (from coloredlogs->onnxruntime==1.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading humanfriendly-10.0-py2.py3-none-any.whl.metadata (9.2 kB)
Collecting attrs>=18.2.0 (from dm-tree->tensorflow-probability==0.20.1->hailo-dataflow-compiler==3.33.1)
  Downloading attrs-26.1.0-py3-none-any.whl.metadata (8.8 kB)
Collecting zipp>=3.20 (from importlib-metadata->hailo-dataflow-compiler==3.33.1)
  Downloading zipp-4.1.0-py3-none-any.whl.metadata (3.6 kB)
Collecting exceptiongroup (from ipython->hailo-dataflow-compiler==3.33.1)
  Downloading exceptiongroup-1.3.1-py3-none-any.whl.metadata (6.7 kB)
Collecting matplotlib-inline (from ipython->hailo-dataflow-compiler==3.33.1)
  Downloading matplotlib_inline-0.2.2-py3-none-any.whl.metadata (2.4 kB)
Collecting pexpect>4.3 (from ipython->hailo-dataflow-compiler==3.33.1)
  Downloading pexpect-4.9.0-py2.py3-none-any.whl.metadata (2.5 kB)
Collecting pygments>=2.4.0 (from ipython->hailo-dataflow-compiler==3.33.1)
  Downloading pygments-2.20.0-py3-none-any.whl.metadata (2.5 kB)
Collecting stack_data (from ipython->hailo-dataflow-compiler==3.33.1)
  Downloading stack_data-0.6.3-py3-none-any.whl.metadata (18 kB)
Collecting traitlets>=5.13.0 (from ipython->hailo-dataflow-compiler==3.33.1)
  Downloading traitlets-5.15.1-py3-none-any.whl.metadata (10 kB)
Collecting ptyprocess>=0.5 (from pexpect>4.3->ipython->hailo-dataflow-compiler==3.33.1)
  Downloading ptyprocess-0.7.0-py2.py3-none-any.whl.metadata (1.3 kB)
Collecting jsonschema-specifications>=2023.03.6 (from jsonschema->hailo-dataflow-compiler==3.33.1)
  Downloading jsonschema_specifications-2025.9.1-py3-none-any.whl.metadata (2.9 kB)
Collecting referencing>=0.28.4 (from jsonschema->hailo-dataflow-compiler==3.33.1)
  Downloading referencing-0.37.0-py3-none-any.whl.metadata (2.8 kB)
Collecting rpds-py>=0.25.0 (from jsonschema->hailo-dataflow-compiler==3.33.1)
  Downloading rpds_py-0.30.0-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (4.1 kB)
Collecting notebook (from jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading notebook-7.6.0-py3-none-any.whl.metadata (10 kB)
Collecting jupyter-console (from jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading jupyter_console-6.6.3-py3-none-any.whl.metadata (5.8 kB)
Collecting nbconvert (from jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading nbconvert-7.17.1-py3-none-any.whl.metadata (8.4 kB)
Collecting ipykernel (from jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading ipykernel-7.3.0-py3-none-any.whl.metadata (4.5 kB)
Collecting ipywidgets (from jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading ipywidgets-8.1.8-py3-none-any.whl.metadata (2.4 kB)
Collecting jupyterlab (from jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading jupyterlab-4.6.1-py3-none-any.whl.metadata (16 kB)
Collecting comm>=0.1.1 (from ipykernel->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading comm-0.2.3-py3-none-any.whl.metadata (3.7 kB)
Collecting debugpy>=1.6.5 (from ipykernel->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading debugpy-1.8.21-cp310-cp310-manylinux_2_34_x86_64.whl.metadata (1.4 kB)
Collecting jupyter-client>=8.9.0 (from ipykernel->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading jupyter_client-8.9.1-py3-none-any.whl.metadata (8.5 kB)
Collecting jupyter-core!=6.0.*,>=5.1 (from ipykernel->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading jupyter_core-5.9.1-py3-none-any.whl.metadata (1.5 kB)
Collecting nest-asyncio2>=1.7.0 (from ipykernel->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading nest_asyncio2-1.7.2-py3-none-any.whl.metadata (6.3 kB)
Collecting psutil>=5.7 (from ipykernel->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading psutil-7.2.2-cp36-abi3-manylinux2010_x86_64.manylinux_2_12_x86_64.manylinux_2_28_x86_64.whl.metadata (22 kB)
Collecting pyzmq>=25 (from ipykernel->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading pyzmq-27.1.0-cp310-cp310-manylinux_2_26_x86_64.manylinux_2_28_x86_64.whl.metadata (6.0 kB)
Collecting tornado>=6.4.1 (from ipykernel->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading tornado-6.5.7-cp39-abi3-manylinux1_x86_64.manylinux_2_28_x86_64.manylinux_2_5_x86_64.whl.metadata (2.8 kB)
INFO: pip is looking at multiple versions of jupyter-client to determine which version is compatible with other requirements. This could take a while.
Collecting jupyter-client>=8.9.0 (from ipykernel->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading jupyter_client-8.9.0-py3-none-any.whl.metadata (8.5 kB)
Collecting ipykernel (from jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading ipykernel-7.2.0-py3-none-any.whl.metadata (4.5 kB)
Collecting nest-asyncio>=1.4 (from ipykernel->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading nest_asyncio-1.6.0-py3-none-any.whl.metadata (2.8 kB)
Collecting jupyter-client>=8.8.0 (from ipykernel->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading jupyter_client-8.8.0-py3-none-any.whl.metadata (8.4 kB)
Collecting platformdirs>=2.5 (from jupyter-core!=6.0.*,>=5.1->ipykernel->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading platformdirs-4.10.0-py3-none-any.whl.metadata (5.5 kB)
Collecting widgetsnbextension~=4.0.14 (from ipywidgets->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading widgetsnbextension-4.0.15-py3-none-any.whl.metadata (1.6 kB)
Collecting jupyterlab_widgets~=3.0.15 (from ipywidgets->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading jupyterlab_widgets-3.0.16-py3-none-any.whl.metadata (20 kB)
Collecting async-lru>=1.0.0 (from jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading async_lru-2.3.0-py3-none-any.whl.metadata (7.6 kB)
Collecting httpx<1,>=0.25.0 (from jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading httpx-0.28.1-py3-none-any.whl.metadata (7.1 kB)
Collecting jinja2>=3.0.3 (from jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading jinja2-3.1.6-py3-none-any.whl.metadata (2.9 kB)
Collecting jupyter-builder>=1.0.2 (from jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading jupyter_builder-1.1.0-py3-none-any.whl.metadata (7.7 kB)
Collecting jupyter-lsp>=2.0.0 (from jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading jupyter_lsp-2.3.1-py3-none-any.whl.metadata (1.8 kB)
Collecting jupyter-server<3,>=2.19.0 (from jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading jupyter_server-2.20.0-py3-none-any.whl.metadata (8.5 kB)
Collecting jupyterlab-server<3,>=2.28.0 (from jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading jupyterlab_server-2.28.0-py3-none-any.whl.metadata (5.9 kB)
Collecting notebook-shim>=0.2 (from jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading notebook_shim-0.2.4-py3-none-any.whl.metadata (4.0 kB)
Collecting tomli>=1.2.2 (from jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading tomli-2.4.1-py3-none-any.whl.metadata (10 kB)
Collecting anyio (from httpx<1,>=0.25.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading anyio-4.14.2-py3-none-any.whl.metadata (4.6 kB)
Collecting httpcore==1.* (from httpx<1,>=0.25.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading httpcore-1.0.9-py3-none-any.whl.metadata (21 kB)
Collecting h11>=0.16 (from httpcore==1.*->httpx<1,>=0.25.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading h11-0.16.0-py3-none-any.whl.metadata (8.3 kB)
Collecting argon2-cffi>=21.1 (from jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading argon2_cffi-25.1.0-py3-none-any.whl.metadata (4.1 kB)
Collecting jupyter-events>=0.11.0 (from jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading jupyter_events-0.12.1-py3-none-any.whl.metadata (5.8 kB)
Collecting jupyter-server-terminals>=0.4.4 (from jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading jupyter_server_terminals-0.5.4-py3-none-any.whl.metadata (5.9 kB)
Collecting nbformat>=5.3.0 (from jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading nbformat-5.10.4-py3-none-any.whl.metadata (3.6 kB)
Collecting overrides>=5.0 (from jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading overrides-7.7.0-py3-none-any.whl.metadata (5.8 kB)
Collecting prometheus-client>=0.9 (from jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading prometheus_client-0.25.0-py3-none-any.whl.metadata (2.1 kB)
Collecting send2trash>=1.8.2 (from jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading send2trash-2.1.0-py3-none-any.whl.metadata (4.1 kB)
Collecting terminado>=0.8.3 (from jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading terminado-0.18.1-py3-none-any.whl.metadata (5.8 kB)
Collecting websocket-client>=1.7 (from jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading websocket_client-1.9.0-py3-none-any.whl.metadata (8.3 kB)
Collecting babel>=2.10 (from jupyterlab-server<3,>=2.28.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading babel-2.18.0-py3-none-any.whl.metadata (2.2 kB)
Collecting json5>=0.9.0 (from jupyterlab-server<3,>=2.28.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading json5-0.15.0-py3-none-any.whl.metadata (37 kB)
Collecting argon2-cffi-bindings (from argon2-cffi>=21.1->jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading argon2_cffi_bindings-25.1.0-cp39-abi3-manylinux_2_26_x86_64.manylinux_2_28_x86_64.whl.metadata (7.4 kB)
Collecting python-json-logger>=2.0.4 (from jupyter-events>=0.11.0->jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading python_json_logger-4.1.0-py3-none-any.whl.metadata (3.7 kB)
Collecting rfc3339-validator (from jupyter-events>=0.11.0->jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading rfc3339_validator-0.1.4-py2.py3-none-any.whl.metadata (1.5 kB)
Collecting rfc3986-validator>=0.1.1 (from jupyter-events>=0.11.0->jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading rfc3986_validator-0.1.1-py2.py3-none-any.whl.metadata (1.7 kB)
Collecting fqdn (from jsonschema[format-nongpl]>=4.18.0->jupyter-events>=0.11.0->jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading fqdn-1.5.1-py3-none-any.whl.metadata (1.4 kB)
Collecting isoduration (from jsonschema[format-nongpl]>=4.18.0->jupyter-events>=0.11.0->jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading isoduration-20.11.0-py3-none-any.whl.metadata (5.7 kB)
Collecting jsonpointer>1.13 (from jsonschema[format-nongpl]>=4.18.0->jupyter-events>=0.11.0->jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading jsonpointer-3.1.1-py3-none-any.whl.metadata (2.4 kB)
Collecting rfc3987-syntax>=1.1.0 (from jsonschema[format-nongpl]>=4.18.0->jupyter-events>=0.11.0->jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading rfc3987_syntax-1.1.0-py3-none-any.whl.metadata (7.7 kB)
Collecting uri-template (from jsonschema[format-nongpl]>=4.18.0->jupyter-events>=0.11.0->jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading uri_template-1.3.0-py3-none-any.whl.metadata (8.8 kB)
Collecting webcolors>=24.6.0 (from jsonschema[format-nongpl]>=4.18.0->jupyter-events>=0.11.0->jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading webcolors-25.10.0-py3-none-any.whl.metadata (2.2 kB)
Collecting beautifulsoup4 (from nbconvert->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading beautifulsoup4-4.15.0-py3-none-any.whl.metadata (3.8 kB)
Collecting bleach!=5.0.0 (from bleach[css]!=5.0.0->nbconvert->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading bleach-6.4.0-py3-none-any.whl.metadata (32 kB)
Collecting defusedxml (from nbconvert->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading defusedxml-0.7.1-py2.py3-none-any.whl.metadata (32 kB)
Collecting jupyterlab-pygments (from nbconvert->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading jupyterlab_pygments-0.3.0-py3-none-any.whl.metadata (4.4 kB)
Collecting mistune<4,>=2.0.3 (from nbconvert->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading mistune-3.3.3-py3-none-any.whl.metadata (1.9 kB)
Collecting nbclient>=0.5.0 (from nbconvert->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading nbclient-0.11.0-py3-none-any.whl.metadata (7.3 kB)
Collecting pandocfilters>=1.4.1 (from nbconvert->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading pandocfilters-1.5.1-py2.py3-none-any.whl.metadata (9.0 kB)
Collecting webencodings (from bleach!=5.0.0->bleach[css]!=5.0.0->nbconvert->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading webencodings-0.5.1-py2.py3-none-any.whl.metadata (2.1 kB)
Collecting tinycss2>=1.1.0 (from bleach[css]!=5.0.0->nbconvert->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading tinycss2-1.5.1-py3-none-any.whl.metadata (3.0 kB)
Collecting fastjsonschema>=2.15 (from nbformat>=5.3.0->jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading fastjsonschema-2.21.2-py3-none-any.whl.metadata (2.3 kB)
Collecting lark>=1.2.2 (from rfc3987-syntax>=1.1.0->jsonschema[format-nongpl]>=4.18.0->jupyter-events>=0.11.0->jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading lark-1.3.1-py3-none-any.whl.metadata (1.8 kB)
Collecting cffi>=1.0.1 (from argon2-cffi-bindings->argon2-cffi>=21.1->jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading cffi-2.1.0-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.whl.metadata (2.5 kB)
Collecting pycparser (from cffi>=1.0.1->argon2-cffi-bindings->argon2-cffi>=21.1->jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading pycparser-3.0-py3-none-any.whl.metadata (8.2 kB)
Collecting soupsieve>=1.6.1 (from beautifulsoup4->nbconvert->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading soupsieve-2.8.4-py3-none-any.whl.metadata (4.6 kB)
Collecting arrow>=0.15.0 (from isoduration->jsonschema[format-nongpl]>=4.18.0->jupyter-events>=0.11.0->jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading arrow-1.4.0-py3-none-any.whl.metadata (7.7 kB)
Collecting tzdata (from arrow>=0.15.0->isoduration->jsonschema[format-nongpl]>=4.18.0->jupyter-events>=0.11.0->jupyter-server<3,>=2.19.0->jupyterlab->jupyter->hailo-dataflow-compiler==3.33.1)
  Downloading tzdata-2026.3-py2.py3-none-any.whl.metadata (1.4 kB)
Collecting tensorflow-addons (from onnx-tf->hailo-dataflow-compiler==3.33.1)
  Downloading tensorflow_addons-0.23.0-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (1.8 kB)
Collecting pytz>=2020.1 (from pandas->hailo-dataflow-compiler==3.33.1)
  Downloading pytz-2026.2-py2.py3-none-any.whl.metadata (22 kB)
Collecting markdown-it-py>=2.2.0 (from rich->keras==3.5.0->hailo-dataflow-compiler==3.33.1)
  Downloading markdown_it_py-4.2.0-py3-none-any.whl.metadata (7.4 kB)
Collecting mdurl~=0.1 (from markdown-it-py>=2.2.0->rich->keras==3.5.0->hailo-dataflow-compiler==3.33.1)
  Downloading mdurl-0.1.2-py3-none-any.whl.metadata (1.6 kB)
Collecting executing>=1.2.0 (from stack_data->ipython->hailo-dataflow-compiler==3.33.1)
  Downloading executing-2.2.1-py2.py3-none-any.whl.metadata (8.9 kB)
Collecting asttokens>=2.1.0 (from stack_data->ipython->hailo-dataflow-compiler==3.33.1)
  Downloading asttokens-3.0.2-py3-none-any.whl.metadata (5.7 kB)
Collecting pure-eval (from stack_data->ipython->hailo-dataflow-compiler==3.33.1)
  Downloading pure_eval-0.2.3-py3-none-any.whl.metadata (6.3 kB)
Collecting mpmath<1.4,>=1.1.0 (from sympy->onnxruntime==1.18.0->hailo-dataflow-compiler==3.33.1)
  Downloading mpmath-1.3.0-py3-none-any.whl.metadata (8.6 kB)
Collecting typeguard<3.0.0,>=2.7 (from tensorflow-addons->onnx-tf->hailo-dataflow-compiler==3.33.1)
  Downloading typeguard-2.13.3-py3-none-any.whl.metadata (3.6 kB)
Downloading annotated_types-0.4.0-py3-none-any.whl (11 kB)
Downloading flatbuffers-24.3.25-py2.py3-none-any.whl (26 kB)
Downloading jax-0.5.3-py3-none-any.whl (2.4 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.4/2.4 MB 113.5 MB/s  0:00:00
Downloading jaxlib-0.5.3-cp310-cp310-manylinux2014_x86_64.whl (105.1 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 105.1/105.1 MB 122.5 MB/s  0:00:00
Downloading keras-3.5.0-py3-none-any.whl (1.1 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.1/1.1 MB 64.7 MB/s  0:00:00
Downloading matplotlib-3.5.2-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (11.9 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 11.9/11.9 MB 117.6 MB/s  0:00:00
Downloading networkx-2.8.8-py3-none-any.whl (2.0 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.0/2.0 MB 107.0 MB/s  0:00:00
Downloading numpy-1.26.4-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (18.2 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 18.2/18.2 MB 151.4 MB/s  0:00:00
Downloading onnx-1.16.0-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (15.9 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 15.9/15.9 MB 149.8 MB/s  0:00:00
Downloading onnxruntime-1.18.0-cp310-cp310-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl (6.8 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.8/6.8 MB 135.1 MB/s  0:00:00
Downloading onnxsim-0.4.36-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (2.3 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.3/2.3 MB 108.2 MB/s  0:00:00
Downloading prettytable-3.5.0-py3-none-any.whl (26 kB)
Downloading protobuf-3.20.3-cp310-cp310-manylinux_2_12_x86_64.manylinux2010_x86_64.whl (1.1 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.1/1.1 MB 60.9 MB/s  0:00:00
Downloading pydantic-2.0.2-py3-none-any.whl (359 kB)
Downloading pydantic_core-2.1.2-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (1.8 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.8/1.8 MB 90.5 MB/s  0:00:00
Downloading pyparsing-2.4.7-py2.py3-none-any.whl (67 kB)
Downloading scipy-1.12.0-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (38.4 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 38.4/38.4 MB 180.6 MB/s  0:00:00
Downloading tensorboard-2.18.0-py3-none-any.whl (5.5 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.5/5.5 MB 127.9 MB/s  0:00:00
Downloading tensorflow-2.18.0-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (615.3 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 615.3/615.3 MB 51.3 MB/s  0:00:06
Downloading tensorflow_probability-0.20.1-py2.py3-none-any.whl (6.9 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.9/6.9 MB 102.4 MB/s  0:00:00
Downloading tflite-2.10.0-py2.py3-none-any.whl (123 kB)
Downloading typing_extensions-4.12.2-py3-none-any.whl (37 kB)
Downloading xxhash-3.5.0-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (194 kB)
Downloading gast-0.4.0-py3-none-any.whl (9.8 kB)
Downloading grpcio-1.82.1-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.whl (6.9 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.9/6.9 MB 113.2 MB/s  0:00:00
Downloading ml_dtypes-0.4.1-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (2.2 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.2/2.2 MB 86.8 MB/s  0:00:00
Downloading requests-2.34.2-py3-none-any.whl (73 kB)
Downloading charset_normalizer-3.4.9-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl (223 kB)
Downloading idna-3.18-py3-none-any.whl (65 kB)
Downloading tensorboard_data_server-0.7.2-py3-none-manylinux_2_31_x86_64.whl (6.6 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.6/6.6 MB 132.9 MB/s  0:00:00
Downloading urllib3-2.7.0-py3-none-any.whl (131 kB)
Downloading absl_py-2.5.0-py3-none-any.whl (137 kB)
Downloading astunparse-1.6.3-py2.py3-none-any.whl (12 kB)
Downloading six-1.17.0-py2.py3-none-any.whl (11 kB)
Downloading certifi-2026.6.17-py3-none-any.whl (133 kB)
Downloading cloudpickle-3.1.2-py3-none-any.whl (22 kB)
Downloading cycler-0.12.1-py3-none-any.whl (8.3 kB)
Downloading fonttools-4.63.0-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.whl (4.9 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4.9/4.9 MB 146.9 MB/s  0:00:00
Downloading google_pasta-0.2.0-py3-none-any.whl (57 kB)
Downloading h5py-3.16.0-cp310-cp310-manylinux_2_28_x86_64.whl (5.1 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.1/5.1 MB 133.3 MB/s  0:00:00
Downloading kiwisolver-1.5.0-cp310-cp310-manylinux_2_12_x86_64.manylinux2010_x86_64.whl (1.6 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.6/1.6 MB 85.3 MB/s  0:00:00
Downloading libclang-18.1.1-py2.py3-none-manylinux2010_x86_64.whl (24.5 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 24.5/24.5 MB 161.0 MB/s  0:00:00
Downloading markdown-3.10.2-py3-none-any.whl (108 kB)
Downloading opt_einsum-3.4.0-py3-none-any.whl (71 kB)
Downloading python_dateutil-2.9.0.post0-py2.py3-none-any.whl (229 kB)
Downloading tensorflow_io_gcs_filesystem-0.37.1-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (5.1 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.1/5.1 MB 160.7 MB/s  0:00:00
Downloading termcolor-3.3.0-py3-none-any.whl (7.7 kB)
Downloading werkzeug-3.1.8-py3-none-any.whl (226 kB)
Downloading markupsafe-3.0.3-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl (20 kB)
Downloading wrapt-2.2.2-cp310-cp310-manylinux1_x86_64.manylinux_2_28_x86_64.manylinux_2_5_x86_64.whl (152 kB)
Downloading argcomplete-3.7.0-py3-none-any.whl (42 kB)
Downloading coloredlogs-15.0.1-py2.py3-none-any.whl (46 kB)
Downloading humanfriendly-10.0-py2.py3-none-any.whl (86 kB)
Downloading contextlib2-21.6.0-py2.py3-none-any.whl (13 kB)
Downloading decorator-5.3.1-py3-none-any.whl (10 kB)
Downloading disjoint_set-0.9.0-py3-none-any.whl (4.8 kB)
Downloading dm_tree-0.1.10-cp310-cp310-manylinux_2_24_x86_64.manylinux_2_28_x86_64.whl (183 kB)
Downloading attrs-26.1.0-py3-none-any.whl (67 kB)
Downloading future-1.0.0-py3-none-any.whl (491 kB)
Downloading importlib_metadata-9.0.0-py3-none-any.whl (27 kB)
Downloading zipp-4.1.0-py3-none-any.whl (10 kB)
Downloading ipython-8.39.0-py3-none-any.whl (831 kB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 831.8/831.8 kB 47.0 MB/s  0:00:00
Downloading prompt_toolkit-3.0.52-py3-none-any.whl (391 kB)
Downloading jedi-0.20.0-py2.py3-none-any.whl (4.9 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4.9/4.9 MB 154.9 MB/s  0:00:00
Downloading parso-0.8.7-py2.py3-none-any.whl (107 kB)
Downloading pexpect-4.9.0-py2.py3-none-any.whl (63 kB)
Downloading ptyprocess-0.7.0-py2.py3-none-any.whl (13 kB)
Downloading pygments-2.20.0-py3-none-any.whl (1.2 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 1.2/1.2 MB 70.2 MB/s  0:00:00
Downloading traitlets-5.15.1-py3-none-any.whl (85 kB)
Downloading exceptiongroup-1.3.1-py3-none-any.whl (16 kB)
Downloading jsonref-1.1.0-py3-none-any.whl (9.4 kB)
Downloading jsonschema-4.26.0-py3-none-any.whl (90 kB)
Downloading jsonschema_specifications-2025.9.1-py3-none-any.whl (18 kB)
Downloading referencing-0.37.0-py3-none-any.whl (26 kB)
Downloading rpds_py-0.30.0-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (390 kB)
Downloading jupyter-1.1.1-py2.py3-none-any.whl (2.7 kB)
Downloading ipykernel-7.2.0-py3-none-any.whl (118 kB)
Downloading jupyter_client-8.8.0-py3-none-any.whl (107 kB)
Downloading comm-0.2.3-py3-none-any.whl (7.3 kB)
Downloading debugpy-1.8.21-cp310-cp310-manylinux_2_34_x86_64.whl (3.0 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3.0/3.0 MB 134.7 MB/s  0:00:00
Downloading jupyter_core-5.9.1-py3-none-any.whl (29 kB)
Downloading matplotlib_inline-0.2.2-py3-none-any.whl (9.5 kB)
Downloading nest_asyncio-1.6.0-py3-none-any.whl (5.2 kB)
Downloading platformdirs-4.10.0-py3-none-any.whl (22 kB)
Downloading psutil-7.2.2-cp36-abi3-manylinux2010_x86_64.manylinux_2_12_x86_64.manylinux_2_28_x86_64.whl (155 kB)
Downloading pyzmq-27.1.0-cp310-cp310-manylinux_2_26_x86_64.manylinux_2_28_x86_64.whl (854 kB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 854.1/854.1 kB 47.5 MB/s  0:00:00
Downloading tornado-6.5.7-cp39-abi3-manylinux1_x86_64.manylinux_2_28_x86_64.manylinux_2_5_x86_64.whl (449 kB)
Downloading ipywidgets-8.1.8-py3-none-any.whl (139 kB)
Downloading jupyterlab_widgets-3.0.16-py3-none-any.whl (914 kB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 914.9/914.9 kB 39.8 MB/s  0:00:00
Downloading widgetsnbextension-4.0.15-py3-none-any.whl (2.2 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.2/2.2 MB 84.4 MB/s  0:00:00
Downloading jupyter_console-6.6.3-py3-none-any.whl (24 kB)
Downloading jupyterlab-4.6.1-py3-none-any.whl (17.2 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 17.2/17.2 MB 150.0 MB/s  0:00:00
Downloading httpx-0.28.1-py3-none-any.whl (73 kB)
Downloading httpcore-1.0.9-py3-none-any.whl (78 kB)
Downloading jupyter_server-2.20.0-py3-none-any.whl (393 kB)
Downloading jupyterlab_server-2.28.0-py3-none-any.whl (59 kB)
Downloading anyio-4.14.2-py3-none-any.whl (125 kB)
Downloading argon2_cffi-25.1.0-py3-none-any.whl (14 kB)
Downloading async_lru-2.3.0-py3-none-any.whl (8.4 kB)
Downloading babel-2.18.0-py3-none-any.whl (10.2 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 10.2/10.2 MB 126.5 MB/s  0:00:00
Downloading h11-0.16.0-py3-none-any.whl (37 kB)
Downloading jinja2-3.1.6-py3-none-any.whl (134 kB)
Downloading json5-0.15.0-py3-none-any.whl (36 kB)
Downloading jupyter_builder-1.1.0-py3-none-any.whl (912 kB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 913.0/913.0 kB 51.8 MB/s  0:00:00
Downloading jupyter_events-0.12.1-py3-none-any.whl (19 kB)
Downloading jsonpointer-3.1.1-py3-none-any.whl (7.7 kB)
Downloading jupyter_lsp-2.3.1-py3-none-any.whl (77 kB)
Downloading jupyter_server_terminals-0.5.4-py3-none-any.whl (13 kB)
Downloading nbconvert-7.17.1-py3-none-any.whl (261 kB)
Downloading mistune-3.3.3-py3-none-any.whl (63 kB)
Downloading bleach-6.4.0-py3-none-any.whl (165 kB)
Downloading nbclient-0.11.0-py3-none-any.whl (25 kB)
Downloading nbformat-5.10.4-py3-none-any.whl (78 kB)
Downloading fastjsonschema-2.21.2-py3-none-any.whl (24 kB)
Downloading notebook_shim-0.2.4-py3-none-any.whl (13 kB)
Downloading overrides-7.7.0-py3-none-any.whl (17 kB)
Downloading pandocfilters-1.5.1-py2.py3-none-any.whl (8.7 kB)
Downloading prometheus_client-0.25.0-py3-none-any.whl (64 kB)
Downloading python_json_logger-4.1.0-py3-none-any.whl (15 kB)
Downloading pyyaml-6.0.3-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl (770 kB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 770.3/770.3 kB 47.3 MB/s  0:00:00
Downloading rfc3986_validator-0.1.1-py2.py3-none-any.whl (4.2 kB)
Downloading rfc3987_syntax-1.1.0-py3-none-any.whl (8.0 kB)
Downloading lark-1.3.1-py3-none-any.whl (113 kB)
Downloading send2trash-2.1.0-py3-none-any.whl (17 kB)
Downloading terminado-0.18.1-py3-none-any.whl (14 kB)
Downloading tinycss2-1.5.1-py3-none-any.whl (28 kB)
Downloading tomli-2.4.1-py3-none-any.whl (14 kB)
Downloading webcolors-25.10.0-py3-none-any.whl (14 kB)
Downloading webencodings-0.5.1-py2.py3-none-any.whl (11 kB)
Downloading websocket_client-1.9.0-py3-none-any.whl (82 kB)
Downloading argon2_cffi_bindings-25.1.0-cp39-abi3-manylinux_2_26_x86_64.manylinux_2_28_x86_64.whl (87 kB)
Downloading cffi-2.1.0-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.whl (218 kB)
Downloading beautifulsoup4-4.15.0-py3-none-any.whl (109 kB)
Downloading soupsieve-2.8.4-py3-none-any.whl (37 kB)
Downloading defusedxml-0.7.1-py2.py3-none-any.whl (25 kB)
Downloading fqdn-1.5.1-py3-none-any.whl (9.1 kB)
Downloading isoduration-20.11.0-py3-none-any.whl (11 kB)
Downloading arrow-1.4.0-py3-none-any.whl (68 kB)
Downloading jupyterlab_pygments-0.3.0-py3-none-any.whl (15 kB)
Downloading msgpack-1.2.1-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl (407 kB)
Downloading namex-0.1.0-py3-none-any.whl (5.9 kB)
Downloading notebook-7.6.0-py3-none-any.whl (5.5 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.5/5.5 MB 141.6 MB/s  0:00:00
Downloading onnx_tf-1.10.0-py3-none-any.whl (226 kB)
Downloading optree-0.19.1-cp310-cp310-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl (425 kB)
Downloading pandas-2.3.3-cp310-cp310-manylinux_2_24_x86_64.manylinux_2_28_x86_64.whl (12.8 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 12.8/12.8 MB 161.2 MB/s  0:00:00
Downloading pytz-2026.2-py2.py3-none-any.whl (510 kB)
Downloading tzdata-2026.3-py2.py3-none-any.whl (348 kB)
Downloading pwlf-2.5.3-py3-none-any.whl (17 kB)
Downloading py-1.11.0-py2.py3-none-any.whl (98 kB)
Downloading py_cpuinfo-9.0.0-py3-none-any.whl (22 kB)
Downloading pycparser-3.0-py3-none-any.whl (48 kB)
Downloading pygraphviz-2.0-cp310-cp310-manylinux_2_28_x86_64.whl (5.4 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 5.4/5.4 MB 151.2 MB/s  0:00:00
Downloading rfc3339_validator-0.1.4-py2.py3-none-any.whl (3.5 kB)
Downloading rich-15.0.0-py3-none-any.whl (310 kB)
Downloading markdown_it_py-4.2.0-py3-none-any.whl (91 kB)
Downloading mdurl-0.1.2-py3-none-any.whl (10.0 kB)
Downloading safetensors-0.8.0-cp310-abi3-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (516 kB)
Downloading stack_data-0.6.3-py3-none-any.whl (24 kB)
Downloading asttokens-3.0.2-py3-none-any.whl (28 kB)
Downloading executing-2.2.1-py2.py3-none-any.whl (28 kB)
Downloading pure_eval-0.2.3-py3-none-any.whl (11 kB)
Downloading sympy-1.14.0-py3-none-any.whl (6.3 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6.3/6.3 MB 156.7 MB/s  0:00:00
Downloading mpmath-1.3.0-py3-none-any.whl (536 kB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 536.2/536.2 kB 26.0 MB/s  0:00:00
Downloading tabulate-0.10.0-py3-none-any.whl (39 kB)
Downloading tensorflow_addons-0.23.0-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (611 kB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 611.8/611.8 kB 33.3 MB/s  0:00:00
Downloading typeguard-2.13.3-py3-none-any.whl (17 kB)
Downloading testresources-2.1.2-py3-none-any.whl (25 kB)
Downloading tqdm-4.68.4-py3-none-any.whl (676 kB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 676.6/676.6 kB 41.4 MB/s  0:00:00
Downloading uri_template-1.3.0-py3-none-any.whl (11 kB)
Downloading verboselogs-1.7-py2.py3-none-any.whl (11 kB)
Downloading wcwidth-0.8.2-py3-none-any.whl (323 kB)
Installing collected packages: webencodings, verboselogs, pytz, py-cpuinfo, pure-eval, ptyprocess, namex, mpmath, libclang, flatbuffers, fastjsonschema, zipp, xxhash, wrapt, widgetsnbextension, websocket-client, webcolors, wcwidth, urllib3, uri-template, tzdata, typing-extensions, typeguard, traitlets, tqdm, tornado, tomli, tinycss2, testresources, termcolor, tensorflow-io-gcs-filesystem, tensorboard-data-server, tabulate, sympy, soupsieve, six, send2trash, safetensors, rpds-py, rfc3986-validator, pyzmq, PyYAML, python-json-logger, pyparsing, pygraphviz, pygments, pycparser, py, psutil, protobuf, prometheus-client, platformdirs, pexpect, parso, pandocfilters, overrides, opt_einsum, numpy, networkx, nest-asyncio, msgpack, mdurl, markupsafe, markdown, lark, kiwisolver, jupyterlab_widgets, jupyterlab-pygments, jsonref, jsonpointer, json5, idna, humanfriendly, h11, gast, future, fqdn, fonttools, executing, defusedxml, decorator, debugpy, cycler, contextlib2, comm, cloudpickle, charset_normalizer, certifi, bleach, babel, attrs, asttokens, argcomplete, annotated-types, absl-py, werkzeug, tflite, terminado, tensorflow-addons, stack_data, scipy, rfc3987-syntax, rfc3339-validator, requests, referencing, python-dateutil, pydantic-core, prompt-toolkit, prettytable, optree, onnx, ml_dtypes, mistune, matplotlib-inline, markdown-it-py, jupyter-core, jinja2, jedi, importlib-metadata, httpcore, h5py, grpcio, google-pasta, exceptiongroup, dm-tree, disjoint-set, coloredlogs, cffi, beautifulsoup4, async-lru, astunparse, tensorflow-probability, tensorboard, rich, pydantic, pwlf, pandas, onnxruntime, onnx-tf, matplotlib, jupyter-server-terminals, jupyter-client, jupyter-builder, jsonschema-specifications, jaxlib, ipython, arrow, argon2-cffi-bindings, anyio, onnxsim, keras, jsonschema, jax, isoduration, ipywidgets, ipykernel, httpx, argon2-cffi, tensorflow, nbformat, jupyter-console, nbclient, jupyter-events, nbconvert, jupyter-server, notebook-shim, jupyterlab-server, jupyter-lsp, jupyterlab, notebook, jupyter, hailo-dataflow-compiler
  Attempting uninstall: typing-extensions
    Found existing installation: typing_extensions 4.16.0
    Uninstalling typing_extensions-4.16.0:
      Successfully uninstalled typing_extensions-4.16.0
  Attempting uninstall: protobuf
    Found existing installation: protobuf 7.35.1
    Uninstalling protobuf-7.35.1:
      Successfully uninstalled protobuf-7.35.1
  Attempting uninstall: numpy
    Found existing installation: numpy 1.23.3
    Uninstalling numpy-1.23.3:
      Successfully uninstalled numpy-1.23.3
  Attempting uninstall: scipy
    Found existing installation: scipy 1.10.1
    Uninstalling scipy-1.10.1:
      Successfully uninstalled scipy-1.10.1
  Attempting uninstall: onnx
    Found existing installation: onnx 1.22.0
    Uninstalling onnx-1.22.0:
      Successfully uninstalled onnx-1.22.0
  Attempting uninstall: ml_dtypes
    Found existing installation: ml_dtypes 0.5.4
    Uninstalling ml_dtypes-0.5.4:
      Successfully uninstalled ml_dtypes-0.5.4
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 172/172 [hailo-dataflow-compiler]
Successfully installed PyYAML-6.0.3 absl-py-2.5.0 annotated-types-0.4.0 anyio-4.14.2 argcomplete-3.7.0 argon2-cffi-25.1.0 argon2-cffi-bindings-25.1.0 arrow-1.4.0 asttokens-3.0.2 astunparse-1.6.3 async-lru-2.3.0 attrs-26.1.0 babel-2.18.0 beautifulsoup4-4.15.0 bleach-6.4.0 certifi-2026.6.17 cffi-2.1.0 charset_normalizer-3.4.9 cloudpickle-3.1.2 coloredlogs-15.0.1 comm-0.2.3 contextlib2-21.6.0 cycler-0.12.1 debugpy-1.8.21 decorator-5.3.1 defusedxml-0.7.1 disjoint-set-0.9.0 dm-tree-0.1.10 exceptiongroup-1.3.1 executing-2.2.1 fastjsonschema-2.21.2 flatbuffers-24.3.25 fonttools-4.63.0 fqdn-1.5.1 future-1.0.0 gast-0.4.0 google-pasta-0.2.0 grpcio-1.82.1 h11-0.16.0 h5py-3.16.0 hailo-dataflow-compiler-3.33.1 httpcore-1.0.9 httpx-0.28.1 humanfriendly-10.0 idna-3.18 importlib-metadata-9.0.0 ipykernel-7.2.0 ipython-8.39.0 ipywidgets-8.1.8 isoduration-20.11.0 jax-0.5.3 jaxlib-0.5.3 jedi-0.20.0 jinja2-3.1.6 json5-0.15.0 jsonpointer-3.1.1 jsonref-1.1.0 jsonschema-4.26.0 jsonschema-specifications-2025.9.1 jupyter-1.1.1 jupyter-builder-1.1.0 jupyter-client-8.8.0 jupyter-console-6.6.3 jupyter-core-5.9.1 jupyter-events-0.12.1 jupyter-lsp-2.3.1 jupyter-server-2.20.0 jupyter-server-terminals-0.5.4 jupyterlab-4.6.1 jupyterlab-pygments-0.3.0 jupyterlab-server-2.28.0 jupyterlab_widgets-3.0.16 keras-3.5.0 kiwisolver-1.5.0 lark-1.3.1 libclang-18.1.1 markdown-3.10.2 markdown-it-py-4.2.0 markupsafe-3.0.3 matplotlib-3.5.2 matplotlib-inline-0.2.2 mdurl-0.1.2 mistune-3.3.3 ml_dtypes-0.4.1 mpmath-1.3.0 msgpack-1.2.1 namex-0.1.0 nbclient-0.11.0 nbconvert-7.17.1 nbformat-5.10.4 nest-asyncio-1.6.0 networkx-2.8.8 notebook-7.6.0 notebook-shim-0.2.4 numpy-1.26.4 onnx-1.16.0 onnx-tf-1.10.0 onnxruntime-1.18.0 onnxsim-0.4.36 opt_einsum-3.4.0 optree-0.19.1 overrides-7.7.0 pandas-2.3.3 pandocfilters-1.5.1 parso-0.8.7 pexpect-4.9.0 platformdirs-4.10.0 prettytable-3.5.0 prometheus-client-0.25.0 prompt-toolkit-3.0.52 protobuf-3.20.3 psutil-7.2.2 ptyprocess-0.7.0 pure-eval-0.2.3 pwlf-2.5.3 py-1.11.0 py-cpuinfo-9.0.0 pycparser-3.0 pydantic-2.0.2 pydantic-core-2.1.2 pygments-2.20.0 pygraphviz-2.0 pyparsing-2.4.7 python-dateutil-2.9.0.post0 python-json-logger-4.1.0 pytz-2026.2 pyzmq-27.1.0 referencing-0.37.0 requests-2.34.2 rfc3339-validator-0.1.4 rfc3986-validator-0.1.1 rfc3987-syntax-1.1.0 rich-15.0.0 rpds-py-0.30.0 safetensors-0.8.0 scipy-1.12.0 send2trash-2.1.0 six-1.17.0 soupsieve-2.8.4 stack_data-0.6.3 sympy-1.14.0 tabulate-0.10.0 tensorboard-2.18.0 tensorboard-data-server-0.7.2 tensorflow-2.18.0 tensorflow-addons-0.23.0 tensorflow-io-gcs-filesystem-0.37.1 tensorflow-probability-0.20.1 termcolor-3.3.0 terminado-0.18.1 testresources-2.1.2 tflite-2.10.0 tinycss2-1.5.1 tomli-2.4.1 tornado-6.5.7 tqdm-4.68.4 traitlets-5.15.1 typeguard-2.13.3 typing-extensions-4.12.2 tzdata-2026.3 uri-template-1.3.0 urllib3-2.7.0 verboselogs-1.7 wcwidth-0.8.2 webcolors-25.10.0 webencodings-0.5.1 websocket-client-1.9.0 werkzeug-3.1.8 widgetsnbextension-4.0.15 wrapt-2.2.2 xxhash-3.5.0 zipp-4.1.0
[dfc] venv ready: /content/hailo_venv/bin/python
[calib] using split='val' dir=/content/sack-train-ml/data/extracted/8940629e-520f-45d0-99bd-d1fe43b7e59a/SACK_DATASET_JUNE_v2_allmask/valid/images (616 imgs)
[calib] 512 imgs -> /content/sack-train-ml/data/calib/8940629e-520f-45d0-99bd-d1fe43b7e59a (requested 512)
[compile] /content/hailo_venv/bin/python /content/sack-train-ml/scripts/compile_clientrunner.py --onnx /content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/weights/best.onnx --calib /content/sack-train-ml/data/calib/8940629e-520f-45d0-99bd-d1fe43b7e59a --out /content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/hef/yolov11s_sack.hef --work /content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/hef --hw hailo8l --net yolov11s_sack --classes 2 --size 640 --calib-n 512 --opt-level 0 --scores-th 0.2 --iou-th 0.7 --max-per-class 50 --reg-len 16
[info] No GPU chosen and no suitable GPU found, falling back to CPU.
DETECT {"family": "yolov11", "task": "segmentation", "nms": "raw", "end_nodes": ["/model.23/cv2.0/cv2.0.2/Conv", "/model.23/cv3.0/cv3.0.2/Conv", "/model.23/cv2.1/cv2.1.2/Conv", "/model.23/cv3.1/cv3.1.2/Conv", "/model.23/cv2.2/cv2.2.2/Conv", "/model.23/cv3.2/cv3.2.2/Conv", "/model.23/cv4.0/cv4.0.2/Conv", "/model.23/cv4.1/cv4.1.2/Conv", "/model.23/cv4.2/cv4.2.2/Conv", "/model.23/proto/cv3/conv/Conv"]}
[info] Translation started on ONNX model yolov11s_sack
[info] Restored ONNX model yolov11s_sack (completion time: 00:00:00.23)
[info] Extracted ONNXRuntime meta-data for Hailo model (completion time: 00:00:00.94)
[info] Start nodes mapped from original model: 'images': 'yolov11s_sack/input_layer1'.
[info] End nodes mapped from original model: '/model.23/cv2.0/cv2.0.2/Conv', '/model.23/cv3.0/cv3.0.2/Conv', '/model.23/cv2.1/cv2.1.2/Conv', '/model.23/cv3.1/cv3.1.2/Conv', '/model.23/cv2.2/cv2.2.2/Conv', '/model.23/cv3.2/cv3.2.2/Conv', '/model.23/cv4.0/cv4.0.2/Conv', '/model.23/cv4.1/cv4.1.2/Conv', '/model.23/cv4.2/cv4.2.2/Conv', '/model.23/proto/cv3/conv/Conv'.
[info] Translation completed on ONNX model yolov11s_sack (completion time: 00:00:02.92)
[info] Saved HAR to: /content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/hef/yolov11s_sack_parsed.har
PARSED -> /content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/hef/yolov11s_sack_parsed.har
nms=raw (yolov11/segmentation) — skipping on-chip nms_postprocess
--- alls ---
model_optimization_flavor(optimization_level=0, compression_level=0)
normalization1 = normalization([0.0,0.0,0.0],[255.0,255.0,255.0])

[info] Loading model script commands to yolov11s_sack from string
calib 512 imgs shape=(512, 640, 640, 3) range=[0,255]
[info] Found model with 3 input channels, using real RGB images for calibration instead of sampling random data.
[info] Starting Model Optimization
[warning] Running model optimization with zero level of optimization is not recommended for production use and might lead to suboptimal accuracy results
[info] Model received quantization params from the hn
[info] MatmulDecompose skipped
[info] Starting Mixed Precision
[info] Model Optimization Algorithm Mixed Precision is done (completion time is 00:00:00.93)
[info] LayerNorm Decomposition skipped
[info] Starting Statistics Collector
[info] Using dataset with 64 entries for calibration
[info] Model Optimization Algorithm Statistics Collector is done (completion time is 00:01:02.19)
[info] Starting Fix zp_comp Encoding
[info] Model Optimization Algorithm Fix zp_comp Encoding is done (completion time is 00:00:00.00)
[info] Starting Matmul Equalization
[info] Model Optimization Algorithm Matmul Equalization is done (completion time is 00:00:00.04)
[info] Starting MatmulDecomposeFix
[info] Model Optimization Algorithm MatmulDecomposeFix is done (completion time is 00:00:00.00)
[info] activation fitting started for yolov11s_sack/reduce_sum_softmax1/act_op
[info] Finetune encoding skipped
[info] Bias Correction skipped
[info] Adaround skipped
[info] Quantization-Aware Fine-Tuning skipped
[info] Layer Noise Analysis skipped
[info] Model Optimization is done
[info] Saved HAR to: /content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/hef/yolov11s_sack_quantized.har
QUANTIZED -> /content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/hef/yolov11s_sack_quantized.har
[info] To achieve optimal performance, set the compiler_optimization_level to "max" by adding performance_param(compiler_optimization_level=max) to the model script. Note that this may increase compilation time.
[info] Loading network parameters
[info] Starting Hailo allocation and compilation flow
[info] Building optimization options for network layers...
[info] Successfully built optimization options - 11s 90ms
[info] Trying to compile the network in a single context
[info] Single context flow failed: Recoverable single context error
[info] Building optimization options for network layers...
[info] Successfully built optimization options - 18s 982ms
[info] Using Multi-context flow
[info] Resources optimization params: max_control_utilization=60%, max_compute_utilization=60%, max_compute_16bit_utilization=60%, max_memory_utilization (weights)=60%, max_input_aligner_utilization=60%, max_apu_utilization=60%
[info] Finding the best partition to contexts...
[info] Found valid partition to 5 contexts

[info] Iteration #5 - 5 contexts,
[info] Searching for a better partition...
[info] Found valid partition to 5 contexts, Performance improved by 27.0%

[info] Iteration #9 - 5 contexts,
[info] Searching for a better partition...
[info] Found valid partition to 5 contexts, Performance improved by 10.7%

[info] Iteration #13 - 5 contexts,
[info] Searching for a better partition...
[info] Found valid partition to 5 contexts, Performance improved by 2.5%

[info] Iteration #55 - 5 contexts,
[info] Searching for a better partition...
[info] Found valid partition to 5 contexts, Performance improved by 0.3%

[info] Iteration #57 - 5 contexts,
[info] Searching for a better partition...
[info] Found valid partition to 5 contexts, Performance improved by 0.9%

[info] Iteration #58 - 5 contexts,
[info] Searching for a better partition...
[info] Found valid partition to 5 contexts, Performance improved by 3.9%

[info] Iteration #61 - 5 contexts,
[info] Searching for a better partition...
[info] Found valid partition to 5 contexts, Performance improved by 18.8%

[info] Iteration #66 - 5 contexts,
[info] Searching for a better partition...
[info] Found valid partition to 5 contexts, Performance improved by 4.0%

[info] Iteration #69 - 5 contexts,
[info] Searching for a better partition...
[info] Found valid partition to 5 contexts, Performance improved by 1.1%

[info] Iteration #73 - 5 contexts,
[info] Searching for a better partition...

[<==>....................................] 
[info] Partition to contexts finished successfully
[info] Partitioner finished after 323 iterations, Time it took: 26m 47s 567ms
[info] Applying selected partition to 5 contexts...
[info] Validating layers feasibility
[info] input_layer1: Pass
[info] normalization1: Pass
[info] conv1_dc: Pass
[info] conv_feature_splitter1_1: Pass
[info] conv2_sdc: Pass
[info] conv5: Pass
[info] conv2_ws: Pass
[info] conv1_d0: Pass
[info] ew_add1: Pass
[info] conv2_sd1: Pass
[info] conv2_sd0: Pass
[info] conv4: Pass
[info] conv_feature_splitter1_2: Pass
[info] conv1_d1: Pass
[info] concat1: Pass
[info] conv7_ws: Pass
[info] conv6: Pass
[info] conv7_sd1: Pass
[info] conv7_sdc: Pass
[info] conv7_sd0: Pass
[info] conv_feature_splitter2_1: Pass
[info] ew_add2: Pass
[info] concat2: Pass
[info] conv10: Pass
[info] conv9: Pass
[info] conv_feature_splitter3_1: Pass
[info] conv12_dc: Pass
[info] conv11: Pass
[info] conv_feature_splitter2_2: Pass
[info] conv12_d0: Pass
[info] conv_feature_splitter3_2: Pass
[info] conv17: Pass
[info] conv16: Pass
[info] conv14: Pass
[info] conv12_d1: Pass
[info] yolov11s_sack_yolov11s_sack_context_0_to_yolov11s_sack_context_2_4342: Pass
[info] conv15: Pass
[info] yolov11s_sack_yolov11s_sack_context_0_to_yolov11s_sack_context_1_4346: Pass
[info] yolov11s_sack_yolov11s_sack_context_0_to_yolov11s_sack_context_1_4344: Pass
[info] conv19: Pass
[info] ew_add4: Pass
[info] conv18: Pass
[info] ew_add3: Pass
[info] yolov11s_sack_yolov11s_sack_context_0_to_yolov11s_sack_context_1_4348: Pass
[info] yolov11s_sack_yolov11s_sack_context_0_to_yolov11s_sack_context_1_4350: Pass
[info] auto_reshape_from_input_layer1_to_normalization1: Pass
[info] conv25: Pass
[info] conv20: Pass
[info] concat4: Pass
[info] concat3: Pass
[info] conv24: Pass
[info] conv_feature_splitter4_1: Pass
[info] conv21: Pass
[info] conv_feature_splitter4_2: Pass
[info] conv26: Pass
[info] conv22_dc: Pass
[info] ew_add6: Pass
[info] conv27: Pass
[info] ew_add5: Pass
[info] conv28: Pass
[info] conv29: Pass
[info] conv22_d1: Pass
[info] maxpool1: Pass
[info] concat5: Pass
[info] conv30: Pass
[info] conv22_d0: Pass
[info] concat6: Pass
[info] maxpool2: Pass
[info] conv32: Pass
[info] maxpool3: Pass
[info] conv31: Pass
[info] conv_feature_splitter6_1: Pass
[info] conv_feature_splitter5_1: Pass
[info] conv_feature_splitter5_2: Pass
[info] concat7: Pass
[info] conv33: Pass
[info] ew_sub_softmax1: Pass
[info] conv_feature_splitter6_2: Pass
[info] matmul2_reshape: Pass
[info] matmul1: Pass
[info] activation1: Pass
[info] reduce_max_softmax1: Pass
[info] yolov11s_sack_yolov11s_sack_context_0_to_yolov11s_sack_context_1_4347: Pass
[info] conv_feature_splitter6_3: Pass
[info] yolov11s_sack_yolov11s_sack_context_0_to_yolov11s_sack_context_1_4345: Pass
[info] yolov11s_sack_yolov11s_sack_context_1_to_yolov11s_sack_context_2_4354: Pass
[info] ew_mult_softmax1: Pass
[info] yolov11s_sack_yolov11s_sack_context_1_to_yolov11s_sack_context_2_4352: Pass
[info] yolov11s_sack_yolov11s_sack_context_1_to_yolov11s_sack_context_2_4356: Pass
[info] reduce_sum_softmax1: Pass
[info] yolov11s_sack_yolov11s_sack_context_1_to_yolov11s_sack_context_2_4358: Pass
[info] yolov11s_sack_yolov11s_sack_context_1_to_yolov11s_sack_context_2_4360: Pass
[info] yolov11s_sack_yolov11s_sack_context_1_to_yolov11s_sack_context_2_4362: Pass
[info] yolov11s_sack_yolov11s_sack_context_0_to_yolov11s_sack_context_1_4349: Pass
[info] yolov11s_sack_yolov11s_sack_context_0_to_yolov11s_sack_context_1_4351: Pass
[info] dw1_defuse_width_feature_reshape: Pass
[info] dw1_defuse_reshape_hxf_to_w_transposed: Pass
[info] dw1_defuse_1x1: Pass
[info] concat8: Pass
[info] conv36: Pass
[info] resize1: Pass
[info] conv37: Pass
[info] conv_feature_splitter7_1: Pass
[info] conv38: Pass
[info] concat9: Pass
[info] conv39: Pass
[info] matmul2: Pass
[info] conv_feature_splitter8_2: Pass
[info] conv42: Pass
[info] conv_feature_splitter7_2: Pass
[info] conv_feature_splitter8_1: Pass
[info] concat10: Pass
[info] conv41: Pass
[info] ew_add10: Pass
[info] conv43: Pass
[info] resize2: Pass
[info] ew_add11: Pass
[info] conv45: Pass
[info] concat11: Pass
[info] sh_from_conv47_to_conv48-51_1: Pass
[info] conv47: Pass
[info] conv46: Pass
[info] concat12: Pass
[info] conv48: Pass
[info] conv50: Pass
[info] conv49: Pass
[info] dw2_sd0: Pass
[info] conv51_dc: Pass
[info] conv58: Pass
[info] conv51_d0: Pass
[info] dw2_sd1: Pass
[info] conv51_d1: Pass
[info] yolov11s_sack_yolov11s_sack_context_0_to_yolov11s_sack_context_2_4343: Pass
[info] dw2_sdc: Pass
[info] yolov11s_sack_yolov11s_sack_context_1_to_yolov11s_sack_context_2_4355: Pass
[info] yolov11s_sack_yolov11s_sack_context_2_to_yolov11s_sack_context_3_4366: Pass
[info] yolov11s_sack_yolov11s_sack_context_2_to_yolov11s_sack_context_3_4364: Pass
[info] yolov11s_sack_yolov11s_sack_context_2_to_yolov11s_sack_context_3_4368: Pass
[info] yolov11s_sack_yolov11s_sack_context_1_to_yolov11s_sack_context_2_4357: Pass
[info] yolov11s_sack_yolov11s_sack_context_2_to_yolov11s_sack_context_3_4372: Pass
[info] yolov11s_sack_yolov11s_sack_context_2_to_yolov11s_sack_context_3_4374: Pass
[info] yolov11s_sack_yolov11s_sack_context_2_to_yolov11s_sack_context_3_4376: Pass
[info] yolov11s_sack_yolov11s_sack_context_1_to_yolov11s_sack_context_2_4353: Pass
[info] yolov11s_sack_yolov11s_sack_context_1_to_yolov11s_sack_context_2_4359: Pass
[info] yolov11s_sack_yolov11s_sack_context_1_to_yolov11s_sack_context_2_4361: Pass
[info] yolov11s_sack_yolov11s_sack_context_1_to_yolov11s_sack_context_2_4363: Pass
[info] sh_from_sh_from_conv47_to_conv48-51_1_to_conv51_d0-1_4388: Pass
[info] mux_conv48-49_to_concat13_conv52: Pass
[info] conv53: Pass
[info] concat13: Pass
[info] conv55: Pass
[info] deconv1_defuse_fi0_d0: Pass
[info] deconv1_defuse_fi0_d1: Pass
[info] auto_reshape_from_conv55_to_output_layer2: Pass
[info] conv_feature_splitter9_2: Pass
[info] conv_feature_splitter9_1: Pass
[info] conv52: Pass
[info] conv54: Pass
[info] conv63: Pass
[info] deconv1_defuse_conv: Pass
[info] deconv1_defuse_fi0_dc: Pass
[info] yolov11s_sack_yolov11s_sack_context_2_to_yolov11s_sack_context_3_4373: Pass
[info] conv62: Pass
[info] conv56_sd3: Pass
[info] yolov11s_sack_yolov11s_sack_context_2_to_yolov11s_sack_context_3_4369: Pass
[info] yolov11s_sack_yolov11s_sack_context_2_to_yolov11s_sack_context_3_4375: Pass
[info] conv56_sd6: Pass
[info] yolov11s_sack_yolov11s_sack_context_3_to_yolov11s_sack_context_4_4379: Pass
[info] yolov11s_sack_yolov11s_sack_context_3_to_yolov11s_sack_context_4_4384: Pass
[info] output_layer4: Pass
[info] output_layer1: Pass
[info] dw4: Pass
[info] conv56_ws: Pass
[info] conv59: Pass
[info] dw3_sdc: Pass
[info] yolov11s_sack_yolov11s_sack_context_3_to_yolov11s_sack_context_4_4382: Pass
[info] dw3_sd1: Pass
[info] concat14: Pass
[info] output_layer2: Pass
[info] yolov11s_sack_yolov11s_sack_context_2_to_yolov11s_sack_context_3_4365: Pass
[info] yolov11s_sack_yolov11s_sack_context_3_to_yolov11s_sack_context_4_4386: Pass
[info] yolov11s_sack_yolov11s_sack_context_2_to_yolov11s_sack_context_3_4377: Pass
[info] ew_add12: Pass
[info] auto_reshape_from_conv57_to_output_layer3: Pass
[info] auto_reshape_from_conv54_to_output_layer1: Pass
[info] output_layer3: Pass
[info] conv56_sd5: Pass
[info] yolov11s_sack_yolov11s_sack_context_2_to_yolov11s_sack_context_3_4367: Pass
[info] conv56_sdc: Pass
[info] conv64: Pass
[info] conv68: Pass
[info] dw3_sd0: Pass
[info] ws_from_conv56_ws_to_conv56_sd0-3_56: Pass
[info] conv56_sd0: Pass
[info] conv65: Pass
[info] conv66: Pass
[info] conv56_sd1: Pass
[info] demux_conv48-49_to_concat13_conv52: Pass
[info] concat15: Pass
[info] conv67: Pass
[info] conv60: Pass
[info] concat_w_from_conv56_sd0-3_to_conv56_sdc: Pass
[info] conv57: Pass
[info] conv56_sd2: Pass
[info] conv56_sd4: Pass
[info] conv69: Pass
[info] conv70: Pass
[info] conv71: Pass
[info] conv77: Pass
[info] conv78: Pass
[info] conv73: Pass
[info] conv_feature_splitter10_2: Pass
[info] conv_feature_splitter10_1: Pass
[info] conv79: Pass
[info] dw5: Pass
[info] conv76: Pass
[info] conv80: Pass
[info] ew_add13: Pass
[info] conv72: Pass
[info] ew_add14: Pass
[info] conv88: Pass
[info] conv84_d0: Pass
[info] conv87: Pass
[info] concat17: Pass
[info] conv85: Pass
[info] conv83_d1: Pass
[info] concat16: Pass
[info] conv91: Pass
[info] conv83_d0: Pass
[info] dw6_sd0: Pass
[info] conv81: Pass
[info] conv89: Pass
[info] conv82: Pass
[info] output_layer8: Pass
[info] dw7: Pass
[info] output_layer6: Pass
[info] output_layer9: Pass
[info] conv86: Pass
[info] output_layer10: Pass
[info] conv83_dc: Pass
[info] yolov11s_sack_yolov11s_sack_context_3_to_yolov11s_sack_context_4_4383: Pass
[info] conv74: Pass
[info] auto_reshape_from_conv88_to_output_layer9: Pass
[info] output_layer5: Pass
[info] auto_reshape_from_conv89_to_output_layer10: Pass
[info] output_layer7: Pass
[info] conv90: Pass
[info] auto_reshape_from_conv71_to_output_layer6: Pass
[info] auto_reshape_from_conv70_to_output_layer5: Pass
[info] dw6_sdc: Pass
[info] conv84_dc: Pass
[info] yolov11s_sack_yolov11s_sack_context_3_to_yolov11s_sack_context_4_4380: Pass
[info] yolov11s_sack_yolov11s_sack_context_3_to_yolov11s_sack_context_4_4387: Pass
[info] dw6_sd1: Pass
[info] conv92: Pass
[info] conv84_d1: Pass
[info] yolov11s_sack_yolov11s_sack_context_3_to_yolov11s_sack_context_4_4385: Pass
[info] sh_from_conv83_dc_to_conv85_conv84_d0-1_dw6_sd0_4389: Pass
[info] Layers feasibility validated successfully
[info] Running resources allocation (mapping) flow, time per context: 59m 59s


[info] Context:0/0 Iteration 0: Mapping prepost...          
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1                                                                                                  
 worker2                                                                                                  
 worker3                                                                                                  

  00:01
[info] Context:0/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1                                                                                                  
 worker2                                                                                                  
 worker3                                                                                                  

  00:01
[info] Context:0/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2                                                                                                  
 worker3                                                                                                  

  00:01
[info] Context:0/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:01
[info] Context:0/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:02
[info] Context:0/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:02
[info] Context:0/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:02
[info] Context:0/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3  *          *          *          *          *          *          *          *          V       

  00:02
[info] Context:0/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3  *          *          *          *          V          *          *          *          V       

  00:02
[info] Context:0/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:02
[info] Context:0/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          *          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:02
[info] Context:0/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:02
[info] Context:0/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:02
[info] Context:0/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:02
[info] Context:0/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:02
[info] Context:0/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:02
[info] Context:0/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:02
[info] Context:0/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:02
[info] Context:0/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:02
[info] Context:0/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:02
[info] Context:0/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:02
[info] Context:0/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:02
[info] Context:0/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:05
[info] Context:0/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  V          V          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:06
[info] Context:0/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  V          V          *          *          V          *          *          *          V       
 worker2  V          V          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:06


[info] Context:1/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1                                                                                                  
 worker2                                                                                                  
 worker3                                                                                                  

  00:07
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1                                                                                                  
 worker2                                                                                                  
 worker3                                                                                                  

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2                                                                                                  
 worker3                                                                                                  

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2                                                                                                  
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2                                                                                                  
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2                                                                                                  
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2                                                                                                  
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          *          *          *          *          V          *          *          V       
 worker2                                                                                                  
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          *          *          *          *          V          *          *          V       
 worker2                                                                                                  
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          V          *          *          *          V          *          *          V       
 worker2                                                                                                  
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          V          *          *          *          V          *          *          V       
 worker2  *          V          *          *          *          *          *          *          V       
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          V          *          *          *          V          *          *          V       
 worker2  *          V          *          *          *          *          *          *          V       
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          V          *          *          *          V          *          *          V       
 worker2  *          V          *          *          *          V          *          *          V       
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          V          *          *          *          V          *          *          V       
 worker2  V          V          *          *          *          V          *          *          V       
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          V          *          *          *          V          *          *          V       
 worker2  V          V          *          *          *          V          *          *          V       
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          V          *          *          *          V          *          *          V       
 worker2  V          V          *          *          *          V          *          *          V       
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          V          *          *          *          V          *          *          V       
 worker2  V          V          *          *          *          V          *          *          V       
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          V          *          *          *          V          *          *          V       
 worker2  V          V          *          *          *          V          *          *          V       
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          V          *          *          *          V          *          *          V       
 worker2  V          V          *          *          *          V          *          *          V       
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          V          *          *          *          V          *          *          V       
 worker2  V          V          *          *          *          V          *          *          V       
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          V          *          *          *          V          *          *          V       
 worker2  V          V          *          *          V          V          *          *          V       
 worker3  *          *          *          *          *          *          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          V          *          *          *          V          *          *          V       
 worker2  V          V          *          *          V          V          *          *          V       
 worker3  V          *          *          *          V          V          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          V          *          *          *          V          *          *          V       
 worker2  V          V          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:08
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  V          V          *          *          V          V          *          *          V       
 worker2  V          V          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:12
[info] Context:1/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  V          V          *          *          V          V          *          *          V       
 worker2  V          V          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:18


[info] Context:2/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1                                                                                                  
 worker2                                                                                                  
 worker3                                                                                                  

  00:19
[info] Context:2/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2                                                                                                  
 worker3                                                                                                  

  00:20
[info] Context:2/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          V          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          V          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          V          *          *          *          V       
 worker2  *          V          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          V          *          *          *          V       
 worker2  *          V          *          *          *          *          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          V          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          V          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          V          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          V          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          V          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          V          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          V          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          V          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          V          *          *          *          V       
 worker2  *          V          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:20
[info] Context:2/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          V          *          *          *          V       
 worker2  V          V          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:20


[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1                                                                                                  
 worker2                                                                                                  
 worker3                                                                                                  

  00:23
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1                                                                                                  
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:24
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:24
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:24
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:24
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:24
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:24
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          V          *          *          V       
 worker3                                                                                                  

  00:24
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          V          *          *          V       
 worker3  *          *          *          *          V          *          *          *          V       

  00:24
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  V          *          *          *          *          V          *          *          V       
 worker3  *          *          *          *          V          *          *          *          V       

  00:24
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  V          *          *          *          *          V          *          *          V       
 worker3  *          V          *          *          V          *          *          *          V       

  00:24
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  V          *          *          *          *          V          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:24
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  V          *          *          *          *          V          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:24
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  V          *          *          *          *          V          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:24
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  V          *          *          *          *          V          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:24
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  V          *          *          *          *          V          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:24
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  V          *          *          *          *          V          *          *          V       
 worker3  *          V          *          *          V          V          *          *          V       

  00:24
[info] Context:3/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  V          *          *          *          *          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:27
[info] Context:3/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          V          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  V          *          *          *          *          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:28
[info] Context:3/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  V          *          *          *          *          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:28
[info] Context:3/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  V          V          *          *          X          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  00:54


[info] Context:4/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1                                                                                                  
 worker2                                                                                                  
 worker3                                                                                                  

  00:58
[info] Context:4/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1                                                                                                  
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:58
[info] Context:4/4 Iteration 0: Trying parallel splits...   
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0                                                                                                  
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          *          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3                                                                                                  

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3  *          V          *          *          V          *          *          *          V       

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3  *          V          *          *          V          *          *          *          V       

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3  *          V          *          *          V          *          *          *          V       

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3  *          V          *          *          V          *          *          *          V       

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          *          *          *          *          *          *          *          V       
 worker1  *          V          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3  *          V          *          *          V          *          *          *          V       

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          V          *          *          *          V          *          *          V       
 worker1  *          V          *          *          *          *          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3  *          V          *          *          V          *          *          *          V       

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  *          V          *          *          *          V          *          *          V       
 worker1  *          V          *          *          V          V          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3  *          V          *          *          V          *          *          *          V       

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          V          *          *          V          V          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3  *          V          *          *          V          *          *          *          V       

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          V          *          *          V          V          *          *          V       
 worker2  *          *          *          *          *          *          *          *          V       
 worker3  *          V          *          *          V          *          *          *          V       

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          V          *          *          V          V          *          *          V       
 worker2  *          *          *          *          V          V          *          *          V       
 worker3  *          V          *          *          V          *          *          *          V       

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          V          *          *          V          V          *          *          V       
 worker2  *          *          *          *          V          V          *          *          V       
 worker3  *          V          *          *          V          *          *          *          V       

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          V          *          *          V          V          *          *          V       
 worker2  *          *          *          *          V          V          *          *          V       
 worker3  *          V          *          *          V          *          *          *          V       

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          V          *          *          V          V          *          *          V       
 worker2  *          *          *          *          V          V          *          *          V       
 worker3  *          V          *          *          V          *          *          *          V       

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          V          *          *          V          V          *          *          V       
 worker2  *          *          *          *          V          V          *          *          V       
 worker3  *          V          *          *          V          *          *          *          V       

  00:58
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          V          *          *          V          V          *          *          V       
 worker2  V          *          *          *          V          V          *          *          V       
 worker3  *          V          *          *          V          *          *          *          V       

  01:02
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  *          V          *          *          V          V          *          *          V       
 worker2  V          *          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  01:02
[info] Context:4/4 Iteration 4: Trying parallel mapping...  
          cluster_0  cluster_1  cluster_2  cluster_3  cluster_4  cluster_5  cluster_6  cluster_7  prepost 
 worker0  V          V          *          *          V          V          *          *          V       
 worker1  V          V          *          *          V          V          *          *          V       
 worker2  V          *          *          *          V          V          *          *          V       
 worker3  V          V          *          *          V          V          *          *          V       

  01:03

[info] yolov11s_sack_context_0 (yolov11s_sack_context_0):
Iterations: 4
Reverts on cluster mapping: 0
Reverts on inter-cluster connectivity: 0
Reverts on pre-mapping validation: 0
Reverts on split failed: 0
[info] yolov11s_sack_context_1 (yolov11s_sack_context_1):
Iterations: 4
Reverts on cluster mapping: 0
Reverts on inter-cluster connectivity: 0
Reverts on pre-mapping validation: 0
Reverts on split failed: 0
[info] yolov11s_sack_context_2 (yolov11s_sack_context_2):
Iterations: 4
Reverts on cluster mapping: 0
Reverts on inter-cluster connectivity: 0
Reverts on pre-mapping validation: 1
Reverts on split failed: 0
[info] yolov11s_sack_context_3 (yolov11s_sack_context_3):
Iterations: 4
Reverts on cluster mapping: 0
Reverts on inter-cluster connectivity: 0
Reverts on pre-mapping validation: 0
Reverts on split failed: 0
[info] yolov11s_sack_context_4 (yolov11s_sack_context_4):
Iterations: 4
Reverts on cluster mapping: 0
Reverts on inter-cluster connectivity: 0
Reverts on pre-mapping validation: 0
Reverts on split failed: 0
[info] yolov11s_sack_context_0 utilization: 
[info] +-----------+---------------------+---------------------+--------------------+
[info] | Cluster   | Control Utilization | Compute Utilization | Memory Utilization |
[info] +-----------+---------------------+---------------------+--------------------+
[info] | cluster_0 | 50%                 | 23.4%               | 26.6%              |
[info] | cluster_1 | 93.8%               | 48.4%               | 60.9%              |
[info] | cluster_4 | 50%                 | 35.9%               | 31.3%              |
[info] | cluster_5 | 50%                 | 42.2%               | 37.5%              |
[info] +-----------+---------------------+---------------------+--------------------+
[info] | Total     | 60.9%               | 37.5%               | 39.1%              |
[info] +-----------+---------------------+---------------------+--------------------+
[info] yolov11s_sack_context_1 utilization: 
[info] +-----------+---------------------+---------------------+--------------------+
[info] | Cluster   | Control Utilization | Compute Utilization | Memory Utilization |
[info] +-----------+---------------------+---------------------+--------------------+
[info] | cluster_0 | 31.3%               | 17.2%               | 25%                |
[info] | cluster_1 | 75%                 | 53.1%               | 80.5%              |
[info] | cluster_4 | 87.5%               | 32.8%               | 47.7%              |
[info] | cluster_5 | 50%                 | 26.6%               | 64.8%              |
[info] +-----------+---------------------+---------------------+--------------------+
[info] | Total     | 60.9%               | 32.4%               | 54.5%              |
[info] +-----------+---------------------+---------------------+--------------------+
[info] yolov11s_sack_context_2 utilization: 
[info] +-----------+---------------------+---------------------+--------------------+
[info] | Cluster   | Control Utilization | Compute Utilization | Memory Utilization |
[info] +-----------+---------------------+---------------------+--------------------+
[info] | cluster_0 | 100%                | 85.9%               | 54.7%              |
[info] | cluster_1 | 12.5%               | 4.7%                | 10.2%              |
[info] | cluster_4 | 75%                 | 43.8%               | 40.6%              |
[info] | cluster_5 | 62.5%               | 25%                 | 38.3%              |
[info] +-----------+---------------------+---------------------+--------------------+
[info] | Total     | 62.5%               | 39.8%               | 35.9%              |
[info] +-----------+---------------------+---------------------+--------------------+
[info] yolov11s_sack_context_3 utilization: 
[info] +-----------+---------------------+---------------------+--------------------+
[info] | Cluster   | Control Utilization | Compute Utilization | Memory Utilization |
[info] +-----------+---------------------+---------------------+--------------------+
[info] | cluster_0 | 75%                 | 50%                 | 56.3%              |
[info] | cluster_1 | 31.3%               | 23.4%               | 24.2%              |
[info] | cluster_4 | 87.5%               | 76.6%               | 65.6%              |
[info] | cluster_5 | 56.3%               | 42.2%               | 37.5%              |
[info] +-----------+---------------------+---------------------+--------------------+
[info] | Total     | 62.5%               | 48%                 | 45.9%              |
[info] +-----------+---------------------+---------------------+--------------------+
[info] yolov11s_sack_context_4 utilization: 
[info] +-----------+---------------------+---------------------+--------------------+
[info] | Cluster   | Control Utilization | Compute Utilization | Memory Utilization |
[info] +-----------+---------------------+---------------------+--------------------+
[info] | cluster_0 | 100%                | 76.6%               | 58.6%              |
[info] | cluster_1 | 31.3%               | 31.3%               | 22.7%              |
[info] | cluster_4 | 81.3%               | 59.4%               | 48.4%              |
[info] | cluster_5 | 31.3%               | 28.1%               | 24.2%              |
[info] +-----------+---------------------+---------------------+--------------------+
[info] | Total     | 60.9%               | 48.8%               | 38.5%              |
[info] +-----------+---------------------+---------------------+--------------------+
[info] Successful Mapping (allocation time: 30m 39s)
[info] Compiling kernels of yolov11s_sack_context_0...
[info] Compiling kernels of yolov11s_sack_context_1...
[info] Compiling kernels of yolov11s_sack_context_2...
[info] Compiling kernels of yolov11s_sack_context_3...
[info] Compiling kernels of yolov11s_sack_context_4...
[info] Bandwidth of model inputs: 9.375 Mbps, outputs: 12.5305 Mbps (for a single frame)
[info] Bandwidth of DDR buffers: 0.0 Mbps (for a single frame)
[info] Bandwidth of inter context tensors: 116.797 Mbps (for a single frame)
[info] Compiling kernels of yolov11s_sack_context_0...
[info] Compiling kernels of yolov11s_sack_context_1...
[info] Compiling kernels of yolov11s_sack_context_2...
[info] Compiling kernels of yolov11s_sack_context_3...
[info] Compiling kernels of yolov11s_sack_context_4...
[info] Bandwidth of model inputs: 9.375 Mbps, outputs: 12.5305 Mbps (for a single frame)
[info] Bandwidth of DDR buffers: 0.0 Mbps (for a single frame)
[info] Bandwidth of inter context tensors: 116.797 Mbps (for a single frame)
[info] Building HEF...
[info] Successful Compilation (compilation time: 48s)
HEF -> /content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/hef/yolov11s_sack.hef 26125689 bytes

Calibration:   0%|          | 0/64 [00:00<?, ?entries/s]
Calibration:   2%|▏         | 1/64 [00:46<49:13, 46.88s/entries]
Calibration:   3%|▎         | 2/64 [00:47<20:04, 19.43s/entries]
Calibration:   5%|▍         | 3/64 [00:47<10:49, 10.65s/entries]
Calibration:   6%|▋         | 4/64 [00:47<06:31,  6.53s/entries]
Calibration:   8%|▊         | 5/64 [00:47<04:10,  4.25s/entries]
Calibration:   9%|▉         | 6/64 [00:47<02:46,  2.88s/entries]
Calibration:  11%|█         | 7/64 [00:48<01:54,  2.00s/entries]
Calibration:  12%|█▎        | 8/64 [00:48<01:20,  1.43s/entries]
Calibration:  14%|█▍        | 9/64 [00:48<00:57,  1.05s/entries]
Calibration:  16%|█▌        | 10/64 [00:48<00:42,  1.27entries/s]
Calibration:  17%|█▋        | 11/64 [00:48<00:32,  1.65entries/s]
Calibration:  19%|█▉        | 12/64 [00:49<00:25,  2.07entries/s]
Calibration:  20%|██        | 13/64 [00:49<00:20,  2.51entries/s]
Calibration:  22%|██▏       | 14/64 [00:49<00:16,  2.94entries/s]
Calibration:  23%|██▎       | 15/64 [00:49<00:14,  3.34entries/s]
Calibration:  25%|██▌       | 16/64 [00:49<00:12,  3.72entries/s]
Calibration:  27%|██▋       | 17/64 [00:50<00:11,  4.03entries/s]
Calibration:  28%|██▊       | 18/64 [00:50<00:10,  4.27entries/s]
Calibration:  30%|██▉       | 19/64 [00:50<00:10,  4.48entries/s]
Calibration:  31%|███▏      | 20/64 [00:50<00:09,  4.60entries/s]
Calibration:  33%|███▎      | 21/64 [00:50<00:09,  4.70entries/s]
Calibration:  34%|███▍      | 22/64 [00:51<00:08,  4.77entries/s]
Calibration:  36%|███▌      | 23/64 [00:51<00:08,  4.85entries/s]
Calibration:  38%|███▊      | 24/64 [00:51<00:08,  4.87entries/s]
Calibration:  39%|███▉      | 25/64 [00:51<00:07,  4.88entries/s]
Calibration:  41%|████      | 26/64 [00:51<00:07,  4.91entries/s]
Calibration:  42%|████▏     | 27/64 [00:52<00:07,  4.94entries/s]
Calibration:  44%|████▍     | 28/64 [00:52<00:07,  4.94entries/s]
Calibration:  45%|████▌     | 29/64 [00:52<00:07,  4.93entries/s]
Calibration:  47%|████▋     | 30/64 [00:52<00:06,  4.92entries/s]
Calibration:  48%|████▊     | 31/64 [00:52<00:06,  4.94entries/s]
Calibration:  50%|█████     | 32/64 [00:53<00:06,  4.93entries/s]
Calibration:  52%|█████▏    | 33/64 [00:53<00:06,  4.94entries/s]
Calibration:  53%|█████▎    | 34/64 [00:53<00:06,  4.96entries/s]
Calibration:  55%|█████▍    | 35/64 [00:53<00:05,  4.94entries/s]
Calibration:  56%|█████▋    | 36/64 [00:54<00:05,  4.95entries/s]
Calibration:  58%|█████▊    | 37/64 [00:54<00:05,  4.95entries/s]
Calibration:  59%|█████▉    | 38/64 [00:54<00:05,  4.95entries/s]
Calibration:  61%|██████    | 39/64 [00:54<00:05,  4.95entries/s]
Calibration:  62%|██████▎   | 40/64 [00:54<00:04,  4.93entries/s]
Calibration:  64%|██████▍   | 41/64 [00:55<00:04,  4.93entries/s]
Calibration:  66%|██████▌   | 42/64 [00:55<00:04,  4.96entries/s]
Calibration:  67%|██████▋   | 43/64 [00:55<00:04,  4.97entries/s]
Calibration:  69%|██████▉   | 44/64 [00:55<00:04,  4.95entries/s]
Calibration:  70%|███████   | 45/64 [00:55<00:03,  4.96entries/s]
Calibration:  72%|███████▏  | 46/64 [00:56<00:03,  4.94entries/s]
Calibration:  73%|███████▎  | 47/64 [00:56<00:03,  4.95entries/s]
Calibration:  75%|███████▌  | 48/64 [00:56<00:03,  4.88entries/s]
Calibration:  77%|███████▋  | 49/64 [00:56<00:03,  4.77entries/s]
Calibration:  78%|███████▊  | 50/64 [00:56<00:02,  4.72entries/s]
Calibration:  80%|███████▉  | 51/64 [00:57<00:02,  4.75entries/s]
Calibration:  81%|████████▏ | 52/64 [00:57<00:02,  4.76entries/s]
Calibration:  83%|████████▎ | 53/64 [00:57<00:02,  4.74entries/s]
Calibration:  84%|████████▍ | 54/64 [00:57<00:02,  4.79entries/s]
Calibration:  86%|████████▌ | 55/64 [00:57<00:01,  4.78entries/s]
Calibration:  88%|████████▊ | 56/64 [00:58<00:01,  4.76entries/s]
Calibration:  89%|████████▉ | 57/64 [00:58<00:01,  4.75entries/s]
Calibration:  91%|█████████ | 58/64 [00:58<00:01,  4.71entries/s]
Calibration:  92%|█████████▏| 59/64 [00:58<00:01,  4.70entries/s]
Calibration:  94%|█████████▍| 60/64 [00:58<00:00,  4.68entries/s]
Calibration:  95%|█████████▌| 61/64 [00:59<00:00,  4.79entries/s]
Calibration:  97%|█████████▋| 62/64 [00:59<00:00,  4.83entries/s]
Calibration:  98%|█████████▊| 63/64 [00:59<00:00,  4.87entries/s]
Calibration: 100%|██████████| 64/64 [00:59<00:00,  4.91entries/s]
Calibration: 100%|██████████| 64/64 [00:59<00:00,  4.91entries/s]
Calibration: 100%|██████████| 64/64 [00:59<00:00,  1.07entries/s]
[compile] meta -> /content/sack-train-ml/runs/8940629e-520f-45d0-99bd-d1fe43b7e59a/hef/yolov11s_sack.hef.meta.yaml
