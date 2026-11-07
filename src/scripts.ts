// Photopea's Photoshop-like DOM must be tested in the real engine, not assumed.
export const closeAll = 'while(app.documents.length) app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);';
export function openSmart(name: string) {
  return `var parent=app.activeDocument; var hits=[];
function walk(ls){for(var i=0;i<ls.length;i++){var l=ls[i];if(l.name===${JSON.stringify(name)})hits.push(l);if(l.typename==='LayerSet')walk(l.layers);}}
walk(parent.layers);if(hits.length!==1)throw new Error('Expected exactly one matching layer, found '+hits.length);
parent.activeLayer=hits[0];executeAction(stringIDToTypeID('placedLayerEditContents'));
if(app.activeDocument===parent)throw new Error('Smart Object did not open');
var child=app.activeDocument;for(var i=0;i<child.layers.length;i++)child.layers[i].visible=false;`;
}
export function openSmartAt(path: string) {
  const indexes = path.split('/').filter(Boolean).map(value => Number(value));
  if (!indexes.length || indexes.some(value => !Number.isInteger(value) || value < 0)) throw new Error('Invalid Smart Object path');
  return `var parent=app.activeDocument;var target=parent.layers;
${indexes.map((index, i) => `target=target[${index}];if(!target)throw new Error('Smart Object path not found');${i < indexes.length - 1 ? "if(target.typename!=='LayerSet')throw new Error('Smart Object path is not a layer group');target=target.layers;" : ''}`).join('')}
parent.activeLayer=target;executeAction(stringIDToTypeID('placedLayerEditContents'));
if(app.activeDocument===parent)throw new Error('Selected layer did not open as a Smart Object');
var child=app.activeDocument;for(var i=0;i<child.layers.length;i++)child.layers[i].visible=false;`;
}
export const inspectLayers = `var rows=[];function walk(ls,path){for(var i=0;i<ls.length;i++){var l=ls[i];var kind='';try{kind=String(l.kind);}catch(e){}rows.push({path:path+'/'+i,name:l.name,typename:l.typename,kind:kind});if(l.typename==='LayerSet')walk(l.layers,path+'/'+i);}}walk(app.activeDocument.layers,'');app.echoToOE('OM_META:'+JSON.stringify(rows));`;
export function place(dataUri: string) { return `app.open(${JSON.stringify(dataUri)},null,true);`; }
export function placementScript(mode: 'fit' | 'fill', designScale = 100, offsetX = 0, offsetY = 0) {
  if (!Number.isFinite(designScale) || designScale <= 0) throw new Error('Invalid design scale');
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) throw new Error('Invalid design offset');
  const scale = mode === 'fill' ? 'Math.max(dw/w,dh/h)' : 'Math.min(dw/w,dh/h)';
  return `var d=app.activeDocument;var l=d.activeLayer;l.visible=true;
var b=l.bounds;var w=b[2].value-b[0].value;var h=b[3].value-b[1].value;
if(!isFinite(w)||!isFinite(h)||w<=0||h<=0)throw new Error('Invalid artwork bounds');
var dw=Number(d.width),dh=Number(d.height);
if(!isFinite(dw)||!isFinite(dh)||dw<=0||dh<=0)throw new Error('Invalid document dimensions');
var scale=100*${scale}*${designScale / 100};l.resize(scale,scale,AnchorPosition.MIDDLECENTER);
b=l.bounds;var bw=b[2].value-b[0].value;var bh=b[3].value-b[1].value;
var dx=(dw-bw)/2-b[0].value+dw*${offsetX / 100};
var dy=(dh-bh)/2-b[1].value+dh*${offsetY / 100};l.translate(dx,dy);`;
}
export const fitArtwork = placementScript('fit');
export const fillArtwork = placementScript('fill');
/* Keep the original fixture script small and deterministic for the feasibility test. */
export const fixture = `app.documents.add(480,360,72,'OpenMockup original fixture');var d=app.activeDocument;var c=new SolidColor();c.rgb.hexValue='E9E2D5';d.selection.selectAll();d.selection.fill(c);d.selection.deselect();var l=d.artLayers.add();l.name='ADD DESIGN HERE';d.selection.select([[120,90],[360,90],[360,270],[120,270]]);c.rgb.hexValue='444444';d.selection.fill(c);d.selection.deselect();executeAction(stringIDToTypeID('newPlacedLayer'));d.activeLayer.name='ADD DESIGN HERE';d.activeLayer.rotate(8);d.saveToOE('psd');`;
