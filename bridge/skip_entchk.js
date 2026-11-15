// Memory-only: skip the client entity-count checksum check (DEV ERROR 0x558520DF at 0x3c1dad4).
// 0x3c1dabc: b.eq 0x3c1dad8  ->  b 0x3c1dad8   (always treat checksum as matching)
(function(){const b=Process.getModuleByName('libgame.so').base;const a=b.add(0x3c1dabc);
 if(a.readU32()!==0x540000e0){send({s:'entchkBadOpcode',op:a.readU32().toString(16)});return;}
 Memory.patchCode(a,4,c=>{c.writeU32(0x14000007);});send({s:'entchkSkipped'});})();
