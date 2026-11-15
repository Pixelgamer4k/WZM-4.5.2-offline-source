import Java from "frida-java-bridge";
const lastJni = {};
const recentJni = {};
const describe = a => { const r=Process.findRangeByAddress(a); const m=Process.findModuleByAddress(a); return {address:a.toString(),module:m?m.name:null,offset:m?a.sub(m.base).toString():null,range:r?{base:r.base.toString(),size:r.size,protection:r.protection,file:r.file||null}:null}; };
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
      if (!m && !Process.findRangeByAddress(ra)) return; // exclude cloaked instrumentation frames
      if (m && (m.name === "libart.so" || m.name.startsWith("libandroid_runtime") || m.name.startsWith("libc.so"))) return;
      const tid=Process.getCurrentThreadId();
      const event={at:Date.now(),fn:e.name,caller:describe(ra),bt:Thread.backtrace(this.context,Backtracer.ACCURATE).slice(0,8).map(describe)};
      lastJni[tid]=event;const ring=recentJni[tid]||(recentJni[tid]=[]);ring.push(event);if(ring.length>8)ring.shift();
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
          const entryTid=Process.getCurrentThreadId();
          const entryJni=lastJni[entryTid];
          const entryRecent=(recentJni[entryTid]||[]).slice();
          let nbt = [], th = "";
          try { th = "" + Java.use("java.lang.Thread").currentThread().getName(); } catch (e) { th = "err:" + e; }
          try {
            nbt = Thread.backtrace(undefined, Backtracer.FUZZY).slice(0, 40).map(a => {
              const m = Process.findModuleByAddress(a);
              return m ? m.name + "+" + a.sub(m.base).toString(16) : a.toString();
            });
          } catch (e) { nbt = ["err:" + e]; }
          send({ s: "java", what: cls + "." + name, args: args.map(String).slice(0, 3), stack: stack(), thread: th, tid: Process.getCurrentThreadId(), native: nbt, jni: entryJni, recentJni: entryRecent });
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

// Read-only interpreter witness for SDK task removal; bounded to four events.
{
 const sdk=Process.findModuleByName('libeevsdgz.so');let n=0;
 if(sdk)Interceptor.attach(sdk.base.add(0x2a12e0),{onEnter(a){
  if(n++>=4)return;
  try{const pc=a[0].add(0x160).readPointer();
   const r=Process.findRangeByAddress(pc);
   send({s:'sdkCloseVmContext',at:Date.now(),tid:Process.getCurrentThreadId(),cursor:pc.toString(),sdkOffset:pc.sub(sdk.base).toString(),readable:!!r});
  }catch(e){send({s:'sdkCloseVmContextError',error:String(e)});}
 }});
}
