import { PhotopeaBridge, ORIGIN } from './bridge';
import { closeAll, openSmart, openSmartAt, place, placementScript, fixture, inspectLayers } from './scripts';
import { BatchRow, LayerInfo, PlacementSettings, createZip, isDesignName, isPsdName, outputFilename, smartObjectCandidates, suggestedPath } from './batch';
import './style.css';
import './visibility.css';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const frame = el<HTMLIFrameElement>('engine');
const status = el('status'); const log = el('log');
const experiment = el<HTMLButtonElement>('experiment');
const realFixture = el<HTMLButtonElement>('realFixture');
const process = el<HTMLButtonElement>('process');
const reset = el<HTMLButtonElement>('reset');
const batchPsds = el<HTMLInputElement>('batchPsds');
const batchDesign = el<HTMLInputElement>('batchDesign');
const batchMode = el<HTMLSelectElement>('batchMode');
const batchScale = el<HTMLInputElement>('batchScale');
const batchOffsetX = el<HTMLInputElement>('batchOffsetX');
const batchOffsetY = el<HTMLInputElement>('batchOffsetY');
const batchScaleValue = el<HTMLOutputElement>('batchScaleValue');
const batchOffsetXValue = el<HTMLOutputElement>('batchOffsetXValue');
const batchOffsetYValue = el<HTMLOutputElement>('batchOffsetYValue');
const centerDesign = el<HTMLButtonElement>('centerDesign');
const resetPlacement = el<HTMLButtonElement>('resetPlacement');
const previewSelected = el<HTMLButtonElement>('previewSelected');
const placementStale = el('placementStale');
const scanBatchButton = el<HTMLButtonElement>('scanBatch');
const generateAllButton = el<HTMLButtonElement>('generateAll');
const providedBatchButton = el<HTMLButtonElement>('providedBatch');
const batchRowsElement = el('batchRows');
const batchResults = el('batchResults');
const emptyResults = el('emptyResults');
const downloadZipButton = el<HTMLButtonElement>('downloadZip');
const progress = el<HTMLProgressElement>('batchProgress');
const progressLabel = el('batchProgressLabel');
const templateDrop = el('templateDrop');
const templateList = el('templateList');
const templateSummary = el('templateSummary');
const templateError = el('templateError');
const templatesState = el('templatesState');
const designDrop = el('designDrop');
const designPlaceholder = el('designPlaceholder');
const designPreview = el('designPreview');
const designError = el('designError');
const designState = el('designState');
const configureState = el('configureState');
const previewDialog = el<HTMLDialogElement>('previewDialog');
const previewDialogImage = el<HTMLImageElement>('previewDialogImage');
const previewDialogTitle = el('previewDialogTitle');
const closePreview = el<HTMLButtonElement>('closePreview');
const allButtons = [experiment, realFixture, process, scanBatchButton, generateAllButton, providedBatchButton];
let busy = false;
let bridge: PhotopeaBridge;
let batchRows: BatchRow[] = [];
let selectedDesign: File | undefined;
let selectedPsdFiles: File[] = [];
const DEFAULT_PLACEMENT: PlacementSettings = { scale: 100, offsetX: 0, offsetY: 0 };
let globalPlacement: PlacementSettings = { ...DEFAULT_PLACEMENT };
let previewRowIndex: number | undefined;

function refreshControls() {
  const available = bridge.ready && !bridge.poisoned && !busy;
  experiment.disabled = !available; realFixture.disabled = !available; process.disabled = !available;
  scanBatchButton.disabled = !available || !selectedPsdFiles.length;
  generateAllButton.disabled = !available || !selectedDesign || !batchRows.length || batchRows.some(row => row.status === 'scanning' || row.status === 'processing' || !row.selectedPath);
  providedBatchButton.disabled = !available;
  previewSelected.disabled = !available || previewRowIndex === undefined || !batchRows[previewRowIndex]?.selectedPath || !selectedDesign;
}
function report(message: string) { status.textContent = message; log.textContent += message + '\n'; refreshControls(); }
function diagnostic(message: string) { log.textContent += message + '\n'; }

bridge = new PhotopeaBridge(frame, report, diagnostic);
frame.src = ORIGIN;
setTimeout(() => { if (!bridge.ready) report('Photopea has not initialized. Check internet access to photopea.com, then Reset engine.'); }, 60000);

