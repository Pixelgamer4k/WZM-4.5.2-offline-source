import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {FENCE_LUA_SOURCE, FENCE_SOURCE_SHA256, FENCE_SOURCE_BYTE_LENGTH} from './fence_embedded.js';
import {createNativeBootSupervisor, MIN_NATIVE_DELAY_MS, WZM_452_GUARDS} from './native_boot.js';

const expectedLua = crypto.createHash('sha256').update(FENCE_LUA_SOURCE, 'utf8').digest('hex');
assert.equal(FENCE_SOURCE_SHA256, expectedLua, 'embedded original Lua SHA256');
assert.equal(FENCE_SOURCE_BYTE_LENGTH, 5233);
assert.ok(FENCE_LUA_SOURCE.includes('local C=LUI.FenceGroup'));
assert.ok(FENCE_LUA_SOURCE.includes('MenuBuilder'));
assert.equal(FENCE_LUA_SOURCE.includes('adb '), false);

const nativeSource = fs.readFileSync(new URL('./native_boot.js', import.meta.url), 'utf8');
const entrySource = fs.readFileSync(new URL('./entry.js', import.meta.url), 'utf8');
assert.ok(entrySource.includes('if (!state.nativeReady)'), 'Activity attach gated on native ready');
assert.ok(entrySource.includes('root.setVisibility(Java.use(\'android.view.View\').GONE.value)'), 'panel initially hidden');
assert.ok(entrySource.includes('beginAutonomousBoot();'), 'standalone boot starts from Gadget.init');
assert.ok(!nativeSource.includes('Script.evaluate(') && !nativeSource.includes('Script.load('),
          'No experimental host JS evaluation before standalone core works');
assert.ok(!entrySource.includes('TYPE_APPLICATION_OVERLAY'));

class Ptr {
  constructor(value) { this.value = value; }
  add(n) { return new Ptr(this.value + n); }
  compare(b) { return this.value === b.value ? 0 : this.value < b.value ? -1 : 1; }
  isNull() { return this.value === 0; }
  toString() { return '0x' + this.value.toString(16); }
}
const P = n => new Ptr(n);

function fixture() {
  let now = 0;
  let libAvailable = false;
  let arch = 'arm64';
  let corrupt = false;
  let luaHolder = P(0x70001000);
  let luaState = P(0x70002000);
  let top = P(0x70003000);
  let luaPcallResult = 0;
  let luaLoadResult = 0;
  let attached = null;
  let attachedCount = 0;
  let detachedCount = 0;
  let restores = 0;
  let loaded = 0;
  const nativeEvents = [];
  const stages = [];
  const ready = [];
  const base = P(0x100000000);
  const module = {name: 'libgame.so', base, size: 0x0de4b000};
  const code = {base: base.add(0x10a6000), size: 0x4290170, protection: 'r-x'};
  const data = {base: base.add(0x5337170), size: 0x1b6af8, protection: 'r--'};
  const heap = {base: P(0x70000000), size: 0x100000, protection: 'rw-'};
  const guards = new Map(WZM_452_GUARDS.prologues.map(a => [base.value+a.offset,a.hex]));
  const runtime = {
    now: () => now,
    arch: () => arch,
    findModule: () => libAvailable ? module : null,
    range(address) {
      for (const r of [code,data,heap])
        if (address.value >= r.base.value && address.value < r.base.value + r.size)
          return r;
      return null;
    },
    hexBytes(address, count) {
      let match = guards.get(address.value);
      if (match === undefined) throw new Error('unexpected opcode lookup');
      if (corrupt) match='00000000'+match.slice(8);
      return match.slice(0,count*2);
    },
    readPointer(address) {
      if (address.value === base.value + WZM_452_GUARDS.luaSlot) return luaHolder;
      if (address.value === luaHolder.value) return luaState;
      if (address.value === luaState.value + 0x28) return top;
      throw new Error('unexpected pointer read '+address);
    },
    writePointer(address,value) {
      assert.equal(address.value,luaState.value+0x28,'stack restored to active Lua VM');
      assert.equal(value.value,top.value,'original top pointer retained');
      restores++;
    },
    nullPointer: () => P(0),
    readUtf8: (value) => value.isNull() ? '' : 'installed layer=true cond=true pd=9',
    createBindings({source,sourceByteLength}) {
      assert.equal(source,FENCE_LUA_SOURCE);
      assert.equal(sourceByteLength,5233);
      return {
        load(_L,_buffer,length) { loaded++;assert.equal(length,5233);return luaLoadResult; },
        pcall() { return luaPcallResult; },
        toString() { return P(0x70004000); },
        fenceBuffer: P(0x70005000),chunkName: P(0x70006000)
      };
    },
    attach(address,onFrame) {
      assert.equal(address.value,base.value+WZM_452_GUARDS.frame);
      assert.equal(attachedCount,0,'never install a second native hook');
      attachedCount++;
      attached = onFrame;
      return {detach() {detachedCount++;attached=null;}};
    }
  };
  const supervisor = createNativeBootSupervisor({
    runtime, fenceSource: FENCE_LUA_SOURCE,
    fenceByteLength: FENCE_SOURCE_BYTE_LENGTH,
    startMs: 0,
    notifyStage: x=>stages.push(x),
    notifyReady: x=>ready.push(x),
    log: x=>nativeEvents.push(x)
  });
  return {
    supervisor, stages, ready, nativeEvents,
    clock(t) {now=t;},
    setLib(flag) {libAvailable=flag;},
    setArch(a) {arch=a;},
    corrupt(flag) {corrupt=flag;},
    pcallFail(value) {luaPcallResult=value;},
    loadFail(value) {luaLoadResult=value;},
    setLuaState(n) {luaState=P(n);},
    setLuaHolder(n) {luaHolder=P(n);},
    frame(n=1) {for(let i=0;i<n;i++){assert.ok(attached);attached();}},
    get attachedCount() {return attachedCount;},
    get detachedCount() {return detachedCount;},
    get restores() {return restores;},
    get loaded() {return loaded;}
  };
}

