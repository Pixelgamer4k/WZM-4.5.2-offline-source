/*
 * WZM 4.5.2 original in-process host and AI orchestrator.
 *
 * A request to host is not a completed match. Native client/AI receipts
 * originate in the original 4.5.2 host/bot scripts and are checked here;
 * there is deliberately no unconditional PLAYING transition. Rendering,
 * weapon firing, damage, respawn and match completion require separate
 * device verification. The source can be exercised with an injected mock
 * evaluator without invoking libgame or running ADB.
 */
import {validateOfflineMatchRequest} from './match_contract.js';
import {
  PACK_SOURCE, PACK_FILES
} from './play_runtime.js';
import {
  HOST_FUNCTION_SOURCE, PARTY_INJECTOR_SOURCE, AI_CREATOR_SOURCE,
  AI_DIFFICULTY_GUARD_SOURCE
} from './host/embedded_sources.js';
import {createFridaHostRuntime} from './host/native_proof.js';

const PARTY_PRIMER = Object.freeze({
  partyMembers: true, teamFields: false, count: 2, team: 1, calls: 2, friends: 0
});
const EXPERIMENTAL_SUPPORTED_MAPS = Object.freeze(['nuketown', 'crash', 'verdansk']);
const PREPARATION_TIMEOUT_MS = 90000;
const AI_TIMEOUT_MS = 120000;
// The audited host function returns its original RPC object; its LUI and
// party frame callbacks were converted to functions called by native_boot's
// SOLE original game frame owner. Never run the legacy 3-hook host bundle.
const NATIVE_HOST_SOURCE = 'globalThis.wzmHost = ' + HOST_FUNCTION_SOURCE + ';';

export function rosterPlan(config) {
  return Object.freeze({
    map: config.nativeMapId,
    mode: config.nativeModeHash,
    hostEnemies: config.enemies,
    friendly: config.friends,
    party: PARTY_PRIMER,
    aiCount: config.enemies + config.friends,
    difficulty: config.nativeDifficulty,
    durationSeconds: config.durationSeconds
  });
}