reset.onclick = () => {
  if (busy) return;
  bridge.dispose(); bridge = new PhotopeaBridge(frame, report, diagnostic);
  allButtons.forEach(button => button.disabled = true);
  frame.src = ORIGIN + '/#' + encodeURIComponent(JSON.stringify({}));
  report('Reloading engine…');
};

function binary(reply: { binary: ArrayBuffer[] }) {
  if (reply.binary.length !== 1) throw new Error('Expected exactly one exported file');
  return reply.binary[0];
}
function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function preview(bytes: ArrayBuffer, name: string, container: HTMLElement = el('results')) {
  const blob = new Blob([bytes], { type: 'image/png' }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.textContent = 'Download';
  const img = document.createElement('img'); img.src = url; img.alt = name + ' — inspect against the intended artwork';
  img.onclick = () => { previewDialogImage.src = url; previewDialogImage.alt = name; previewDialogTitle.textContent = name; previewDialog.showModal(); };
  const meta = document.createElement('div'); meta.className = 'result-meta'; const title = document.createElement('strong'); title.textContent = name; meta.append(title, a);
  const box = document.createElement('article'); box.dataset.filename = name; box.append(img, meta); container.append(box); emptyResults.hidden = true; return box;
}
async function run(task: () => Promise<void>, doneMessage = 'Processing finished. Visual comparison is still required.') {
  if (busy) return; busy = true; allButtons.forEach(button => button.disabled = true); reset.disabled = true;
  try { await task(); report(doneMessage); } catch (error) { report('FAILED: ' + String(error)); }
  finally { busy = false; reset.disabled = false; refreshControls(); }
}

async function replace(psd: ArrayBuffer, uri: string, target: string, mode: 'fit' | 'fill' = 'fit', placement: PlacementSettings = DEFAULT_PLACEMENT) {
  await bridge.script(closeAll, 'Close documents'); await bridge.send(psd.slice(0), 'Load PSD');
  await bridge.script(target.startsWith('/') ? openSmartAt(target) : openSmart(target), 'Open Smart Object');
  await bridge.script(place(uri), 'Insert artwork'); await bridge.script(placementScript(mode, placement.scale, placement.offsetX, placement.offsetY), mode === 'fill' ? 'Fill artwork' : 'Fit artwork');
  await bridge.script('app.activeDocument.save();', 'Save Smart Object'); await bridge.script('app.activeDocument.close();', 'Close Smart Object');
  return binary(await bridge.script("app.activeDocument.saveToOE('png');", 'Export result PNG', 1));
}
function placementFromControls(): PlacementSettings { return { scale: Number(batchScale.value), offsetX: Number(batchOffsetX.value), offsetY: Number(batchOffsetY.value) }; }
function updatePlacementLabels() { batchScaleValue.value = `${batchScale.value}%`; batchOffsetXValue.value = `${Number(batchOffsetX.value) > 0 ? '+' : ''}${batchOffsetX.value}%`; batchOffsetYValue.value = `${Number(batchOffsetY.value) > 0 ? '+' : ''}${batchOffsetY.value}%`; }
function markPreviewStale() { placementStale.hidden = true; if (batchRows.length) placementStale.hidden = false; }
function rowPlacement(row: BatchRow) { return row.placement ?? globalPlacement; }
async function outputSize(bytes: ArrayBuffer) {
  const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  try { if (image.width <= 0 || image.height <= 0) throw new Error('Export has invalid dimensions'); return { width: image.width, height: image.height }; }
  finally { image.close(); }
}
async function checkOriginalOutput(bytes: ArrayBuffer, color: string) {
  const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  try {
    if (image.width !== 480 || image.height !== 360) throw new Error('Unexpected fixture export dimensions');
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 360; const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, 480, 360).data; const expected = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)); let count = 0;
    for (let i = 0; i < pixels.length; i += 4) if (expected.every((value, channel) => Math.abs(pixels[i + channel] - value) < 5) && pixels[i + 3] === 255) count++;
    if (count < 15000) throw new Error('Export does not contain the intended original design color'); diagnostic(`Fixture pixel check: 480 × 360; intended color present in ${count} pixels`);
  } finally { image.close(); }
}
async function blobDataUri(blob: Blob) {
  return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Cannot decode design file')); reader.readAsDataURL(blob); });
}
async function dataUri(path: string) { const response = await fetch(path); if (!response.ok) throw new Error(`Cannot read fixture ${path} (${response.status})`); return blobDataUri(await response.blob()); }
async function fileDataUri(file: File) { return blobDataUri(file); }
async function inspectPsd(file: File, label: string): Promise<LayerInfo[]> {
  const bytes = await file.arrayBuffer(); if (new TextDecoder().decode(bytes.slice(0, 4)) !== '8BPS') throw new Error('Invalid PSD signature');
  await bridge.script(closeAll, 'Close documents'); await bridge.send(bytes, label); const reply = await bridge.script(inspectLayers, 'Inspect layers');
  const meta = reply.strings.find(value => value.startsWith('OM_META:')); if (!meta) throw new Error('Layer inspection returned no metadata'); return JSON.parse(meta.slice('OM_META:'.length)) as LayerInfo[];
}
async function closeAfterFailure() { if (!bridge.poisoned) { try { await bridge.script(closeAll, 'Clean up documents'); } catch { /* preserve original failure */ } } }

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function setFieldError(element: HTMLElement, message?: string) {
  element.textContent = message ?? ''; element.hidden = !message;
}
function renderTemplateList() {
  templateList.replaceChildren();
  templateSummary.hidden = !selectedPsdFiles.length;
  templateSummary.textContent = selectedPsdFiles.length ? `${selectedPsdFiles.length} PSD template${selectedPsdFiles.length === 1 ? '' : 's'} selected` : '';
  templatesState.textContent = selectedPsdFiles.length ? `${selectedPsdFiles.length} selected` : 'Required';
  templatesState.classList.toggle('ready', Boolean(selectedPsdFiles.length));
  for (const [index, file] of selectedPsdFiles.entries()) {
    const chip = document.createElement('div'); chip.className = 'file-chip';
    chip.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/></svg>';
    const name = document.createElement('span'); name.textContent = file.name; const size = document.createElement('small'); size.textContent = formatBytes(file.size);
    const remove = document.createElement('button'); remove.className = 'remove-file'; remove.type = 'button'; remove.title = `Remove ${file.name}`; remove.setAttribute('aria-label', `Remove ${file.name}`); remove.textContent = '×';
    remove.onclick = () => { selectedPsdFiles = selectedPsdFiles.filter((_, itemIndex) => itemIndex !== index); batchPsds.value = ''; batchRows = batchRows.filter(row => selectedPsdFiles.includes(row.file)); renderTemplateList(); renderBatchRows(); refreshControls(); };
    chip.append(name, size, remove); templateList.append(chip);
  }
  setFieldError(templateError, selectedPsdFiles.some(file => !isPsdName(file.name)) ? 'Only PSD files can be used as templates.' : undefined);
}
function renderDesign(file?: File) {
  designPreview.replaceChildren(); designPreview.hidden = !file; designPlaceholder.hidden = Boolean(file); designState.textContent = file ? 'Ready' : 'Required'; designState.classList.toggle('ready', Boolean(file));
  if (!file) { setFieldError(designError); return; }
  if (!isDesignName(file.name)) { designPreview.hidden = true; designPlaceholder.hidden = false; designState.textContent = 'Required'; designState.classList.remove('ready'); setFieldError(designError, 'Choose a PNG or JPG design.'); return; }
  setFieldError(designError);
  const url = URL.createObjectURL(file); const image = document.createElement('img'); image.src = url; image.alt = file.name; const copy = document.createElement('div'); const name = document.createElement('strong'); name.textContent = file.name; const meta = document.createElement('small'); meta.textContent = `${formatBytes(file.size)} · loading dimensions…`; copy.append(name, meta); designPreview.append(image, copy);
  image.onload = () => { meta.textContent = `${image.naturalWidth} × ${image.naturalHeight} px · ${formatBytes(file.size)}`; URL.revokeObjectURL(url); };
}
function setDroppedFiles(target: 'templates' | 'design', files: File[]) {
  if (target === 'templates') { selectedPsdFiles = files.filter(file => isPsdName(file.name)).slice(0, 10); batchRows = selectedPsdFiles.map(file => ({ file, layers: [], candidates: [], status: 'pending' as const })); renderTemplateList(); renderBatchRows(); }
  else { selectedDesign = files[0]; renderDesign(selectedDesign); }
  refreshControls();
}
function wireDropzone(zone: HTMLElement, target: 'templates' | 'design') {
  for (const eventName of ['dragenter', 'dragover']) zone.addEventListener(eventName, event => { event.preventDefault(); zone.classList.add('is-dragging'); });
  for (const eventName of ['dragleave', 'drop']) zone.addEventListener(eventName, event => { event.preventDefault(); zone.classList.remove('is-dragging'); });
  zone.addEventListener('drop', event => { const files = Array.from((event as DragEvent).dataTransfer?.files ?? []); if (files.length) setDroppedFiles(target, files); });
}

