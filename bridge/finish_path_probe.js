'use strict';
// Read-only Java-side witnesses for the activity teardown that follows the
// protected VM53 host path. Identifies WHO calls finish()/exit(): the ANR
// watchdog (ANRError.New -> nativeCDNiANRHandler), a native JNI caller, or
// another Java path. All hooks call the original; nothing is replaced,
// skipped or mutated. Bundled with frida-java-bridge because Frida 17 does
// not expose Java as an implicit global.
import Java from 'frida-java-bridge';

function jstack() {
  try {
    const E = Java.use('java.lang.Exception');
    const Log = Java.use('android.util.Log');
    return String(Log.getStackTraceString(E.$new())).slice(0, 1600);
  } catch (e) { return 'traceFailed:' + String(e); }
}

send({ s: 'finishProbeStarting' });
Java.perform(() => {
  try {
    const MA = Java.use('com.activision.game.MainActivity');
    MA.finish.implementation = function () {
      send({ s: 'javaFinishCalled', tid: Process.getCurrentThreadId(), stack: jstack() });
      return this.finish();
    };
  } catch (e) { send({ s: 'finishHookFailed', error: String(e).slice(0, 300) }); }
  try {
    const RT = Java.use('java.lang.Runtime');
    RT.exit.implementation = function (code) {
      send({ s: 'javaRuntimeExit', code, tid: Process.getCurrentThreadId(), stack: jstack() });
      return this.exit(code);
    };
    RT.halt.implementation = function (code) {
      send({ s: 'javaRuntimeHalt', code, tid: Process.getCurrentThreadId(), stack: jstack() });
      return this.halt(code);
    };
  } catch (e) { send({ s: 'runtimeHookFailed', error: String(e).slice(0, 300) }); }
  try {
    const AE = Java.use('com.activision.anr.ANRError');
    AE.New.overload('long', 'java.lang.String', 'boolean').implementation = function (dur, name, flag) {
      send({ s: 'javaANRErrorNew', duration: dur.toString(), tid: Process.getCurrentThreadId() });
      return this.New(dur, name, flag);
    };
    AE.NewMainOnly.overload('long').implementation = function (dur) {
      send({ s: 'javaANRErrorNewMainOnly', duration: dur.toString(), tid: Process.getCurrentThreadId() });
      return this.NewMainOnly(dur);
    };
  } catch (e) { send({ s: 'anrErrorHookFailed', error: String(e).slice(0, 300) }); }
  try {
    const MA2 = Java.use('com.activision.game.MainActivity');
    MA2.nativeCDNiANRHandler.implementation = function (err) {
      let info = '';
      try { info = String(err).slice(0, 300); } catch (e) { info = 'unreadable'; }
      send({ s: 'javaCdnANRHandler', error: info, tid: Process.getCurrentThreadId(), stack: jstack() });
      return this.nativeCDNiANRHandler(err);
    };
  } catch (e) { send({ s: 'cdnANRHookFailed', error: String(e).slice(0, 300) }); }
  send({ s: 'finishProbeReady', readOnly: true });
});
