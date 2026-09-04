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

## Round 2 — v2 (external review) and v3 (merge)

The owner took the three variants to a second reviewer, which returned a single converged design. It is better than all three of mine as a *form*, and became the base. The v2 original lives at `~/Downloads/new-run.final-v2.html` and is **not** copied into the repo — the sandbox blocks reads of that directory — so v3 is the only committed descendant of it.

**What v2 got right that v1 did not:** model choice decomposed into family → task → size, with params and COCO mAP per size instead of everything crammed into one dropdown; a dataset card showing real counts and a VALID badge, which is fail-fast made visible; training presets (Quick test / Balanced / Full / Custom) that also give an ablation a named baseline; a run name, which v1 omitted entirely though runs need human identity to be compared; Summary and YAML tabs serving readers and the record separately; a named, versioned compiler profile; and always-visible helper text under each control rather than hover tooltips.

**What v2 softened, and why it mattered:** its compatibility function returned only `ok` or `warn`, so a path this project *knows* is broken — YOLO26, whose 4-channel box head no edge decoder can read, and pose/OBB, which compile with the extra branch silently dropped — was presented as a caution rather than a refusal. And its effective config was a flat dump: `optimizer: AdamW` looked identical whether someone chose it or it was filled in, losing the one thing the whole map exists to establish.

**v3 = v2 plus those two, ported back** — [`prototype/new-run.v3.html`](../prototype/new-run.v3.html), screenshots [ok](../prototype/v3-ok.png) · [yaml](../prototype/v3-yaml.png) · [blocked](../prototype/v3-blocked.png):

1. A third `bad` level that **blocks**: both create buttons disable and relabel, a red bar states the reason, the compiler profile reads `unsupported`, and the explanation names the mechanism (4-channel box versus the required 64-channel DFL) rather than saying "not validated". Verified by driving the page: selecting YOLO26 leaves `#createTop` disabled with no console errors.
2. **Provenance on every value**, in both tabs — `you set it` / `default — nobody typed this` / `derived` — with a legend. The YAML now renders `optimizer: AdamW  # default — nobody typed this`, which is the Muon incident made visible before launch.
3. The dataset status line, previously hardcoded to pass, now follows the selected dataset (the smoke subset reports a warning). Note the dataset *card* was already dynamic in v2 — an earlier claim that it was hardcoded was too broad and is corrected here.

Awaiting the owner's verdict on v3 before this ticket closes.

<!-- 05 was listed here and has been removed: a prototype settles form and behaviour;
     where the schema definition lives is a build concern that does not change what
     there is to react to. -->


## Question

Make the decided contract concrete enough to argue with: a rough, throwaway New-run form showing the full model catalogue with compile-capability marked, the curated parameter fields, the escape hatch, and — the piece the owner asked for directly — the **preview of the effective config shown before the Colab notebook opens**, including values nobody typed (`optimizer: AdamW` is the test case: it must be visible there).

The point is reaction, not code to keep. Cheap and rough beats polished. Link the artifact from this ticket rather than pasting it.

Open questions the prototype should force answers to: how much of the parameter surface can be on screen at once before it stops being usable; whether compile options belong on the same page as train options now that the two are separable ([08](./08-compile-notebook-and-recompile-flow.md)); how a train-only checkpoint visibly disables the compile section; and whether the preview is a separate step or an always-visible panel.
