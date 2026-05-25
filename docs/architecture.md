# Architecture

## Intent

`sack-train-ml` is the training-side companion to `sack-detector-edge`.
It should own artifact production, not runtime inference.

## Boundaries

- Input: dataset configs, train configs, calibration manifests
- Output: release bundles containing `.pt`, `.hef`, `.hef.meta.yaml`, and summaries
- Not in scope: edge runtime deployment, MQTT, Node-RED, container control

## Long-term shape

```text
operator / web ui
  -> local run orchestration
  -> artifact generation
  -> release index
  -> future registry
```
