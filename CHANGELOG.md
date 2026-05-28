# Changelog

All notable changes to `sack-train-ml` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `manual/sample_img.py` — frame sampler for YOLO training. Accepts a single video
  file or a directory (recursive over `.mp4/.mov/.avi/.mkv/.m4v/.webm`).
  Sampling rate via `--fps` or `--every N`, optional `--start/--end` clipping,
  `jpg/png` output with quality control, deterministic filenames
  (`{video_stem}_f{frame_index:07d}.{ext}`).
