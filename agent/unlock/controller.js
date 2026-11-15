/* Pure queue and safety policy. No Frida APIs; exercised using a mocked LUI. */

export const PREPARE_STAGES = Object.freeze([
  'inspect', 'ownership', 'clientFence', 'full',
]);

export const ORIGINAL_OWNERSHIP_SEQUENCE = Object.freeze([
  'offline_unlocks', 'offline_unlocks_ext', 'offline_unlocks_level',
]);

export function normalizeAction(input, nextId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, code: 'INVALID_ACTION', error: 'expected an object' };
  }
  const action = input.type ?? 'prepareUnlock';
  if (action !== 'prepareUnlock') {
    return { ok: false, code: 'INVALID_ACTION_TYPE', error: 'type must be prepareUnlock' };
  }
  const stage = input.stage;
  if (!PREPARE_STAGES.includes(stage)) {
    return { ok: false, code: 'INVALID_PREPARE_STAGE',
      error: 'stage must be inspect, ownership, clientFence or full' };
  }
  const requestId = input.requestId ?? `prepare-${nextId}`;
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(requestId)) {
    return { ok: false, code: 'INVALID_REQUEST_ID' };
  }
  const version = input.gameVersion ?? '4.5.2.22729281';
  if (version !== '4.5.2.22729281') {
    return { ok: false, code: 'UNSUPPORTED_GAME_VERSION', expected: '4.5.2.22729281' };
  }
  return { ok: true, requestId, type: action, stage };
}

export function byteLengthUtf8(value) {
  let n = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 0x80) n++;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < value.length &&
             value.charCodeAt(i + 1) >= 0xdc00 &&
             value.charCodeAt(i + 1) <= 0xdfff) { n += 4; i++; }
    else n += 3;
  }
  return n;
}

export function buildLuaProbe(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(token)) {
    throw new Error('invalid generation token');
  }
  // A marker in Lua _G detects a fresh LUI state even if the allocator
  // reuses a previous Lua-state address. It is harmless unless the UI rebuilds.
  // This source is isolated instrumentation; the four original payloads are
  // separately embedded byte-for-byte and invoked exactly as authored.
  const source = `local E=rawget(_G,'WZM_GADGET_UNLOCK_GEN_452')
if type(E)~='string' then E='${token}';rawset(_G,'WZM_GADGET_UNLOCK_GEN_452',E) end
local function t(n) return type(rawget(_G,n))=='table' end
local function h(n,hash)
 local tab=rawget(_G,n);if type(tab)~='table' then return false end
 for k,v in pairs(tab) do if type(v)=='function' and tostring(k):find(hash,1,true) then return true end end
 return false
end
local prog=t('PROGRESSION');local loot=rawget(_G,'LOOT')
local items=type(loot)=='table' and type(loot.itemTypes)=='table'
local F=t('Fences')
local P=t('PLAYER_DATA')
local hub=t('MobileMainMenuButtons')
local baseState=rawget(_G,'WZM_UNLOCK')
local extState=rawget(_G,'WZM_UNLOCK_EXT')
local levelState=rawget(_G,'WZM_UNLOCK_LVL')
local function hasEntries(v) return type(v)=='table' and next(v)~=nil end
local bits={
 'WZMP452','epoch='..E,
 'prog='..tostring(prog),
 'loot='..tostring(items),
 'ownerQuery='..tostring(h('PROGRESSION','13d8bd2b211db6cc')),
 'levelQuery='..tostring(h('PROGRESSION','33568d3533d63f69')),
 'fences='..tostring(F),
 'clientQuery='..tostring(h('Fences','b06c6d08978b8c65')),
 'playerData='..tostring(P),
 'hub='..tostring(hub),
 'base='..tostring(rawget(_G,'WZM_UNLOCK')~=nil),
 'ext='..tostring(rawget(_G,'WZM_UNLOCK_EXT')~=nil),
 'level='..tostring(rawget(_G,'WZM_UNLOCK_LVL')~=nil),
 'baseActive='..tostring(type(baseState)=='table' and baseState.enabled==true and hasEntries(baseState.originals)),
 'extActive='..tostring(type(extState)=='table' and hasEntries(extState.orig)),
 'levelActive='..tostring(type(levelState)=='table' and hasEntries(levelState.orig)),
 'clientShim='..tostring(rawget(_G,'WZM_CLIENT_FENCE')~=nil)
}
return table.concat(bits,'|')`;
  return { name: 'lui_probe', text: source, byteLength: byteLengthUtf8(source) };
}

