/*
 * Optional one-shot read-only WZM 4.5.2 weapon-definition readiness snapshot.
 * Use only in an existing session after confirming the phone is free.
 * Exact unmodified ELF VAs from Gear Up source trace; no hooks or writes.
 */
'use strict';
(function () {
  const module = Process.findModuleByName('libgame.so');
  if (!module) {
    send({kind:'weapon_def_snapshot',error:'libgame.so not loaded'});
    return;
  }
  const expectedOriginalELFSHA256 = 'c8f5e9df317b7442567e61255ac7894bbf1b6693c30fcfd3a6ee6cde6c04b7d7';
  const countVA = 0x6cb1ab0;
  const busyVA = 0x6cb1abc;
  try {
    const count = module.base.add(countVA).readU32();
    const busy = module.base.add(busyVA).readU8();
    // Mirrors original read-only predicate at ELF VA 0x1ff1108.
    const readyByPredicate = count >= 1 && count <= 0xfffffffe && busy === 0;
    send({kind:'weapon_def_snapshot',moduleBase:String(module.base),moduleSize:module.size,
      expectedOriginalELFSHA256:expectedOriginalELFSHA256,registrationCount:count,busyFlag:busy,
      originalPredicateVA:'0x1ff1108',readyByPredicate:readyByPredicate});
  } catch (error) {
    send({kind:'weapon_def_snapshot',error:String(error),moduleBase:String(module.base)});
  }
})();
