/*
 * WZM 4.5.2 offline: in-APK controller (Frida Gadget 17, script mode).
 *
 * Boot: native_boot.js runs the original skip_online_fences.lua on the LUI
 * frame until the real main menu is up (unchanged from r6).
 * After that, mac_port/pipeline.js replays the proven Mac/root "menu" flow
 * in-process: profile, armed host, unlock everything, keeper, and matches
 * started from the menu with real bots.
 *
 * UI: a floating ball and a panel attached to the game Activity's decorView.
 * No overlay permission, no second app, no computer.
 */
import Java from 'frida-java-bridge';
import {readBoundedUtf8} from './bounded_utf8.js';
import {FENCE_LUA_SOURCE, FENCE_SOURCE_BYTE_LENGTH} from './fence_embedded.js';
import {createNativeBootSupervisor, MIN_NATIVE_DELAY_MS} from './native_boot.js';
import {GAME_FINGERPRINT} from './unlock/fingerprint.js';
import {createMacSession, MAPS, MODES, DIFFICULTIES} from './mac_port/pipeline.js';
import {GFX_SPEC, GFX_DEFAULTS, sanitizeGfx, createGfxLive} from './mac_port/gfx_live.js';
import {PROBE_SITES} from './mac_port/mac_sources.js';
import {attachAnywhere, relayFor, relayPossible, fragile} from './mac_port/nearhook.js';
import {addExceptionObserver} from './mac_port/stage.js';
import {createThirdPerson} from './mac_port/camera3p.js';

const VERSION = 'r19';
const PKG = 'com.activision.callofduty.warzone';
const GAME_ACTIVITY = 'com.activision.game.MainActivity';
const FILES_DIR = '/data/user/0/' + PKG + '/files';
const UI_AFTER_MS = 20000;
const MAINMENU_PROBE = "local W=rawget(_G,'_WZM'); local L=rawget(_G,'LUI'); if W and W.play == true and L and L.primaryRoot then return 'MAINMENU_READY' end return 'WAIT_MAINMENU'";
const MAINMENU_RECOVERY_PROBE = `local L=rawget(_G,'LUI')
local root=L and L.primaryRoot
if not root then return 'WAIT_MAINMENU' end
local remaining=512
local function hasPlay(e,d)
  if not e or d>12 or remaining<=0 then return false end
  remaining=remaining-1
  if tostring(e.id)=='xhash: #x0d6362796dd5f31d1' then return true end
  local c=e:getFirstChild()
  while c and remaining>0 do
    remaining=remaining-1
    if hasPlay(c,d+1) then return true end
    c=c:getNextSibling()
  end
  return false
end
local ok,found=pcall(hasPlay,root,0)
return ok and found and 'MAINMENU_PLAY_PRESENT' or 'WAIT_MAINMENU'`;

// ---------------------------------------------------------------- logging
let androidLog = null;
try {
  const w = Module.findGlobalExportByName('__android_log_write');
  if (w) androidLog = new NativeFunction(w, 'int', ['int', 'pointer', 'pointer']);
} catch (_) {}
const LOG_TAG = Memory.allocUtf8String('WZM');
let logFile = null;
function openLog() {
  if (logFile !== null) return logFile;
  try {
    logFile = new File(FILES_DIR + '/wzm_offline.log', 'a');
  } catch (_) { logFile = false; }
  return logFile;
}
function log(message) {
  const text = String(message).slice(0, 900);
  try { if (androidLog) androidLog(4, LOG_TAG, Memory.allocUtf8String(text)); } catch (_) {}
  try {
    const f = openLog();
    if (f) { f.write(new Date().toISOString().slice(11, 23) + ' ' + text + '\n'); f.flush(); }
  } catch (_) {}
}
log('==== WZM offline ' + VERSION + ' agent loaded, pid ' + Process.id);

const storage = {
  read(name) {
    try { return File.readAllText(FILES_DIR + '/' + name); } catch (_) { return null; }
  },
  write(name, text) {
    // new File(…, 'w') truncates; File.writeAllText leaves the old tail when the new text is shorter
    // (that corrupted wzm_pending_match.json, so RESTART & PLAY could come back to the menu).
    try { const f = new File(FILES_DIR + '/' + name, 'w'); f.write(text); f.flush(); f.close(); return true; }
    catch (e) { log('storage write ' + name + ': ' + e); return false; }
  }
};

// Native crash witness: logs the faulting PC, then lets the signal continue
// (ART null checks and the original crash handlers still run). Armed only
// after the menu is up: no exception handler during the fragile boot window.
let crashWitnessArmed = false;
function armCrashWitness() {
  if (crashWitnessArmed) return;
  crashWitnessArmed = true;
  let reported = 0;
  addExceptionObserver(d => {
  try {
    // ART uses SIGSEGV for implicit null checks in JIT/boot code: ignore those.
    const pcMod = Process.findModuleByAddress(d.context.pc);
    if (reported >= 30 || d.context.pc.compare(ptr('0x100000000')) < 0 ||
        (pcMod !== null && /^(libart|boot)/.test(pcMod.name))) return false;
    reported++;
    try {
      const sp = d.context.sp, fa = d.memory ? d.memory.address : null;
      const r = x => { const g = x ? Process.findRangeByAddress(x) : null;
        return g ? g.base + '+' + g.size.toString(16) + ' ' + g.protection + ' ' + (g.file ? g.file.path : '') : 'unmapped'; };
      log('NATIVE detail sp=' + sp + ' sprange=' + r(sp) + ' faultrange=' + r(fa) + ' pcrange=' + r(d.context.pc) +
        ' x0=' + d.context.x0 + ' x1=' + d.context.x1 + ' fp=' + d.context.fp);
    } catch (e) { log('NATIVE detail err ' + e); }
    const rel = x => { const m = Process.findModuleByAddress(x); return m ? m.name + '+' + x.sub(m.base).toString(16) : String(x); };
    log('NATIVE ' + d.type + ' pc=' + rel(d.context.pc) + ' lr=' + rel(d.context.lr) +
      ' addr=' + (d.memory ? d.memory.address : '?') + ' tid=' + Process.getCurrentThreadId() +
      ' bt=' + Thread.backtrace(d.context, Backtracer.FUZZY).slice(0, 8).map(rel).join(' '));
  } catch (_) {}
  return false;
  });
}

// ---------------------------------------------------------------- state
const prefs = (() => {
  try { return JSON.parse(storage.read('wzm_prefs.json') || '{}'); } catch (_) { return {}; }
})();
const state = {
  bootStartedAt: 0, bootTimer: null, nativeBootTimer: null, nativeSupervisor: null,
  bootStage: 'WAIT_15S', nativeReady: false, everReady: false, menuContinuity: false,
  lifecycle: null, app: null, uiClasses: null, uiClassReady: false, javaRegistering: false,
  lastBootstrapAttemptAt: 0, pendingActivity: null,
  activity: null, panel: null, ball: null, ui: {}, drag: null, ballDrag: null,
  mapIndex: clampIndex(prefs.mapIndex, MAPS.length, 0),
  modeIndex: clampIndex(prefs.modeIndex, MODES.length, 0),
  difficultyIndex: clampIndex(prefs.difficultyIndex, DIFFICULTIES.length, 3),
  enemies: clampInt(prefs.enemies, 1, 6, 5),
  classIndex: clampInt(prefs.classIndex, 0, 4, 0),
  friends: clampInt(prefs.friends, 0, 6, 0),
  thirdPerson: prefs.thirdPerson === true,
  gfx: sanitizeGfx(prefs.gfx),
  tab: 'match', subTab: 'display', selMatch: null, selGfx: null, lastMap: null,
  statusText: 'Waiting for the main menu…',
  disposing: false
};
function clampIndex(v, n, d) { return Number.isInteger(v) && v >= 0 && v < n ? v : d; }
function clampInt(v, lo, hi, d) { return Number.isInteger(v) && v >= lo && v <= hi ? v : d; }
// ---------------------------------------------------------------- log export
// Opens the Android share sheet with the logs as text, so they can be sent from any
// phone without a computer. Nothing is saved on the phone.
function readTail(path, maxBytes) {
  try {
    const t = File.readAllText(path);
    return t.length > maxBytes ? '…(earlier lines cut)…\n' + t.slice(t.length - maxBytes) : t;
  } catch (e) { return '(could not read ' + path + ': ' + e + ')'; }
}