function renderBatchRows() {
  batchRowsElement.replaceChildren();
  configureState.textContent = batchRows.some(row => row.status === 'ready' || row.status === 'success') ? 'Mapped' : batchRows.length ? 'Review mapping' : 'Ready when scanned';
  configureState.classList.toggle('ready', batchRows.some(row => row.status === 'ready' || row.status === 'success'));
  for (const row of batchRows) {
    const item = document.createElement('article'); item.className = 'template-row'; const title = document.createElement('strong'); title.textContent = row.file.name; item.append(title);
    const state = document.createElement('span'); state.className = 'row-status'; state.textContent = row.status; state.dataset.status = row.status; item.append(state);
    if (row.layers.length) {
      const label = document.createElement('label'); label.textContent = 'Target Smart Object'; const select = document.createElement('select');
      for (const layer of row.candidates) { const option = document.createElement('option'); option.value = layer.path; option.textContent = `${layer.path} — ${layer.name}${layer.kind ? ` [${layer.kind}]` : ''}`; option.selected = layer.path === row.selectedPath; select.append(option); }
      if (!row.candidates.length) { const option = document.createElement('option'); option.textContent = 'No compatible Smart Object detected'; option.disabled = true; select.append(option); }
      select.onchange = () => { row.selectedPath = select.value || undefined; row.status = row.selectedPath ? 'ready' : 'failed'; row.error = undefined; renderBatchRows(); };
      label.append(select); item.append(label);
    }
    if (row.selectedPath && selectedDesign) {
      const details = document.createElement('details'); details.className = 'template-advanced';
      const summary = document.createElement('summary'); summary.textContent = row.placement ? 'Custom placement for this template' : 'Advanced placement override'; details.append(summary);
      const fields = document.createElement('div'); fields.className = 'template-placement-fields';
      const current = rowPlacement(row);
      const makeRange = (labelText: string, min: string, max: string, value: number, suffix: string, onChange: (value: number) => void) => {
        const label = document.createElement('label'); label.className = 'range-field'; const span = document.createElement('span'); span.textContent = labelText; const output = document.createElement('output'); output.textContent = `${value > 0 && suffix !== '%' ? '+' : ''}${value}${suffix}`; span.append(' ', output); const input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = '1'; input.value = String(value); input.oninput = () => { const next = Number(input.value); output.textContent = `${next > 0 && suffix !== '%' ? '+' : ''}${next}${suffix}`; onChange(next); }; label.append(span, input); return label;
      };
      const ensureOverride = () => { if (!row.placement) row.placement = { ...globalPlacement }; };
      fields.append(makeRange('Design size', '70', '110', current.scale, '%', value => { ensureOverride(); row.placement!.scale = value; markPreviewStale(); }));
      fields.append(makeRange('Left / right', '-20', '20', current.offsetX, '%', value => { ensureOverride(); row.placement!.offsetX = value; markPreviewStale(); }));
      fields.append(makeRange('Up / down', '-20', '20', current.offsetY, '%', value => { ensureOverride(); row.placement!.offsetY = value; markPreviewStale(); }));
      const actions = document.createElement('div'); actions.className = 'template-placement-actions'; const center = document.createElement('button'); center.className = 'text-button'; center.type = 'button'; center.textContent = 'Center'; center.onclick = () => { ensureOverride(); row.placement!.offsetX = 0; row.placement!.offsetY = 0; renderBatchRows(); markPreviewStale(); }; const reset = document.createElement('button'); reset.className = 'text-button'; reset.type = 'button'; reset.textContent = 'Use global'; reset.onclick = () => { row.placement = undefined; renderBatchRows(); markPreviewStale(); }; actions.append(center, reset); fields.append(actions); details.append(fields); item.append(details);
    }
    if (row.selectedPath && selectedDesign) { const previewButton = document.createElement('button'); previewButton.className = 'text-button row-preview'; previewButton.type = 'button'; previewButton.textContent = 'Preview this template'; previewButton.onclick = () => { previewRowIndex = batchRows.indexOf(row); void run(previewCurrentRow, 'Preview updated. Review the rendered output.'); }; item.append(previewButton); }
    if (row.error) { const error = document.createElement('small'); error.className = 'error'; error.textContent = row.error; item.append(error); }
    if (row.outputName) { const result = document.createElement('small'); result.textContent = `${row.outputName} · ${row.width} × ${row.height}`; item.append(result); }
    if (row.status === 'failed' && row.selectedPath && selectedDesign) { const retry = document.createElement('button'); retry.className = 'secondary-button'; retry.type = 'button'; retry.textContent = 'Retry'; retry.onclick = () => void run(() => retryRow(batchRows.indexOf(row)), 'Retry finished. Review the output.'); item.append(retry); }
    batchRowsElement.append(item);
  }
  refreshControls();
}

