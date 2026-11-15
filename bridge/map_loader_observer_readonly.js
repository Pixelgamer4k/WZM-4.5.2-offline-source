'use strict';
/*
 * WZM 4.5.2 exact-build, passive map-loader/fatal diagnosis.
 * No state changes, native calls, synthetic readiness, or map requests.
 * Run only alongside a separately controlled, user-initiated map test.
 */
const game = Process.getModuleByName('libgame.so');
const base = game.base;
const at = va => base.add(va);
const describe = addr => {
  try {
    if (addr.compare(base) >= 0 && addr.compare(base.add(game.size)) < 0)
      return 'G+' + addr.sub(base).toString();
    const m = Process.findModuleByAddress(addr);
    return m ? m.name + '+' + addr.sub(m.base).toString() : addr.toString();
  } catch (e) { return 'unreadable'; }
};
const shortCString = (p, max = 384) => {
  try { return p.isNull() ? null : p.readCString(max); }
  catch (_) { return '<unreadable>'; }
};
const emit = obj => send({ ...obj, utc: (new Date()).toISOString(), tid: Process.getCurrentThreadId() });

// The ORIGINAL jump table at 0x6324a8 orders states 1,2,3,4 as targets
// 0x3abb730, 0x3abb7b0, 0x3abb754, 0x3abb780 (not address order).
// Critically: low bit is OBSERVED, NEVER CHANGED. The old advance.js
// overwrote x0 to 1 and could therefore force incompatible engine states.
for (const [gate, va] of [
  ['state_1_to_2', 0x3abb730], ['state_2_to_3', 0x3abb7b0],
  ['state_3_to_4', 0x3abb754], ['state_4_to_7', 0x3abb780],
]) {
  Interceptor.attach(at(va), { onEnter() {
    emit({ kind:'natural_gate', gate, value: this.context.x0.toUInt32() & 1,
           origin: describe(this.context.pc) });
  }});
}

Interceptor.attach(at(0x199fa34), { onEnter(args) {
  emit({ kind:'queue_load_level', map:shortCString(args[0],96), flags:args[1].toInt32(),
         caller:describe(this.returnAddress) });
}});
Interceptor.attach(at(0x199fb60), { onEnter(args) {
  emit({ kind:'queue_zone', name:shortCString(args[1],128),
         caller:describe(this.returnAddress) });
}});

// Original routine 0x12a1104 is a generic fatal reporter; 0x12a1300 is
// deliberately generated SIGSEGV. Capture caller/message BEFORE exit.
Interceptor.attach(at(0x12a1104), { onEnter(args) {
  const caller = this.returnAddress;
  let opcode = null;
  try { opcode = caller.sub(4).readU32().toString(16); } catch (_) {}
  emit({ kind:'fatal_enter', severity:args[0].toInt32(),
         format:shortCString(args[1],384), caller:describe(caller),
         candidate_callsite:describe(caller.sub(4)), opcode,
         backtrace:Thread.backtrace(this.context,Backtracer.ACCURATE)
           .slice(0,12).map(describe) });
}});

// The engine logs its fully formatted fatal message as tag 'WZM' priority 6
// before it intentionally writes address 0x13. Avoid capturing other tags.
const logFn = Module.findGlobalExportByName('__android_log_write');
if (logFn !== null) {
  Interceptor.attach(logFn, { onEnter(args) {
    try {
      if (args[0].toInt32() !== 6 || shortCString(args[1],16) !== 'WZM') return;
      emit({kind:'wzm_fatal_log', message:shortCString(args[2],1024),
            caller:describe(this.returnAddress)});
    } catch (_) {}
  }});
} else {
  emit({kind:'warning',message:'__android_log_write export unavailable'});
}

emit({kind:'observer_loaded', module_base:base.toString(), module_size:game.size});
