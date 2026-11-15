// Observe the original SDK task-removal routine before Java receives the call.
const SDK_NAME = 'libeevsdgz.so';
const HANDLER = 0x2a12e0;
const REMOVE_TASK = 0x3b9534;
const JNI_CALL = 0x3b9acc;

export function armSdkExitObserver(report) {
  const hooks = [];
  let budget = 12;
  let observed = false;

  function describe(address) {
    const module = Process.findModuleByAddress(address);
    return module ? module.name + '+' + address.sub(module.base) : address.toString();
  }

  const observer = Process.attachModuleObserver({
    onAdded(module) {
      if (module.name !== SDK_NAME || observed) return;
      observed = true;
      try {
        if (module.size <= JNI_CALL + 4 ||
            module.base.add(HANDLER).readU32() !== 0xa9be7bfd ||
            module.base.add(JNI_CALL).readU32() !== 0xd63f0100) {
          report('SDK exit observer refused: original opcode check failed');
          return;
        }
        for (const [name, offset] of [['handler', HANDLER], ['removeTask', REMOVE_TASK]]) {
          hooks.push(Interceptor.attach(module.base.add(offset), {
            onEnter(args) {
              if (budget <= 0) return;
              budget--;
              try {
                const event = {
                  name,
                  tid: Process.getCurrentThreadId(),
                  time: Date.now(),
                  caller: describe(this.returnAddress),
                  frames: Thread.backtrace(this.context, Backtracer.ACCURATE)
                    .slice(0, 8).map(describe)
                };
                if (offset === HANDLER) {
                  try { event.cursor = describe(args[0].add(0x160).readPointer()); }
                  catch (_) { event.cursor = 'unreadable'; }
                }
                report('SDK exit ' + JSON.stringify(event));
              } catch (error) { report('SDK exit observation failed: ' + error); }
            }
          }));
        }
        report('SDK exit observer armed');
      } catch (error) {
        for (const hook of hooks.splice(0)) hook.detach();
        report('SDK exit observer unavailable: ' + error);
      }
    }
  });

  setTimeout(() => {
    observer.detach();
    for (const hook of hooks.splice(0)) hook.detach();
  }, 35000);
}