export function parseLuaProbe(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('WZMP452|')) {
    return { ok: false, code: 'LUA_PROBE_UNRECOGNIZED',
      detail: String(raw ?? '').slice(0, 160) };
  }
  const fields = {};
  for (const item of raw.split('|').slice(1)) {
    const pos = item.indexOf('=');
    if (pos === -1) continue;
    fields[item.slice(0, pos)] = item.slice(pos + 1);
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(fields.epoch ?? '')) {
    return { ok: false, code: 'LUA_PROBE_INVALID_EPOCH' };
  }
  return {
    ok: true,
    epoch: fields.epoch,
    progression: fields.prog === 'true',
    loot: fields.loot === 'true',
    ownerQuery: fields.ownerQuery === 'true',
    levelQuery: fields.levelQuery === 'true',
    fences: fields.fences === 'true',
    clientQuery: fields.clientQuery === 'true',
    playerData: fields.playerData === 'true',
    hub: fields.hub === 'true',
    base: fields.base === 'true',
    ext: fields.ext === 'true',
    level: fields.level === 'true',
    baseActive: fields.baseActive === 'true',
    extActive: fields.extActive === 'true',
    levelActive: fields.levelActive === 'true',
    clientShim: fields.clientShim === 'true',
  };
}

export function prerequisites(stage, lua, native) {
  const missing = [];
  if (!lua.progression) missing.push('PROGRESSION_TABLE');
  if (!lua.loot) missing.push('LOOT_ITEM_TYPES');
  if (!lua.ownerQuery) missing.push('ORIGINAL_OWNERSHIP_QUERY');
  if (!lua.levelQuery) missing.push('ORIGINAL_LEVEL_QUERY');
  // offline_unlocks.lua leaves WZM_UNLOCK.enabled=false after its restore().
  // Running it again keeps enabled=false; mere table existence is not proof.
  if (lua.base && !lua.baseActive) missing.push('BASE_UNLOCK_RESTORED_OR_INACTIVE');
  if (!native || native.catalogCount < 1 || native.catalogBusy !== 0) {
    missing.push('WEAPON_CATALOG_NOT_READY');
  }
  if (stage === 'ownership') return missing;
  if (stage !== 'clientFence' && stage !== 'full') return missing;
  if (!lua.fences || !lua.clientQuery) missing.push('CLIENT_CONNECT_FENCE_QUERY');
  if (!lua.playerData || !native?.profileBindOwnedByPort) {
    missing.push('NATIVE_DDL_PROFILE_BIND_UNPORTED');
  }
  if (!native?.hubLoaderOwnedByPort || !lua.hub) {
    missing.push('ORIGINAL_CUSTOMIZATION_HUB_UNPORTED');
  }
  if (!native?.previewGuardOwnedByPort && !native?.previewUsable) {
    missing.push('PREVIEW_CLIENT_OR_GUARD_UNAVAILABLE');
  }
  // No owner currently implements native genuine CLIENT_CONNECT or model
  // streaming; the original offline_client_fence.lua changes only Lua results.
  missing.push('NATIVE_CLIENT_AND_MODEL_STREAMING_UNVERIFIED');
  return missing;
}

export class UnlockController {
  constructor({ engine, payloads, emit, token = 'gadget-port-452', maxQueue = 8,
    clock = () => Date.now() } = {}) {
    if (!engine || typeof engine.runLua !== 'function' || typeof engine.getLuaState !== 'function') {
      throw new Error('native LUI engine required');
    }
    if (!payloads || ORIGINAL_OWNERSHIP_SEQUENCE.some(key => !payloads[key])) {
      throw new Error('original Lua payloads missing');
    }
    this.engine = engine;
    this.payloads = payloads;
    this.emit = typeof emit === 'function' ? emit : () => {};
    this.clock = clock;
    this.tokenPrefix = token.slice(0, 54);
    this.resetSerial = 0;
    this.probe = buildLuaProbe(this.tokenPrefix + '-' + this.resetSerial);
    this.queue = [];
    this.ids = new Map();
    this.nextId = 1;
    this.maxQueue = maxQueue;
    this.inFrame = false;
    this.luaEpoch = null;
    this.last = null;
    this.luiFrames = 0;
    this.activeGeneration = null;
    this.lastProbe = null;
    this.lastNative = null;
    this.scriptRuns = 0;
  }

