import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {WeaponCatalogPort} from '../unlock/weapon_catalog.js';
import {UnifiedUnlock} from '../unlock/unified_unlock.js';
import {UnlockController, buildLuaProbe, parseLuaProbe} from '../unlock/controller.js';
import {EMBEDDED_LUA} from '../unlock/payloads.js';

test('four embedded original unlock Lua strings match authoritative Mac sources byte-for-byte', () => {
  for (const [key, entry] of Object.entries(EMBEDDED_LUA)) {
    const source = readFileSync(new URL(
      '../../../../WarzoneMobileOffline/' + entry.source, import.meta.url));
    assert.deepEqual(Buffer.from(entry.text, 'utf8'), source, key + ' original Lua differs');
    assert.equal(source.length, entry.byteLength);
    assert.equal(createHash('sha256').update(source).digest('hex'), entry.sha256);
  }
});

test('native boot/entry wiring retains a single LUI owner and exact original catalog RVAs', () => {
  const boot = readFileSync(new URL('../native_boot.js', import.meta.url), 'utf8');
  const entry = readFileSync(new URL('../entry.js', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('../unlock/weapon_catalog.js', import.meta.url), 'utf8');
  const original = readFileSync(new URL(
    '../../../../WarzoneMobileOffline/analysis/frida_tools/lua_bridge/frontend_weapon_catalog.py',
    import.meta.url), 'utf8');
  assert.match(boot, /onVerifiedLuiFrame\(\{L, native, runtime,\s*moduleBase:\s*native\.moduleBase,\s*identity,\s*menuReady:true\}\)/);
  assert.match(boot, /menuReady:false/,'original LUI frame remains owned after the game leaves its main menu');
  assert.match(boot, /onLuiReset\(\)/);
  assert.match(entry, /unlockPort\.onVerifiedLuiFrame\(context\)/);
  assert.match(entry, /unlockPort\.onLuaReset\(\)/);
  assert.match(entry, /unlockPort\.heartbeat\(\)/);
  assert.equal((boot.match(/runtime\.attach\(/g) ?? []).length, 1);
  assert.doesNotMatch(catalog, /Interceptor\.attach\(/);
  for (const anchor of ['0x635b940', '0xd0', '0x530', '0x28fe554',
    '0xd101c3ff', '0x54bb7e8', '0x6cb1ab0', '0x6cb1abc']) {
    assert.ok(original.includes(anchor), 'missing original catalog anchor ' + anchor);
    assert.ok(catalog.includes(anchor), 'missing port catalog anchor ' + anchor);
  }
  assert.match(original, /j<4&&pos<refs\.length/);
  assert.match(catalog, /REGISTER_PER_FRAME = 4/);
});

// Pure JavaScript test-only Frida memory model. It contains only a synthetic
// map of the original 4.5.2 catalog RVAs and a fake NativeFunction callback.
// No game, device, network, Frida session, ADB or installed APK is accessed.
const POOL_RVA = 0x635b940 + 60 * 0xd0;
const CALLBACK_RVA = 0x28fe554;
const COUNT_RVA = 0x6cb1ab0;
const BUSY_RVA = 0x6cb1abc;
const CLIENT_RVA = 0x54bb7e8;
const STRIDE = 0x530;
const OPCODE = 0xd101c3ff;

class FakePtr {
  constructor(memory, value) { this.memory = memory; this.value = value; }
  add(delta) { return new FakePtr(this.memory, this.value + delta); }
  compare(other) { return Math.sign(this.value - other.value); }
  isNull() { return this.value === 0; }
  readPointer() { return this.memory.ptr(this.memory.pointers.get(this.value) ?? 0); }
  readU32() {
    if (!this.memory.u32.has(this.value)) throw new Error('unmapped u32 ' + this.value.toString(16));
    return this.memory.u32.get(this.value);
  }
  readU8() {
    if (!this.memory.u8.has(this.value)) throw new Error('unmapped u8 ' + this.value.toString(16));
    return this.memory.u8.get(this.value);
  }
  readByteArray(length) {
    if (!this.memory.strings.has(this.value)) throw new Error('unmapped string');
    const bytes = new Uint8Array(length);
    const encoded = new TextEncoder().encode(this.memory.strings.get(this.value));
    bytes.set(encoded.subarray(0, length));
    return bytes.buffer;
  }
  readUtf8String(_max) {
    if (!this.memory.strings.has(this.value)) throw new Error('unmapped string');
    return this.memory.strings.get(this.value);
  }
  toString() { return '0x' + this.value.toString(16); }
}

class FakeMemory {
  constructor({ names = ['m4', 'ak47', 'mp5', 'pistol', 'knife'],
    count = 0, busy = 0, state = 2, empty = false,
    callbackOpcode = OPCODE, callbackMode = 'full', capacity = null,
    stride = STRIDE } = {}) {
    this.baseAddress = 0x100000000;
    this.base = this.ptr(this.baseAddress);
    this.pointers = new Map();
    this.u32 = new Map();
    this.u8 = new Map();
    this.strings = new Map();
    this.regions = [];
    this.calls = [];
    this.callbackMode = callbackMode;
    this.callbackConstructed = 0;
    this.stringAllocations = 0;

    const n = capacity ?? names.length;
    const pool = this.baseAddress + POOL_RVA;
    const callback = this.baseAddress + CALLBACK_RVA;
    const list = 0x200000000;
    const bits = 0x300000000;
    const client = 0x400000000;
    this.addRegion(pool, 0x100);
    this.addRegion(callback, 0x100, 'r-x');
    this.addRegion(this.baseAddress + COUNT_RVA, 0x200);
    this.addRegion(this.baseAddress + CLIENT_RVA, 0x100);
    this.addRegion(list, Math.max(n * stride, 1));
    this.addRegion(bits, Math.max(Math.ceil(n / 32) * 4, 4));
    this.addRegion(client, 0x100);
    this.pointers.set(pool, list);
    this.pointers.set(pool + 0xb0, bits);
    this.u32.set(pool + 16, n);
    this.u32.set(pool + 20, stride);
    this.u32.set(callback, callbackOpcode);
    this.u32.set(this.baseAddress + COUNT_RVA, count);
    this.u8.set(this.baseAddress + BUSY_RVA, busy);
    this.pointers.set(this.baseAddress + CLIENT_RVA, client);
    this.u32.set(client + 8, state);
    for (let i = 0; i < Math.ceil(n / 32); i++) this.u32.set(bits + i * 4, 0);
    for (let i = 0; i < Math.min(names.length, n); i++) {
      if (!empty) {
        const b = bits + (i >>> 5) * 4;
        this.u32.set(b, (this.u32.get(b) | (0x80000000 >>> (i & 31))) >>> 0);
      }
      const str = 0x500000000 + i * 0x100;
      this.addRegion(str, 0x100);
      this.strings.set(str, names[i]);
      this.pointers.set(list + i * stride + 8, str);
    }
  }
  ptr(x) { return new FakePtr(this, x); }
  addRegion(start, size, protection = 'rw-') { this.regions.push({start, size, protection}); }
  range(pointer) {
    const r = this.regions.find(x => x.start <= pointer.value &&
      pointer.value < x.start + x.size);
    return r ? {base: this.ptr(r.start), size: r.size, protection: r.protection} : null;
  }
  nativeFunction(address, _ret, _args) {
    assert.equal(address.value, this.baseAddress + CALLBACK_RVA);
    this.callbackConstructed++;
    return (index, string) => {
      if (this.callbackMode === 'throw' && index === 3) throw Error('MOCK_CALLBACK_EXCEPTION');
      this.calls.push({index, name: this.strings.get(string.value)});
      const count = this.callbackMode === 'zero' ? 0 :
        this.callbackMode === 'partial' ? 1 : index;
      this.u32.set(this.baseAddress + COUNT_RVA, count);
    };
  }
  allocateString(value) {
    this.stringAllocations++;
    const address = 0x600000000 + this.stringAllocations * 0x1000;
    this.addRegion(address, 0x1000);
    this.strings.set(address, value);
    return this.ptr(address);
  }
  busy(value) { this.u8.set(this.baseAddress + BUSY_RVA, value); }
  state(value) {
    this.u32.set(this.pointers.get(this.baseAddress + CLIENT_RVA) + 8, value);
  }
  catalogCount() { return this.u32.get(this.baseAddress + COUNT_RVA); }
}

function withFakeFrida(settings, fn) {
  const memory = new FakeMemory(settings);
  const old = {Process: globalThis.Process, Memory: globalThis.Memory,
    NativeFunction: globalThis.NativeFunction};
  globalThis.Process = {
    findRangeByAddress: pointer => memory.range(pointer),
  };
  globalThis.Memory = {
    allocUtf8String: value => memory.allocateString(value),
  };
  globalThis.NativeFunction = function(...args) { return memory.nativeFunction(...args); };
  try { return fn(memory); }
  finally {
    for (const name of Object.keys(old)) {
      if (old[name] === undefined) delete globalThis[name];
      else globalThis[name] = old[name];
    }
  }
}

function catalogHarness(settings = {}) {
  return withFakeFrida(settings, memory => {
    const events = [];
    const catalog = new WeaponCatalogPort({notify: x => events.push(x)});
    catalog.start();
    for (let i = 0; i < 5 && !catalog.completed() && catalog.stage !== 'FAILED'; i++) {
      catalog.tick({moduleBase: memory.base});
    }
    return {stage: catalog.stage, snapshot: catalog.snapshot(),
      events, calls: memory.calls, callbackConstructed: memory.callbackConstructed,
      finalCount: memory.catalogCount()};
  });
}

test('catalog: original callback receives resident names/indices in batches of four', () => {
  const result = catalogHarness();
  assert.equal(result.stage, 'COMPLETE');
  assert.equal(result.snapshot.resident, 5);
  assert.equal(result.snapshot.processed, 5);
  assert.equal(result.snapshot.frameCount, 2);
  assert.deepEqual(result.calls.map(x => x.index), [1,2,3,4,5]);
  assert.deepEqual(result.calls.map(x => x.name), ['m4','ak47','mp5','pistol','knife']);
  assert.equal(result.finalCount, 5);
  assert.equal(result.events.at(-1).event, 'CATALOG_REGISTERED');
});

test('catalog: empty resident bitset never registers or reports successful unlock', () => {
  const result = catalogHarness({empty: true});
  assert.equal(result.stage, 'FAILED');
  assert.equal(result.snapshot.error, 'CATALOG_NATIVE_EXCEPTION');
  assert.ok(result.events.some(x => x.detail.includes('NO_RESIDENT_WEAPON_ASSETS')));
  assert.equal(result.calls.length, 0);
});

test('catalog: game busy flag prevents enumeration and original callback until idle', () => {
  withFakeFrida({busy: 1}, memory => {
    const catalog = new WeaponCatalogPort();
    catalog.start();
    catalog.tick({moduleBase: memory.base});
    assert.equal(catalog.stage, 'PENDING');
    assert.equal(memory.callbackConstructed, 0);
    assert.equal(memory.calls.length, 0);
    memory.busy(0);
    catalog.tick({moduleBase: memory.base});
    assert.equal(memory.calls.length, 4);
    memory.busy(1);
    catalog.tick({moduleBase: memory.base});
    assert.equal(memory.calls.length, 4);
    memory.busy(0);
    catalog.tick({moduleBase: memory.base});
    assert.equal(catalog.stage, 'COMPLETE');
    assert.equal(memory.calls.length, 5);
  });
});

test('catalog: busy status returning during final callback fails the readback gate', () => {
  withFakeFrida({}, memory => {
    const makeFunction = memory.nativeFunction.bind(memory);
    memory.nativeFunction = (...args) => {
      const original = makeFunction(...args);
      return (idx, name) => {
        original(idx, name);
        if (idx === 5) memory.busy(1);
      };
    };
    const catalog = new WeaponCatalogPort();
    catalog.start();
    catalog.tick({moduleBase:memory.base});
    catalog.tick({moduleBase:memory.base});
    assert.equal(catalog.stage, 'FAILED');
    assert.equal(catalog.error, 'ORIGINAL_CATALOG_POSTCHECK_FAILED');
  });
});

test('catalog: guarded client state >=5 defers native registrations', () => {
  withFakeFrida({state: 7}, memory => {
    const catalog = new WeaponCatalogPort();
    catalog.start();
    catalog.tick({moduleBase: memory.base});
    assert.equal(catalog.stage, 'REGISTERING');
    assert.equal(memory.calls.length, 0);
    memory.state(4);
    catalog.tick({moduleBase: memory.base});
    assert.equal(memory.calls.length, 4);
  });
});

test('catalog: incorrect original callback opcode fails before NativeFunction construction', () => {
  const result = catalogHarness({callbackOpcode: 0xdeadbeef});
  assert.equal(result.stage, 'FAILED');
  assert.equal(result.callbackConstructed, 0);
  assert.equal(result.calls.length, 0);
  assert.ok(result.events.some(x => x.detail.includes('ORIGINAL_CATALOG_CALLBACK_OPCODE_MISMATCH')));
});

test('catalog: callback exception stops further registration and records partial count', () => {
  const result = catalogHarness({callbackMode: 'throw'});
  assert.equal(result.stage, 'FAILED');
  assert.equal(result.snapshot.processed, 2);
  assert.deepEqual(result.calls.map(x => x.index), [1,2]);
  assert.ok(result.events.at(-1).detail.includes('MOCK_CALLBACK_EXCEPTION'));
});

test('catalog: successful native calls but zero/partial readback cannot be called complete', () => {
  for (const callbackMode of ['zero', 'partial']) {
    const result = catalogHarness({callbackMode});
    assert.equal(result.stage, 'FAILED');
    assert.equal(result.snapshot.error, 'ORIGINAL_CATALOG_POSTCHECK_FAILED');
    assert.equal(result.calls.length, 5);
  }
});

test('catalog: existing partial registry is not mistaken for fully populated', () => {
  const partial = catalogHarness({count: 2});
  assert.equal(partial.stage, 'FAILED');
  assert.equal(partial.snapshot.error, 'PARTIAL_CATALOG_ALREADY_REGISTERED');
  assert.equal(partial.calls.length, 0);
  const full = catalogHarness({count: 5});
  assert.equal(full.stage, 'ALREADY_REGISTERED');
  assert.equal(full.calls.length, 0);
  assert.equal(full.snapshot.catalogCount, 5);
});

test('catalog: invalid pool shape and all-unreadable resident names fail closed', () => {
  for (const settings of [
    {stride: 0x400}, {capacity: 2049}, {capacity: 0}, {names: ['invalid-name!', 'bad name']},
  ]) {
    const result = catalogHarness(settings);
    assert.equal(result.stage, 'FAILED');
    assert.equal(result.calls.length, 0);
  }
});

test('catalog: bound of 1200 frames has an explicit error', () => {
  withFakeFrida({busy: 1}, memory => {
    const catalog = new WeaponCatalogPort();
    catalog.start();
    catalog.frameCount = 1200;
    catalog.tick({moduleBase: memory.base});
    assert.equal(catalog.stage, 'FAILED');
    assert.equal(catalog.error, 'CATALOG_FRAME_TIMEOUT');
    assert.equal(memory.calls.length, 0);
  });
});

test('unified: missing LUI frames time out pending original catalog exactly once', () => {
  let now = 100;
  const events = [];
  const port = new UnifiedUnlock({clock: () => now, notify: x => events.push(x)});
  const req = port.request('ownership');
  assert.equal(req.accepted, true);
  now += 120001;
  port.heartbeat();
  assert.equal(port.pendingOwnership, null);
  assert.equal(port.catalog.stage, 'FAILED');
  assert.equal(events.filter(x => x.event === 'RESULT' &&
    x.requestId === req.requestId).length, 1);
  assert.ok(events.some(x => x.code === 'ORIGINAL_CATALOG_TIMEOUT'));
  assert.equal(port.snapshot().status, 'ORIGINAL_CATALOG_TIMEOUT');
  assert.equal(port.snapshot().controller.queue.length, 0);
});

test('unified: full editor mode cites unverified original catalog as an explicit blocker', () => {
  const port = new UnifiedUnlock();
  const locked = port.request('full');
  assert.equal(locked.accepted,false);
  assert.equal(locked.code,'UI_PORT_INCOMPLETE');
  assert.ok(locked.missing.includes('ORIGINAL_WEAPON_CATALOG_NOT_VERIFIED'));
  assert.ok(locked.missing.includes('PREVIEW_GUARD_NOT_OWNED'));
  port.dispose();
});

test('unified: queued inspect receives timeout event and status without any LUI frames', () => {
  let now = 10;
  const events = [];
  const port = new UnifiedUnlock({clock:()=>now,notify:x=>events.push(x)});
  const request = port.request('inspect');
  now = 120011;
  port.heartbeat();
  assert.equal(port.snapshot().status,'LUI_FRAME_TIMEOUT');
  assert.equal(port.snapshot().controller.queue.length,0);
  assert.equal(events.filter(x=>x.event==='RESULT' && x.requestId===request.requestId &&
    x.code==='LUI_FRAME_TIMEOUT').length,1);
  port.dispose();
});

test('unified: same-millisecond explicit requests get unique ids', () => {
  const port = new UnifiedUnlock({clock: () => 500});
  const one = port.request('ownership');
  port.onLuaReset();
  const two = port.request('ownership');
  assert.notEqual(one.requestId, two.requestId);
  port.dispose();
});

test('unified: callback failure after partial catalog refuses re-registering on same LUI', () => {
  withFakeFrida({callbackMode: 'throw'}, memory => {
    const events = [];
    const port = new UnifiedUnlock({notify: x => events.push(x)});
    const first = port.request('ownership');
    port.onVerifiedLuiFrame({moduleBase: memory.base, L: {}});
    assert.equal(port.catalog.stage, 'FAILED');
    assert.equal(memory.calls.length, 2);
    const retry = port.request('ownership');
    assert.equal(retry.accepted, false);
    assert.equal(retry.code, 'PARTIAL_CATALOG_REQUIRES_LUI_RESET');
    assert.equal(memory.calls.length, 2);
    assert.equal(events.filter(x => x.requestId === first.requestId &&
      x.event === 'RESULT').length, 1);
    assert.equal(port.snapshot().status, 'ORIGINAL_CATALOG_UNAVAILABLE');
    port.dispose();
  });
});

test('unified: full Lua queue reports a final failure for an accepted catalog request', () => {
  withFakeFrida({count:5}, memory => {
    const events = [];
    const port = new UnifiedUnlock({notify:x=>events.push(x)});
    port.controller.maxQueue = 1;
    const inspect = port.request('inspect');
    const ownership = port.request('ownership');
    assert.equal(inspect.accepted,true);
    assert.equal(ownership.accepted,true);
    // A synchronous readback is enough to finish this already-populated pool,
    // but the controller's capacity is still occupied by the inspect request.
    port.onVerifiedLuiFrame({moduleBase:memory.base,L:{}});
    const outcome = events.find(x=>x.event==='RESULT' && x.requestId===ownership.requestId);
    assert.equal(outcome.code,'QUEUE_FULL');
    assert.equal(outcome.status,'FAILED');
    assert.equal(port.pendingOwnership,null);
    assert.equal(memory.calls.length,0);
    port.dispose();
  });
});

test('unified: a reset aborts a pending request and clears catalog ownership', () => {
  const events = [];
  const port = new UnifiedUnlock({notify: x => events.push(x)});
  const req = port.request('ownership');
  port.onLuaReset();
  assert.equal(port.snapshot().pendingOwnership, null);
  assert.equal(port.snapshot().catalog.stage, 'NOT_REQUESTED');
  assert.equal(events.filter(x => x.requestId === req.requestId &&
    x.code === 'LUA_STATE_CHANGED').length, 1);
  assert.equal(port.snapshot().controller.currentLuaEpoch, null);
});

const probeText = (data = {}) => {
  const f = {epoch:'gen-A',prog:true,loot:true,ownerQuery:true,levelQuery:true,
    fences:true,clientQuery:true,playerData:true,hub:true,
    base:false,ext:false,level:false,baseActive:false,extActive:false,
    levelActive:false,clientShim:false,...data};
  return 'WZMP452|' + Object.entries(f).map(([k,v])=>k+'='+v).join('|');
};

function makeControllerEngine(overrides = {}) {
  const engine = {
    data: {},
    runs: [],
    lastProbeToken: null,
    getLuaState: () => ({ptr: 'fake'}),
    frontendSnapshot: () => ({catalogCount: 5, catalogBusy: 0}),
    runLua(_state, script) {
      engine.runs.push(script.name);
      if (script.name === 'lui_probe') {
        const match = script.text.match(/then E='([^']+)'/);
        engine.lastProbeToken = match?.[1] ?? null;
        return {ok:true,code:'OK',value:probeText(engine.data)};
      }
      if (script.name === 'offline_unlocks') {
        engine.data.base = true;
        engine.data.baseActive = true;
      }
      if (script.name === 'offline_unlocks_ext') {
        engine.data.ext = true;
        engine.data.extActive = true;
      }
      if (script.name === 'offline_unlocks_level') {
        engine.data.level = true;
        engine.data.levelActive = true;
      }
      return {ok:true,code:'OK',value:'installed'};
    },
  };
  return Object.assign(engine, overrides);
}

test('unified: actual mock catalog completion progresses to original ownership Lua stages', () => {
  withFakeFrida({}, memory => {
    let now = 5000;
    const events = [];
    const sourceRuns = [];
    const port = new UnifiedUnlock({notify: x => events.push(x),clock:()=>now});
    const flags = {
      epoch:'actual-frame-A',base:false,baseActive:false,
      ext:false,extActive:false,level:false,levelActive:false,
    };
    port.runLua = (_L, script) => {
      if (script.name === 'lui_probe')
        return {ok:true,value:probeText(flags)};
      sourceRuns.push(script.name);
      if (script.name === 'offline_unlocks') { flags.base=true; flags.baseActive=true; }
      if (script.name === 'offline_unlocks_ext') { flags.ext=true; flags.extActive=true; }
      if (script.name === 'offline_unlocks_level') { flags.level=true; flags.levelActive=true; }
      return {ok:true,value:'installed original source'};
    };
    const request = port.request('ownership');
    const context = {moduleBase:memory.base,L:{ptr:'original-lui-state'}};
    for(let i=0;i<5;i++) {now += 500;port.onVerifiedLuiFrame(context);}
    assert.deepEqual(sourceRuns,
      ['offline_unlocks','offline_unlocks_ext','offline_unlocks_level']);
    assert.equal(memory.catalogCount(),5);
    assert.equal(port.snapshot().controller.lastResult.code,'OWNERSHIP_WRAPPERS_INSTALLED');
    const result = events.find(x=>x.event==='RESULT' && x.requestId===request.requestId);
    assert.equal(result.ownershipWrappersOnly,true);
    assert.equal(result.uiReady,false);
    assert.equal(port.snapshot().catalog.stage,'COMPLETE');
    port.dispose();
  });
});

test('unified: a new LUI generation can reuse registered native assets without repeating callbacks', () => {
  withFakeFrida({}, memory => {
    const port = new UnifiedUnlock();
    const flags={epoch:'lua-A'};
    port.runLua = (_L, script) => {
      if(script.name==='lui_probe') return {ok:true,value:probeText(flags)};
      if(script.name==='offline_unlocks'){flags.base=true;flags.baseActive=true;}
      if(script.name==='offline_unlocks_ext'){flags.ext=true;flags.extActive=true;}
      if(script.name==='offline_unlocks_level'){flags.level=true;flags.levelActive=true;}
      return {ok:true,value:'installed'};
    };
    const context={moduleBase:memory.base,L:{}};
    port.request('ownership');
    for(let i=0;i<5;i++) port.onVerifiedLuiFrame(context);
    assert.equal(memory.calls.length,5);
    port.onLuaReset();
    Object.assign(flags,{epoch:'lua-B',base:false,baseActive:false,
      ext:false,extActive:false,level:false,levelActive:false});
    const second=port.request('ownership');
    for(let i=0;i<4;i++) port.onVerifiedLuiFrame(context);
    assert.equal(memory.calls.length,5);
    assert.equal(port.snapshot().catalog.stage,'ALREADY_REGISTERED');
    assert.equal(port.snapshot().controller.lastResult.requestId,second.requestId);
    assert.equal(port.snapshot().controller.lastResult.code,'OWNERSHIP_WRAPPERS_INSTALLED');
    port.dispose();
  });
});

test('controller: original Lua restore leaves table existing but disabled; reject false success', () => {
  const engine = makeControllerEngine();
  engine.data = {base:true,baseActive:false,ext:true,extActive:true,
    level:true,levelActive:true};
  const ctrl = new UnlockController({engine,payloads:EMBEDDED_LUA});
  ctrl.prepareUnlock({type:'prepareUnlock',stage:'ownership'});
  ctrl.frame();
  assert.equal(ctrl.status().lastResult.code, 'OWNERSHIP_PREREQUISITES_MISSING');
  assert.ok(ctrl.status().lastResult.missing.includes('BASE_UNLOCK_RESTORED_OR_INACTIVE'));
  assert.deepEqual(engine.runs, ['lui_probe']);
});

test('controller: ext/level wrapper tables after restore are not mistaken for installed wrappers', () => {
  const engine = makeControllerEngine();
  engine.data = {base:true,baseActive:true,ext:true,extActive:false,
    level:true,levelActive:false};
  const ctrl = new UnlockController({engine,payloads:EMBEDDED_LUA});
  ctrl.prepareUnlock({type:'prepareUnlock',stage:'ownership'});
  for(let i=0;i<4;i++) ctrl.frame();
  assert.equal(ctrl.status().lastResult.code,'OWNERSHIP_WRAPPERS_INSTALLED');
  assert.ok(engine.runs.includes('offline_unlocks_ext'));
  assert.ok(engine.runs.includes('offline_unlocks_level'));
});

test('controller: same request id deduplicates; injected fake clock drives queued expiration', () => {
  let now = 200;
  const engine = makeControllerEngine();
  const ctrl = new UnlockController({engine,payloads:EMBEDDED_LUA,
    clock:()=>now,token:'fake-test'});
  const first = ctrl.prepareUnlock({stage:'inspect',requestId:'same'});
  assert.equal(first.accepted,true);
  assert.equal(ctrl.prepareUnlock({stage:'inspect',requestId:'same'}).code,'DUPLICATE_REQUEST');
  assert.equal(ctrl.prepareUnlock({stage:'ownership',requestId:'same'}).code,'REQUEST_ID_CONFLICT');
  now = 120201;
  ctrl.expire();
  assert.equal(ctrl.status().lastResult.code,'LUI_FRAME_TIMEOUT');
  assert.equal(ctrl.status().lastResult.waitedMs,120001);
});

test('controller: explicit Lua-generation reset cancels work and rotates probe marker', () => {
  const engine = makeControllerEngine();
  const events = [];
  const ctrl = new UnlockController({engine,payloads:EMBEDDED_LUA,
    token:'test-generation',emit:x=>events.push(x)});
  ctrl.prepareUnlock({stage:'inspect',requestId:'first'});
  ctrl.frame();
  const tokenBefore = engine.lastProbeToken;
  ctrl.prepareUnlock({stage:'ownership',requestId:'cancelled'});
  ctrl.resetGeneration();
  assert.equal(ctrl.status().currentLuaEpoch,null);
  assert.equal(ctrl.status().queue.length,0);
  assert.ok(events.some(x=>x.requestId==='cancelled' && x.code==='LUA_STATE_CHANGED'));
  ctrl.prepareUnlock({stage:'inspect',requestId:'after'});
  ctrl.frame();
  assert.notEqual(engine.lastProbeToken,tokenBefore);
  assert.equal(parseLuaProbe(probeText({epoch:engine.lastProbeToken})).ok,true);
});

test('controller: restored or absent wrapper cannot be counted as a completed ownership stage', () => {
  const engine = makeControllerEngine();
  const run = engine.runLua.bind(engine);
  engine.runLua = (state, script) => {
    const result = run(state, script);
    if (script.name === 'offline_unlocks_ext') engine.data.extActive = false;
    return result;
  };
  const ctrl = new UnlockController({engine,payloads:EMBEDDED_LUA});
  ctrl.prepareUnlock({stage:'ownership'});
  for(let i=0;i<4;i++) ctrl.frame();
  assert.equal(ctrl.status().lastResult.code,'OWNERSHIP_POSTCHECK_FAILED');
  assert.equal(ctrl.status().lastResult.lua.extActive,false);
});

test('controller: same-epoch repeat is idempotent; changed epoch mid-run stops remaining scripts', () => {
  const engine = makeControllerEngine();
  const ctrl = new UnlockController({engine,payloads:EMBEDDED_LUA});
  ctrl.prepareUnlock({stage:'ownership',requestId:'original'});
  for(let i=0;i<4;i++) ctrl.frame();
  assert.equal(ctrl.status().lastResult.code,'OWNERSHIP_WRAPPERS_INSTALLED');
  const scriptsBefore = engine.runs.filter(s=>s!=='lui_probe').length;
  ctrl.prepareUnlock({stage:'ownership',requestId:'again'});
  ctrl.frame();
  assert.equal(ctrl.status().lastResult.code,'ALREADY_APPLIED_CURRENT_LUA_EPOCH');
  assert.equal(engine.runs.filter(s=>s!=='lui_probe').length,scriptsBefore);

  ctrl.resetGeneration();
  Object.assign(engine.data,{epoch:'lua-B',base:false,baseActive:false,
    ext:false,extActive:false,level:false,levelActive:false});
  ctrl.prepareUnlock({stage:'ownership',requestId:'interrupted'});
  ctrl.frame();
  engine.data.epoch = 'lua-C';
  ctrl.frame();
  assert.equal(ctrl.status().lastResult.code,'LUI_GENERATION_CHANGED');
  assert.equal(ctrl.status().lastResult.completedOriginalScripts,1);
});