async function previewCurrentRow() {
  if (previewRowIndex === undefined) throw new Error('Choose a mapped template first');
  const row = batchRows[previewRowIndex]; if (!row?.selectedPath || !selectedDesign) throw new Error('Choose a mapped template and design first');
  report(`Rendering preview: ${row.file.name}`); const result = await replace(await row.file.arrayBuffer(), await fileDataUri(selectedDesign), row.selectedPath, batchMode.value === 'fill' ? 'fill' : 'fit', rowPlacement(row));
  preview(result, `preview-${row.file.name.replace(/\.psd$/i, '')}.png`, batchResults); placementStale.hidden = true;
}

async function scanBatch(inputFiles?: File[]) {
  const files = inputFiles ?? selectedPsdFiles; if (!files.length) { setFieldError(templateError, 'Add at least one PSD template first.'); throw new Error('Select at least one PSD template'); } if (files.length > 10) { setFieldError(templateError, 'Choose no more than 10 PSD templates.'); throw new Error('Select at most 10 PSD templates per batch'); } if (files.some(file => !isPsdName(file.name))) { setFieldError(templateError, 'Only PSD files can be used as templates.'); throw new Error('Every template must be a .psd file'); }
  selectedPsdFiles = files;
  batchRows = files.map(file => ({ file, layers: [], candidates: [], status: 'pending' as const })); renderBatchRows(); progress.max = files.length; progress.value = 0; progressLabel.textContent = `0 / ${files.length} scanned`;
  for (let index = 0; index < batchRows.length; index++) {
    const row = batchRows[index]; row.status = 'scanning'; report(`Scanning ${index + 1} / ${files.length}: ${row.file.name}`); renderBatchRows();
    try { row.layers = await inspectPsd(row.file, `Scan ${row.file.name}`); row.candidates = smartObjectCandidates(row.layers); row.selectedPath = suggestedPath(row.layers); row.status = row.selectedPath ? 'ready' : 'failed'; if (!row.selectedPath) row.error = 'No unique Smart Object suggestion; choose a target manually.'; diagnostic(`${row.file.name}: ${row.layers.length} layers, ${row.candidates.length} candidates, selected=${row.selectedPath ?? 'none'}`); }
    catch (error) { row.status = 'failed'; row.error = String(error); await closeAfterFailure(); }
    progress.value = index + 1; progressLabel.textContent = `${index + 1} / ${files.length} scanned`; renderBatchRows();
  }
}