  prepareUnlock(input) {
    const cmd = normalizeAction(input, this.nextId);
    if (!cmd.ok) return { accepted: false, ...cmd };
    const existing = this.ids.get(cmd.requestId);
    if (existing) {
      if (existing.stage !== cmd.stage) return {
        accepted: false, code: 'REQUEST_ID_CONFLICT', requestId: cmd.requestId,
      };
      return { accepted: true, code: 'DUPLICATE_REQUEST', requestId: cmd.requestId,
        status: existing.status, stage: cmd.stage };
    }
    if (this.queue.length >= this.maxQueue) return {
      accepted: false, code: 'QUEUE_FULL', maxQueue: this.maxQueue,
    };
    const job = { id: cmd.requestId, stage: cmd.stage, status: 'QUEUED',
      generation: null, nextScript: 0, results: [], queuedAt: this.clock() };
    this.ids.set(job.id, job);
    this.queue.push(job);
    this.nextId++;
    this.report('ACCEPTED', job, { code: 'QUEUED_FOR_LUI_FRAME' });
    return { accepted: true, code: 'QUEUED_FOR_LUI_FRAME',
      requestId: job.id, stage: job.stage, status: job.status };
  }

  report(event, job, values = {}) {
    const obj = { channel: 'wzm.unlockPort', event, type: 'prepareUnlock',
      requestId: job.id, stage: job.stage, ...values };
    this.last = obj;
    try { this.emit(obj); } catch (_) { /* native hook must not throw on UI event */ }
  }

  finish(job, status, code, extra = {}) {
    job.status = status;
    this.report('RESULT', job, { status, code, ...extra });
    this.queue.shift();
    if (this.ids.size > 128) {
      for (const [id, item] of this.ids) {
        if (!this.queue.includes(item)) { this.ids.delete(id); break; }
      }
    }
  }

  expire(maxAgeMs = 120000, now = this.clock()) {
    let n = 0;
    while (this.queue.length && now - this.queue[0].queuedAt >= maxAgeMs) {
      const job = this.queue[0];
      this.finish(job, 'FAILED', 'LUI_FRAME_TIMEOUT', {
        waitedMs: now - job.queuedAt,
        completedOriginalScripts: job.nextScript,
      });
      n++;
    }
    return n;
  }

  abortAll(code = 'GADGET_PORT_DISPOSED') {
    while (this.queue.length) {
      const job = this.queue[0];
      this.finish(job, 'FAILED', code, {
        completedOriginalScripts: job.nextScript,
      });
    }
  }

  resetGeneration() {
    this.abortAll('LUA_STATE_CHANGED');
    this.luaEpoch = null;
    this.lastProbe = null;
    this.lastNative = null;
    // New marker only takes effect when a new Lua _G is created. Existing
    // game Lua states retain their original marker, by design.
    this.resetSerial++;
    this.probe = buildLuaProbe(this.tokenPrefix + '-' + this.resetSerial);
  }

  status() {
    return {
      stage: 'IN_PROCESS_LUI',
      queue: this.queue.map(j => ({ requestId: j.id, stage: j.stage,
        status: j.status, completedOriginalScripts: j.nextScript })),
      currentLuaEpoch: this.luaEpoch,
      luiFrames: this.luiFrames,
      originalLuaExecutions: this.scriptRuns,
      lastResult: this.last,
      lastLuaReadiness: this.lastProbe,
      lastNativeReadiness: this.lastNative,
      standaloneUiReady: false,
      missingIndependentPorts: [
        'native weapon catalog enumerator', 'native DDL/profile binder',
        'original binary customization-hub registration', 'owned preview guard',
        'genuine native CLIENT_CONNECT and model streaming',
      ],
    };
  }

