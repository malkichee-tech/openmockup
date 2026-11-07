export const ORIGIN = 'https://www.photopea.com';
export type Reply = { strings: string[]; binary: ArrayBuffer[] };
type Pending = {
 resolve: (r: Reply) => void; reject: (e: Error) => void; reply: Reply;
 timer: ReturnType<typeof setTimeout>; id: string; label: string; started: number;
 script: boolean; acknowledged: boolean; error?: string; expectedBinary: number;
};
/** Require a correlated terminal echo, expected binary and subsequent done.
 * Real Photopea can emit intermediate done during asynchronous operations. */
export class PhotopeaBridge {
 ready = false;
 poisoned = false;
 private sequence = 0;
 private session = Math.random().toString(36).slice(2);
 private pending?: Pending;
 private frame: HTMLIFrameElement;
 private report: (s: string) => void;
 private diagnostic: (s: string) => void;
 private timeoutMs: number;
 constructor(frame: HTMLIFrameElement, report: (s: string) => void,
   diagnostic: (s: string) => void = () => {}, timeoutMs = 90000) {
   this.frame=frame;this.report=report;this.diagnostic=diagnostic;this.timeoutMs=timeoutMs;
   window.addEventListener('message', this.receive);
 }
 private trace(message: string) { this.diagnostic(`[${new Date().toISOString()}] ${message}`); }
 private receive = (e: MessageEvent) => {
   if (e.origin !== ORIGIN || e.source !== this.frame.contentWindow) return;
   if (this.poisoned) { this.trace('Ignored late engine message; reset required'); return; }
   if (!this.ready) {
     if (e.data === 'done') { this.ready = true; this.trace('Initialization done'); this.report('Photopea ready'); }
     return;
   }
   const p = this.pending;
   if (!p) { this.trace('Ignored unsolicited engine message'); return; }
   const prefix = `OM:${p.id}:`;
   if (e.data === 'done') {
     this.trace(`${p.label} RX done (ack=${p.acknowledged}, binary=${p.reply.binary.length}/${p.expectedBinary})`);
     if (p.script && !p.acknowledged && !p.error) { this.trace('Intermediate done; waiting for correlated terminal echo'); return; }
     if (!p.error && p.reply.binary.length < p.expectedBinary) return;
     clearTimeout(p.timer); this.pending = undefined;
     this.trace(`${p.label} ${p.error ? 'FAILED' : 'completed'} after ${Date.now()-p.started} ms`);
     if (p.error) p.reject(new Error(p.error)); else p.resolve(p.reply);
   } else if (typeof e.data === 'string') {
     if (e.data === prefix+'OK') { p.acknowledged = true; this.trace(`${p.label} RX matching OK`); }
     else if (e.data.startsWith(prefix+'ERROR:')) {
       p.error = `${p.label}: Photopea script error (details withheld from diagnostics)`;
       this.trace(`${p.label} RX matching ERROR`);
     } else if (e.data === prefix+'START') this.trace(`${p.label} RX matching START`);
     else this.trace(`${p.label} RX unmatched string (${e.data.length} chars; content omitted)`);
     p.reply.strings.push(e.data);
   } else if (e.data instanceof ArrayBuffer) {
     this.trace(`${p.label} RX binary (${e.data.byteLength} bytes)`);p.reply.binary.push(e.data);
   } else this.trace(`${p.label} RX unsupported message type`);
 };
 private request(data: string | ArrayBuffer, id: string, label: string, script: boolean, expectedBinary: number): Promise<Reply> {
   if (!this.ready || this.poisoned || this.pending) return Promise.reject(new Error('Engine unavailable or busy; reset after failure.'));
   return new Promise((resolve, reject) => {
     const timer = setTimeout(() => {
       const p = this.pending!;this.poisoned = true;this.pending = undefined;
       const message = `${label}: timeout (ack=${p.acknowledged}, binary=${p.reply.binary.length}/${expectedBinary}). Reset engine before retrying.`;
       this.trace(message);reject(new Error(message));
     }, this.timeoutMs);
     this.pending = { resolve, reject, timer, id, label, script, expectedBinary, acknowledged: false, started: Date.now(), reply: { strings: [], binary: [] } };
     this.trace(`${label} TX ${script ? 'script' : 'file'} ${id} (payload omitted)`);
     try { this.frame.contentWindow!.postMessage(data, ORIGIN); }
     catch { clearTimeout(timer);this.pending = undefined;this.poisoned = true;reject(new Error(`${label}: postMessage failed; reset engine`)); }
   });
 }
 send(data: ArrayBuffer, label = 'Load PSD') { return this.request(data, `${this.session}-${++this.sequence}`, label, false, 0); }
 script(body: string, label = 'Script', expectedBinary = 0) {
   const id = `${this.session}-${++this.sequence}`, prefix = `OM:${id}:`;
   const wrapped = `app.echoToOE(${JSON.stringify(prefix+'START')});try {\n${body}\n;app.echoToOE(${JSON.stringify(prefix+'OK')});} catch(e) {app.echoToOE(${JSON.stringify(prefix+'ERROR:')}+String(e));}`;
   return this.request(wrapped, id, label, true, expectedBinary);
 }
 dispose() {
   window.removeEventListener('message', this.receive);this.poisoned = true;this.ready = false;
   if (this.pending) { clearTimeout(this.pending.timer);this.pending.reject(new Error('Engine reset'));this.pending = undefined; }
 }
}