async function generateBatch() {
  if (!selectedDesign || !isDesignName(selectedDesign.name)) { setFieldError(designError, 'Add one PNG or JPG design first.'); throw new Error('Select one PNG or JPG design'); } if (!batchRows.length) throw new Error('Scan PSD templates first'); if (batchRows.some(row => !row.selectedPath)) throw new Error('Choose one Smart Object target for every template');
  const uri = await fileDataUri(selectedDesign); batchResults.replaceChildren(); downloadZipButton.hidden = true; emptyResults.hidden = false; let finished = 0; const total = batchRows.length; progress.max = total; progress.value = 0;
  for (let index = 0; index < batchRows.length; index++) {
    const row = batchRows[index]; row.status = 'processing'; report(`Generating ${index + 1} / ${total}: ${row.file.name}`); renderBatchRows();
    try { const result = await replace(await row.file.arrayBuffer(), uri, row.selectedPath!, batchMode.value === 'fill' ? 'fill' : 'fit', rowPlacement(row)); const dimensions = await outputSize(result); row.output = result; row.width = dimensions.width; row.height = dimensions.height; row.outputName = outputFilename(index, row.file.name, selectedDesign.name); row.status = 'success'; preview(result, row.outputName, batchResults); diagnostic(`${row.file.name}: success, ${result.byteLength} bytes, ${dimensions.width} × ${dimensions.height}; placement=${JSON.stringify(rowPlacement(row))}`); }
    catch (error) { row.status = 'failed'; row.error = String(error); diagnostic(`${row.file.name}: failed (details withheld from file contents)`); await closeAfterFailure(); }
    finished++; progress.value = finished; progressLabel.textContent = `${finished} / ${total} completed`; renderBatchRows(); if (bridge.poisoned) for (const pending of batchRows.slice(index + 1)) { pending.status = 'failed'; pending.error = 'Engine unavailable after a previous failure; reset and retry.'; }
  }
  refreshZipButton();
}

