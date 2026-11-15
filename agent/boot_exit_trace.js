/*
 * Spare-phone v7 boot-exit diagnostics. Observational only.
 *
 * The first Xiaomi Android 13 v6 launch loaded the native libraries and
 * Havok, then ActivityManager logged finish-and-remove-task. This tracer
 * records the originating Java stack (if Java-visible), without changing
 * return values, preventing shutdowns, or asserting gameplay readiness.
 * Do not add IPC, network, app-private file writes or heavy render hooks.
 */
import Java from 'frida-java-bridge';

const PKG = 'com.activision.callofduty.warzone';
const TAG = 'WZM_BOOTTRACE';
let queued = false;
let armed = false;

export function armBootExitTrace() {
  if (armed || queued) return;
  queued = true;
  setTimeout(tryArm, 150);
}

function tryArm() {
  queued = false;
  if (armed) return;
  if (typeof Java === 'undefined' || !Java.available) {
    armBootExitTrace();
    return;
  }
  Java.perform(() => {
    if (armed) return;
    try {
      const Log = Java.use('android.util.Log');
      const Exception = Java.use('java.lang.Exception');
      const Activity = Java.use('android.app.Activity');
      const log = (where) => {
        try {
          const trace = String(Log.getStackTraceString(Exception.$new('WZM boot exit')));
          Log.w(TAG, where + '\n' + trace.slice(0, 3500));
        } catch (e) { Log.w(TAG, where + ': stack unavailable: ' + e); }
      };
      const isGameActivity = (self) => {
        try { return String(self.getPackageName()) === PKG; }
        catch (_) { return false; }
      };
      for (const name of ['finish', 'finishAffinity', 'finishAndRemoveTask', 'finishAfterTransition']) {
        if (!Activity[name]) continue;
        const method = Activity[name].overload();
        method.implementation = function () {
          if (isGameActivity(this)) log('Activity.' + name + ' called');
          return method.call(this);
        };
      }
      // Android's task API can also remove a game Activity without calling
      // Activity.finishAndRemoveTask() directly.
      try {
        const AppTask = Java.use('android.app.ActivityManager$AppTask');
        const method = AppTask.finishAndRemoveTask.overload();
        method.implementation = function () {
          log('ActivityManager.AppTask.finishAndRemoveTask called');
          return method.call(this);
        };
      } catch (e) { Log.w(TAG, 'AppTask hook unavailable: ' + e); }
      armed = true;
      Log.i(TAG, 'Diagnostic Activity exit hooks installed; callbacks unchanged');
    } catch (e) {
      try { Java.use('android.util.Log').e(TAG, 'Startup hook failed: ' + e); }
      catch (_) { /* fail closed */ }
    }
  });
}
