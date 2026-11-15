const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const path = require('path');
const contract = require('./match_contract.js');

const src = fs.readFileSync(path.join(__dirname, 'entry.js'), 'utf8');
const start = src.indexOf('const GAME_ACTIVITY');
const end = src.indexOf('\nfunction jtext(value)', start);
assert.ok(start >= 0 && end > start, 'Cannot isolate menu model');

let nativeMapped = false;
const model = vm.runInNewContext(src.slice(start, end) + `
  function setStatus(value) { state.lastStatus = value; }
  function refreshLabels() { state.refreshCount = (state.refreshCount || 0) + 1; }
  function setMinimized(value) { state.minimized = value; }
  function closeMenu() { if (state.root !== null) state.root.setVisibility(8); }
  ;({state, validate, handleControl, onMenuAction, chosenCommand, MAPS, MODES});`, {
  Process: {findModuleByName: () => nativeMapped ? {} : null},
  Thread: {}, Backtracer: {}, GAME_FINGERPRINT: {},
  createBootExitNativeDiagnostic: () => ({arm() {}}),
  setTimeout() {},
  setImmediate: fn => fn(),
  Java: {available:true,perform:fn=>fn(),scheduleOnMainThread:fn=>fn(),
    use: (name) => {
    assert.equal(name, 'android.view.View');
    return {VISIBLE: {value: 0}, GONE: {value: 8}};
  }},
  ...contract, log() {}, console: {log() {}}
});

const msg = {command: 'start', map: 'crash', mode: 'tdm', enemies: 2, friends: 2};
assert.equal(model.validate(msg), null);
assert.equal(model.validate({...msg, command: 'execute'}), 'INVALID_COMMAND');
assert.equal(model.validate({...msg, map: 'unknown'}), 'INVALID_MAP');
assert.equal(model.validate({...msg, mode: 'unknown'}), 'INVALID_MODE');
assert.equal(model.validate({...msg, enemies: 6, friends: 6}), 'INVALID_ROSTER');
assert.match(model.handleControl(msg), /^WAIT_NATIVE_READY:/);
assert.match(model.handleControl({...msg, command:'menu'}), /^WAIT_NATIVE_READY:/);
assert.match(model.handleControl({...msg, command:'status'}), /not loaded/);
nativeMapped=true;
assert.match(model.handleControl({...msg, command:'status'}), /native library loaded/);
model.state.nativeReady = true; // A successful native LUI + original Lua pcall, not an Activity resume.
model.state.bootStage = 'FENCE_LUA_EXECUTED';
model.state.matchGate={inspect: () => ({code:'NATIVE_MATCH_PREREQUISITES_MISSING',
  missing:['LOCAL_DDL_PROFILE_BOUND','HOST_GADGET_NOT_INTEGRATED']})};
assert.match(model.handleControl(msg), /^NATIVE_MATCH_PREREQUISITES_MISSING:/,
             'Even after native fence, host+profile must not falsely claim a started match');
assert.match(model.handleControl(msg), /HOST_GADGET_NOT_INTEGRATED/);
model.state.nativeReady = false;
model.state.nativeMatchUiContinuity = true;
assert.match(model.handleControl(msg), /^WAIT_NATIVE_READY:/,
  'retained in-match floating controls must never grant new menu/Play privileges');
model.state.nativeReady = true;
model.state.nativeMatchUiContinuity = false;
assert.equal(model.MAPS.length,8,'Original TUI has eight maps');
assert.equal(model.MODES.length,6,'Original TUI has six modes');
assert.equal(model.state.enemies,5,'Original TUI default is five enemy bots');
assert.equal(model.state.friends,0,'Original TUI default has zero friendly bots');
assert.equal(model.chosenCommand('start').difficulty,'Veteran');
assert.equal(model.chosenCommand('start').minutes,60);
model.onMenuAction('difficulty_next');
assert.equal(model.chosenCommand('start').difficulty,'Recruit');
model.onMenuAction('difficulty_prev');
assert.equal(model.chosenCommand('start').difficulty,'Veteran');
model.onMenuAction('duration_next');
assert.equal(model.chosenCommand('start').minutes,65);
model.onMenuAction('duration_prev');
assert.equal(model.chosenCommand('start').minutes,60);