function exportLogs() {
  if (!Java.available) { setStatus('Export failed: Java not ready'); return; }
  Java.perform(() => {
    try {
      const Build = Java.use('android.os.Build');
      const VERSION_ = Java.use('android.os.Build$VERSION');
      const model = String(Build.MANUFACTURER.value) + ' ' + String(Build.MODEL.value);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const name = 'WZM_logs_' + String(Build.MODEL.value).replace(/[^A-Za-z0-9]+/g, '_') + '_' + stamp + '.txt';
      // this process's own logcat (apps may read their own log lines)
      let logcat = '';
      try {
        const Runtime = Java.use('java.lang.Runtime');
        const String_ = Java.use('java.lang.String');
        const cmd = Java.array('java.lang.String', ['logcat', '-d', '-v', 'time', '-t', '4000', '--pid', String(Process.id)]);
        const proc = Runtime.getRuntime().exec(cmd);
        const reader = Java.use('java.io.BufferedReader').$new(Java.use('java.io.InputStreamReader').$new(proc.getInputStream()));
        const sb = Java.use('java.lang.StringBuilder').$new();
        let line, n = 0;
        while ((line = reader.readLine()) !== null && n < 4000) { sb.append(line); sb.append(String_.$new('\n')); n++; }
        reader.close();
        logcat = String(sb.toString());
      } catch (e) { logcat = '(logcat unavailable: ' + e + ')'; }
      let snap = {};
      try { snap = session.snapshot(); } catch (_) {}
      const header = [
        'WZM offline log export', 'agent ' + VERSION + ', pid ' + Process.id + ', ' + new Date().toISOString(),
        'device ' + model + ' (' + String(Build.DEVICE.value) + '), Android ' + String(VERSION_.RELEASE.value) +
          ' (API ' + VERSION_.SDK_INT.value + '), ABI ' + String(Build.SUPPORTED_ABIS.value[0]),
        'boot stage ' + state.bootStage + ', session phase ' + session.phase + ', graphics ' +
          (gfxLive.started ? gfxLive.status() : 'not started'),
        'session ' + JSON.stringify(snap).slice(0, 600),
        'prefs ' + JSON.stringify({mapIndex: state.mapIndex, modeIndex: state.modeIndex, enemies: state.enemies,
          friends: state.friends, classIndex: state.classIndex, gfx: state.gfx}),
      ].join('\n');
      const body = header + '\n\n===== agent log (files/wzm_offline.log) =====\n' +
        readTail(FILES_DIR + '/wzm_offline.log', 600000) +
        '\n\n===== game process logcat =====\n' + logcat + '\n';
      // Share as text: nothing is saved on the phone. Android's sharing limit is ~1 MB per
      // transfer, so the newest ~150 KB is sent (header always included).
      const LIMIT = 150000;
      const text = body.length > LIMIT ? header + '\n\n…(older lines cut)…\n' + body.slice(body.length - (LIMIT - header.length - 40)) : body;
      const app = Java.use('android.app.ActivityThread').currentApplication();
      log('logs ready to share (' + text.length + ' chars)');
      Java.scheduleOnMainThread(() => {
        try {
          const Intent = Java.use('android.content.Intent');
          const send = Intent.$new('android.intent.action.SEND');
          send.setType('text/plain');
          send.putExtra.overload('java.lang.String', 'java.lang.String').call(send, 'android.intent.extra.SUBJECT', jstr(name));
          send.putExtra.overload('java.lang.String', 'java.lang.String').call(send, 'android.intent.extra.TEXT', jstr(text));
          const chooser = Intent.createChooser(send, jstr('Send WZM logs'));
          const ctx = state.activity !== null ? state.activity : app;
          if (state.activity === null) chooser.addFlags(0x10000000);
          ctx.startActivity(chooser);
          setStatus('Logs ready: pick an app to send them (WhatsApp, Telegram, email…).');
        } catch (e) { log('share sheet: ' + e); setStatus('Share failed: ' + String(e).slice(0, 120)); }
      });
    } catch (e) {
      log('export failed: ' + e);
      setStatus('Export failed: ' + String(e).slice(0, 120));
    }
  });
}

function savePrefs() {
  storage.write('wzm_prefs.json', JSON.stringify({mapIndex: state.mapIndex, modeIndex: state.modeIndex,
    difficultyIndex: state.difficultyIndex, classIndex: state.classIndex, enemies: state.enemies, friends: state.friends,
    thirdPerson: state.thirdPerson, gfx: state.gfx}));
}

// Device check: can Frida place a hook at every site the Mac scripts use?
// (Some phones have no free memory near libgame for short jumps.)
function logNearGaps() {
  const N = p => Number(p.toString());
  const m = Process.getModuleByName('libgame.so');
  const lo = N(m.base), hi = lo + m.size;
  const rs = Process.enumerateRanges('---').map(r => ({a: N(r.base), b: N(r.base) + r.size, prot: r.protection,
    file: r.file ? r.file.path.split('/').pop() : ''})).sort((x, y) => x.a - y.a);
  const MB = 1024 * 1024, gaps = [];
  for (let i = 1; i < rs.length; i++) if (rs[i].a > rs[i - 1].b) gaps.push({a: rs[i - 1].b, b: rs[i].a});
  const dist = g => g.b <= lo ? lo - g.b : (g.a >= hi ? g.a - hi : 0);
  const near = gaps.filter(g => dist(g) < 512 * MB);
  log('near gaps (libgame 0x' + lo.toString(16) + ' ' + (m.size / MB).toFixed(0) + 'MB): ' + near.map(g =>
    (g.b <= lo ? 'below ' : 'above ') + (dist(g) / MB).toFixed(1) + 'MB size ' + ((g.b - g.a) / MB).toFixed(2) + 'MB').join('; '));
  const around = rs.filter(r => (r.b <= lo && lo - r.b < 160 * MB) || (r.a >= hi && r.a - hi < 160 * MB));
  log('maps near libgame: ' + around.map(r => (r.a < lo ? '-' + ((lo - r.a) / MB).toFixed(1) : '+' + ((r.a - hi) / MB).toFixed(1)) +
    'MB ' + ((r.b - r.a) / MB).toFixed(2) + 'MB ' + r.prot + ' ' + r.file).join(' | ').slice(0, 2500));
}

function probeHookSites() {
  const base = Process.getModuleByName('libgame.so').base;
  const bad = [], relayed = [];
  for (const off of PROBE_SITES) {
    const site = base.add(off);
    try {
      if (false && fragile(site)) {
        // Always relayed when hooked; only check that relay space is in reach (no code change here).
        if (relayPossible(site)) relayed.push('0x' + off.toString(16));
        else bad.push('0x' + off.toString(16) + ' (no relay space)');
        continue;
      }
      const l = Interceptor.attach(site, {onEnter() {}});
      l.detach();
    } catch (e) { bad.push('0x' + off.toString(16) + ' (' + String(e).slice(0, 60) + ')'); }
  }
  try { Interceptor.flush(); } catch (_) {}
  try { logNearGaps(); } catch (e) { log('gap scan: ' + e); }
  log('hook probe: ' + (PROBE_SITES.length - bad.length) + '/' + PROBE_SITES.length + ' ok' +
    (relayed.length ? '; ' + relayed.length + ' via relay' : '') + (bad.length ? '; cannot hook ' + bad.join(',') : ''));
}

const gfxLive = createGfxLive({log: m => log('[gfx] ' + m)});
const camera = createThirdPerson({log: m => log('[cam] ' + m)});
// Verdansk needs the game's own textures (stock streaming pool; blocky trees otherwise).
function effectiveGfx(map) {
  const g = {...state.gfx};
  if (map === 'mp_mgl_wz2_sierra') g.tex = 'Game default';
  return g;
}

const session = createMacSession({
  log: m => log('[session] ' + m),
  status: text => setStatus(text),
  event: (stage, p) => {
    const s = p && (p.s || p.k || p.kind);
    if (['state', 'luaCacheServed', 'gfxFixed640Stats'].includes(s)) return;
    log('[' + stage + '] ' + JSON.stringify(p).slice(0, 400));
  },
  storage,
  relaunch: relaunchGame,
  beforeMatch(o) {
    state.lastMap = o.map;
    // With the menu 3D room on screen, changing render settings now crashes the renderer (0x4d597a0):
    // apply them once the match world has replaced the room.
    const applyGfx = () => { try { gfxLive.start(effectiveGfx(o.map)); } catch (e) { log('gfx start: ' + e); } };
    if (session.frontendStarted && !o.fromRestart) setTimeout(applyGfx, 25000); else applyGfx();
    camera.set(state.thirdPerson);
  }
});

