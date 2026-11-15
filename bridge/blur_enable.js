// Genuine radial blur dvar, traced from original renderer settings builder
// 0x2d97918 (out+0x54) and view builder 0x2eb7040. The old .data.rel.ro
// targets were NAME POINTERS and must never be written as booleans.
// Radial/event blur is distinct from full-camera velocity motion blur.
{
'use strict';
const b=Process.getModuleByName('libgame.so').base;
const want=globalThis.WZM_BLUR_VALUE===undefined?1:globalThis.WZM_BLUR_VALUE;
if(want!==0&&want!==1)throw Error('Radial blur expects 0 or 1');
const p=b.add(0x54d4d48).readPointer().readPointer();
if(p.readU64().toString(16)!=='6eeba106b70638d9'||p.add(0x15).readU8()!==0)throw Error('Radial blur dvar identity mismatch');
const before=p.add(0x28).readU8();
p.add(0x28).writeU8(want);p.add(0x38).writeU8(want);
send({s:'radialBlurConfigured',hash:'6eeba106b70638d9',before,current:p.add(0x28).readU8(),latched:p.add(0x38).readU8(),activeShaderValue:b.add(0x835ede4).readU32(),note:'Radial/event blur; full-camera motion blur is not established.'});
}