model.onMenuAction('map_next');
assert.equal(model.state.mapIndex, 1);
model.onMenuAction('map_prev');
assert.equal(model.state.mapIndex, 0);
model.onMenuAction('mode_prev');
assert.equal(model.state.modeIndex, model.MODES.length - 1);
for (let i = 0; i < 12; i++) model.onMenuAction('enemy_inc');
for (let i = 0; i < 12; i++) model.onMenuAction('friend_inc');
assert.ok(model.state.enemies + model.state.friends <= 8);
model.onMenuAction('start');
assert.match(model.state.lastStatus, /^NATIVE_MATCH_PREREQUISITES_MISSING:/);
model.onMenuAction('minimize');
assert.equal(model.state.minimized, true);
let visibility = 0;
model.state.root = {getVisibility: () => visibility, setVisibility: next => {visibility = next;}};
model.onMenuAction('close');
assert.equal(visibility, 8, 'Close hides panel but keeps persistent floating ball usable');
model.onMenuAction('map_next');
assert.equal(model.state.mapIndex, 1, 'Closing panel must not disable future menu actions');
model.onMenuAction('toggle_panel');
assert.equal(visibility, 0, 'Floating ball must reopen hidden panel');
model.onMenuAction('toggle_panel');
assert.equal(visibility, 8, 'Floating ball must hide panel when already open');

const realCloseStart = src.indexOf('function closeMenu() {');
const realCloseEnd = src.indexOf('\nfunction setMinimized(value)', realCloseStart);
assert.ok(realCloseStart >= 0 && realCloseEnd > realCloseStart);
const realCloseSource = src.slice(realCloseStart, realCloseEnd);
assert.ok(realCloseSource.includes('state.root.setVisibility'), 'Actual closeMenu must hide view');
assert.equal(realCloseSource.includes('state.closed = true'), false, 'Close must not permanently disable persistent ball');

// Exercise the actual Activity attachment and visibility functions. The
// original MainMenu was verified before this in-match transition, but the new
// Lua VM has no verified menu and must not grant readiness to Play/gear.
const showStart = src.indexOf('function showForActivity(activity) {');
const showEnd = src.indexOf('\nfunction scheduleActivity(activity)', showStart);
const showSource = src.slice(showStart, showEnd);
assert.ok(showStart >= 0 && showEnd > showStart);
let buildCount=0,detachCount=0;
const resumedActivity = {getClass:()=>({getName:()=> 'com.activision.game.MainActivity'}),
  isFinishing:()=>false};
const showContext = {
  GAME_ACTIVITY:'com.activision.game.MainActivity',
  state:{nativeReady:false,nativeMatchUiContinuity:true,root:null,activity:null,
    pendingActivity:null},
  Java:{retain:value=>value},buildPanel:()=>{buildCount++;},
  detachPanel:()=>{detachCount++;},log() {},String
};
vm.runInNewContext(showSource+'\nshowForActivity(activity);',
  {...showContext,activity:resumedActivity});
assert.equal(buildCount,1,
  'Activity reattach during verified native match must restore floating controller');
assert.equal(detachCount,1);
assert.equal(showContext.state.pendingActivity,null);
showContext.state.root=null;
showContext.state.activity=null;
showContext.state.nativeMatchUiContinuity=false;
vm.runInNewContext(showSource+'\nshowForActivity(activity);',
  {...showContext,activity:resumedActivity});
assert.equal(buildCount,1,'an unverified post-reset menu must not attach the controller');
assert.equal(showContext.state.pendingActivity,resumedActivity);

const updateStart = src.indexOf('function scheduleNativeUiUpdate() {');
const updateEnd = src.indexOf('\nfunction beginAutonomousBoot()', updateStart);
assert.ok(updateStart >= 0 && updateEnd > updateStart);
const updateSource = src.slice(updateStart,updateEnd);
let ballVisibility=8,rootVisibility=0;
const uiContext = {
  state:{disposing:false,nativeReady:false,nativeMatchUiContinuity:true,
    ball:{setVisibility:v=>{ballVisibility=v;}},
    root:{setVisibility:v=>{rootVisibility=v;}},info:null},
  Java:{available:true,perform:fn=>fn(),scheduleOnMainThread:fn=>fn(),
    use:()=>({GONE:{value:8},VISIBLE:{value:0}})},
  setImmediate:fn=>fn(),jtext:value=>value,
  showForActivity(){throw Error('not needed with existing ball');},
  fallbackExistingActivity(){throw Error('not needed with existing ball');},
  log() {}
};
vm.runInNewContext(updateSource+'\nscheduleNativeUiUpdate();',uiContext);
assert.equal(ballVisibility,0,'LUI VM rebuild during match must retain ball');
assert.equal(rootVisibility,0,'LUI VM rebuild must not close an open panel');
uiContext.state.nativeMatchUiContinuity=false;
vm.runInNewContext(updateSource+'\nscheduleNativeUiUpdate();',uiContext);
assert.equal(ballVisibility,8,'without verified menu or match, ball must hide');
assert.equal(rootVisibility,8,'without verified menu or match, panel must hide');
uiContext.state.nativeReady=true;
vm.runInNewContext(updateSource+'\nscheduleNativeUiUpdate();',uiContext);
assert.equal(ballVisibility,0,'genuine MainMenu re-verification restores ball');

