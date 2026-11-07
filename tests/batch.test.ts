import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createZip, outputFilename, smartObjectCandidates, suggestedPath } from '../src/batch.ts';

test('batch target detection prefers one exact Add Design Here match', () => {
  const layers = [
    { path: '/0', name: 'Lighting', typename: 'ArtLayer', kind: 'NORMAL' },
    { path: '/1/0', name: 'Add Design Here', typename: 'ArtLayer', kind: 'SMARTOBJECT' },
  ];
  assert.deepEqual(smartObjectCandidates(layers), [layers[1]]);
  assert.equal(suggestedPath(layers), '/1/0');
});

test('ambiguous smart objects do not get silently selected', () => {
  const layers = [
    { path: '/0', name: 'Design A', typename: 'ArtLayer', kind: 'SMARTOBJECT' },
    { path: '/1', name: 'Design B', typename: 'ArtLayer', kind: 'SMARTOBJECT' },
  ];
  assert.equal(suggestedPath(layers), undefined);
  assert.equal(smartObjectCandidates(layers).length, 2);
});

test('batch filenames are deterministic and sanitized', () => {
  assert.equal(outputFilename(0, 'My jar (9oz).psd', 'Fall label.png'), 'mockup-01_Fall-label_My-jar-9oz.png');
});

test('ZIP output has the expected signature and file names', async () => {
  const blob = createZip([{ name: 'mockup-01.png', data: new Uint8Array([1, 2, 3]).buffer }]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
  assert.equal(new TextDecoder().decode(bytes).includes('mockup-01.png'), true);
});
