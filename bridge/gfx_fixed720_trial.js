// BOUNDED in-game FIXED-720 trial, auto-restores after 9 seconds.
// Native engine scale table was proven 0=>full width, 15=>half width in this PID.
// Intercepts original render-sizing builder only; original APK/ELF untouched.
'use strict';
const m=Process.getModuleByName('libgame.so'),b=m.base;
const names=['270baabe0eb3399e','ba9243ff7e168cf'],s=0x58;
const first=b.add(0x54bd7b8).readPointer().readPointer(),idx={};
function ok(p){try{return !p.readU64().equals(0)&&p.add(8).readU64().equals(0)&&p.add(0x15).readU8()<16&&p.add(0x14).readU8()<=1;}catch(e){return false;}}
for(const d of [-1,1]){let p=d>0?first.add(s):first,miss=0;while(miss<400){if(ok(p)){miss=0;const k=p.readU64().toString(16);if(names.includes(k))idx[k]=p;}else miss++;p=p.add(d*s);}}
if(names.some(k=>!idx[k])){send({event:'fixed720Error',reason:'Missing dvar',idx:Object.keys(idx)});}
else{
 const before={};for(const k of names){before[k]=[idx[k].add(0x28).readS32(),idx[k].add(0x38).readS32()];}
 const sizes={},dim={};let modified=0,calls=0;
 const rp=b.add(0xadfa370).readPointer();
 const hrp=Interceptor.attach(rp,{onEnter(a){try{const v=a[1],w=v.add(0x28).readU32(),h=v.add(0x2c).readU32();if(w>=480&&h>=480&&w<=2400&&h<=1600){const key=w+'x'+h;sizes[key]=(sizes[key]||0)+1;}}catch(e){}}});
 const h=Interceptor.attach(b.add(0x2eaf78c),{
   onEnter(args){
    this.out=this.context.x8;
    this.before=args[6].toUInt32();
    this.target=(args[0].toUInt32()>=1500 && args[1].toUInt32()>=700 && this.before<=15);
    calls++;
    if(this.target){this.context.x6=ptr(0);modified++;}
   },
   onLeave(){if(!this.target)return;try{const a=this.out;const k=a.add(8).readU32()+'x'+a.add(12).readU32()+' from '+this.before;dim[k]=(dim[k]||0)+1;}catch(e){}}
 });
 const apply=()=>{for(const k of names){idx[k].add(0x28).writeS32(75);idx[k].add(0x38).writeS32(75);}};
 send({event:'fixed720TrialStarted',previous:before,durationMs:9000,description:'percent75 + DRS index0 (fully reversible)'});
 apply();const t=setInterval(apply,90);
 setTimeout(()=>{
  clearInterval(t);h.detach();hrp.detach();
  for(const k of names){idx[k].add(0x28).writeS32(before[k][0]);idx[k].add(0x38).writeS32(before[k][1]);}
  send({event:'fixed720TrialFinished',restored:before,modified,calls,dim:Object.entries(dim).sort((a,c)=>c[1]-a[1]).slice(0,12),sizes:Object.entries(sizes).sort((a,c)=>c[1]-a[1]).slice(0,20)});
 },9000);
}
