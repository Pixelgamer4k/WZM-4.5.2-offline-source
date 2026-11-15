// Early boot agent for motion blur: capture (and widen) the swapchain image usage before creation.
// The game fills its Vulkan table via vkGetDeviceProcAddr; vkCreateSwapchainKHR slot is libgame+0xadfa770.
{
const E=globalThis.WZM_MBVK_ENV||{};
globalThis.WZM_MBVK=globalThis.WZM_MBVK||{};
const G=globalThis.WZM_MBVK;
function hookCreate(fn){
 if(G.createHooked)return;G.createHooked=true;
 Interceptor.attach(fn,{onEnter(a){
  const ci=a[1];const usage=ci.add(56).readU32();
  const info={format:ci.add(36).readU32(),w:ci.add(44).readU32(),h:ci.add(48).readU32(),usage,minImages:ci.add(32).readU32(),present:ci.add(80).readU32()};
  if(E.widen!==false){ci.add(56).writeU32(usage|0x1|0x2);info.usageNow=ci.add(56).readU32();} // + TRANSFER_SRC | TRANSFER_DST
  G.swapInfo=info;send({s:'mbvkSwapchainCreate',info});
 },onLeave(r){send({s:'mbvkSwapchainCreateResult',r:r.toInt32()});}});
 send({s:'mbvkCreateHooked',fn:fn.toString()});
}
function arm(m){
 const b=m.base,slot=b.add(0xadfa770);
 const lv=Process.findModuleByName('libvulkan.so');
 if(lv){try{Interceptor.attach(lv.getExportByName('vkGetDeviceProcAddr'),{onEnter(a){this.n=a[1].readCString();},onLeave(r){if(this.n==='vkCreateSwapchainKHR'&&!r.isNull())hookCreate(r);}});}catch(e){send({s:'mbvkGdpaErr',e:String(e)});}}
 const t=setInterval(()=>{try{const p=slot.readPointer();if(!p.isNull()){clearInterval(t);hookCreate(p);}}catch(e){}},1);
 send({s:'mbvkArmed'});
}
const m=Process.findModuleByName('libgame.so');
if(m)arm(m);else{const t=setInterval(()=>{const mm=Process.findModuleByName('libgame.so');if(mm){clearInterval(t);arm(mm);}},2);}
}
