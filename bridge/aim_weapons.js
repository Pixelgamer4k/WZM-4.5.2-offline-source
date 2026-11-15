// WZM_AIM_WEAPONS=probe|boost : per-weapon aim-assist numbers (memory-only, applied at launch, once per weapon).
// Pool: libgame+0x635b940+60*0xd0 (used by frontend_weapon_catalog.py): base ptr, stride 0x530, capacity, used-bits at +0xb0.
// Entry: +8 = name ptr, +0x20 = pointer to the WeaponDef. Aim-assist floats inside WeaponDef (community IW8 header, computed with clang):
//   autoAimRange +1016, aimAssistRange +1020, aimAssistRangeAds +1024, pitchSlowdown +1028, pitchSlowdownAds +1032,
//   yawSlowdown +1036, yawSlowdownAds +1040, lockonStrength +1044.   The header is the PC build; the phone layout is UNVERIFIED,
// so every weapon is sanity-checked and nothing is written unless most weapons look plausible. probe = never writes.
// Factors (WZM_AIM_ENV): {range:1.5, slow:1.5, lock:1.5}.
{
const MODE=globalThis.WZM_AIM_MODE||'probe',E=globalThis.WZM_AIM_ENV||{};
const KR=E.range===undefined?1.5:E.range,KS=E.slow===undefined?1.5:E.slow,KL=E.lock===undefined?1.5:E.lock;
const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x),pool=at(0x635b940+60*0xd0);
const OFF={ar:1016,aar:1020,aara:1024,ps:1028,psa:1032,ys:1036,ysa:1040,lock:1044};
const done=new Set();let rounds=0,wrote=0,writeErr=0,lastReport=0;
function plausible(f){return f.every(v=>Number.isFinite(v)&&v>=0&&v<100000)&&(f[0]>0||f[1]>0||f[2]>0||f[7]>0);}
function scan(){
 const base=pool.readPointer(),stride=pool.add(20).readU32(),cap=pool.add(16).readU32(),bits=pool.add(0xb0).readPointer();
 if(stride!==0x530||cap>2048)return{error:'pool layout mismatch'};
 const rows=[];let total=0,ok=0;
 for(let i=0;i<cap;i++){
  if(!(bits.add((i>>>5)*4).readU32()&(0x80000000>>>(i&31))))continue;
  const a=base.add(i*stride);let name='?',wd=null;
  try{name=a.add(8).readPointer().readUtf8String()||'?';wd=a.add(0x20).readPointer();}catch(e){continue;}
  if(wd===null||wd.isNull()||wd.compare(ptr('0x10000'))<0)continue;
  let f;try{f=[OFF.ar,OFF.aar,OFF.aara,OFF.ps,OFF.psa,OFF.ys,OFF.ysa,OFF.lock].map(o=>wd.add(o).readFloat());}catch(e){continue;}
  total++;const p=plausible(f);if(p)ok++;
  rows.push({name,wd,f,p});
 }
 return{rows,total,ok};
}
function round(){
 const r=scan();if(r.error){send({s:'aimWeaponsError',e:r.error});return;}
 rounds++;
 const frac=r.total?r.ok/r.total:0;
 if(MODE==='boost'&&r.total>=20&&frac>=0.6){
  for(const w of r.rows){
   const key=w.wd.toString();if(done.has(key)||!w.p)continue;done.add(key);
   try{
    const f=w.f,n=[f[0]*KR,f[1]*KR,f[2]*KR,f[3]*KS,f[4]*KS,f[5]*KS,f[6]*KS,f[7]*KL];
    [OFF.ar,OFF.aar,OFF.aara,OFF.ps,OFF.psa,OFF.ys,OFF.ysa,OFF.lock].forEach((o,i)=>w.wd.add(o).writeFloat(n[i]));wrote++;
   }catch(e){writeErr++;}
  }
 }
 const now=Date.now();
 if(rounds<=2||now-lastReport>20000){lastReport=now;
  send({s:'aimWeapons',mode:MODE,round:rounds,weapons:r.total,plausible:r.ok,boosted:wrote,writeErrors:writeErr,
   sample:r.rows.filter(w=>w.p).slice(0,6).map(w=>({n:w.name,f:w.f.map(v=>+v.toFixed(3))}))});}
}
round();
setInterval(()=>{try{round();}catch(e){send({s:'aimWeaponsError',e:String(e).slice(0,160)});}},3000);
send({s:'aimWeaponsArmed',mode:MODE,factors:{range:KR,slow:KS,lock:KL}});
}
