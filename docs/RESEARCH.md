# Feasibility investigation — 2026-11-05

Reviewed official sources:

- https://www.photopea.com/api/ — iframe integration, free API, ads must not be bypassed.
- https://www.photopea.com/api/live — initial and per-operation `done`, ArrayBuffer input and export, echo strings.
- https://www.photopea.com/learn/scripts — Photoshop-like DOM, `app.open(uri,null,true)`, `saveToOE`.
- https://www.photopea.com/tuts/edit-smart-objects-with-a-script/ — `placedLayerEditContents`, child save/close, `newPlacedLayer` conversion.
- https://www.photopea.com/learn/smart-objects — source updates parent instances, transformations belong to instances.
- https://www.photopea.com/privacy.html — third-party terms/privacy.
- https://psd-tools.readthedocs.io/en/latest/ — Smart Object editing unsupported; not an alternative renderer.
- https://vite.dev/guide/ — local development and Node requirements.

Documented support is not experimental evidence. Risks to isolate: asynchronous image insertion, DOM unit conversion, bounds and transparency, parent refresh after child save/close, export completion ordering, embedded versus externally linked sources, masks/warp compatibility. No generic Smart Object support is claimed.

Gate: run original fixture, visually inspect all three exports, verify pixels/dimensions, then obtain private candle PSD and approved manual reference. Do not build advanced features before this gate passes. Competitor and GitHub publication research is deferred until relevant; no account or repository changes made.

## Acknowledgment bug investigation

Reproduced the owner's failure in Chrome, in the existing application. The fixture script produced this actual event order: early `done`, PSD ArrayBuffer (53,445 bytes), success echo, final `done`. The old bridge resolved on the early `done`, throwing before the actual success/binary arrived. The same intermediate `done` was observed while opening Smart Object contents. This behavior is an observed engine detail; the public Live Messaging documentation only describes the normal completed-message boundary.

The bridge now waits for a request-specific terminal echo, required export binary and a subsequent `done`. Unmatched echoes never count as success. Missing acknowledgments fail via a diagnostic timeout that disables further operations until reset. All inbound messages still require exact origin and iframe window identity; outbound target remains https://www.photopea.com. Logs contain labels, IDs, timing, message classifications and byte counts, never source scripts, data URIs or file contents. Raw script error text is withheld because it may include private filenames.

After fixing messaging, real pixel inspection caught blank output. Placement coerced layer bounds with `Number(UnitValue)` and produced NaN. Numeric probes isolated this; the standard UnitValue `value` property works in real Photopea, whereas `.as('px')` did not produce usable bounds in this experiment. The final code uses `.value` for pixel bounds, validates dimensions, and separates fitting, saving and closing for observable stages. Temporary child exports and raw bounds probes were removed.

## Supplied candle-template run

The supplied `36.psd` was run in real Photopea/Chrome using the local ignored fixture copy. Inspection returned eight layer records: `Lighting`, `Adjust Saturation`, `Adjust Brightness`, `Shadow`, `Highlights`, `Smart Object`, `Add Design Here`, and `Background`. The target is a single nested `Add Design Here` layer, so the runner now accepts the actual capitalization case-insensitively while still requiring exactly one match. A 12,760,440-byte baseline PNG and a 13,380,660-byte replacement PNG were exported. Visual inspection showed the FALL label on the candle with the original scene, flame, lighting, shadows and perspective retained. This is one real design verification, not yet a three-design commercial-template batch proof.