function refreshZipButton() {
  const outputs = batchRows.filter(row => row.output && row.outputName).map(row => ({ name: row.outputName!, data: row.output! }));
  downloadZipButton.hidden = !outputs.length; downloadZipButton.onclick = () => downloadBlob(createZip(outputs), 'openmockup-results.zip');
}
async function retryRow(index: number) {
  const row = batchRows[index]; if (!row || !selectedDesign || !row.selectedPath) throw new Error('This item is not ready to retry');
  row.status = 'processing'; row.error = undefined; renderBatchRows(); report(`Retrying ${row.file.name}…`);
  try { const result = await replace(await row.file.arrayBuffer(), await fileDataUri(selectedDesign), row.selectedPath, batchMode.value === 'fill' ? 'fill' : 'fit', rowPlacement(row)); const dimensions = await outputSize(result); row.output = result; row.width = dimensions.width; row.height = dimensions.height; row.outputName = outputFilename(index, row.file.name, selectedDesign.name); row.status = 'success'; preview(result, row.outputName, batchResults); }
  catch (error) { row.status = 'failed'; row.error = String(error); await closeAfterFailure(); }
  refreshZipButton(); renderBatchRows();
}

async function runProvidedBatch() {
  const names = ['2.psd', '3.psd', '4.psd', '6.psd', '7.psd', '9.psd', '10.psd', '1 (1).psd', '1.psd', '11.psd'];
  const files = await Promise.all(names.map(async name => { const response = await fetch(`/test-fixtures/batch/${encodeURIComponent(name)}`); if (!response.ok) throw new Error(`Cannot read supplied ${name}`); return new File([await response.arrayBuffer()], name, { type: 'application/octet-stream' }); }));
  const designResponse = await fetch('/test-fixtures/batch/design.png'); if (!designResponse.ok) throw new Error('Cannot read supplied design.png');
  selectedDesign = new File([await designResponse.arrayBuffer()], 'design.png', { type: 'image/png' }); renderDesign(selectedDesign);
  await scanBatch(files); await generateBatch();
}

async function runProvidedFixture() {
  const response = await fetch('/test-fixtures/36.psd'); if (!response.ok) throw new Error(`Cannot read 36.psd (${response.status})`); const psd = await response.arrayBuffer(); if (new TextDecoder().decode(psd.slice(0, 4)) !== '8BPS') throw new Error('Provided file is not a valid PSD');
  await bridge.script(closeAll, 'Close documents'); await bridge.send(psd, 'Load provided 36.psd'); const inspected = await bridge.script(inspectLayers, 'Inspect provided PSD layers'); const meta = inspected.strings.find(value => value.startsWith('OM_META:')); if (!meta) throw new Error('Layer inspection returned no metadata');
  const layers = JSON.parse(meta.slice('OM_META:'.length)) as LayerInfo[]; const targets = layers.filter(layer => /^add design here$/i.test(layer.name.trim())); const target = targets[0]; diagnostic(`Provided PSD: ${layers.length} layers; Add Design Here matches=${targets.length}; PSD bytes=${psd.byteLength}`); diagnostic(`Provided layer map: ${layers.map(layer => `${layer.path}=${layer.name} [${layer.typename}]`).join(' | ')}`);
  if (targets.length !== 1 || !target) throw new Error(`Expected one Add Design Here Smart Object, found ${targets.length}`); preview(binary(await bridge.script("app.activeDocument.saveToOE('png');", 'Export provided baseline PNG', 1)), '36-baseline.png'); const result = await replace(psd, await dataUri('/test-fixtures/label.png'), target.path); preview(result, '36-real-result.png'); diagnostic(`Provided PSD result: ${result.byteLength} exported PNG bytes; visual review required.`);
}