// Dev console (root only: files/ is private): run files/wzm_lua_in.lua in the LUI state,
// result -> files/wzm_lua_out.txt. Used to explore the game's own menus.
let devBusy = false, devLast = null;
setInterval(() => {
  if (devBusy) return;
  const src = storage.read('wzm_lua_in.lua');
  if (src === null || src === '' || src === devLast || src.startsWith('-- done')) return;
  devLast = src;
  devBusy = true;
  session.runLua('dev', src, 30000).then(out => {
    storage.write('wzm_lua_out.txt', 'load=' + out.load + ' pcall=' + out.pcall + '\n' +
      String(out.result ?? out.exception ?? ''));
  }, e => storage.write('wzm_lua_out.txt', 'ERR ' + e)).finally(() => { devBusy = false; });
}, 1000);

// Dev JS console (root only): files/wzm_js_boot.js runs once at agent load (for early hooks);
// files/wzm_js_in.js runs when it changes. Output and dlog() lines go to files/wzm_js_out.txt.
const devJs = {last: null, out: []};
globalThis.dlog = s => { devJs.out.push(new Date().toISOString().slice(11, 23) + ' ' + s);
  if (devJs.out.length > 400) devJs.out.shift(); };
globalThis.dflush = () => storage.write('wzm_js_out.txt', devJs.out.join('\n'));
function devRun(name, src) {
  try { const r = (0, eval)(src); dlog(name + ' -> ' + String(r).slice(0, 2000)); } catch (e) { dlog(name + ' ERR ' + e + '\n' + (e.stack || '')); }
  dflush();
}
{ const boot = storage.read('wzm_js_boot.js'); if (boot) devRun('boot', boot); }
setInterval(() => {
  const src = storage.read('wzm_js_in.js');
  if (src && src !== devJs.last && !src.startsWith('// done')) { devJs.last = src; devRun('in', src); }
  else if (devJs.out.length) dflush();
}, 1000);

// Restart the game process into a fresh MainActivity (same as tapping the icon).
function relaunchGame() {
  log('relaunching game process');
  if (!Java.available) return;
  Java.perform(() => Java.scheduleOnMainThread(() => {
    try {
      const app = Java.use('android.app.ActivityThread').currentApplication();
      const Intent = Java.use('android.content.Intent');
      const launch = app.getPackageManager().getLaunchIntentForPackage(PKG);
      const restart = Intent.makeRestartActivityTask(launch.getComponent());
      const ctx = state.activity !== null ? state.activity : app;
      if (state.activity === null) restart.addFlags(0x10000000);
      ctx.startActivity(restart);
    } catch (e) { log('relaunch start: ' + e); }
    Java.use('java.lang.Runtime').getRuntime().exit(0);
  }));
}

// ---------------------------------------------------------------- UI helpers
function jstr(v) { return Java.use('java.lang.String').$new(String(v)); }
function color(hex) { return Java.use('android.graphics.Color').parseColor(hex); }
function dp(v) {
  const a = state.activity;
  return Math.round(Number(a.getResources().getDisplayMetrics().density.value) * v);
}
function rounded(fill, radius, stroke, strokeWidth) {
  const g = Java.use('android.graphics.drawable.GradientDrawable').$new();
  g.setColor(color(fill));
  g.setCornerRadius(dp(radius));
  if (stroke) g.setStroke(dp(strokeWidth || 1), color(stroke));
  return g;
}
function gradient(colors, radius, oval) {
  const GD = Java.use('android.graphics.drawable.GradientDrawable');
  const Orientation = Java.use('android.graphics.drawable.GradientDrawable$Orientation');
  const g = GD.$new(Orientation.TL_BR.value, Java.array('int', colors.map(color)));
  if (oval) g.setShape(1); else g.setCornerRadius(dp(radius));
  return g;
}
function ripple(content) {
  const RD = Java.use('android.graphics.drawable.RippleDrawable');
  const CSL = Java.use('android.content.res.ColorStateList');
  return RD.$new(CSL.valueOf(color('#40FFFFFF')), content, null);
}
function text(str, sp, hex, bold) {
  const tv = Java.use('android.widget.TextView').$new(state.activity);
  tv.setText(jstr(str));
  tv.setTextSize(2, sp);
  tv.setTextColor(color(hex));
  tv.setIncludeFontPadding(false);
  if (bold) tv.setTypeface(Java.use('android.graphics.Typeface').DEFAULT_BOLD.value);
  return tv;
}
function button(label, tag, background, sp, hex) {
  const tv = text(label, sp || 13, hex || '#FFFFFF', true);
  tv.setGravity(17);
  tv.setBackground(ripple(background));
  tv.setClickable(true);
  tv.setFocusable(true);
  tv.setTag(jstr(tag));
  tv.setOnClickListener(state.uiClasses.click.$new());
  return tv;
}
function LP(w, h, weight) {
  const P = Java.use('android.widget.LinearLayout$LayoutParams');
  return weight === undefined ? P.$new(w, h) : P.$new(w, h, weight);
}
function margins(lp, l, t, r, b) { lp.setMargins(dp(l), dp(t), dp(r), dp(b)); return lp; }
function vbox() { const l = Java.use('android.widget.LinearLayout').$new(state.activity); l.setOrientation(1); return l; }
function hbox() { const l = Java.use('android.widget.LinearLayout').$new(state.activity); l.setOrientation(0); l.setGravity(16); return l; }

const MATCH_W = -1, WRAP = -2;

// ---- options-menu look (dark slate rows, light title, underlined tabs) ----
const C = {
  scrim: '#F7121820', row: '#FF1D262E', rowSel: '#FF2A3743', rowStroke: '#334FC3F7',
  label: '#AEB9C1', value: '#FFFFFF', dim: '#6E7A83', accent: '#4FC3F7', note: '#E8D25A',
  title: '#C9D3DA', bar: '#3A4650', barFill: '#E6EDF2', play: '#FF8A1F'
};
function face(tv, family, style) {
  tv.setTypeface(Java.use('android.graphics.Typeface').create(family, style || 0));
  return tv;
}
function plain(str, sp, hex, family, style) {
  const tv = text(str, sp, hex, false);
  return face(tv, family || 'sans-serif-condensed', style || 0);
}

// Row model -------------------------------------------------------------
const GFX_SUBTABS = [
  {id: 'display', label: 'DISPLAY', sections: ['DISPLAY']},
  {id: 'quality', label: 'QUALITY', sections: ['ANTI-ALIASING & SHARPNESS', 'TEXTURES & DETAIL']},
  {id: 'effects', label: 'EFFECTS', sections: ['LIGHTING & EFFECTS', 'ACCESSIBILITY']},
  {id: 'advanced', label: 'ADVANCED', sections: ['ADVANCED (UNLABELLED GAME SETTINGS — MAY CRASH)']},
];
const GFX_HELP = {
  on: 'Turns every graphics change below on or off. Off restores the game\'s own values instantly.',
  res: 'Fixed internal render height. 640p is the sharp, blur-free default. Native renders at the full screen render size.',
  dynamic: 'The game lowers resolution under load. This is what made the picture blurry; keep it Disabled.',
  preset: 'The game\'s render preset. Native gives full detail; lower presets trade sharpness for speed.',
  fps: 'Frame-rate cap. Uncapped can heat the phone faster.',
  aa: 'Edge smoothing. SMAA is the best quality this build offers.',
  smaa: 'SMAA quality. Low is the highest level available on mobile.',
  temporal: 'Temporal accumulation. Off keeps motion sharp; Temporal can ghost.',
  upscaler: 'Sharpening / upscaling pass. CAS sharpens; FSR 2–4 are not in the mobile build.',
  sharpen: 'Strength of the CAS sharpening pass.',
  tex: 'Texture resolution. Read when the map loads. Ultra overflows the streaming pool (grey flicker).',
  detail: 'Overall detail/LOD level. Read when the map loads.',
  filter: 'Texture filtering. Aniso 16x keeps ground textures sharp at an angle.',
  refl: 'Reflection probe quality. Experimental: showed green/red ground patches on Crash.',
  shadows: 'Shadow cascades. Experimental.',
  ao: 'Ambient occlusion / global illumination. Experimental: GT Global Illumination crashed matches.',
  aoq: 'Quality of the ambient occlusion pass (needs AO on).',
  blur: 'Motion blur. Had no visible effect in testing.',
  colorblind: 'Colour-blind filter for the whole picture.',
};

function gfxRows() {
  const rows = [{key: 'on', sub: 'display', label: 'Graphics Override', toggle: true, live: true}];
  for (const s of GFX_SPEC) {
    const sub = GFX_SUBTABS.find(t => t.sections.includes(s.section));
    rows.push({key: s.key, sub: sub ? sub.id : 'advanced', label: s.label, toggle: !!s.toggle,
      options: s.options, live: s.live, note: s.note, spec: s});
  }
  return rows;
}