assert.match(src,/menuRecoveryProbeSource:\s*MAINMENU_RECOVERY_PROBE/);
assert.match(src,/isNativeMatchObserved\(\)/);
assert.match(src,/isNativeMatchPending\(\)\s*\{[^}]*'GUARD'\]/);
assert.match(src,/MAINMENU_RECOVERY_PROBE[\s\S]*?x0d6362796dd5f31d1/,
  'recovery detection must refer to original Play-widget ID');
const recoveryLua = src.match(/const MAINMENU_RECOVERY_PROBE = `([\s\S]*?)`;/)?.[1];
assert.ok(recoveryLua,'bounded read-only menu recovery probe must exist');
assert.match(recoveryLua,/local remaining=512/,
  'recursive native-frame widget scan must have a total work budget');
assert.match(recoveryLua,/if not e or d>12 or remaining<=0 then return false end/,
  'every recursive visit must obey depth and global bounds');
assert.match(recoveryLua,/while c and remaining>0 do/,
  'cyclic sibling chains must stop at the global node/sibling budget');
assert.equal((recoveryLua.match(/remaining=remaining-1/g)||[]).length,2,
  'charge budget for both visited nodes and sibling steps');

for (const marker of [
  'ActivityLifecycleCallbacks', 'registerActivityLifecycleCallbacks',
  'onActivityResumed(activity)', 'getDecorView()', 'decor.addView(root, layout)',
  "Java.cast(activity.getWindow().getDecorView(), Java.use('android.view.ViewGroup'))",
  'decor.addView(ball, ballLayout)', 'FrameLayoutParams.$new(dp(activity, 54), dp(activity, 54))',
  "ball.setTag(jtext('toggle_panel'))", 'ball.setOnTouchListener(state.uiClasses.ballDrag.$new())',
  'setOnTouchListener', 'setTranslationX', 'setTranslationY',
  'setVisibility', 'closeMenu()', 'detachPanel()', 'unregisterActivityLifecycleCallbacks',
  "if (!state.nativeReady)", 'state.pendingActivity = Java.retain(activity)',
  'beginAutonomousBoot()', 'state.nativeSupervisor.tick()',
  'state.nativeSupervisor.dispose()', 'setInterval(() =>',
  'createNativeBootSupervisor', 'FENCE_LUA_SOURCE', 'FENCE_SOURCE_BYTE_LENGTH',
  'MIN_NATIVE_DELAY_MS', 'scheduleNativeUiUpdate()',
  'createMatchRequestGate({',
  'bindNativeVerifier(writer)',
  'state.matchVerifier.set(',
  "makeButton(activity, 'Play', 'start')",
  'createMatchPlayer({',
  'difficulty_prev', 'difficulty_next', 'duration_prev', 'duration_next',
  "root.setVisibility(Java.use('android.view.View').GONE.value)"
]) assert.ok(src.includes(marker), 'Missing in-game menu integration: '+marker);
assert.ok(fs.readFileSync(path.join(__dirname,'match_request_gate.js'),'utf8')
  .includes('LOCAL_DDL_PROFILE_BOUND'), 'Must gate match start on local original DDL profile');

// Android API 29+ extends Application.ActivityLifecycleCallbacks with 14
// pre/post default methods. Android 16 Frida registerClass requires ALL 21
// interface methods, not just 7 legacy callbacks. Exercise the exact
// Java.registerClass methods object with a fake bridge, not only string grep.
const lifecycleSource = src.slice(src.indexOf('function registerUiClasses() {'),
                                  src.indexOf('\nfunction registerReceiver(app)'));
