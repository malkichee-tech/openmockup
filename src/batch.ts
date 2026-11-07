export type LayerInfo = { name: string; typename: string; path: string; kind?: string };

export type BatchStatus = 'pending' | 'scanning' | 'ready' | 'processing' | 'success' | 'failed';

export type PlacementSettings = { scale: number; offsetX: number; offsetY: number };

export type BatchRow = {
  file: File;
  layers: LayerInfo[];
  candidates: LayerInfo[];
  selectedPath?: string;
  status: BatchStatus;
  error?: string;
  output?: ArrayBuffer;
  outputName?: string;
  width?: number;
  height?: number;
  placement?: PlacementSettings;
};

export function isPsdName(name: string) { return /\.psd$/i.test(name); }
export function isDesignName(name: string) { return /\.(png|jpe?g)$/i.test(name); }

export function sanitizeStem(name: string) {
  const stem = name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '');
  return stem || 'design';
}

export function outputFilename(index: number, templateName: string, designName: string) {
  return `mockup-${String(index + 1).padStart(2, '0')}_${sanitizeStem(designName)}_${sanitizeStem(templateName)}.png`;
}

function isSmartKind(layer: LayerInfo) { return /smart.?object/i.test(layer.kind ?? ''); }

/** Prefer the conventional name, then an explicit Smart Object kind, then a lone art layer.
 * Ambiguous fallback candidates are surfaced for manual mapping rather than guessed. */
export function smartObjectCandidates(layers: LayerInfo[]) {
  const named = layers.filter(layer => /^add design here$/i.test(layer.name.trim()));
  if (named.length) return named;
  const smart = layers.filter(isSmartKind);
  if (smart.length) return smart;
  return layers.filter(layer => layer.typename === 'ArtLayer');
}

export function suggestedPath(layers: LayerInfo[]) {
  const named = layers.filter(layer => /^add design here$/i.test(layer.name.trim()));
  if (named.length === 1) return named[0].path;
  const smart = layers.filter(isSmartKind);
  if (named.length === 0 && smart.length === 1) return smart[0].path;
  const fallback = layers.filter(layer => layer.typename === 'ArtLayer');
  if (named.length === 0 && smart.length === 0 && fallback.length === 1) return fallback[0].path;
  return undefined;
}

function writeU16(view: DataView, offset: number, value: number) { view.setUint16(offset, value, true); }
function writeU32(view: DataView, offset: number, value: number) { view.setUint32(offset, value >>> 0, true); }

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (~c) >>> 0;
}

/** Create a standards-compliant uncompressed ZIP without adding a runtime dependency. */
export function createZip(files: { name: string; data: ArrayBuffer }[]) {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = new Uint8Array(file.data);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    writeU32(lv, 0, 0x04034b50); writeU16(lv, 4, 20); writeU16(lv, 6, 0); writeU16(lv, 8, 0);
    writeU16(lv, 10, 0); writeU16(lv, 12, 0); writeU32(lv, 14, crc); writeU32(lv, 18, data.length); writeU32(lv, 22, data.length);
    writeU16(lv, 26, name.length); writeU16(lv, 28, 0); local.set(name, 30); local.set(data, 30 + name.length);
    locals.push(local);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    writeU32(cv, 0, 0x02014b50); writeU16(cv, 4, 20); writeU16(cv, 6, 20); writeU16(cv, 8, 0); writeU16(cv, 10, 0);
    writeU16(cv, 12, 0); writeU16(cv, 14, 0); writeU32(cv, 16, crc); writeU32(cv, 20, data.length); writeU32(cv, 24, data.length);
    writeU16(cv, 28, name.length); writeU16(cv, 30, 0); writeU16(cv, 32, 0); writeU16(cv, 34, 0); writeU16(cv, 36, 0); writeU32(cv, 38, 0); writeU32(cv, 42, offset);
    central.set(name, 46); centrals.push(central); offset += local.length;
  }
  const centralSize = centrals.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22); const ev = new DataView(end.buffer);
  writeU32(ev, 0, 0x06054b50); writeU16(ev, 4, 0); writeU16(ev, 6, 0); writeU16(ev, 8, files.length); writeU16(ev, 10, files.length);
  writeU32(ev, 12, centralSize); writeU32(ev, 16, offset); writeU16(ev, 20, 0);
  const parts = [...locals, ...centrals, end];
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let cursor = 0; for (const part of parts) { bytes.set(part, cursor); cursor += part.byteLength; }
  return new Blob([bytes.buffer], { type: 'application/zip' });
}