function gfxValue(row) {
  const v = state.gfx[row.key];
  if (row.toggle) return v ? 'Enabled' : 'Disabled';
  return String(v);
}
function gfxFrac(row) {
  if (row.toggle) return state.gfx[row.key] ? 1 : 0.15;
  const i = row.options.indexOf(state.gfx[row.key]);
  return row.options.length <= 1 ? 1 : Math.max(0.08, i / (row.options.length - 1));
}
function gfxStep(row, d) {
  if (row.toggle) { state.gfx[row.key] = !state.gfx[row.key]; return; }
  const list = row.options;
  const i = Math.max(0, list.indexOf(state.gfx[row.key]));
  state.gfx[row.key] = list[(i + d + list.length) % list.length];
}

const MATCH_ROWS = [
  {key: 'map', label: 'Map', help: 'The map for your match. Nuketown and Crash are fully tested; Verdansk is a large map and loads slowly.',
    get: () => MAPS[state.mapIndex].label, frac: () => state.mapIndex / (MAPS.length - 1),
    step: d => { state.mapIndex = (state.mapIndex + d + MAPS.length) % MAPS.length; }},
  {key: 'mode', label: 'Mode', help: 'Game mode. Team Deathmatch is tested; the others are experimental.',
    get: () => MODES[state.modeIndex].label, frac: () => state.modeIndex / (MODES.length - 1),
    step: d => { state.modeIndex = (state.modeIndex + d + MODES.length) % MODES.length; }},
  {key: 'diff', label: 'AI Difficulty', help: 'How well the bots fight.',
    get: () => DIFFICULTIES[state.difficultyIndex], frac: () => state.difficultyIndex / (DIFFICULTIES.length - 1),
    step: d => { state.difficultyIndex = (state.difficultyIndex + d + DIFFICULTIES.length) % DIFFICULTIES.length; }},
  {key: 'class', label: 'Class', help: 'Which of your Gear Up loadouts you spawn with.',
    get: () => 'Class ' + (state.classIndex + 1), frac: () => state.classIndex / 4,
    step: d => { state.classIndex = (state.classIndex + d + 5) % 5; }},
  {key: 'enemies', label: 'Enemy Bots', help: 'Number of enemy AI soldiers (1–6). Enemies + allies can be at most 8.',
    get: () => String(state.enemies), frac: () => state.enemies / 6,
    step: d => { const v = state.enemies + d; if (v >= 1 && v <= 6 && v + state.friends <= 8) state.enemies = v; }},
  {key: 'camera', label: 'Camera', help: 'First or third person. Changes instantly during a match, and is kept for your next matches.',
    get: () => state.thirdPerson ? 'Third person' : 'First person', frac: () => state.thirdPerson ? 1 : 0,
    step: () => { state.thirdPerson = !state.thirdPerson; camera.set(state.thirdPerson); }},
  {key: 'allies', label: 'Friendly Bots', help: 'Number of AI soldiers on your team (0–6).',
    get: () => String(state.friends), frac: () => state.friends / 6,
    step: d => { const v = state.friends + d; if (v >= 0 && v <= 6 && state.enemies + v <= 8) state.friends = v; }},
];

// Views -----------------------------------------------------------------
function makeRow(parent, key, label) {
  const row = hbox();
  row.setTag(jstr('sel:' + key));
  row.setClickable(true);
  row.setOnClickListener(state.uiClasses.click.$new());
  row.setPadding(dp(12), 0, dp(4), 0);
  row.setBackground(rounded(C.row, 2));
  const lab = plain(label, 12, C.label);
  lab.setSingleLine(true);
  row.addView(lab, LP(0, WRAP, 1.05));
  const divider = Java.use('android.view.View').$new(state.activity);
  divider.setBackgroundColor(color('#33FFFFFF'));
  row.addView(divider, margins(LP(dp(1), dp(18)), 0, 0, 8, 0));
  const valCol = vbox();
  const valRow = hbox();
  const val = plain('', 12, C.value);
  val.setSingleLine(true);
  valRow.addView(val, LP(0, WRAP, 1));
  const prev = button('‹', 'dec:' + key, rounded('#00000000', 2), 15, C.dim);
  const next = button('›', 'inc:' + key, rounded('#00000000', 2), 15, C.dim);
  valRow.addView(prev, LP(dp(30), dp(22)));
  valRow.addView(next, LP(dp(30), dp(22)));
  valCol.addView(valRow, LP(MATCH_W, WRAP));
  const bar = hbox();
  const fill = Java.use('android.view.View').$new(state.activity);
  fill.setBackgroundColor(color(C.barFill));
  const rest = Java.use('android.view.View').$new(state.activity);
  rest.setBackgroundColor(color(C.bar));
  bar.addView(fill, LP(0, dp(2), 0.5));
  bar.addView(rest, LP(0, dp(2), 0.5));
  valCol.addView(bar, margins(LP(MATCH_W, WRAP), 0, 0, dp(62) / Math.max(1, dp(1)), 0));
  row.addView(valCol, LP(0, WRAP, 1));
  parent.addView(row, margins(LP(MATCH_W, dp(30)), 0, 0, 0, 2));
  return {row: Java.retain(row), val: Java.retain(val), fill: Java.retain(fill), rest: Java.retain(rest),
    lab: Java.retain(lab)};
}

function setFrac(r, f) {
  const P = Java.use('android.widget.LinearLayout$LayoutParams');
  const x = Math.max(0.02, Math.min(1, f));
  r.fill.setLayoutParams(P.$new(0, dp(2), x));
  r.rest.setLayoutParams(P.$new(0, dp(2), Math.max(0.0001, 1 - x)));
}

function tabButton(label, tag, sp) {
  const col = vbox();
  col.setGravity(17);
  col.setTag(jstr(tag));
  col.setClickable(true);
  col.setOnClickListener(state.uiClasses.click.$new());
  const t = plain(label, sp, C.label, 'sans-serif-condensed', 1);
  t.setLetterSpacing(0.06);
  t.setGravity(17);
  col.addView(t, LP(WRAP, WRAP));
  const under = Java.use('android.view.View').$new(state.activity);
  under.setBackgroundColor(color(C.accent));
  col.addView(under, margins(LP(MATCH_W, dp(2)), 0, dp(4) / Math.max(1, dp(1)), 0, 0));
  col.setPadding(dp(12), dp(6), dp(12), 0);
  return {view: Java.retain(col), text: Java.retain(t), under: Java.retain(under)};
}

function footerButton(label, tag) {
  const b = button(label, tag, rounded('#FF28323B', 2, '#33FFFFFF', 1), 11, '#E6EDF2');
  face(b, 'sans-serif-condensed', 0);
  b.setPadding(dp(14), 0, dp(14), 0);
  return b;
}

