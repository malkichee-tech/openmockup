# Project progress

## Environment — VERIFIED WORKING

Windows workspace initially contained only `.git`. Node 24.15.0, npm 11.12.1, Git 2.54.0 available. No private PSD or Canva designs found in workspace. Blog repository untouched.

## Experiment status

- A: VERIFIED WORKING for the original synthetic embedded Smart Object fixture in real Photopea/Chrome: PSD creation, reload, exact-name selection, contents opening, PNG insertion, fitting, save/close, parent update and PNG export.
- B: VERIFIED WORKING for three original designs: red 1, green 2, blue 3, independently reloaded from original PSD bytes. Final cleaned-code run on 2026-11-05 at 22:49:53–54 UTC (15:49:53–54 America/Denver). All outputs 480 × 360; intended-color pixel counts 41,591 / 40,973 / 41,033. Export sizes 6,067 / 7,424 / 7,557 bytes. Visually inspected all three numerals, colors, beige background and preserved rotated boundary. This does not verify complex effects, masks, perspective or warp.
- C: VERIFIED WORKING for the supplied candle template in real Photopea/Chrome. The provided `36.psd` (66,354,051 bytes) loaded, was inspected, and was exported before replacement (baseline PNG: 12,760,440 bytes). The actual unique target is `Add Design Here` (case differs from the initial uppercase assumption), nested at `/1/0` under `/1=Smart Object`; the layer map was logged without file contents. The supplied label PNG was inserted into that Smart Object, fitted with valid `UnitValue.value` bounds, saved, closed, and the parent re-exported (result PNG: 13,380,660 bytes). The Photopea canvas visibly showed the FALL label correctly mapped onto the candle jar while preserving the scene, flame, lighting and shadows. This verifies one real design end-to-end; a three-design run on this commercial template is still pending.

This file must be updated with observed results, never inferred success.

## Observed validation

- VERIFIED WORKING: dependency installation (20 audited packages, zero advisories reported), TypeScript check, production build, two script-encoding tests.
- VERIFIED WORKING: local Vite page opened in Chrome at http://127.0.0.1:5174/ after starting outside sandbox. Sandbox port 5173 was inaccessible to Chrome.
- PARTIALLY WORKING: iframe element renders, but observed content remained blank and no initial `done` arrived. Subsequent browser state read timed out on `Page.getFrameTree`. No PSD experiment ran; do not interpret this as replacement failure or success.
- The initial iframe blank state was temporary; subsequent real browser testing established communication successfully.
- VERIFIED WORKING: final `npm run check`, `npm test` (9 passing), `npm run build`. Tests now include bridge event integration, sequencing, origin/source rejection, stale echoes, timeout poisoning, missing binary, concurrent request rejection, script encoding and placement regression. Lint/format tooling is still outstanding.
- Local ignored evidence: `test-results/real-engine-trace.txt`, `test-results/verified-red-green.png`, `test-results/verified-blue.png`. The browser run also produced baseline and provided-template result download links; the real result was visually reviewed in Photopea.
- Root cause of the reported failure: bridge resolved on intermediate `done` before delayed binary and acknowledgment. Fixed with per-request terminal echo + required binary + subsequent `done`, without weakening origin/source checks. Follow-on real-rendering bug: Number(UnitValue) returned NaN; use bounds `.value` and validate dimensions. See RESEARCH.md.

## Next work

Original synthetic objective and the supplied single-design candle compatibility check are achieved. The next real-template gate is to run three distinct label designs through `36.psd` and manually confirm the exported PNGs at full resolution. The ignored files under `public/test-fixtures/` are local test inputs only and must not be committed or published. No advanced features, polished interface or publication performed.

## Multi-PSD batch workflow — VERIFIED 10/10 IN REAL PHOTOPEA

- The UI now accepts 1–10 PSD templates and one PNG/JPG design, with Fit/Fill placement selection.
- “Scan PSD Smart Objects” loads templates sequentially, reports layer candidates, auto-suggests a unique `Add Design Here` or unique Smart Object, and exposes an explicit per-template mapping when the suggestion is ambiguous.
- “Generate All Mockups” processes the selected mappings sequentially with the existing Photopea bridge, validates PNG dimensions, preserves per-template failures, shows progress, previews outputs, creates deterministic filenames, and offers an uncompressed ZIP download.
- Automated regression coverage is now 13 passing tests, including mapping ambiguity, filename generation, and ZIP structure.
- The browser UI was loaded successfully and showed Photopea ready. The supplied verification path then loaded all ten ignored fixture copies and completed the real Photopea batch: 10/10 templates scanned, mapped to `/1/0 — Add Design Here [1]`, replaced, saved, and exported as PNG.
- Verified output dimensions and byte sizes from the browser run:
  - `2.psd` — 3584 × 3584, 11,353,516 bytes
  - `3.psd` — 3584 × 3584, 14,198,224 bytes
  - `4.psd` — 3584 × 3584, 15,276,502 bytes
  - `6.psd` — 3584 × 3584, 12,807,405 bytes
  - `7.psd` — 3848 × 3848, 12,179,495 bytes
  - `9.psd` — 3584 × 3584, 12,669,572 bytes
  - `10.psd` — 4076 × 4064, 15,113,838 bytes
  - `1 (1).psd` — 3808 × 3808, 12,861,440 bytes
  - `1.psd` — 3808 × 3808, 12,861,440 bytes
  - `11.psd` — 3584 × 3584, 13,602,849 bytes
