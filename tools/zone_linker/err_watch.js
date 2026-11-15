const b = Process.getModuleByName('libgame.so').base;
const off = p => { try { const o = p.sub(b); return o.compare(0x6000000) < 0 ? 'g+0x' + o.toString(16) : p.toString(); } catch (e) { return '?'; } };
function rd(p) { try { return p.readCString(200); } catch (e) { return null; } }
for (const [name, a] of [['teardown', 0x3a5462c], ['devError', 0x12a1104], ['err2', 0x3a55cc4]]) {
  Interceptor.attach(b.add(a), { onEnter(x) { send({ s: name, x0: x[0].toString(), x1: x[1].toString(), s1: rd(x[1]), s0: rd(x[0]), x2: x[2].toString(), tid: Process.getCurrentThreadId(),
    bt: Thread.backtrace(this.context, Backtracer.ACCURATE).slice(0, 14).map(off) }); } });
}
send({ s: 'errWatchReady' });