// ---------------------------------------------------------------- panel
function buildUi(activity) {
  state.activity = activity;
  state.playLook = undefined;
  const FLP = Java.use('android.widget.FrameLayout$LayoutParams');
  const View = Java.use('android.view.View');
  const ScrollView = Java.use('android.widget.ScrollView');
  const metrics = activity.getResources().getDisplayMetrics();
  const screenW = Number(metrics.widthPixels.value), screenH = Number(metrics.heightPixels.value);
  const ui = {rows: {}, tabs: {}, subtabs: {}, lists: {}};

  const panel = vbox();
  panel.setBackground(rounded(C.scrim, 6, '#22FFFFFF', 1));
  panel.setElevation(dp(16));
  panel.setPadding(dp(16), dp(4), dp(16), dp(8));
  panel.setClickable(true);
  panel.setVisibility(View.GONE.value);

  // title row: big light title, tabs, status pill, close
  const top = hbox();
  top.setTag(jstr('drag'));
  top.setOnTouchListener(state.uiClasses.drag.$new());
  const title = plain('OPTIONS', 21, C.title, 'sans-serif-light', 0);
  title.setLetterSpacing(0.04);
  top.addView(title, margins(LP(WRAP, WRAP), 0, 0, 18, 0));
  for (const [id, label] of [['match', 'MATCH'], ['gfx', 'GRAPHICS']]) {
    ui.tabs[id] = tabButton(label, 'tab:' + id, 12);
    top.addView(ui.tabs[id].view, LP(WRAP, dp(32)));
  }
  top.addView(Java.use('android.widget.Space').$new(activity), LP(0, 1, 1));
  ui.pill = plain('STARTING', 11, '#F5A623', 'sans-serif-condensed', 1);
  ui.pill.setLetterSpacing(0.1);
  ui.pill.setPadding(dp(8), dp(3), dp(8), dp(3));
  top.addView(ui.pill, margins(LP(WRAP, WRAP), 0, 0, 10, 0));
  const close = button('✕', 'close', rounded('#00000000', 14), 13, C.label);
  top.addView(close, LP(dp(30), dp(30)));
  panel.addView(top, LP(MATCH_W, WRAP));
  const rule = View.$new(activity);
  rule.setBackgroundColor(color('#2EFFFFFF'));
  panel.addView(rule, margins(LP(MATCH_W, dp(1)), 0, 0, 0, 0));

  // graphics sub-tabs
  const subs = hbox();
  for (const s of GFX_SUBTABS) {
    ui.subtabs[s.id] = tabButton(s.label, 'sub:' + s.id, 10);
    subs.addView(ui.subtabs[s.id].view, LP(WRAP, dp(24)));
  }
  ui.subBar = subs;
  panel.addView(subs, margins(LP(MATCH_W, WRAP), 0, 2, 0, 0));

  // content: list (left) + description (right)
  const content = hbox();
  content.setGravity(48);
  const listScroll = ScrollView.$new(activity);
  listScroll.setVerticalScrollBarEnabled(true);
  const listHolder = vbox();
  // match list
  const mList = vbox();
  for (const r of MATCH_ROWS) ui.rows[r.key] = makeRow(mList, r.key, r.label);
  listHolder.addView(mList, LP(MATCH_W, WRAP));
  ui.lists.match = mList;
  // graphics lists, one per sub-tab
  for (const s of GFX_SUBTABS) {
    const l = vbox();
    for (const r of gfxRows().filter(x => x.sub === s.id)) {
      ui.rows['g.' + r.key] = makeRow(l, 'g.' + r.key, r.label);
    }
    l.setVisibility(View.GONE.value);
    listHolder.addView(l, LP(MATCH_W, WRAP));
    ui.lists[s.id] = l;
  }
  listScroll.addView(listHolder);
  content.addView(listScroll, margins(LP(0, MATCH_W, 1.25), 0, 6, 0, 0));
  ui.listScroll = listScroll;

  // description pane
  const desc = vbox();
  desc.setPadding(dp(20), dp(4), dp(4), dp(2));
  ui.dTitle = plain('', 15, C.title, 'sans-serif-condensed', 1);
  ui.dTitle.setLetterSpacing(0.04);
  desc.addView(ui.dTitle, LP(MATCH_W, WRAP));
  ui.dText = plain('', 12, C.label);
  ui.dText.setLineSpacing(0, 1.15);
  desc.addView(ui.dText, margins(LP(MATCH_W, WRAP), 0, 8, 0, 0));
  ui.dNote = plain('', 12, C.note);
  ui.dNote.setLineSpacing(0, 1.15);
  desc.addView(ui.dNote, margins(LP(MATCH_W, WRAP), 0, 10, 0, 0));
  desc.addView(Java.use('android.widget.Space').$new(activity), LP(1, 0, 1));
  ui.play = button('PLAY', 'play', gradient(['#FFFF8A1F', '#FFE8501A'], 4), 20, '#FFFFFF');
  face(ui.play, 'sans-serif-condensed', 1);
  ui.play.setLetterSpacing(0.2);
  desc.addView(ui.play, LP(MATCH_W, dp(46)));
  content.addView(desc, LP(0, MATCH_W, 1));
  panel.addView(content, LP(MATCH_W, 0, 1));

  // footer: status (left), buttons (right)
  const foot = hbox();
  ui.status = plain(state.statusText, 11, C.label);
  ui.status.setMaxLines(1);
  ui.status.setEllipsize(Java.use('android.text.TextUtils$TruncateAt').END.value);
  foot.addView(ui.status, LP(0, WRAP, 1));
  foot.addView(footerButton('Export Logs', 'export'), margins(LP(WRAP, dp(26)), 8, 0, 0, 0));
  ui.reset = footerButton('Reset Tab', 'reset');
  foot.addView(ui.reset, margins(LP(WRAP, dp(26)), 8, 0, 0, 0));
  foot.addView(footerButton('Back', 'close'), margins(LP(WRAP, dp(26)), 8, 0, 0, 0));
  ui.ver = plain(VERSION, 10, '#4D5763');
  foot.addView(ui.ver, margins(LP(WRAP, WRAP), 10, 0, 0, 0));
  panel.addView(foot, margins(LP(MATCH_W, WRAP), 0, 6, 0, 0));

  const panelLayout = FLP.$new(screenW - dp(36), screenH - dp(24));
  panelLayout.gravity.value = 17;
  const decor = Java.cast(activity.getWindow().getDecorView(), Java.use('android.view.ViewGroup'));
  decor.addView(panel, panelLayout);

  // floating ball
  const ball = text('WZ', 12, '#FFFFFF', true);
  ball.setGravity(17);
  ball.setLetterSpacing(0.05);
  const ballBg = gradient(['#FFFF8A1F', '#FFD9381E'], 0, true);
  ballBg.setStroke(dp(2), color('#CCFFFFFF'));
  ball.setBackground(ballBg);
  ball.setElevation(dp(20));
  ball.setAlpha(BALL_IDLE);
  ball.setOnTouchListener(state.uiClasses.ballDrag.$new());
  const size = dp(42);
  const ballLayout = FLP.$new(size, size);
  ballLayout.gravity.value = 48 | 8388611;
  ballLayout.leftMargin.value = dp(10);
  ballLayout.topMargin.value = Math.round(screenH * 0.42);
  decor.addView(ball, ballLayout);

  state.panel = Java.retain(panel);
  state.ball = Java.retain(ball);
  state.panelShown = false;
  state.ballHidden = false;
  scheduleBallHide();
  for (const k of ['pill', 'subBar', 'listScroll', 'dTitle', 'dText', 'dNote', 'play', 'status', 'reset', 'ver'])
    ui[k] = Java.retain(ui[k]);
  for (const k of Object.keys(ui.lists)) ui.lists[k] = Java.retain(ui.lists[k]);
  state.ui = ui;
  refreshUi();
  log('UI attached (' + screenW + 'x' + screenH + ')');
}

function detachUi() {
  for (const v of [state.ball, state.panel]) {
    if (v === null) continue;
    try {
      const parent = v.getParent();
      if (parent !== null) Java.cast(parent, Java.use('android.view.ViewGroup')).removeView(v);
    } catch (e) { log('detach: ' + e); }
  }
  state.ball = null; state.panel = null; state.ui = {}; state.activity = null;
  state.drag = null; state.ballDrag = null;
}

function phaseLook() {
  const p = session.phase;
  if (p === 'FAILED') return ['ERROR', '#FF5A5A'];
  if (session.matchActive) return ['IN MATCH', C.accent];
  if (p === 'MENU') return [session.snapshot().busy === 'unlock' ? 'UNLOCKING' : 'READY', '#3DDC84'];
  return ['STARTING', '#F5A623'];
}

function selectedRow() {
  if (state.tab === 'match') return MATCH_ROWS.find(r => r.key === state.selMatch) || MATCH_ROWS[0];
  const rows = gfxRows().filter(r => r.sub === state.subTab);
  return rows.find(r => r.key === state.selGfx) || rows[0];
}

