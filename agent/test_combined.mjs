import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {UnifiedUnlock} from './unlock/unified_unlock.js';
import {GAME_FINGERPRINT} from './unlock/fingerprint.js';
import {verifyEmbeddedLua} from './unlock/source_integrity.js';
import {EMBEDDED_LUA} from './unlock/payloads.js';
import {byteLengthUtf8} from './unlock/controller.js';

const here = dirname(fileURLToPath(import.meta.url));
const events = [];
let now = 120000;
const port = new UnifiedUnlock({notify: x => events.push(x),clock:()=>now});
assert.equal(port.source.ok,true);
assert.equal(verifyEmbeddedLua(EMBEDDED_LUA).count,4);
assert.equal(GAME_FINGERPRINT.game_version,'4.5.2.22729281');
assert.equal(GAME_FINGERPRINT.code_windows.length,4);
assert.equal(GAME_FINGERPRINT.gnu_build_id_hex,'9528f1d264b40639b57e14998e01d080');

for(const key of ['offline_unlocks','offline_unlocks_ext','offline_unlocks_level','offline_client_fence']) {
  assert.equal(byteLengthUtf8(EMBEDDED_LUA[key].text),EMBEDDED_LUA[key].byteLength);
}
let r=port.request('full');
assert.equal(r.accepted,false);
assert.equal(r.code,'UI_PORT_INCOMPLETE');
assert.ok(r.missing.includes('NATIVE_CLIENT_AND_MODEL_STREAMING_UNVERIFIED'));
r=port.request('clientFence');
assert.equal(r.accepted,false);
assert.equal(r.code,'UI_PORT_INCOMPLETE');
r=port.request('unsupported');
assert.equal(r.code,'INVALID_PREPARE_STAGE');

r=port.request('inspect');
assert.equal(r.accepted,true);
assert.equal(port.snapshot().controller.queue.length,1);
port.onLuaReset();
assert.equal(port.snapshot().controller.queue.length,0);
assert.ok(events.some(x => x.code==='LUA_STATE_CHANGED'));

// The frame adapter runs only synchronously within the existing original
// LUI hook. Confirm correct Lua source-size/error contract and stack restore.
let restored=false;
const fakeTop={isNull:()=>false};
const fakeState={add:offset=>{assert.equal(offset,0x28);return {writePointer:p=>{restored=true;assert.equal(p,fakeTop)}};}};
const fakeNative={
  chunkName:{text:'=original_wzm_lui'},
  load(_L,b,len){assert.equal(len,5);assert.equal(b.source,'hello');return 0;},
  pcall(){return 0;},
  toString(){return {isNull:()=>false};},
};
const fakeRuntime={readPointer:()=>fakeTop,writePointer:()=>{restored=true;},
  nullPointer:()=>null,readUtf8:()=> 'OK'};
const originalMemory = globalThis.Memory;
globalThis.Memory={allocUtf8String:source=>({source})};
port.context={L:fakeState,native:fakeNative,runtime:fakeRuntime};
const out=port.runLua(fakeState,{name:'test',text:'hello',byteLength:5});
assert.equal(out.ok,true);
assert.equal(out.value,'OK');
assert.equal(restored,true);
assert.equal(port.runLua(fakeState,{name:'test',text:'hello',byteLength:3}).code,
  'LUA_SOURCE_LENGTH_MISMATCH');
port.context=null;
globalThis.Memory=originalMemory;

// Ownership cannot be called "completed" until the in-app original catalog
// actually registers live assets. An unavailable native DB must fail closed.
r=port.request('ownership');
assert.equal(r.accepted,true);
assert.equal(port.request('ownership').code,'CATALOG_STILL_PREPARING');
port.onVerifiedLuiFrame({L:fakeState,native:fakeNative,runtime:fakeRuntime,
  moduleBase:{add(){throw new Error('expected unmapped DB')}}});
assert.equal(port.snapshot().catalog.stage,'FAILED');
assert.equal(port.snapshot().pendingOwnership,null);
assert.ok(events.some(x=>x.code==='ORIGINAL_CATALOG_UNAVAILABLE'));
port.dispose();

// Single Frida interceptor owner: only worker16 native_boot installs the
// LUI hook, while controller/adapter execute from its callback.
const boot=readFileSync(join(here,'native_boot.js'),'utf8');
const adapter=readFileSync(join(here,'unlock/unified_unlock.js'),'utf8');
const ui=readFileSync(join(here,'entry.js'),'utf8');
assert.equal((boot.match(/runtime\.attach\(/g)||[]).length,1);
assert.equal((ui.match(/Interceptor\.attach\(/g)||[]).length,1);
assert.equal((adapter.match(/^\s*Interceptor\.attach\(/mg)||[]).length,0);
assert.ok(boot.includes('onVerifiedLuiFrame'));
assert.ok(boot.includes('GNU_BUILD_ID_MISMATCH'));
assert.ok(boot.includes('ORIGINAL_CODE_WINDOW_MISMATCH'));
assert.ok(boot.includes('WAIT_MAINMENU_PLAY_BUTTON'));
assert.ok(ui.includes('MAINMENU_PROBE'));
assert.ok(ui.includes('Unlock Ownership*'));
console.log('PASS combined rootless source: original SHA-verified Lua, one native frame owner, independent ELF/build gates, original catalog prerequisite, truthful unsupported full UI, exact Lua stack cleanup');
