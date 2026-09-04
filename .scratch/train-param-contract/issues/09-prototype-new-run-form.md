# 09 — Prototype the New-run form under the new contract

Type: prototype
Status: claimed
Blocked by: 06

## Artifact

Three variants of the New-run page on one route, switchable with `?variant=A|B|C`, the floating bar, or the ← → arrow keys:

- [`prototype/new-run.prototype.html`](../prototype/new-run.prototype.html) — open with `open .scratch/train-param-contract/prototype/new-run.prototype.html`
- Screenshots: [A](../prototype/variant-A.png) · [B](../prototype/variant-B.png) · [C](../prototype/variant-C.png)

| Variant | Shape | Its bet |
|---|---|---|
| **A** — Sectioned single column | one page, grouped, review panel at the bottom | closest to today; the review is a section you scroll to |
| **B** — Split, live effective config | form left, always-visible effective config + validation right | the truth is never more than a glance away; launch is blocked from the same panel that explains why |
| **C** — Stepper with review gate | four steps, one decision cluster each, review is step 4 | the gate before Colab is a *place*, not a paragraph |

Built as a standalone file rather than mounted in `apps/web` because the real Train page sits behind Supabase magic-link auth and cannot be screenshotted headlessly; the app chrome is reproduced so the variants are judged at realistic density. Tokens copied from `apps/web/src/styles/tokens.css`.

Notes for whoever reads the screenshots: variant B's tooltip is rendered permanently open to show what the "i" affordance looks like — in use it appears on hover and would not cover the fields beneath it.

<!-- 05 was listed here and has been removed: a prototype settles form and behaviour;
     where the schema definition lives is a build concern that does not change what
     there is to react to. -->


## Question

Make the decided contract concrete enough to argue with: a rough, throwaway New-run form showing the full model catalogue with compile-capability marked, the curated parameter fields, the escape hatch, and — the piece the owner asked for directly — the **preview of the effective config shown before the Colab notebook opens**, including values nobody typed (`optimizer: AdamW` is the test case: it must be visible there).

The point is reaction, not code to keep. Cheap and rough beats polished. Link the artifact from this ticket rather than pasting it.

Open questions the prototype should force answers to: how much of the parameter surface can be on screen at once before it stops being usable; whether compile options belong on the same page as train options now that the two are separable ([08](./08-compile-notebook-and-recompile-flow.md)); how a train-only checkpoint visibly disables the compile section; and whether the preview is a separate step or an always-visible panel.