function refreshUi() {
  const ui = state.ui;
  if (!ui.rows) return;
  const View = Java.use('android.view.View');
  const gfx = state.tab === 'gfx';
  for (const id of Object.keys(ui.tabs)) {
    const on = (id === 'gfx') === gfx;
    ui.tabs[id].text.setTextColor(color(on ? '#FFFFFF' : C.dim));
    ui.tabs[id].under.setVisibility(on ? View.VISIBLE.value : View.INVISIBLE.value);
  }
  ui.subBar.setVisibility(gfx ? View.VISIBLE.value : View.GONE.value);
  for (const s of GFX_SUBTABS) {
    const on = s.id === state.subTab;
    ui.subtabs[s.id].text.setTextColor(color(on ? C.accent : C.dim));
    ui.subtabs[s.id].under.setVisibility(on ? View.VISIBLE.value : View.INVISIBLE.value);
    ui.lists[s.id].setVisibility(gfx && on ? View.VISIBLE.value : View.GONE.value);
  }
  ui.lists.match.setVisibility(gfx ? View.GONE.value : View.VISIBLE.value);
  const sel = selectedRow();
  for (const r of MATCH_ROWS) {
    const v = ui.rows[r.key];
    v.val.setText(jstr(r.get()));
    setFrac(v, r.frac());
    v.row.setBackground(rounded(!gfx && sel === r ? C.rowSel : C.row, 2, !gfx && sel === r ? C.rowStroke : null, 1));
  }
  for (const r of gfxRows()) {
    const v = ui.rows['g.' + r.key];
    if (!v) continue;
    v.val.setText(jstr(gfxValue(r)));
    setFrac(v, gfxFrac(r));
    const active = state.gfx.on || r.key === 'on';
    v.row.setAlpha(active ? 1.0 : 0.45);
    const isSel = gfx && sel && sel.key === r.key;
    v.row.setBackground(rounded(isSel ? C.rowSel : C.row, 2, isSel ? C.rowStroke : null, 1));
  }
  // description pane
  if (!gfx) {
    ui.dTitle.setText(jstr(sel.label.toUpperCase()));
    ui.dText.setText(jstr(sel.help));
    const restart = !!session.nextPlayRestarts;
    ui.dNote.setText(jstr(restart
      ? 'RESTART REQUIRED: Gear Up was opened or a match was played in this session. Tapping RESTART & PLAY restarts the game (about 1 minute), then your match starts by itself. Do not tap anything while it restarts.'
      : 'PLAY starts the match instantly.\n\nWARNING: opening GEAR UP (or finishing a match) means the next match needs a game restart first.'));
    ui.dNote.setTextColor(color(restart ? '#FFB74D' : C.note));
    ui.play.setVisibility(View.VISIBLE.value);
    ui.play.setAlpha(session.phase === 'MENU' ? 1.0 : 0.45);
    ui.play.setText(jstr(session.matchActive ? 'IN MATCH' : restart ? '↻  RESTART & PLAY' : 'PLAY'));
    ui.play.setLetterSpacing(restart ? 0.08 : 0.2);
    if (state.playLook !== restart) {
      state.playLook = restart;
      ui.play.setBackground(ripple(gradient(restart ? ['#FFFFC107', '#FFFF8F00'] : ['#FFFF8A1F', '#FFE8501A'], 4)));
      ui.play.setTextColor(color(restart ? '#1A1A1A' : '#FFFFFF'));
    }
  } else {
    ui.dTitle.setText(jstr(sel.label.toUpperCase()));
    ui.dText.setText(jstr((GFX_HELP[sel.key] || 'Game setting with no public name. May crash; Game default leaves it untouched.') +
      '\n\n' + (sel.live ? 'Applies instantly, in the menu and during a match.' : 'Applies when the next match loads.')));
    ui.dNote.setText(jstr((sel.note ? sel.note + '\n' : '') + (gfxLive.started ? 'Now: ' + gfxLive.status() : '')));
    ui.play.setVisibility(View.GONE.value);
  }
  ui.status.setText(jstr(state.statusText));
  const [label, hex] = phaseLook();
  ui.pill.setText(jstr(label));
  ui.pill.setTextColor(color(hex));
  ui.pill.setBackground(rounded('#26' + hex.slice(1), 3));
}

setInterval(() => {
  if (state.disposing || state.tab !== 'gfx' || state.panel === null) return;
  onUi(() => { if (panelOpen()) refreshUi(); });
}, 2000);

function onUi(fn) {
  setImmediate(() => {
    if (state.disposing || !Java.available) return;
    try { Java.perform(() => Java.scheduleOnMainThread(() => { try { fn(); } catch (e) { log('ui: ' + e); } })); }
    catch (e) { log('ui dispatch: ' + e); }
  });
}

function setStatus(value) {
  state.statusText = String(value).slice(0, 200);
  log('status: ' + state.statusText);
  onUi(refreshUi);
}

// ---- floating ball: translucent; when idle it fades to faint (still visible). Faint: first tap brings it
// back, next tap opens the menu ----
const BALL_IDLE = 0.5, BALL_FAINT = 0.16, BALL_HIDE_MS = 10000;
let ballTimer = null;
function interp(x1, y1, x2, y2) { return Java.use('android.view.animation.PathInterpolator').$new(x1, y1, x2, y2); }

function scheduleBallHide() {
  if (ballTimer !== null) clearTimeout(ballTimer);
  ballTimer = setTimeout(() => {
    ballTimer = null;
    onUi(() => {
      if (state.ball === null || state.panelShown || state.ballDrag !== null) return;
      state.ballHidden = true;
      state.ball.animate().alpha(BALL_FAINT).setDuration(450).setInterpolator(interp(0.4, 0, 0.2, 1)).start();
    });
  }, BALL_HIDE_MS);
}

function showBall() {
  if (state.ball === null) return;
  state.ballHidden = false;
  state.ball.animate().alpha(state.panelShown ? 0.9 : BALL_IDLE).scaleX(1).scaleY(1)
    .setDuration(220).setInterpolator(interp(0.2, 0.9, 0.3, 1)).start();
  if (!state.panelShown) scheduleBallHide();
}

// iOS-like spring: grows out of the ball with a slight overshoot; quick fade on close.
function setPanelVisible(show) {
  if (state.panel === null) return;
  const View = Java.use('android.view.View');
  const panel = state.panel;
  state.panelAnim = (state.panelAnim || 0) + 1;
  const token = state.panelAnim;
  panel.animate().cancel();
  if (show) {
    state.panelShown = true;
    if (ballTimer !== null) { clearTimeout(ballTimer); ballTimer = null; }
    refreshUi();
    panel.setVisibility(View.VISIBLE.value);
    try {
      const ball = state.ball;
      if (ball !== null && panel.getWidth() > 0) {
        const bx = ball.getLeft() + ball.getTranslationX() + ball.getWidth() / 2;
        const by = ball.getTop() + ball.getTranslationY() + ball.getHeight() / 2;
        panel.setPivotX(Math.max(0, Math.min(panel.getWidth(), bx - panel.getLeft() - panel.getTranslationX())));
        panel.setPivotY(Math.max(0, Math.min(panel.getHeight(), by - panel.getTop() - panel.getTranslationY())));
      }
    } catch (_) {}
    panel.setAlpha(0); panel.setScaleX(0.86); panel.setScaleY(0.86);
    panel.animate().alpha(1).scaleX(1).scaleY(1).setDuration(380)
      .setInterpolator(interp(0.32, 1.28, 0.6, 1)).start();
    if (state.ball !== null) state.ball.animate().alpha(0.9).setDuration(150).start();
    state.ballHidden = false;
  } else {
    if (!state.panelShown) return;
    state.panelShown = false;
    panel.animate().alpha(0).scaleX(0.94).scaleY(0.94).setDuration(170)
      .setInterpolator(interp(0.4, 0, 1, 1)).start();
    setTimeout(() => onUi(() => {
      if (state.panelAnim === token && !state.panelShown && state.panel !== null)
        state.panel.setVisibility(View.GONE.value);
    }), 190);
    showBall();
  }
}

function panelOpen() {
  return state.panel !== null && !!state.panelShown;
}

function gfxChanged() {
  savePrefs();
  const eff = effectiveGfx(state.lastMap);
  setImmediate(() => { try { gfxLive.update(eff); } catch (e) { log('gfx update: ' + e); } onUi(refreshUi); });
}

function onAction(action) {
  if (state.disposing) return;
  const [kind, key] = String(action).split(':');
  switch (kind) {
    case 'toggle': setPanelVisible(!panelOpen()); return;
    case 'close': setPanelVisible(false); return;
    case 'tab': state.tab = key === 'gfx' ? 'gfx' : 'match'; refreshUi(); return;
    case 'sub': state.subTab = key; state.selGfx = null; refreshUi(); return;
    case 'sel':
      if (key.startsWith('g.')) state.selGfx = key.slice(2); else state.selMatch = key;
      refreshUi();
      return;
    case 'dec': case 'inc': {
      const d = kind === 'inc' ? 1 : -1;
      if (key.startsWith('g.')) {
        const r = gfxRows().find(x => x.key === key.slice(2));
        if (!r) return;
        state.selGfx = r.key;
        gfxStep(r, d);
        gfxChanged();
        refreshUi();
        return;
      }
      const r = MATCH_ROWS.find(x => x.key === key);
      if (!r) return;
      state.selMatch = r.key;
      r.step(d);
      savePrefs();
      refreshUi();
      return;
    }
    case 'export':
      setStatus('Collecting logs…');
      setTimeout(exportLogs, 0);
      return;
    case 'reset':
      if (state.tab === 'gfx') {
        for (const r of gfxRows().filter(x => x.sub === state.subTab)) state.gfx[r.key] = GFX_DEFAULTS[r.key];
        gfxChanged();
      } else {
        state.mapIndex = 0; state.modeIndex = 0; state.difficultyIndex = 3; state.classIndex = 0;
        state.enemies = 5; state.friends = 0;
        state.thirdPerson = false; camera.set(false);
        savePrefs();
      }
      refreshUi();
      return;
    case 'play': {
      if (session.phase !== 'MENU') { setStatus(session.matchActive ? 'A match is already running.' : state.statusText); return; }
      const map = MAPS[state.mapIndex], mode = MODES[state.modeIndex];
      const req = {map: map.native, mapLabel: map.label, gametype: mode.native, modeLabel: mode.label,
        enemies: state.enemies, friends: state.friends, difficulty: state.difficultyIndex,
        classIndex: state.classIndex};
      savePrefs();
      setPanelVisible(false);
      setTimeout(() => session.play(req).then(setStatus, e => setStatus('Start failed: ' + e)), 0);
      return;
    }
    default: return;
  }
}

