# 09 — Prototype the New-run form under the new contract

Type: prototype
Status: open
Blocked by: 05, 06

## Question

Make the decided contract concrete enough to argue with: a rough, throwaway New-run form showing the full model catalogue with compile-capability marked, the curated parameter fields, the escape hatch, and — the piece the owner asked for directly — the **preview of the effective config shown before the Colab notebook opens**, including values nobody typed (`optimizer: AdamW` is the test case: it must be visible there).

The point is reaction, not code to keep. Cheap and rough beats polished. Link the artifact from this ticket rather than pasting it.

Open questions the prototype should force answers to: how much of the parameter surface can be on screen at once before it stops being usable; whether compile options belong on the same page as train options now that the two are separable ([08](./08-compile-notebook-and-recompile-flow.md)); how a train-only checkpoint visibly disables the compile section; and whether the preview is a separate step or an always-visible panel.
