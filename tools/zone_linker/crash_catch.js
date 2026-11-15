// Catch native faults in libgame: send pc/lr/registers + backtrace as libgame offsets.
const b = Process.getModuleByName('libgame.so').base;
const off = p => { try { const o = ptr(p).sub(b); return (o.compare(0) >= 0 && o.compare(0x6000000) < 0) ? 'g+0x' + o.toString(16) : ptr(p).toString(); } catch (e) { return '?'; } };
Process.setExceptionHandler(d => {
  const c = d.context; const regs = {};
  for (let i = 0; i <= 28; i++) regs['x' + i] = c['x' + i].toString();
  let bt = []; try { bt = Thread.backtrace(c, Backtracer.FUZZY).slice(0, 20).map(off); } catch (e) {}
  send({ s: 'crash', type: d.type, addr: d.address.toString(), mem: d.memory ? { op: d.memory.operation, addr: d.memory.address.toString() } : null,
         pc: off(c.pc), lr: off(c.lr), sp: c.sp.toString(), fp: c.fp.toString(), regs, bt, tid: Process.getCurrentThreadId() });
  Thread.sleep(1.0);
  return false;
});
send({ s: 'crashCatchReady' });