// ---------------------------------------------------------------- Java classes
// The game's Java NetworkStateManager reports Wi-Fi / mobile data / VPN / wired / background-restriction
// changes to the engine (native*StateChanged). Offline nothing uses the network, but a change (Wi-Fi
// drops, data toggled) made the game show "connecting" and freeze mid-match. The boot-time reports
// arrive before this guard (installed with the menu UI); after that the engine keeps that state and
// later changes are only logged.
let netGuardOn = false;
globalThis.Java = Java;  // dev console access
function installNetworkGuard() {
  if (netGuardOn) return;
  const NSM = Java.use('com.activision.game.NetworkStateManager');
  // Started with Wi-Fi and data off, the engine never hears "connected" and the startup waits on the
  // black start page forever. Tell it Wi-Fi is up (full signal, IPv4) once, before blocking reports.
  try { NSM.nativeWifiStateChanged(true, 100, true, false); log('network: reported Wi-Fi connected to the engine'); }
  catch (e) { log('network fake connect: ' + e); }
  for (const k of ['a', 'b']) { try { NSM[k].implementation = function () { return true; }; } catch (e) { log('net ' + k + ': ' + e); } }
  for (const name of ['nativeWifiStateChanged', 'nativeMobileDataStateChanged', 'nativeVPNStateChanged',
                      'nativeWiredStateChanged', 'nativeBackgroundRestrictionStateChanged']) {
    const m = NSM[name];
    if (!m) continue;
    m.implementation = function (...args) {
      log('network ' + name + '(' + args.join(',') + ') ignored (offline)');
    };
  }
  netGuardOn = true;
  log('network guard installed');
}

function registerUiClasses() {
  if (state.uiClassReady) return;
  const OnClickListener = Java.use('android.view.View$OnClickListener');
  const OnTouchListener = Java.use('android.view.View$OnTouchListener');
  const callbacks = Java.use('android.app.Application$ActivityLifecycleCallbacks');
  const click = Java.registerClass({
    name: 'com.wzm.offline.internal.R7Click',
    implements: [OnClickListener],
    methods: {onClick(view) { try { onAction(String(view.getTag())); } catch (e) { log('click: ' + e); } }}
  });
  const drag = Java.registerClass({
    name: 'com.wzm.offline.internal.R7PanelDrag',
    implements: [OnTouchListener],
    methods: {onTouch(_v, ev) {
      if (state.panel === null) return false;
      try {
        const a = ev.getActionMasked();
        if (a === 0) {
          state.drag = {x: ev.getRawX(), y: ev.getRawY(),
            tx: state.panel.getTranslationX(), ty: state.panel.getTranslationY()};
          return true;
        }
        if (a === 2 && state.drag !== null) {
          state.panel.setTranslationX(state.drag.tx + ev.getRawX() - state.drag.x);
          state.panel.setTranslationY(state.drag.ty + ev.getRawY() - state.drag.y);
          return true;
        }
        if (a === 1 || a === 3) { state.drag = null; return true; }
      } catch (e) { log('drag: ' + e); }
      return false;
    }}
  });
  const ballDrag = Java.registerClass({
    name: 'com.wzm.offline.internal.R7BallDrag',
    implements: [OnTouchListener],
    methods: {onTouch(_v, ev) {
      const ball = state.ball;
      if (ball === null || state.activity === null) return false;
      try {
        const a = ev.getActionMasked();
        if (a === 0) {
          state.ballDrag = {x: ev.getRawX(), y: ev.getRawY(), tx: ball.getTranslationX(),
            ty: ball.getTranslationY(), moved: false, wasHidden: !!state.ballHidden};
          if (ballTimer !== null) { clearTimeout(ballTimer); ballTimer = null; }
          if (!state.ballHidden) { ball.setScaleX(0.9); ball.setScaleY(0.9); }
          return true;
        }
        if (a === 2 && state.ballDrag !== null) {
          const dx = ev.getRawX() - state.ballDrag.x, dy = ev.getRawY() - state.ballDrag.y;
          if (Math.abs(dx) + Math.abs(dy) > dp(8)) {
            if (!state.ballDrag.moved && state.ballHidden) { state.ballHidden = false; ball.setAlpha(BALL_IDLE); }
            state.ballDrag.moved = true;
          }
          if (!state.ballDrag.moved) return true;
          const decor = state.activity.getWindow().getDecorView();
          const x = Math.max(-ball.getLeft(), Math.min(decor.getWidth() - ball.getLeft() - ball.getWidth(), state.ballDrag.tx + dx));
          const y = Math.max(-ball.getTop(), Math.min(decor.getHeight() - ball.getTop() - ball.getHeight(), state.ballDrag.ty + dy));
          ball.setTranslationX(x); ball.setTranslationY(y);
          return true;
        }
        if (a === 1 || a === 3) {
          ball.setScaleX(1.0); ball.setScaleY(1.0);
          const moved = state.ballDrag !== null && state.ballDrag.moved;
          const wasHidden = state.ballDrag !== null && state.ballDrag.wasHidden;
          state.ballDrag = null;
          if (moved) {
            // snap to the nearest screen edge
            const decor = state.activity.getWindow().getDecorView();
            const center = ball.getLeft() + ball.getTranslationX() + ball.getWidth() / 2;
            const target = center < decor.getWidth() / 2 ? -ball.getLeft() + dp(6)
              : decor.getWidth() - ball.getLeft() - ball.getWidth() - dp(6);
            ball.animate().translationX(target).setDuration(220).setInterpolator(interp(0.32, 1.2, 0.6, 1)).start();
            if (!state.panelShown) scheduleBallHide();
          } else if (a === 1) {
            if (wasHidden) showBall();          // first tap on the empty spot: bring the ball back
            else onAction('toggle');            // tap on the visible ball: open/close the menu
          } else if (!state.panelShown) scheduleBallHide();
          return true;
        }
      } catch (e) { log('ball: ' + e); }
      return false;
    }}
  });
  const methods = {
    onActivityPreCreated() {}, onActivityPostCreated() {}, onActivityPreStarted() {},
    onActivityPostStarted() {}, onActivityPreResumed() {}, onActivityPostResumed() {},
    onActivityPrePaused() {}, onActivityPostPaused() {}, onActivityPreStopped() {},
    onActivityPostStopped() {}, onActivityPreSaveInstanceState() {}, onActivityPostSaveInstanceState() {},
    onActivityPreDestroyed() {}, onActivityPostDestroyed() {}, onActivityCreated() {},
    onActivityStarted() {}, onActivityStopped() {}, onActivitySaveInstanceState() {},
    onActivityResumed(activity) { scheduleActivity(activity); },
    onActivityPaused(activity) { forgetActivity(activity); },
    onActivityDestroyed(activity) { forgetActivity(activity); }
  };
  const reflected = callbacks.class.getMethods();
  for (let i = 0; i < reflected.length; i++) {
    const name = String(reflected[i].getName());
    if (name.startsWith('onActivity') && !Object.prototype.hasOwnProperty.call(methods, name))
      methods[name] = function () {};
  }
  const lifecycle = Java.registerClass({
    name: 'com.wzm.offline.internal.R7Lifecycle', implements: [callbacks], methods
  });
  state.uiClasses = {click, drag, ballDrag, lifecycle};
  state.uiClassReady = true;
  // Network guard is off: the 14 Nov test (fake Wi-Fi report) made boots stall; see R7_HANDOFF.md 14 Nov.
  if (storage.read('wzm_net_guard')) { try { installNetworkGuard(); } catch (e) { log('net guard: ' + e); } }
}

function uiAllowed() { return state.nativeReady || state.menuContinuity || state.everReady; }

