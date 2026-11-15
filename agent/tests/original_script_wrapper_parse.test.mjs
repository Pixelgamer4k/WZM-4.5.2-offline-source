// Mac-only parse regression: evaluate the actual dynamic-source wrapper shape
// without executing native Frida globals or connecting to an Android device.
import assert from 'node:assert/strict';
import {
  HOST_FUNCTION_SOURCE, PARTY_INJECTOR_SOURCE, AI_CREATOR_SOURCE,
  AI_DIFFICULTY_GUARD_SOURCE
} from '../host/embedded_sources.js';
import {PACK_SOURCE} from '../play_runtime.js';

const snippets = {
  host: 'globalThis.wzmHost = ' + HOST_FUNCTION_SOURCE + ';',
  party: PARTY_INJECTOR_SOURCE,
  ai: AI_CREATOR_SOURCE,
  guard: AI_DIFFICULTY_GUARD_SOURCE,
  pack: PACK_SOURCE
};
for (const [label, source] of Object.entries(snippets)) {
  assert.ok(source.length > 1000, `${label} unexpectedly empty`);
  const body = "'use strict';\nfunction send(payload){if(globalThis.__wzmRoute)globalThis.__wzmRoute(payload);}\n" + source;
  assert.doesNotThrow(() => new Function(body),
    `${label} must parse with the actual Frida injection wrapper`);
}
assert.match(snippets.host, /globalThis\.wzmHost\s*=/);
assert.match(snippets.party, /globalThis\.wzmBotArm\s*=/);
assert.match(snippets.ai, /globalThis\.wzmBotArm\s*=/);
assert.match(snippets.guard, /globalThis\.wzmBotArm\s*=/);
console.log('PASS 5/5 pinned original dynamic scripts parse under the real in-process wrapper; NO native execution or playability proof');
