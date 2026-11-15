import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMatchPlayer, rosterPlan} from './match_player.js';
import {PACK_FILES} from './play_runtime.js';
import {
  HOST_FUNCTION_SOURCE as HOST_SOURCE, PARTY_INJECTOR_SOURCE,
  AI_CREATOR_SOURCE, AI_DIFFICULTY_GUARD_SOURCE
} from './host/embedded_sources.js';

const host = HOST_SOURCE;
for (const flag of [
  'const FORCE_LOOPBACK_CHAN = true;',
  'const NULL_ENTITY_GUARD = true;',
  'const ROUTE_LOCAL_HOST_PACKET = true;',
  'const SEND_GAMESTATE = true;',
  'const FORCE_OOB_CMD = true;',
  'const BOTS = true;',
  'const STEER_VM53_PIN_PRED = true;',
  'const LOW_OVERHEAD = true;',
  'const BYPASS_STUB53 = false;',
  'const BYPASS_STUB60 = false;',
  'const MATCH_PROBE = true;'
]) assert.ok(host.includes(flag), 'missing ' + flag);
assert.equal(host.includes('WZM_AIM_MODE'), false);
assert.ok(host.includes('rpc.exports='));
assert.ok(host.includes('WZM_HOST_MATCH_PROBE_FRAME'));
assert.equal(host.includes('Interceptor.attach(at(0x337c1c0)'), false,
  'never attach a second independent original native LUI hook');
assert.equal(PARTY_INJECTOR_SOURCE.includes('Interceptor.attach(at(0x337c1c0)'),false);
assert.ok(PARTY_INJECTOR_SOURCE.includes('WZM_PARTY_INJECT_FRAME'));
assert.ok(AI_CREATOR_SOURCE.includes('queue(0x265ea3c,[ai,ptr(BOT_DIFF)])'));
assert.ok(AI_DIFFICULTY_GUARD_SOURCE.includes('WZM_BOT_DIFF'));
assert.ok(Array.isArray(PACK_FILES) && PACK_FILES.length > 100);
new Function("'use strict';\nfunction send(payload){}\n" + HOST_SOURCE);

const plan = rosterPlan({
  nativeMapId: 'mp_mgl_nuketown',
  nativeModeHash: '0x3f9bd6e4038d651d',
  enemies: 5,
  friends: 0,
  nativeDifficulty: 3
});
assert.equal(plan.party.calls, 2, 'party priming stays the two known-good slots');
assert.equal(plan.aiCount, 5);
assert.equal(plan.hostEnemies, 5);
assert.equal(plan.difficulty, 3);

const three = rosterPlan({
  nativeMapId: 'mp_mgl_crash2', nativeModeHash: '0x1',
  enemies: 3, friends: 2, nativeDifficulty: 2
});
assert.equal(three.aiCount, 5);
assert.equal(three.hostEnemies, 3);
assert.equal(three.party.count, 2);

const events = [];
const player = createMatchPlayer({log() {}, onStatus(text) { events.push(text); }});
assert.equal(player.start({map: 'nope', mode: 'tdm', enemies: 5, friends: 0,
  difficulty: 'Veteran', minutes: 60}), 'UNKNOWN_ORIGINAL_MAP');
assert.equal(player.start({map: 'broadcast', mode: 'tdm', enemies: 5, friends: 0,
  difficulty: 'Veteran', minutes: 60}), 'MAP_NOT_VALIDATED_NATIVE: broadcast');
assert.equal(player.start({map: 'nuketown', mode: 'tdm', enemies: 9, friends: 0,
  difficulty: 'Veteran', minutes: 60}), 'INVALID_ENEMIES');
assert.equal(player.start({map: 'nuketown', mode: 'domination', enemies: 5, friends: 0,
  difficulty: 'Veteran', minutes: 60}), 'MODE_NOT_VALIDATED_NATIVE: domination');
assert.match(player.start({map: 'nuketown', mode: 'tdm', enemies: 5, friends: 0,
  difficulty: 'Veteran', minutes: 35}), /^NATIVE_DURATION_CONTROL_UNWIRED:/);

const entry = readFileSync(new URL('./entry.js', import.meta.url), 'utf8');
assert.ok(!entry.includes('armSignatureSpoof();'), 'deferred build uses its actual signing identity');
assert.ok(entry.includes("makeButton(activity, 'Play', 'start')"));
console.log('PASS play runtime: pinned experimental host flags, fail-closed map/mode/duration, Play button');