function showForActivity(activity) {
  if (state.disposing) return;
  try {
    if (!state.uiClassReady) { state.pendingActivity = Java.retain(activity); return; }
    if (String(activity.getClass().getName()) !== GAME_ACTIVITY || activity.isFinishing()) return;
    if (!uiAllowed()) { state.pendingActivity = Java.retain(activity); return; }
    if (state.ball !== null && state.activity !== null && state.activity.equals(activity)) return;
    detachUi();
    state.pendingActivity = null;
    buildUi(Java.retain(activity));
  } catch (e) {
    log('UI attach failed: ' + e + ' ' + (e.stack || ''));
    detachUi();
  }
}

function scheduleActivity(activity) {
  const retained = Java.retain(activity);
  Java.scheduleOnMainThread(() => showForActivity(retained));
}

function forgetActivity(activity) {
  const past = Java.retain(activity);
  Java.scheduleOnMainThread(() => {
    if (state.pendingActivity !== null && state.pendingActivity.equals(past)) state.pendingActivity = null;
    if (state.activity !== null && state.activity.equals(past)) detachUi();
  });
}

function findExistingActivity() {
  try {
    Java.choose(GAME_ACTIVITY, {
      onMatch(a) { if (!a.isFinishing()) scheduleActivity(a); },
      onComplete() {}
    });
  } catch (e) { log('activity lookup: ' + e); }
}

function bootstrapJava() {
  if (!Java.available || state.javaRegistering || state.disposing || state.lifecycle !== null) return;
  state.javaRegistering = true;
  Java.perform(() => {
    try {
      const app = Java.use('android.app.ActivityThread').currentApplication();
      if (app === null) return;
      registerUiClasses();
      state.app = Java.retain(app);
      const lifecycle = state.uiClasses.lifecycle.$new();
      app.registerActivityLifecycleCallbacks(lifecycle);
      state.lifecycle = Java.retain(lifecycle);
      log('activity lifecycle hook registered');
      findExistingActivity();
    } catch (e) { log('java init: ' + e); }
    finally { state.javaRegistering = false; }
  });
}

function onReadinessChanged() {
  onUi(() => {
    if (state.disposing) return;
    if (!uiAllowed()) {
      if (state.ball !== null) state.ball.setVisibility(Java.use('android.view.View').GONE.value);
      setPanelVisible(false);
    } else if (state.ball !== null) {
      state.ball.setVisibility(Java.use('android.view.View').VISIBLE.value);
    } else if (state.pendingActivity !== null) {
      const a = state.pendingActivity;
      state.pendingActivity = null;
      showForActivity(a);
    } else findExistingActivity();
  });
}

// ---------------------------------------------------------------- native boot
function createLocalNativeRuntime() {
  return {
    now() { return Date.now(); },
    arch() { return Process.arch; },
    findModule(name) { return Process.findModuleByName(name); },
    range(address) { return Process.findRangeByAddress(address); },
    hexBytes(address, n) {
      const bytes = new Uint8Array(address.readByteArray(n));
      let hex = '';
      for (const b of bytes) hex += b.toString(16).padStart(2, '0');
      return hex;
    },
    readPointer(address) { return address.readPointer(); },
    writePointer(address, value) { address.writePointer(value); },
    nullPointer() { return ptr(0); },
    readUtf8: readBoundedUtf8,
    createBindings({load, pcall, toString, source, menuProbeSource, menuRecoveryProbeSource}) {
      return {
        load: new NativeFunction(load, 'int', ['pointer', 'pointer', 'size_t', 'pointer', 'pointer']),
        pcall: new NativeFunction(pcall, 'int', ['pointer', 'int', 'int', 'int']),
        toString: new NativeFunction(toString, 'pointer', ['pointer', 'int', 'pointer']),
        fenceBuffer: Memory.allocUtf8String(source),
        menuProbeBuffer: menuProbeSource ? Memory.allocUtf8String(menuProbeSource) : null,
        menuProbeByteLength: menuProbeSource ? menuProbeSource.length : 0,
        menuRecoveryProbeBuffer: menuRecoveryProbeSource ? Memory.allocUtf8String(menuRecoveryProbeSource) : null,
        menuRecoveryProbeByteLength: menuRecoveryProbeSource ? menuRecoveryProbeSource.length : 0,
        chunkName: Memory.allocUtf8String('=wzm_standalone_fence')
      };
    },
    attach(address, callback) { return attachAnywhere(address, {onEnter: callback}); }
  };
}

// Logo stall: the native frame never starts. Owner rule: never wait on it,
// restart fast. Relaunch automatically, at most 4 times in a row.
const STALL_MS = 35000;
let hookInstalledAt = 0;
function stallWatchdog() {
  if (state.everReady) {
    if (state.stallCountCleared !== true) { state.stallCountCleared = true; storage.write('wzm_stall_count', '0'); }
    return;
  }
  if (state.bootStage !== 'WAIT_LUI_FRAME') { if (state.bootStage !== 'WAIT_15S') hookInstalledAt = -1; return; }
  if (hookInstalledAt === 0) hookInstalledAt = Date.now();
  if (hookInstalledAt < 0 || Date.now() - hookInstalledAt < STALL_MS) return;
  hookInstalledAt = -1;
  const n = parseInt(storage.read('wzm_stall_count') || '0', 10) || 0;
  if (n >= 4) { log('logo stall: giving up after ' + n + ' automatic restarts'); storage.write('wzm_stall_count', '0'); return; }
  storage.write('wzm_stall_count', String(n + 1));
  log('logo stall detected (no game frame for ' + STALL_MS / 1000 + ' s): automatic restart ' + (n + 1));
  relaunchGame();
}

function beginNativeBoot() {
  if (state.nativeSupervisor !== null) return;
  try {
    state.nativeSupervisor = createNativeBootSupervisor({
      runtime: createLocalNativeRuntime(),
      fenceSource: FENCE_LUA_SOURCE,
      fenceByteLength: FENCE_SOURCE_BYTE_LENGTH,
      startMs: state.bootStartedAt,
      minDelayMs: MIN_NATIVE_DELAY_MS,
      fingerprint: GAME_FINGERPRINT,
      menuProbeSource: MAINMENU_PROBE,
      menuRecoveryProbeSource: MAINMENU_RECOVERY_PROBE,
      // Once the offline session owns the menu (like the Mac watch.py detaching
      // after boot), the boot fence stops re-running; the keeper takes over.
      isNativeMatchPending() { return session.phase !== 'IDLE'; },
      isNativeMatchObserved() { return false; },
      notifyMatchUiContinuity(visible) { state.menuContinuity = visible; onReadinessChanged(); },
      onVerifiedLuiFrame() {},
      onLuiReset() {},
      notifyStage(stage) { state.bootStage = stage; },
      notifyReady(ready) {
        state.nativeReady = ready;
        if (ready && !state.everReady) {
          state.everReady = true;
          // Leave the native frame callback before running the Mac menu flow.
          setTimeout(() => {
            armCrashWitness();
            probeHookSites();
            try { gfxLive.start(effectiveGfx(null)); } catch (e) { log('gfx start: ' + e); }
            session.prepareMenu({classIndex: state.classIndex, map: MAPS[state.mapIndex].native, gfx: {...state.gfx}}); }, 2000);
        }
        onReadinessChanged();
      },
      log: m => log('[boot] ' + m)
    });
    state.nativeBootTimer = setInterval(() => {
      if (state.disposing || state.nativeSupervisor === null) return;
      try { state.nativeSupervisor.tick(); } catch (e) { log('boot tick: ' + e); }
      stallWatchdog();
    }, 1000);
    log('native boot supervisor staged');
  } catch (e) {
    state.bootStage = 'NATIVE_UNSUPPORTED';
    log('native supervisor unavailable: ' + e);
  }
}

rpc.exports = {
  init(stage) {
    state.bootStartedAt = Date.now();
    log('gadget init stage=' + stage);
    beginNativeBoot();
    state.bootTimer = setInterval(() => {
      if (Date.now() - state.bootStartedAt < UI_AFTER_MS) return;
      if (state.lifecycle === null && Date.now() - state.lastBootstrapAttemptAt >= 5000) {
        state.lastBootstrapAttemptAt = Date.now();
        bootstrapJava();
      }
      if (state.lifecycle !== null) { clearInterval(state.bootTimer); state.bootTimer = null; }
    }, 500);
  },
  dispose() {
    state.disposing = true;
    if (state.bootTimer !== null) clearInterval(state.bootTimer);
    if (state.nativeBootTimer !== null) clearInterval(state.nativeBootTimer);
    if (state.nativeSupervisor !== null) state.nativeSupervisor.dispose();
  }
};
