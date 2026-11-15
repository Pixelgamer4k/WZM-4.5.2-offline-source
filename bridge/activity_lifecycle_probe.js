'use strict';
// Read-only Java/Android lifecycle tracing. No hooks change return values or
// arguments. Bundled with frida-java-bridge because Frida 17 does not expose
// Java as an implicit global.
import Java from 'frida-java-bridge';

const interesting = /com\.activision\.callofduty\.warzone|com\.activision\.game\.MainActivity/;
const seen = Object.create(null);
function stack() {
  try {
    const E = Java.use('java.lang.Exception');
    const Log = Java.use('android.util.Log');
    return String(Log.getStackTraceString(E.$new())).split('\n').slice(1, 17);
  } catch (e) { return ['stack unavailable: ' + String(e)]; }
}
function observe(cls, method, filter) {
  try {
    const C = Java.use(cls);
    if (!C[method]) { send({s: 'javaHookMissing', cls, method}); return 0; }
    let n = 0;
    for (const overload of C[method].overloads) {
      overload.implementation = function () {
        let args = [];
        try { args = Array.prototype.slice.call(arguments).map(a => String(a).slice(0, 120)); }
        catch (e) {}
        let who = '';
        try { who = String(this.getClass().getName()); } catch (e) {}
        const event = {s: 'javaLifecycle', cls, method, who, args, tid: Process.getCurrentThreadId()};
        if (!filter || interesting.test(who)) {
          const key = cls + '.' + method;
          seen[key] = (seen[key] || 0) + 1;
          if (seen[key] <= 12) { event.stack = stack(); send(event); }
        }
        return overload.apply(this, arguments);
      };
      n++;
    }
    send({s: 'javaHookInstalled', cls, method, overloads: n});
    return n;
  } catch (e) { send({s: 'javaHookError', cls, method, error: String(e)}); return 0; }
}
send({s: 'javaProbeStarting'});
Java.perform(() => {
  let count = 0;
  count += observe('com.activision.game.MainActivity', 'finish', true);
  count += observe('android.app.Activity', 'finish', true);
  count += observe('android.app.Activity', 'finishAndRemoveTask', true);
  count += observe('android.app.Activity', 'finishAffinity', true);
  count += observe('android.app.ActivityManager', 'removeTask', false);
  count += observe('java.lang.System', 'exit', false);
  count += observe('java.lang.Runtime', 'exit', false);
  count += observe('java.lang.Runtime', 'halt', false);
  count += observe('android.os.Process', 'killProcess', false);
  send({s: 'javaProbeReady', hooks: count});
});