export function createMatchPlayer({
  log = () => {}, onStatus = () => {},
  evaluateSource = null,
  defer = (fn, ms) => setTimeout(fn, ms),
  cancel = handle => clearTimeout(handle)
} = {}) {
  let phase = 'IDLE';
  let hostInstalled = false;
  let packInstalled = false;
  let partyEvaled = false;
  let aiEvaled = false;
  let guardEvaled = false;
  let partyQueued = false;
  let aiQueued = false;
  let guardQueued = false;
  let hostStartReturned = false;
  let worldEventCandidate = false;
  let plan = null;
  let failure = null;
  let aiReceipt = null;
  let guardReceipt = null;
  let partyApplyReceipt = null;
  let partyReceipt = null;
  let worldReceipt = null;
  let timers = new Set();
  let serial = 0;
  let disposed = false;

  function status(value) {
    try { onStatus(String(value).slice(0, 230)); } catch (_) {}
  }

  function schedule(fn, delay = 0) {
    const epoch = serial;
    const token = defer(() => {
      timers.delete(token);
      if (disposed || serial !== epoch || phase === 'FAILED') return;
      try { fn(); } catch (err) { fail('NATIVE_STAGE_EXCEPTION', err); }
    }, delay);
    timers.add(token);
    return token;
  }

  function clearTimers() {
    for (const token of timers) { try { cancel(token); } catch (_) {} }
    timers.clear();
  }

  function stageTimeout(expectedPhase, ms) {
    schedule(() => {
      if (phase === expectedPhase) fail('NATIVE_STAGE_TIMEOUT', expectedPhase);
    }, ms);
  }

  function fail(code, reason) {
    if (disposed || phase === 'FAILED') return;
    phase = 'FAILED';
    failure = code + ': ' + String(reason).slice(0, 140);
    serial++;
    clearTimers();
    status('Offline host stopped: ' + failure);
    log(failure);
  }

  function runStage(source) {
    if (evaluateSource !== null) {
      evaluateSource(source, onNativeEvent);
      return;
    }
    // Source is exact embedded original local scripts (not untrusted input).
    // Every native event routes to this instance; source doesn't run at boot.
    const body = "'use strict';\nfunction send(payload){if(globalThis.__wzmRoute)globalThis.__wzmRoute(payload);}\n" +
      source;
    new Function(body)();
  }

  function ensureHost() {
    if (hostInstalled) return;
    status('Installing native offline host hooks (not a started match)…');
    if (evaluateSource === null) {
      const checked = createFridaHostRuntime().checkBinary();
      if (!checked.ok) throw new Error(checked.code +
        (checked.site ? ': ' + checked.site : ''));
    }
    runStage(NATIVE_HOST_SOURCE);
    if (!globalThis.wzmHost || typeof globalThis.wzmHost.go !== 'function')
      throw new Error('Native host script did not expose go');
    hostInstalled = true;
  }

  function launchHost() {
    if (phase !== 'PREPARING' && phase !== 'WAIT_PACK') return;
    if (plan === null) return;
    ensureHost();
    phase = 'HOSTING';  // Set BEFORE calling go: callback may run synchronously.
    stageTimeout('HOSTING', PREPARATION_TIMEOUT_MS);
    const result = globalThis.wzmHost.go(plan.map, plan.mode, plan.hostEnemies);
    if (result !== 1)
      throw new Error('Original native host queue returned ' + String(result));
    status('Native host request queued. Waiting for real local client transition…');
  }

  function ensureVerdanskPack() {
    phase = 'WAIT_PACK';
    stageTimeout('WAIT_PACK', 30000);
    if (packInstalled) { schedule(launchHost); return; }
    globalThis.WZM_PACK_FILES = PACK_FILES;
    runStage(PACK_SOURCE);
    status('Checking local Verdansk pack registry (not world-load proof)…');
  }

  function waitForNativeWorld(remainingAttempts) {
    if (phase !== 'WORLD_CANDIDATE' || !plan) return;
    let snap = null;
    try { snap = globalThis.wzmHost?.snap(); }
    catch (err) { log('Original native world snapshot pending: ' + String(err)); }
    if (snap && Number.isInteger(snap.clc0) && snap.clc0 >= 7 &&
        snap.clc0 <= 9) {
      worldReceipt = {clc0:snap.clc0,level:snap.level,
        source:'ORIGINAL_HOST_NATIVE_CLIENT_STATE_SNAPSHOT',mapWorldRendered:false};
      schedule(startParty);
      return;
    }
    if (remainingAttempts <= 0) {
      fail('ORIGINAL_WORLD_STATE_NOT_VERIFIED',
        'clientEnterWorld callback did not reach clc.state >= 7');
      return;
    }
    schedule(() => waitForNativeWorld(remainingAttempts - 1), 500);
  }

  function startParty() {
    if (partyEvaled || phase !== 'WORLD_CANDIDATE' ||
        !hostStartReturned || !worldReceipt || !plan) return;
    phase = 'PARTY';
    partyEvaled = true;
    stageTimeout('PARTY', PREPARATION_TIMEOUT_MS);
    status('Local client callback observed. Priming original party slots…');
    globalThis.WZM_BOT_ENV = {...plan.party,diff:plan.difficulty};
    runStage(PARTY_INJECTOR_SOURCE);
    if (typeof globalThis.wzmBotArm !== 'function')
      throw new Error('Party injector did not expose wzmBotArm');
    globalThis.wzmBotArm();
  }

  function beginWorldReadback() {
    if (partyQueued || phase !== 'HOSTING' ||
        !hostStartReturned || !worldEventCandidate) return;
    partyQueued = true;
    phase = 'WORLD_CANDIDATE';
    stageTimeout('WORLD_CANDIDATE', PREPARATION_TIMEOUT_MS);
    status('Original host returned; awaiting native client state 7…');
    schedule(() => waitForNativeWorld(180), 500);
  }

  function startAi(remainingAttempts) {
    if (phase !== 'AI' || !plan) return;
    if (!aiEvaled) {
      aiEvaled = true;
      status('Requesting ' + plan.aiCount + ' original marker-2 AI clients…');
      globalThis.WZM_BOTH_SIDES_AI = {count: plan.aiCount, difficulty: plan.difficulty};
      runStage(AI_CREATOR_SOURCE);
    }
    try {
      if (typeof globalThis.wzmBotArm !== 'function') throw new Error('AI arm function missing');
      globalThis.wzmBotArm(); // Script refuses unless native player slot 0 is state 7.
    } catch (err) {
      if (remainingAttempts > 0) { schedule(() => startAi(remainingAttempts - 1), 500); return; }
      fail('AI_ARM_FAILED', err);
    }
  }

  function verifyAiReceipt(payload) {
    if (!payload || !Array.isArray(payload.created) || !payload.summary || !plan)
      return 'missing native AI arrays';
    const created = payload.created;
    const summary = payload.summary;
    if (created.length !== plan.aiCount || summary.genuineAi !== plan.aiCount)
      return 'AI marker-2 count differs from requested ' + plan.aiCount;
    if (!Array.isArray(summary.slots) || summary.slots.length !== plan.aiCount)
      return 'native AI slot readback absent';
    const slots = new Map(summary.slots.map(r => [r.slot, r]));
    if (slots.size !== plan.aiCount)
      return 'native marker-2 AI slot identifiers duplicated';
    if (!summary.byTeam || summary.byTeam[1] !== plan.hostEnemies ||
        (summary.byTeam[2] || 0) !== plan.friendly)
      return 'native marker-2 team aggregate readback mismatch';
    let enemies = 0, friendly = 0;
    const unique = new Set();
    for (const row of created) {
      const slot = slots.get(row.slot);
      if (unique.has(row.slot) || !slot || slot.state !== 7 ||
          (row.team !== 1 && row.team !== 2) ||
          row.difficulty !== plan.difficulty || slot.team !== row.team)
        return 'AI client state/team/requested-difficulty readback mismatch';
      unique.add(row.slot);
      if (row.team === 1) enemies++;
      else friendly++;
    }
    if (enemies !== plan.hostEnemies || friendly !== plan.friendly)
      return 'AI sides differ from selected roster (' + enemies + '/' + friendly + ')';
    return null;
  }

  function startGuard() {
    if (guardEvaled || phase !== 'AI' || !plan) return;
    guardEvaled = true;
    phase = 'GUARD';
    stageTimeout('GUARD', 45000);
    globalThis.WZM_BOT_DIFF = plan.difficulty;
    runStage(AI_DIFFICULTY_GUARD_SOURCE); // Native original difficulty setter.
    if (typeof globalThis.wzmBotArm !== 'function')
      throw new Error('Difficulty guard not armed');
    globalThis.wzmBotArm();
    status('Native AI slots read back. Waiting for difficulty guard receipt…');
  }

  function verifyGuardReceipt(payload) {
    if (!payload || !Array.isArray(payload.rows) || !Array.isArray(payload.applied) ||
        !plan)
      return 'missing native difficulty guard client list';
    const activeAi = payload.rows.filter(r => r && r.flag === 2 && r.state === 7);
    const expected = new Map(aiReceipt?.slots || []);
    const activeSlots = new Set(activeAi.map(row => row.slot));
    if (expected.size !== plan.aiCount || activeAi.length !== plan.aiCount ||
        activeSlots.size !== plan.aiCount ||
        activeAi.some(row => !Number.isInteger(row.slot) || !expected.has(row.slot)))
      return 'exact original marker-2 AI client slots changed while setting difficulty';
    const unique = new Set();
    for (const item of payload.applied) {
      if (!item || !Number.isInteger(item.slot) ||
          ![1,2].includes(item.team) || item.difficulty !== plan.difficulty ||
          unique.has(item.slot)) return 'native per-AI setter/readback mismatch';
      unique.add(item.slot);
    }
    if (unique.size !== plan.aiCount)
      return 'native difficulty readback incomplete for requested AI clients';
    if (payload.applied.some(row=>expected.get(row.slot)!==row.team))
      return 'native final setter did not preserve AI slot team readback';
    return null;
  }

  // Original party_bot_inject.js reports the member-table CAPACITY in
  // members.n (20 in the captured native sessions). Only members.v contains
  // occupied [index, status] entries; successful pa_manage_bots uses status 3.
  function partyMemberIndexes(members) {
    if (!members || !Number.isInteger(members.n) ||
        members.n < plan.party.count || members.n > 24 ||
        !Array.isArray(members.v) || members.v.length !== plan.party.count)
      return null;
    const indexes = new Set();
    for (const row of members.v) {
      if (!Array.isArray(row) || row.length !== 2 ||
          !Number.isInteger(row[0]) || row[0] < 0 || row[0] >= members.n ||
          row[1] !== 3 || indexes.has(row[0])) return null;
      indexes.add(row[0]);
    }
    return [...indexes].sort((a,b) => a-b);
  }

  function localPartySlotPresent(slots) {
    return Array.isArray(slots) &&
      slots.some(row => Array.isArray(row) && row.length === 3 &&
        row[0] === 0 && row[1] === 7 && row[2] === 0);
  }

  function verifyPartyFinal(payload) {
    if (!partyApplyReceipt || !localPartySlotPresent(payload.slots))
      return 'original party apply/native local slot receipt missing';
    const indexes = partyMemberIndexes(payload.members);
    if (!indexes || payload.members.n !== partyApplyReceipt.capacity ||
        indexes.some((id,i) => id !== partyApplyReceipt.indexes[i]))
      return 'final native party members differ from successful apply readback';
    const slots = payload.slots;
    const seen = new Set();
    for (const row of slots) {
      if (!Array.isArray(row) || row.length !== 3 ||
          !Number.isInteger(row[0]) || row[0] < 0 || row[0] >= 20 ||
          !Number.isInteger(row[1]) || !Number.isInteger(row[2]) ||
          seen.has(row[0])) return 'invalid or duplicated native client slot';
      seen.add(row[0]);
    }
    // The primer requests exactly two party test clients. A connected native
    // party client is [nonzero slot, state 7, flag 1], unlike marker-2 AI.
    const clients = slots.filter(row => row[0] !== 0 && row[2] === 1);
    if (clients.length !== plan.party.count || clients.some(row => row[1] !== 7))
      return 'native party clients missing, disconnected or over count';
    return null;
  }

  function onNativeEvent(payload) {
    if (disposed || !payload || typeof payload !== 'object') return;
    const kind = String(payload.s || 'unknown');
    const detail = payload.error || payload.e || payload.where;
    if (detail) log(kind + ': ' + String(detail).slice(0, 150));
    if (phase === 'FAILED' || phase === 'IDLE') return;
    if (kind === 'FATAL' || kind === 'FAULT' || kind === 'err' ||
        kind === 'botInjectError' ||
        kind === 'packInstalledError' || kind === 'comError' || kind === 'sessionError') {
      fail(kind, detail || payload.code || 'native engine reported error');
      return;
    }
    if (kind === 'packInstalledApplied' && phase === 'WAIT_PACK') {
      const matched = payload.matched;
      if (Number.isInteger(matched) && matched >= Math.ceil(PACK_FILES.length * .95)) {
        packInstalled = true;
        status('Local pack registry readback ' + matched + '/' + PACK_FILES.length +
          '; actual map streaming not yet verified');
        schedule(launchHost);
      }
    }
    if (kind === 'hostStartReturned' && phase === 'HOSTING') {
      hostStartReturned = true;
      beginWorldReadback();
    }
    if (kind === 'clientEnterWorld' && phase === 'HOSTING' &&
        (payload.state === 6 || payload.state === 7)) {
      worldEventCandidate = true;
      beginWorldReadback();
    }
    if (kind === 'botInjectParty' && phase === 'PARTY' && partyEvaled &&
        !partyApplyReceipt) {
      const after = payload.after;
      const indexes = partyMemberIndexes(after?.members);
      if (payload.applyRet !== 1 || after?.gate !== 1 || after?.cap !== 1 ||
          !indexes || !localPartySlotPresent(payload.slots)) {
        fail('PARTY_NATIVE_APPLY_FAILED',
          'pa_manage_bots return/gate/capacity/member/local-slot readback invalid');
        return;
      }
      partyApplyReceipt = {capacity:after.members.n,indexes};
    }
    if (kind === 'botInjectFinal' && !payload.experiment &&
        phase === 'PARTY' && partyEvaled && !aiQueued) {
      const reason = verifyPartyFinal(payload);
      if (reason) {
        fail('PARTY_NATIVE_READBACK_FAILED',reason);
        return;
      }
      partyReceipt = {localClient:0,nativePartyMemberCount:partyApplyReceipt.indexes.length,
        nativePartyTableCapacity:partyApplyReceipt.capacity,
        nativePartyMemberIndexes:[...partyApplyReceipt.indexes],
        nativeConnectedPartyClients:plan.party.count,
        serverClientRows:payload.slots.length};
      aiQueued = true;
      phase = 'AI';
      stageTimeout('AI', AI_TIMEOUT_MS);
      schedule(() => startAi(20), 300);
    }
    if (kind === 'botInjectFinal' && payload.experiment === 'both_sides_native_ai' &&
        phase === 'AI' && !guardQueued) {
      const reason = verifyAiReceipt(payload);
      if (reason) { fail('NATIVE_AI_READBACK_FAILED', reason); return; }
      aiReceipt = {created: payload.created.length, enemies: plan.hostEnemies,
        friendly: plan.friendly, state: 7, source: 'NATIVE_MARKER2_CLIENT_SLOTS',
        slots:payload.created.map(row=>[row.slot,row.team])};
      guardQueued = true;
      schedule(startGuard, 300);
    }
    if (kind === 'botInjectFinal' && payload.experiment === 'all_native_ai_veteran_guard' &&
        phase === 'GUARD') {
      const reason = verifyGuardReceipt(payload);
      if (reason) { fail('DIFFICULTY_GUARD_FAILED', reason); return; }
      guardReceipt = {guardCompleted: true, requestedDifficulty: plan.difficulty};
      phase = 'NATIVE_AI_OBSERVED';
      status('Native player/AI slot receipts passed; 3D world, firing and match end NOT verified.');
      clearTimers();
    }
  }

  function start(input) {
    if (disposed) return 'MATCH_PLAYER_DISPOSED';
    const config = validateOfflineMatchRequest(input);
    if (!config.ok) return config.code;
    if (!EXPERIMENTAL_SUPPORTED_MAPS.includes(config.map))
      return 'MAP_NOT_VALIDATED_NATIVE: ' + config.map;
    if (config.mode !== 'tdm')
      return 'MODE_NOT_VALIDATED_NATIVE: ' + config.mode;
    if (config.durationSeconds !== 3600)
      return 'NATIVE_DURATION_CONTROL_UNWIRED: use original 60-minute default';
    if (phase !== 'IDLE')
      return phase === 'FAILED' ? 'MATCH_FAILED: ' + failure : 'MATCH_ALREADY_ACTIVE: ' + phase;
    try {
      serial++;
      plan = rosterPlan(config);
      globalThis.__wzmRoute = onNativeEvent;
      globalThis.WZM_STANDALONE_EVENT_SINK = onNativeEvent;
      phase = 'PREPARING';
      if (config.map === 'verdansk') {
        ensureVerdanskPack();
        return 'WAIT_VERDANSK_PACK: local pack registry confirmation pending';
      }
      launchHost();
      return 'HOST_REQUESTED: waiting for native client and AI receipts';
    } catch (err) {
      fail('HOST_SETUP_FAILED', err);
      return 'HOST_SETUP_FAILED: ' + String(err).slice(0, 150);
    }
  }

  function snapshot() {
    return {phase, hostInstalled, packInstalled, partyEvaled, aiEvaled, guardEvaled,
      hostStartReturned,worldEventCandidate,
      partyQueued, aiQueued, guardQueued, failure, worldReceipt, partyReceipt,
      aiReceipt, guardReceipt,
      matchStarted:false, worldRenderVerified:false, gameplayVerified:false};
  }
  function dispose() {
    disposed = true;
    serial++;
    clearTimers();
    if (globalThis.__wzmRoute === onNativeEvent) globalThis.__wzmRoute = null;
    if (globalThis.WZM_STANDALONE_EVENT_SINK === onNativeEvent)
      globalThis.WZM_STANDALONE_EVENT_SINK = null;
  }
  return Object.freeze({start, snapshot, dispose, rosterPlan});
}
