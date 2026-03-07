# Ocean Simulator — Changelog

This is a running log of improvements made during background iteration sprints.

## 2026-03-07
- Fix: Positioned debug GUI to prevent HUD overlap.
  - Set lil-gui z-index to 900 (below custom UI panels at z-index 1000).
  - Offset debug GUI 280px from top to clear the info panel.
  - Resolves visual conflict where debug controls could obscure ecosystem stats.
  - Improves visual hierarchy: custom HUD → debug controls → renderer.
- Verification: Run app, press H to toggle UI, confirm all panels visible without overlap. Debug GUI now appears cleanly below info panel on right side.

## 2026-02-18
- Fix: corrected instanced fish orientation so fish face velocity direction (model forward axis = -X).
- Fix: made GPU swim animation readable at low cruising speeds (baseline normalized speed).
- Added: cinematic/tropical-clear post-processing controls (bloom/threshold, absorption, turbidity, vignette, chroma) via lil-gui.

