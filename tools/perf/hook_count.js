// Count calls/sec at given libgame offsets and libc exports for a few seconds, then detach. Read-only.
const cm = new CModule(`
#include <gum/guminterceptor.h>
#include <stdint.h>
extern volatile uint64_t counts[512];
void onEnter(GumInvocationContext *ic){ uint64_t i=(uint64_t)gum_invocation_context_get_listener_function_data(ic); counts[i]++; }`, { counts: Memory.alloc(512 * 8) });
rpc.exports = {
  count(offs, exps, secs) {
    const b = Process.getModuleByName('libgame.so').base, L = [], names = [];
    const counts = cm.counts;
    offs.forEach((o, i) => { try { L.push(Interceptor.attach(b.add(o), { onEnter: cm.onEnter }, ptr(i))); names.push(o); } catch (e) { names.push(o + '!' + e); } });
    exps.forEach((n, j) => { const a = Module.findGlobalExportByName(n); if (a) try { L.push(Interceptor.attach(a, { onEnter: cm.onEnter }, ptr(offs.length + j))); } catch (e) {} names.push(n); });
    Thread.sleep(secs);
    L.forEach(l => l.detach()); Interceptor.flush();
    const r = {}; names.forEach((n, i) => { const c = counts.add(i * 8).readU64().toNumber(); if (c) r[n] = Math.round(c / secs); }); return r;
  }
};
