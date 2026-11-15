import Java from "frida-java-bridge";
const lastJni = {};
const nameOf = a => { const m = Process.findModuleByAddress(a); return m ? m.name + "+" + a.sub(m.base).toString(16) : a.toString(); };
try {
  const art = Process.getModuleByName("libart.so");
  let n = 0;
  const seenA = new Set();
  for (const e of art.enumerateSymbols().concat(art.enumerateExports())) {
    if (seenA.has(e.address.toString())) continue;
    if (!/JNIILb[01]EE\d+Call(Void|Object|Boolean|Int|Static\w*)Method[VA]?E/.test(e.name)) continue;
    seenA.add(e.address.toString());
    Interceptor.attach(e.address, { onEnter() {
      const ra = this.returnAddress, m = Process.findModuleByAddress(ra);
      if (m && (m.name === "libart.so" || m.name.startsWith("libandroid_runtime") || m.name.startsWith("libc.so"))) return;
      lastJni[Process.getCurrentThreadId()] = { fn: e.name.slice(0, 60), bt: Thread.backtrace(this.context, Backtracer.ACCURATE).slice(0, 16).map(nameOf) };
    }});
    n++;
  }
  send({ s: "jniHooks", n });
} catch (e) { send({ s: "jniHookFailed", e: "" + e }); }
Java.perform(() => {
  const Log = Java.use("android.util.Log"), Exc = Java.use("java.lang.Exception");
  const stack = () => Log.getStackTraceString(Exc.$new()).split("\n").slice(1, 18).join(" | ");
  const watch = (cls, name) => {
    try {
      const C = Java.use(cls);
      for (const ov of C[name].overloads) {
        ov.implementation = function (...args) {
          let nbt = [], th = "";
          try { th = "" + Java.use("java.lang.Thread").currentThread().getName(); } catch (e) { th = "err:" + e; }
          try {
            nbt = Thread.backtrace(undefined, Backtracer.FUZZY).slice(0, 40).map(a => {
              const m = Process.findModuleByAddress(a);
              return m ? m.name + "+" + a.sub(m.base).toString(16) : a.toString();
            });
          } catch (e) { nbt = ["err:" + e]; }
          send({ s: "java", what: cls + "." + name, args: args.map(String).slice(0, 3), stack: stack(), thread: th, tid: Process.getCurrentThreadId(), native: nbt, jni: lastJni[Process.getCurrentThreadId()] });
          return ov.apply(this, args);
        };
      }
      send({ s: "javaHooked", what: cls + "." + name });
    } catch (e) { send({ s: "javaHookFailed", what: cls + "." + name, e: "" + e }); }
  };
  for (const n of ["finish", "finishAndRemoveTask", "finishAffinity", "moveTaskToBack", "onBackPressed"]) watch("android.app.Activity", n);
  for (const n of ["restart", "invokeOnBackPressed", "onPause", "onStop"]) watch("com.activision.game.MainActivity", n);
  watch("android.app.ActivityManager$AppTask", "finishAndRemoveTask");
  watch("java.lang.System", "exit");
  watch("android.os.Process", "killProcess");
});
