# OpenMockup

OpenMockup is a local-first PSD mockup generator. It uses Photopea’s embedded Live Messaging API to open Photoshop Smart Objects, place one PNG/JPG design, render the parent PSD, and export finished PNG mockups in the browser.

The project is intended for experimentation and careful visual review. It does not upload your PSDs to an OpenMockup server.

## Requirements and start

Windows or another modern desktop, Node.js 22.12+ (tested environment: 24.15.0), npm, modern browser, internet access to Photopea.

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. Wait for “Photopea ready”, then use the five-step workflow. The developer-only synthetic experiment is still available in the source for regression testing.

For batch generation, drop 1–10 PSD templates into Step 01, drop one PNG/JPG design into Step 02, choose Fit or Fill, scan the templates, review any layer mapping, adjust Artwork placement if needed, then click “Generate all mockups”. The placement baseline is the template’s calculated 100%; Design size (70–110%), horizontal/vertical offsets, Center design, Reset to default, collapsed per-template overrides, and real Photopea “Preview this template” actions are available. Processing is sequential, uses the existing origin/source-checked bridge, keeps each PSD in memory, reports per-template success/failure, previews valid PNG dimensions, supports larger image previews, and offers individual or ZIP downloads. Fit and Fill modes use the child Smart Object canvas rather than the outer PSD canvas.

The interface is intentionally simple for beginners: technical Photopea logs and the iframe live under “Advanced diagnostics”, while the main page uses a five-step workflow with drag-and-drop upload areas, file removal, design preview, progress, retry controls, and a responsive result gallery.

Photopea is an external, separately hosted dependency. Its application code is not included in this repository and is not licensed under this project’s MIT license.

## Screenshots

Screenshots are intentionally not committed yet. Generated candle mockups and commercial PSD previews are private/user-owned assets and are excluded by `.gitignore`. Add approved, non-sensitive images under `docs/screenshots/` before publishing screenshots to GitHub.

For the supplied real-template check, keep `public/test-fixtures/36.psd` and `public/test-fixtures/label.png` local, then use the developer verification controls when needed. The fixture directory is ignored and is never a publishable asset. The verified runs found the unique nested layer `Add Design Here`, exported a baseline, replaced the label, and exported a visibly mapped candle result. Ten supplied commercial PSD copies have also completed the batch workflow in real Photopea.

The private PSD section accepts one PSD and one PNG/JPG plus an exact layer name. Duplicate names fail rather than guessing. This is an experimental whole-Smart-Object-canvas replacement: existing child layers are hidden. Internal artwork masks/layouts are not preserved. The original parent layer's transformations are left in place, but complex effects, linked objects, warp, and commercial candle templates remain unverified. Do not interact with Photopea while processing.

## Safety and privacy

Local File API reads do not overwrite originals. No project upload server or backend is configured. Photopea is third-party code loaded from the internet; this is not an offline tool. Its [privacy policy](https://www.photopea.com/privacy.html) states file processing stays on the device. Its UI, ads, and network dependencies remain present. No ad or license restrictions are bypassed.

Do not select unrelated valuable documents inside this dedicated engine iframe: the experiment closes its documents without saving. Use Reset engine after a timeout. Inputs remain local to this browser session. Keep private assets in ignored `private-fixtures/`; never commit licensed commercial templates.

## Validation

`npm run check`, `npm test`, `npm run build`. Fourteen automated tests cover message ordering, origin/source checks, stale acknowledgments, missing exports, timeout safety, encoding, placement calculations including scale/offsets, mapping ambiguity, deterministic filenames, and ZIP structure. They do not prove arbitrary PSD compatibility. The real browser runs additionally check output dimensions and the supplied ten-template workflow. See [progress](docs/PROGRESS.md) and [research](docs/RESEARCH.md) for exact evidence and open risks.

## Repository layout

```text
index.html          UI shell
src/bridge.ts       Photopea origin/source-checked messaging bridge
src/scripts.ts      Photopea scripts and placement math
src/batch.ts        Mapping, filenames, and ZIP generation
src/main.ts         UI orchestration and batch workflow
tests/              Node-based regression tests
docs/               Research and observed progress
LICENSE             MIT license for this repository’s source
```

## Architecture

Vanilla TypeScript + Vite; no React until feasibility is established. `src/bridge.ts` isolates origin/source-checked, sequential messaging; timeouts poison the connection to prevent late replies from contaminating subsequent operations. `src/scripts.ts` owns fixed scripts, JSON-encoded input literals. `src/main.ts` owns experiment orchestration and previews. Every design reopens original in-memory PSD bytes. No general-purpose user script execution exists.

## License

The original OpenMockup source is released under the [MIT License](LICENSE). Photopea, its hosted application, terms, privacy policy, and any user-supplied PSD/design assets remain separate and are not relicensed by this repository.
