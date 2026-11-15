// Memory-only guard for the main-menu weapon picker crash (7 Nov 2026).
// 0x355ca54(x0, clientIdx, weaponName) updates the frontend preview client's weapon.
// Offline there is no frontend local client: the client table (GOT 0x54bcd30 count,
// 0x54bcd38 active flag, 0x54bcd40 array) is empty, x21 stays 0 and the function reads
// 0x147f64+0x2394+0x10 = 0x14a308 -> SIGSEGV (seen on selecting AK-74).
// When the client slot is missing, return 0, which is the function's own "nothing done" exit.
const b = Process.getModuleByName('libgame.so').base;
const got = o => b.add(o).readPointer();
const f = b.add(0x355ca54);
let skipped = 0, passed = 0;
if (f.readU32() !== 0xd10703ff) {
  send({ s: 'previewGuardBadOpcode', op: f.readU32().toString(16) });
} else {
  const orig = new NativeFunction(f, 'int', ['pointer', 'int', 'pointer']);
  Interceptor.replace(f, new NativeCallback(function (a, c, name) {
    let ok = false;
    try {
      const cnt = got(0x54bcd30).readS32(), flag = got(0x54bcd38).readS32();
      ok = flag !== 0 && cnt > 0 && !got(0x54bcd40).readPointer().isNull();
    } catch (e) { ok = false; }
    if (!ok) {
      skipped++;
      if (skipped <= 5) { let n = ''; try { n = name.readCString(64); } catch (e) {} send({ s: 'previewGuardSkip', n, skipped }); }
      return 0;
    }
    passed++;
    return orig(a, c, name);
  }, 'int', ['pointer', 'int', 'pointer']));
  send({ s: 'previewGuardInstalled' });
}