  frame() {
    this.luiFrames++;
    if (this.inFrame || this.queue.length === 0) return;
    this.inFrame = true;
    const job = this.queue[0];
    job.status = 'RUNNING';
    try {
      const state = this.engine.getLuaState();
      if (!state) return; // A native LUI frame may precede creation of the Lua VM.
      const probeResult = this.engine.runLua(state, this.probe);
      if (!probeResult.ok) {
        this.finish(job, 'FAILED', 'LUA_PREFLIGHT_FAILED', {
          cause: probeResult.code, detail: probeResult.error || probeResult.value || null });
        return;
      }
      const lua = parseLuaProbe(probeResult.value);
      if (!lua.ok) {
        this.finish(job, 'FAILED', lua.code, { detail: lua.detail ?? null });
        return;
      }
      const native = this.engine.frontendSnapshot();
      this.lastProbe = lua;
      this.lastNative = native;
      if (lua.epoch !== this.luaEpoch) {
        this.luaEpoch = lua.epoch;
        this.report('LUI_GENERATION', job, { code: 'LUA_EPOCH_OBSERVED', epoch: lua.epoch });
      }
      if (job.generation !== null && job.generation !== lua.epoch) {
        this.finish(job, 'FAILED', 'LUI_GENERATION_CHANGED', {
          from: job.generation, to: lua.epoch, completedOriginalScripts: job.nextScript,
        });
        return;
      }
      job.generation = lua.epoch;

      if (job.stage === 'inspect') {
        this.finish(job, 'COMPLETED', 'INSPECTION_ONLY', {
          lua, native, ownershipMissing: prerequisites('ownership', lua, native),
          uiMissing: prerequisites('full', lua, native),
        });
        return;
      }

      const missing = prerequisites(job.stage, lua, native);
      if (missing.length > 0) {
        this.finish(job, 'UNSUPPORTED', job.stage === 'ownership'
          ? 'OWNERSHIP_PREREQUISITES_MISSING' : 'UI_PORT_INCOMPLETE',
        { missing, lua, native, completedOriginalScripts: job.nextScript });
        return;
      }
      if (job.stage === 'clientFence' || job.stage === 'full') {
        // Source is embedded and can be executed through the same native Lua
        // queue when a future real-client port proves readiness. This revision
        // intentionally does not run the native-connection spoof.
        this.finish(job, 'UNSUPPORTED', 'NATIVE_CLIENT_READY_NOT_PROVEN', {
          missing: ['NATIVE_CLIENT_AND_MODEL_STREAMING_UNVERIFIED'] });
        return;
      }

      if (job.nextScript === 0 && lua.baseActive && lua.extActive && lua.levelActive) {
        this.finish(job, 'COMPLETED', 'ALREADY_APPLIED_CURRENT_LUA_EPOCH',
          { epoch: lua.epoch, ownershipWrappersOnly: true });
        return;
      }
      if (job.nextScript >= ORIGINAL_OWNERSHIP_SEQUENCE.length) {
        if (!lua.baseActive || !lua.extActive || !lua.levelActive) {
          this.finish(job, 'FAILED', 'OWNERSHIP_POSTCHECK_FAILED', { lua });
          return;
        }
        this.finish(job, 'COMPLETED', 'OWNERSHIP_WRAPPERS_INSTALLED', {
          epoch: lua.epoch, originalLuaSourceResults: job.results,
          ownershipWrappersOnly: true, uiReady: false,
        });
        return;
      }

      const name = ORIGINAL_OWNERSHIP_SEQUENCE[job.nextScript];
      const input = this.payloads[name];
      const result = this.engine.runLua(state, {
        name, text: input.text, byteLength: input.byteLength,
      });
      if (!result.ok) {
        this.finish(job, 'FAILED', 'ORIGINAL_LUA_SCRIPT_FAILED', {
          script: name, cause: result.code, detail: result.error || result.value || null,
          completedOriginalScripts: job.nextScript,
        });
        return;
      }
      const answer = String(result.value ?? '');
      if (/^(not ready:|unlock query not found|fence query missing)/i.test(answer)) {
        this.finish(job, 'FAILED', 'ORIGINAL_LUA_DECLINED', {
          script: name, detail: answer.slice(0, 200),
          completedOriginalScripts: job.nextScript,
        });
        return;
      }
      job.results.push({ script: name, response: answer.slice(0, 600),
        originalSha256: input.sha256 });
      job.nextScript++;
      this.scriptRuns++;
      this.report('PROGRESS', job, {
        code: 'ORIGINAL_LUA_STAGE_APPLIED', script: name,
        completedOriginalScripts: job.nextScript,
        totalOriginalScripts: ORIGINAL_OWNERSHIP_SEQUENCE.length,
      });
    } catch (error) {
      this.finish(job, 'FAILED', 'LUI_FRAME_EXCEPTION', {
        detail: String(error).slice(0, 300),
        completedOriginalScripts: job.nextScript,
      });
    } finally {
      this.inFrame = false;
    }
  }
}
