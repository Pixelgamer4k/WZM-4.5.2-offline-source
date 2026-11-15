'use strict';
// On-device replacement for lua_exec.js: no RPC, no host. Reads the fence
// script from the module directory and runs it once on the game's own thread
// at the first LUI frame (0x337c1c0), where no Lua is executing.
// Addresses are valid only for libgame.so SHA-256
// c8f5e9df317b7442567e61255ac7894bbf1b6693c30fcfd3a6ee6cde6c04b7d7

const LUA = '/data/adb/modules/wzm_offline/skip_online_fences.lua';

const base = Process.getModuleByName('libgame.so').base;
const at = x => base.add(x);

const lVar = at(0x54bcd08).readPointer();
const load = new NativeFunction(at(0x4490778), 'int',
    ['pointer', 'pointer', 'size_t', 'pointer', 'pointer']);
const pcall = new NativeFunction(at(0x4486bc4), 'int', ['pointer', 'int', 'int', 'int']);
const tostr = new NativeFunction(at(0x4483720), 'pointer', ['pointer', 'int', 'pointer']);
const chunkName = Memory.allocUtf8String('=wzm_auto');

let src = null;
try {
    src = File.readAllText(LUA);
} catch (e) {
    console.log('wzm_auto: cannot read ' + LUA + ' (' + e + ')');
}

let done = false;
if (src !== null) {
    Interceptor.attach(at(0x337c1c0), {
        onEnter() {
            if (done) return;
            const L = lVar.readPointer();
            if (L.isNull()) return;
            done = true;
            const top = L.add(0x28).readPointer();
            try {
                const buf = Memory.allocUtf8String(src);
                const lr = load(L, buf, src.length, chunkName, ptr(0));
                let result = 'load-failed(' + lr + ')';
                if (lr === 0) {
                    const pr = pcall(L, 0, 1, 0);
                    const s = tostr(L, -1, ptr(0));
                    result = 'pcall=' + pr + ' ' + (s.isNull() ? 'null' : s.readUtf8String());
                }
                console.log('wzm_auto: ' + result);
            } catch (e) {
                console.log('wzm_auto error: ' + e);
            }
            L.add(0x28).writePointer(top);
        }
    });
    console.log('wzm_auto: armed, waiting for first LUI frame');
}
