/*
 * Memory-only fixed 640p render + DRS-disabled scene selector (legacy filename).
 * Local game process only. Exit/stop restores previous dvar values and hook.
 * Original game ELF: c8f5e9df317b7442567e61255ac7894bbf1b6693c30fcfd3a6ee6cde6c04b7d7.
 */
'use strict';
const m=Process.getModuleByName('libgame.so'),b=m.base,site=b.add(0x2eaf78c);
if(site.readU32()!==0xd101c3ff)throw new Error('Unexpected render sizing function: build unsupported');
const root=b.add(0x54bd7b8).readPointer().readPointer(),S=0x58;
const keys=['270baabe0eb3399e','ba9243ff7e168cf'],idx={};
function ok(p){try{return !p.readU64().equals(0)&&p.add(8).readU64().equals(0)&&p.add(0x15).readU8()<16&&p.add(0x14).readU8()<=1;}catch(e){return false;}}
for(const dir of [-1,1]){let p=dir>0?root.add(S):root,miss=0;while(miss<400){if(ok(p)){miss=0;const k=p.readU64().toString(16);if(keys.includes(k))idx[k]=p;}else miss++;p=p.add(dir*S);}}
if(keys.some(k=>!idx[k]))throw new Error('Missing original render-percent dvars');
const before={};for(const k of keys){before[k]=[idx[k].add(0x28).readS32(),idx[k].add(0x38).readS32()];}
const state={active:true,target:'1376x640',percent:75,forced:0,calls:0,errors:0,pid:Process.id};
function apply(){if(!state.active)return;try{for(const k of keys){idx[k].add(0x28).writeS32(state.percent);idx[k].add(0x38).writeS32(state.percent);}}catch(e){state.errors++;}}
const h=Interceptor.attach(site,{onEnter(args){
 state.calls++;
 try{
  if(args[0].toUInt32()>=1200&&args[1].toUInt32()>=600&&args[0].toUInt32()>args[1].toUInt32()&&args[6].toUInt32()<=15&&(args[5].add(0x1c).readU32()&1)!==0){
   const percent=Math.max(40,Math.min(100,Math.round(137600/args[0].toUInt32())));
   if(state.percent!==percent){state.percent=percent;apply();send({event:'fixed720Adapted',sourceWidth:args[0].toUInt32(),pct:percent});}
   this.context.x6=ptr(0);state.forced++;
  }
 }catch(e){state.errors++;}
}});
apply();const timer=setInterval(apply,90);
function stop(){if(!state.active)return {stopped:true};state.active=false;clearInterval(timer);h.detach();for(const k of keys){idx[k].add(0x28).writeS32(before[k][0]);idx[k].add(0x38).writeS32(before[k][1]);}send({event:'fixed720Restored',previous:before,forced:state.forced});return {stopped:true,previous:before};}
rpc.exports={status:()=>({...state,values:keys.map(k=>idx[k].add(0x28).readS32())}),stop};
send({event:'fixed640LiveEnabled',target:'1376x640',dynamicLevel:0,renderPercent:'auto from source',original:before,pid:Process.id});
