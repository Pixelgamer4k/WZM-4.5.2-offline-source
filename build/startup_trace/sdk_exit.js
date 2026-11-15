// Observe the previously identified SDK task-removal path on this build.
'use strict';

let budget = 12;
const offsets = {
  handler: 0x2a12e0,
  taskRemoval: 0x3b9534
};

function describe(pc) {
  const module = Process.findModuleByAddress(pc);
  return module ? module.name + '+' + pc.sub(module.base) : pc.toString();
}

Process.attachModuleObserver({
  onAdded(module) {
    if (module.name !== 'libeevsdgz.so') return;
    const handler = module.base.add(offsets.handler);
    const call = module.base.add(0x3b9acc);
    if (handler.readU32() !== 0xa9be7bfd || call.readU32() !== 0xd63f0100) {
      send({ event: 'sdkFingerprintMismatch', module: module.name });
      return;
    }
    for (const [name, offset] of Object.entries(offsets)) {
      Interceptor.attach(module.base.add(offset), {
        onEnter(args) {
          if (budget-- <= 0) return;
          const event = {
            event: name,
            tid: Process.getCurrentThreadId(),
            epochMs: Date.now(),
            caller: describe(this.returnAddress),
            frames: Thread.backtrace(this.context, Backtracer.ACCURATE).slice(0, 12).map(describe)
          };
          if (name === 'handler') {
            try { event.cursor = describe(args[0].add(0x160).readPointer()); }
            catch (_) { event.cursor = 'unreadable'; }
          }
          send(event);
        }
      });
    }
    send({ event: 'sdkObserverArmed', pid: Process.id, base: module.base.toString() });
  }
});
