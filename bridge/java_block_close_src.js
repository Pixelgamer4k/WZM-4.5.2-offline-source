// Opt-in, memory-only: make ActivityManager$AppTask.finishAndRemoveTask a logged no-op, and log other exits.
import Java from "frida-java-bridge";
Java.perform(() => {
  const th = () => { try { return "" + Java.use("java.lang.Thread").currentThread().getName(); } catch (e) { return "?"; } };
  try {
    const T = Java.use("android.app.ActivityManager$AppTask");
    T.finishAndRemoveTask.implementation = function () { send({ s: "closeBlocked", what: "AppTask.finishAndRemoveTask", thread: th() }); };
    send({ s: "blockInstalled" });
  } catch (e) { send({ s: "blockFailed", e: "" + e }); }
  const watch = (cls, name) => { try { const C = Java.use(cls); for (const ov of C[name].overloads) { ov.implementation = function (...a) { send({ s: "java", what: cls + "." + name, thread: th() }); return ov.apply(this, a); }; } } catch (e) {} };
  for (const n of ["finish", "finishAndRemoveTask", "finishAffinity", "moveTaskToBack"]) watch("android.app.Activity", n);
  for (const n of ["onPause", "onStop", "onDestroy"]) watch("com.activision.game.MainActivity", n);
  watch("java.lang.System", "exit"); watch("android.os.Process", "killProcess");
});