- The browser showed ten successful output previews/download links and a `Download All as ZIP` control. One displayed result was visually confirmed as a candle mockup with the FALL artwork mapped onto the jar while preserving the scene, flame, lighting, and shadows. Full-resolution manual review of every output and copying the browser downloads into the workspace remain user-side confirmation steps; originals were not modified.

## Professional UI/UX redesign — IMPLEMENTED AND BROWSER-REVIEWED

- Reworked the existing frontend in place; the Photopea bridge, scripts, batch orchestration, mapping logic, export logic, and original-file safeguards were preserved.
- Added a five-step beginner workflow: PSD upload, design upload, placement configuration, generation, and results.
- Added drag-and-drop upload zones, PSD count/file chips with individual removal, design thumbnail plus dimensions, clear required/ready states, accessible keyboard activation, Fit/Fill explanations, responsive cards, progress messaging, retry controls, a responsive result gallery, click-to-enlarge previews, and ZIP/individual downloads.
- Moved Photopea and technical logs out of the primary workflow into a collapsed Advanced diagnostics section.
- Browser review completed on the local Vite preview at desktop size and at a 390 × 844 mobile viewport. The layout remained single-column on mobile with no visible horizontal overflow; Photopea reported ready in the redesigned page.
- Final post-redesign checks: `npm run check` passed, `npm test` passed 13/13, and `npm run build` passed. The redesigned page was then used to rerun the supplied real 10-PSD Photopea batch: it reached `10 / 10 completed`, produced ten gallery previews/download links, and kept the same `/1/0 — Add Design Here [1]` mapping for every template. The browser ZIP download was also triggered successfully; the downloaded archive had a valid `50 4B 03 04` signature and contained all ten deterministic PNG names.

## Artwork placement controls — IMPLEMENTED AND BROWSER-VERIFIED

- Root cause confirmed from the rendered output: Fit used the complete artwork layer bounds and centered it at the calculated 100% size, leaving the FALL artwork visually too close to the label edges. This is a placement-scale issue, not a Photopea acknowledgment or export failure.
- Added Smart Object-relative controls without changing the existing workflow: Design size (70–110%, baseline 100%), horizontal offset (−20% to +20%), vertical offset (−20% to +20%), Center design, and Reset to default.
- Added collapsed per-template overrides so different PSDs can use different scale/position values; overrides are calculated against each child Smart Object canvas, never the outer PSD document.
- Added real Photopea preview actions per mapped template and an explicit Update preview control. Changing placement marks previews stale instead of presenting an approximate overlay.
- Placement math keeps the existing Fit/Fill aspect-ratio calculation, applies the user scale after that base transform, then translates relative to the Smart Object canvas. Bounds continue to use `UnitValue.value` and are validated before any transform.
- Real browser verification completed after the change: Photopea reported ready, all 10 supplied PSDs scanned and exported successfully at the baseline 100% setting (`10 / 10 completed`), and a real per-template preview was regenerated at 90%. The 90% preview visibly restores useful whitespace around the label artwork while preserving the candle scene, lighting, and shadows. Full-resolution review of every generated image remains a manual confirmation step.
- Final checks after the placement work: `npm run check` passed, `npm test` passed 14/14, and `npm run build` passed.

## GitHub publication — APPROVED AND PUBLISHED

- The project was published as a public repository at `https://github.com/malkichee-tech/openmockup`; existing `bloomenesthome-blog` was not touched.
- Public candidate files are limited to the application source, tests, docs, `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `LICENSE`, and `README.md` (19 files total).
- Explicitly excluded from the candidate: `AGENTS.md`, `node_modules/`, `dist/`, `test-results/`, `public/test-fixtures/`, PSD/PSB files, PNG/JPG files, ZIP exports, `.env*`, npm credentials, and key/certificate files.
- `artifacts/openmockup-publishable-source.zip` is a local ignored backup of the 19-file candidate. Its archive contents were checked for private fixture and generated-media exclusions.
- A clean temporary checkout extracted from that ZIP installed with `npm ci`, passed `npm run check`, passed `npm test` (14/14), and passed `npm run build`.
- Direct dependency license review: TypeScript is Apache-2.0, Vite is MIT, and `@types/node` is MIT; these development dependencies are compatible with the project’s MIT source license. `npm audit --omit=dev` reported zero vulnerabilities in the local audit run.
- An authenticated preflight confirmed that `malkichee-tech/openmockup` did not already exist. GitHub authentication used the official GitHub CLI browser/device flow; no password was requested by the agent.
- The first public commit contains exactly the 19 audited files. No PSD, design image, commercial fixture, generated mockup, ZIP backup, environment file, credential, or build/dependency artifact was committed.
