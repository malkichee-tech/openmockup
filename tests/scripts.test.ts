import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSmart, place } from '../src/scripts.ts';
import { fitArtwork, placementScript } from '../src/scripts.ts';
import { runInNewContext } from 'node:vm';
test('layer names remain string literals, including malicious punctuation', () => {
 const name = '";app.activeDocument.close();// العربية';
 assert.ok(openSmart(name).includes('l.name==='+JSON.stringify(name)));
 assert.ok(openSmart(name).includes('hits.length!==1'));
});
test('artwork URI is encoded as a string literal', () => {
 const uri = 'data:image/png;base64,abc"';
 assert.equal(place(uri),`app.open(${JSON.stringify(uri)},null,true);`);
});
test('placement reads UnitValue.value rather than coercing bounds, preserving aspect ratio',()=>{
 let bounds=[10,20,490,200];const calls:unknown[]=[];
 const layer={visible:false,get bounds(){return bounds.map(value=>({value}));},resize(x:number,y:number){calls.push([x,y]);bounds=[10,20,250,110];},translate(x:number,y:number){calls.push([x,y]);}};
 runInNewContext(fitArtwork,{app:{activeDocument:{width:240,height:180,activeLayer:layer}},AnchorPosition:{MIDDLECENTER:4}});
 assert.deepEqual(calls,[[50,50],[-10,25]]);assert.equal(layer.visible,true);
});
test('invalid artwork bounds fail before any transform',()=>{
 const layer={bounds:[0,0,NaN,180].map(value=>({value})),resize(){assert.fail('must not resize invalid bounds');}};
 assert.throws(()=>runInNewContext(fitArtwork,{app:{activeDocument:{width:240,height:180,activeLayer:layer}}}),/Invalid artwork bounds/);
});
test('placement settings apply relative scale and canvas offsets',()=>{
 let bounds=[0,0,240,180];const calls:unknown[]=[];
 const layer={visible:false,get bounds(){return bounds.map(value=>({value}));},resize(x:number,y:number){calls.push([x,y]);bounds=[0,0,120,90];},translate(x:number,y:number){calls.push([x,y]);}};
 runInNewContext(placementScript('fit',90,10,-5),{app:{activeDocument:{width:240,height:180,activeLayer:layer}},AnchorPosition:{MIDDLECENTER:4}});
 assert.deepEqual(calls,[[90,90],[84,36]]);assert.equal(layer.visible,true);
});