assert.ok(lifecycleSource.startsWith('function registerUiClasses() {'));
const legacy = [
  'onActivityCreated', 'onActivityStarted', 'onActivityResumed',
  'onActivityPaused', 'onActivityStopped', 'onActivitySaveInstanceState',
  'onActivityDestroyed'
];
const phases = ['Created', 'Started', 'Resumed', 'Paused', 'Stopped',
                'SaveInstanceState', 'Destroyed'];
const added = phases.flatMap(p => [`onActivityPre${p}`, `onActivityPost${p}`]);

function simulatedRegistration(reflectedNames) {
  const registrations = new Map();
  const context = {
    state: {uiClassReady: false, activity: null, root: null, ball: null, ballDrag: null, drag: null},
    Java: {
      use: id => id === 'android.app.Application$ActivityLifecycleCallbacks'
        ? {name: id, class: {getMethods: () => reflectedNames.map(name => ({getName: () => name}))}}
        : {name: id},
      registerClass: descriptor => {
        assert.ok(!registrations.has(descriptor.name), 'duplicate registered class');
        registrations.set(descriptor.name, descriptor);
        return {$new: () => ({})};
      },
      retain: value => value,
      scheduleOnMainThread: callback => callback()
    },
    scheduleActivity() {},
    detachPanel() {},
    onMenuAction() {},
    log() {},
    String
  };
  vm.runInNewContext(lifecycleSource + '\nregisterUiClasses();', context);
  assert.equal(registrations.size, 4, 'click, panel drag, floating ball drag, lifecycle classes registered');
  const ballDrag = registrations.get('com.wzm.offline.internal.EmbeddedMenuBallDrag');
  assert.ok(ballDrag && typeof ballDrag.methods.onTouch === 'function', 'persistent floating ball drag class registered');
  const lifecycle = registrations.get('com.wzm.offline.internal.EmbeddedMenuLifecycle');
  assert.ok(lifecycle, 'lifecycle class not registered');
  assert.equal(context.state.uiClassReady, true);
  assert.equal(lifecycle.implements[0].name, 'android.app.Application$ActivityLifecycleCallbacks');
  return lifecycle;
}

const standard = [...legacy, ...added];
const os13 = simulatedRegistration(standard);
assert.deepEqual(Object.keys(os13.methods).sort(), standard.slice().sort(),
                 'Android 13/14 cannot receive Android16-only callback extras');

const oos16Extensions = ['onActivityConfigurationChanged', 'onActivityUnannouncedVendorEvent'];
const lifecycleClass = simulatedRegistration([...standard, ...oos16Extensions]);
const actual = Object.keys(lifecycleClass.methods);
const expected = [...standard, ...oos16Extensions];
assert.equal(actual.length, 23, 'must implement 7 legacy + 14 API29+ + 2 vendor hooks');
assert.deepEqual(actual.slice().sort(), expected.slice().sort(),
                 'Frida interface implementation must cover all reflected methods');
for (const name of standard) {
  const expectedArguments = name.includes('Created') || name.includes('SaveInstanceState') ? 2 : 1;
  assert.equal(lifecycleClass.methods[name].length, expectedArguments, `${name} has wrong signature arity`);
}
for (const name of added) {
  assert.equal(lifecycleClass.methods[name]({}, {}), undefined, `${name} must be a safe no-op`);
}
assert.equal(lifecycleClass.methods.onActivityConfigurationChanged.length, 1,
             'OxygenOS16 configuration changed must have one Activity argument');
assert.equal(lifecycleClass.methods.onActivityConfigurationChanged({}), undefined);
assert.equal(lifecycleClass.methods.onActivityUnannouncedVendorEvent({}), undefined);

assert.equal(src.includes('TYPE_APPLICATION_OVERLAY'), false,
  'No standalone OS overlay window used in source');
const bundle = fs.readFileSync(path.join(__dirname, 'libgadget.script.so'));
assert.ok(bundle.length > 800_000, 'Frida 17 Java bridge must be bundled');
for (const token of ['EmbeddedMenuLifecycle', 'EmbeddedMenuClick', 'EmbeddedMenuDrag', 'EmbeddedMenuBallDrag']) {
  assert.ok(bundle.includes(Buffer.from(token)), 'Bundled menu callback missing: '+token);
}
console.log('PASS v2: original 8 maps/6 modes/5+0 Veteran defaults, native match unported gate, difficulty/time selector, floating ball 54dp/tap toggle/drag, Android16 lifecycle and bundled Frida17 script');