function artwork(color: string, number: number) { const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 180; const context = canvas.getContext('2d')!; context.fillStyle = color; context.fillRect(0, 0, 240, 180); context.fillStyle = 'white'; context.font = 'bold 90px sans-serif'; context.textAlign = 'center'; context.fillText(String(number), 120, 120); return canvas.toDataURL('image/png'); }
experiment.onclick = () => void run(async () => { report('Creating original embedded Smart Object PSD…'); await bridge.script(closeAll, 'Close documents'); const psd = binary(await bridge.script(fixture, 'Create fixture and export PSD', 1)); preview(binary(await bridge.script("app.activeDocument.saveToOE('png');", 'Export baseline PNG', 1)), 'baseline.png'); for (const [index, color] of ['#c83e45', '#23835b', '#285ac0'].entries()) { report('Processing design ' + (index + 1) + ' / 3'); const result = await replace(psd, artwork(color, index + 1), 'ADD DESIGN HERE'); await checkOriginalOutput(result, color); preview(result, 'original-design-' + (index + 1) + '.png'); } });
realFixture.onclick = () => void run(runProvidedFixture);
process.onclick = () => void run(async () => { const psd = el<HTMLInputElement>('psd').files?.[0], art = el<HTMLInputElement>('art').files?.[0]; if (!psd || !art) throw new Error('Select a PSD and a PNG/JPG first'); if (!isPsdName(psd.name) || !isDesignName(art.name)) throw new Error('Unsupported file type'); if (psd.size > 150 * 1024 * 1024 || art.size > 25 * 1024 * 1024) throw new Error('Lab limits: PSD 150 MiB; artwork 25 MiB'); report('Processing private template…'); preview(await replace(await psd.arrayBuffer(), await fileDataUri(art), el<HTMLInputElement>('layer').value), 'openmockup-result.png'); });
batchPsds.onchange = () => { selectedPsdFiles = Array.from(batchPsds.files ?? []).slice(0, 10); batchRows = selectedPsdFiles.map(file => ({ file, layers: [], candidates: [], status: 'pending' as const })); renderTemplateList(); renderBatchRows(); refreshControls(); };
batchDesign.onchange = () => { selectedDesign = batchDesign.files?.[0]; renderDesign(selectedDesign); report(selectedDesign ? `Design selected: ${selectedDesign.name}` : 'No batch design selected'); };
wireDropzone(templateDrop, 'templates'); wireDropzone(designDrop, 'design');
templateDrop.onkeydown = event => { if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') { event.preventDefault(); batchPsds.click(); } };
designDrop.onkeydown = event => { if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') { event.preventDefault(); batchDesign.click(); } };
closePreview.onclick = () => previewDialog.close(); previewDialog.addEventListener('click', event => { if (event.target === previewDialog) previewDialog.close(); });
scanBatchButton.onclick = () => void run(scanBatch, 'Scan complete. Review each Smart Object mapping before generation.');
generateAllButton.onclick = () => void run(generateBatch, 'Batch processing finished. Review every output visually.');
providedBatchButton.onclick = () => void run(runProvidedBatch, 'Supplied 10-PSD batch finished. Review every output visually.');
function syncPlacementControls() { const next = placementFromControls(); globalPlacement = next; updatePlacementLabels(); markPreviewStale(); renderBatchRows(); }
for (const input of [batchScale, batchOffsetX, batchOffsetY]) input.oninput = syncPlacementControls;
centerDesign.onclick = () => { batchOffsetX.value = '0'; batchOffsetY.value = '0'; syncPlacementControls(); };
resetPlacement.onclick = () => { batchScale.value = String(DEFAULT_PLACEMENT.scale); batchOffsetX.value = String(DEFAULT_PLACEMENT.offsetX); batchOffsetY.value = String(DEFAULT_PLACEMENT.offsetY); globalPlacement = { ...DEFAULT_PLACEMENT }; for (const row of batchRows) row.placement = undefined; updatePlacementLabels(); markPreviewStale(); renderBatchRows(); };
previewSelected.onclick = () => void run(previewCurrentRow, 'Preview updated. Review the rendered output.');
updatePlacementLabels();
renderTemplateList(); renderDesign();
refreshControls();
