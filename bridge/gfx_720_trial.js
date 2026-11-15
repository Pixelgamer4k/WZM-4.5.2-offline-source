// Bounded/auto-restoring in-game test of original render-resolution % dvars.
// Does not touch OS display dimensions, APK, or camera; auto-restores after 8s.
'use strict';
const mod=Process.getModuleByName('libgame.so'), b=mod.base, S=0x58;
const keys=['270baabe0eb3399e','ba9243ff7e168cf'];
const root=b.add(0x54bd7b8).readPointer().readPointer();
const idx={};
function valid(p){try{return !p.readU64().equals(0)&&p.add(8).readU64().equals(0)&&p.add(0x15).readU8()<16&&p.add(0x14).readU8()<=1}catch(e){return false}}
for (const dir of [-1,1]) {
 let p=dir>0?root.add(S):root,miss=0;
 while(miss<400){if(valid(p)){miss=0;const k=p.readU64().toString(16);if(keys.includes(k))idx[k]=p;}else miss++;p=p.add(dir*S);}
}
if (keys.some(k=>!idx[k])){send({event:'gfx720TrialError',reason:'dvar missing',found:Object.keys(idx)});}
else{
 const before={}; for(const k of keys)before[k]=[idx[k].add(0x28).readS32(),idx[k].add(0x38).readS32()];
 const rp=b.add(0xadfa370).readPointer(),vp=b.add(0xadfa4a8).readPointer();
 const groups={}, samples=[];
 const h1=Interceptor.attach(rp,{onEnter(a){try{const i=a[1],w=i.add(0x28).readU32(),h=i.add(0x2c).readU32();if(w>512&&h>400){const k='renderpass:'+w+'x'+h;groups[k]=(groups[k]||0)+1;}}catch(_) {}}});
 const h2=Interceptor.attach(vp,{onEnter(a){try{if(a[2].toInt32()>0){const p=a[3],w=p.add(8).readFloat(),h=Math.abs(p.add(12).readFloat());if(w>500&&h>400){const k='viewport:'+w+'x'+h;groups[k]=(groups[k]||0)+1;}}}catch(_) {}}});
 const apply=()=>{for(const k of keys){idx[k].add(0x28).writeS32(75);idx[k].add(0x38).writeS32(75);}};
 send({event:'gfx720TrialStarted',pct:75,before,durationMs:8000});
 apply();let n=0;
 const timer=setInterval(()=>{apply();if(++n%8===0){samples.push({timeMs:n*125,sizes:Object.keys(groups).sort((a,c)=>groups[c]-groups[a]).slice(0,8),values:keys.map(k=>idx[k].add(0x28).readS32())});}},125);
 setTimeout(()=>{
  clearInterval(timer); h1.detach();h2.detach();
  for(const k of keys){idx[k].add(0x28).writeS32(before[k][0]);idx[k].add(0x38).writeS32(before[k][1]);}
  send({event:'gfx720TrialFinished',restored:before,sizes:Object.entries(groups).sort((a,c)=>c[1]-a[1]).slice(0,18),samples});
 },8000);
}
