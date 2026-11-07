import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhotopeaBridge, ORIGIN } from '../src/bridge.ts';

function setup(timeout = 1000) {
 const bus = new EventTarget();
 Object.assign(globalThis, {window:bus});
 const sent: {data:string|ArrayBuffer;origin:string}[]=[];
 const source={postMessage(data:string|ArrayBuffer,origin:string){sent.push({data,origin});}};
 const logs:string[]=[];
 const bridge=new PhotopeaBridge({contentWindow:source} as unknown as HTMLIFrameElement,()=>{},s=>logs.push(s),timeout);
 const emit=(data:unknown,origin=ORIGIN,sender:unknown=source)=>{
  const e=new Event('message');Object.assign(e,{data,origin,source:sender});bus.dispatchEvent(e);
 };
 const token=()=>String(sent.at(-1)!.data).match(/OM:[^" ]+:START/)![0].replace(/START$/,'');
 emit('done');return {bridge,sent,logs,emit,token};
}
test('regression: early done must not discard delayed export and acknowledgment',async()=>{
 const s=setup();let settled=false;
 const job=s.bridge.script("app.activeDocument.saveToOE('psd');",'Fixture',1).then(r=>{settled=true;return r;});
 s.emit(s.token()+'START');s.emit('done');await Promise.resolve();assert.equal(settled,false);
 const buffer=new ArrayBuffer(10);s.emit(buffer);s.emit(s.token()+'OK');
 await Promise.resolve();assert.equal(settled,false);s.emit('done');
 assert.deepEqual((await job).binary,[buffer]);assert.equal(s.sent[0].origin,ORIGIN);s.bridge.dispose();
});
test('wrong origin, sender and stale acknowledgments cannot complete a script',async()=>{
 const s=setup();const job=s.bridge.script('','Probe');let settled=false;void job.then(()=>{settled=true;});
 s.emit(s.token()+'OK','https://evil.example');s.emit(s.token()+'OK',ORIGIN,{});s.emit('OM:stale:OK');s.emit('done');
 await Promise.resolve();assert.equal(settled,false);s.emit(s.token()+'OK');s.emit('done');await job;s.bridge.dispose();
});
test('script error rejects and private message contents are absent from diagnostics',async()=>{
 const s=setup();const job=s.bridge.script('','Probe');s.emit(s.token()+'ERROR:private-design.png');s.emit('done');
 await assert.rejects(job,/Photopea script error/);assert.ok(!s.logs.join('').includes('private-design'));s.bridge.dispose();
});
test('missing acknowledgment times out and poisons transport; late done cannot unlock it',async()=>{
 const s=setup(15);const job=s.bridge.script('','Probe');s.emit('done');
 await assert.rejects(job,/timeout.*ack=false/);s.emit('done');assert.equal(s.bridge.poisoned,true);
 await assert.rejects(s.bridge.script(''),/unavailable/);s.bridge.dispose();
});
test('binary missing after OK does not complete; concurrent sends are rejected',async()=>{
 const s=setup();const job=s.bridge.script('','Export',1);await assert.rejects(s.bridge.send(new ArrayBuffer(1)),/busy/);
 s.emit(s.token()+'OK');s.emit('done');s.emit(new ArrayBuffer(1));s.emit('done');await job;s.bridge.dispose();
});
