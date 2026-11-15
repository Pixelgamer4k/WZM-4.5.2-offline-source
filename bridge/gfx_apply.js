// WZM_GFX: memory-only graphics overrides. Native render resolution (no upscaling),
// SMAA (Low quality, the highest this build offers), temporal mode off, upscaler off, 60 fps cap.
{
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const d1=at(0x54bd7b8).readPointer().readPointer();const S=0x58;
function ok(p){try{const h=p.readU64();const t=p.add(0x15).readU8(),z=p.add(8).readU64();return !h.equals(0)&&z.equals(0)&&t<16&&p.add(0x14).readU8()<=1;}catch(e){return false;}}
const idx={};
for(const dir of [-1,1]){let p=dir>0?d1.add(S):d1;let miss=0;while(miss<400){if(ok(p)){miss=0;idx[p.readU64().toString(16)]=p;}else miss++;p=p.add(dir*S);}}
const E=globalThis.WZM_GFX_ENV||{};
const want={
 '19e76c718fbb7351':E.res===undefined?6:E.res, // resolution preset: 6 Native Resolution
 '1b1ba5e9ed47837e':E.res===undefined?6:E.res, // second resolution preset (PC path): Native
 'd2a2a59552643885':1,  // anti-aliasing: SMAA
 '7b374f8d8b8f7d8e':1,  // SMAA quality: Low (Very Low/Low are the only options)
 '5cd1f66da730bbca':0,  // Off/Spatial/Temporal: Off
 'fa96a2168c519506':E.cas===false?0:1,  // upscaler Off/CAS/FSR1-4: CAS (sharpening; FSR2-4 shaders are not in the mobile build)
 'caa98f528ccd5f26':E.fps===undefined?3:E.fps, // frame-rate cap: 3 = 60
 '270baabe0eb3399e':E.pct||100, // render resolution percent (game sets 62; height follows this)
 'ba9243ff7e168cf':E.pct||100,  // second render resolution percent (also 62)
 // textures (E.tex===false keeps the game's values)
 ...(E.tex===false?{}:{
 'e3f56fe404e467cb':7,  // Mega Low..Ultra: Ultra
 '791caebb225b800d':E.texQ||2,  // Default/Ultra/Very_High/High...: Very_High (Ultra overflows the stock streaming pool: grey flicker; enlarging the pool at boot crashes)
 'c89d1f42b13d341c':5}), // texture filter: aniso 16x
 // motion-blur candidates: both On showed no visible blur (owner test, 4 Nov), so off by default; WZM_GFX_ENV={blur:true} turns them On.
 ...(E.blur!==true?{}:{
 '43a74b2ca0523ded':1,  // Off / On / Force Disable: On
 '980aa1522036313':2}), // Default / Off / On / Disabled: On
 // lighting: opt-in (WZM_GFX_ENV={light:true}). With these on, two matches crashed in the renderer at 0x2d2ca44 (4 Nov).
 ...(E.light!==true?{}:{
 'a2745f0302a0d8df':3,  // Off / GT AO / GT Bent Normals / GT Global Illumination: GT GI (real-time screen-space GI)
 'aea2a028c757852f':3,  // GTAO quality: Ultra
 '6d194d6c7f21172e':2}), // shadow cascades: High (2-3)
};
// float dvars (candidates for the dynamic-resolution scale limits, 0.6 by default)
const wantF={...(E.cas===false?{}:{'c56180de91339fec':E.casStrength===undefined?0.8:E.casStrength}), // CAS strength 0..1 (read by 0x2ef67b8 in CAS mode)
 '80362e18112ccf7d':E.scale===undefined?1.0:E.scale,'d3d2a87b1e1ae9ac':E.scale===undefined?1.0:E.scale};
// The fixed-render controller can update the desired percentage once the
// renderer exposes its actual source dimensions (960-high and 832-high
// sessions need different percentages to produce the SAME 640-high scene).
// Share the existing verified dvar registry; do not duplicate scanner/hashes.
globalThis.WZM_GFX_SET_PCT=function(percent){
 const v=Math.round(Number(percent));
 if(!Number.isFinite(v)||v<40||v>100)return false;
 E.pct=v;
 for(const h of ['270baabe0eb3399e','ba9243ff7e168cf']){
  want[h]=v;
  const p=idx[h];
  if(p){p.add(0x28).writeS32(v);p.add(0x38).writeS32(v);}
 }
 return true;
};
// 0x2ef61f8 forces the resolution preset into 1..4 every frame (6 Native -> 4). Return early instead.
const clamp=at(0x2ef61f8);
if(clamp.readU32()!==0xd65f03c0){Memory.patchCode(clamp,4,c=>c.writeU32(0xd65f03c0));}

// Reflection probe quality: the renderer keeps its shader quality constants in a plain int array at libgame+0x835ed90
// (slot order = the MTL_FUNCTION_CONST table at 0x538e838). Slot 3 = gReflectionQuality; the game sets 0 (off) on this device.
// Pipelines read it when the map loads, so it must be set before the match request. Off by default; WZM_GFX_ENV={refl:N} turns it on at level N.
const reflSlot=at(0x835ed9c),reflWant=(typeof E.refl==='number')?E.refl:-1; // OPT-IN: level 2 showed green/red ground patches on Crash (8 Nov); the game's own value (0) is left alone unless WZM_GFX_ENV={refl:N}
function apply(){const changed=[];if(reflWant>=0&&reflSlot.readS32()!==reflWant){reflSlot.writeS32(reflWant);changed.push('gReflectionQuality');}for(const h in want){const p=idx[h];if(!p)continue;if(p.add(0x28).readS32()!==want[h]){p.add(0x28).writeS32(want[h]);p.add(0x38).writeS32(want[h]);changed.push(h);}}for(const h in wantF){const p=idx[h];if(!p||p.add(0x15).readU8()!==1)continue;if(Math.abs(p.add(0x28).readFloat()-wantF[h])>1e-4){p.add(0x28).writeFloat(wantF[h]);p.add(0x38).writeFloat(wantF[h]);changed.push(h);}}return changed;}
send({s:'gfxApplied',found:Object.keys(want).filter(h=>idx[h]).length,changed:apply()});
let reapplied=0;
setInterval(()=>{const c=apply();if(c.length&&reapplied++<10)send({s:'gfxReapplied',changed:c});},1000);
}