assert.equal(MIN_NATIVE_DELAY_MS,15000);
assert.throws(() => createNativeBootSupervisor({
  runtime: fixture().supervisor, fenceSource: FENCE_LUA_SOURCE,
  fenceByteLength: 5233, minDelayMs: 1000
}), /15-second grace period/);

{
  const f=fixture();
  f.setLib(true);
  f.clock(14999);f.supervisor.tick();
  assert.equal(f.attachedCount,0,'native Interceptor not attached before >=15s');
  assert.equal(f.supervisor.snapshot().bootStage,'WAIT_15S');
  f.clock(15000);f.supervisor.tick();
  assert.equal(f.attachedCount,1);
  assert.equal(f.supervisor.snapshot().bootStage,'WAIT_LUI_FRAME');
  f.frame(9);
  assert.equal(f.loaded,0,'original Lua not run until tenth frame');
  f.frame();
  assert.equal(f.loaded,1);
  assert.equal(f.restores,1,'Lua stack top restored on success');
  assert.equal(f.supervisor.snapshot().bootStage,'FENCE_LUA_EXECUTED');
  assert.equal(f.supervisor.snapshot().nativeReady,true);
  assert.deepEqual(f.ready,[true]);
  f.frame(10);
  assert.equal(f.loaded,2,'fence re-applied every ten native frames');
  f.supervisor.tick();
  assert.equal(f.attachedCount,1,'tick cannot install duplicate native hook');
  // Simulate LUI VM reset; presence alone is not a successful fence execution.
  f.setLuaState(0x70002100);
  f.pcallFail(1);
  f.frame(10);
  assert.equal(f.supervisor.snapshot().nativeReady,false,'VM reset revokes native ready');
  assert.equal(f.supervisor.snapshot().bootStage,'WAIT_FENCE_LUA');
  assert.deepEqual(f.ready,[true,false]);
  assert.equal(f.restores,3,'Lua stack restored on pcall error');
  f.pcallFail(0);
  f.frame(10);
  assert.equal(f.supervisor.snapshot().nativeReady,true,'VM rearm only after successful Lua');
  assert.deepEqual(f.ready,[true,false,true]);
  f.clock(50000);f.supervisor.tick();
  assert.equal(f.supervisor.snapshot().nativeReady,false,'lost frame heartbeat hides floating ball');
  assert.equal(f.attachedCount,1,'heartbeat loss does not install duplicate hook');
  f.supervisor.dispose();
  assert.equal(f.detachedCount,1);
  assert.equal(f.supervisor.snapshot().bootStage,'DISPOSED');
}

{
  const f=fixture();
  f.clock(16000);f.supervisor.tick();
  assert.equal(f.attachedCount,0,'missing module waits instead of attaching to other lib');
  assert.equal(f.supervisor.snapshot().bootStage,'WAIT_LIBGAME');
  f.setLib(true);f.corrupt(true);f.supervisor.tick();
  assert.equal(f.attachedCount,0,'changed native opcode fails closed');
  assert.equal(f.supervisor.snapshot().bootStage,'NATIVE_UNSUPPORTED');
  f.corrupt(false);f.supervisor.tick();
  assert.equal(f.attachedCount,0,'mismatch must not initiate unbounded attach retries');
}

{
  const f=fixture();
  f.clock(15000);f.setLib(true);f.setArch('x64');f.supervisor.tick();
  assert.equal(f.attachedCount,0,'non ARM64 target rejected');
  assert.equal(f.supervisor.snapshot().bootStage,'NATIVE_UNSUPPORTED');
}

{
  const f=fixture();
  f.clock(15000);f.setLib(true);f.supervisor.tick();
  f.setLuaHolder(0);f.frame(10);
  assert.equal(f.supervisor.snapshot().nativeReady,false,'missing Lua VM must not show ball');
  assert.equal(f.supervisor.snapshot().bootStage,'WAIT_LUI_STATE');
  f.setLuaHolder(0x70001000);f.loadFail(1);f.frame(10);
  assert.equal(f.supervisor.snapshot().nativeReady,false,'Lua load failed, no native readiness');
  assert.equal(f.restores,1);
  f.loadFail(0);f.frame(10);
  assert.equal(f.supervisor.snapshot().nativeReady,true);
}

console.log('PASS standalone Frida-native mock: pinned Lua source, >=15s gate, one validated ARM64 hook, tenth-frame Lua, stack restore, VM reset/rearm, heartbeat timeout, fail-closed bytes and arch, no host/bots');
