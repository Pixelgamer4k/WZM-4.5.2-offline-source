// Read-only: count viewport and render-pass sizes for 2.5 s via the game's driver pointer table.
{
const b=Process.getModuleByName('libgame.so').base;
const vp=b.add(0xadfa4a8).readPointer(),rp=b.add(0xadfa370).readPointer();
const counts={};
const h1=Interceptor.attach(vp,{onEnter(a){if(a[2].toInt32()>0){const p=a[3];const k='viewport '+p.add(8).readFloat()+'x'+Math.abs(p.add(12).readFloat());counts[k]=(counts[k]||0)+1;}}});
const h2=Interceptor.attach(rp,{onEnter(a){const i=a[1];const k='renderpass '+i.add(0x28).readU32()+'x'+i.add(0x2c).readU32();counts[k]=(counts[k]||0)+1;}});
setTimeout(()=>{h1.detach();h2.detach();send({top:Object.entries(counts).sort((x,y)=>y[1]-x[1]).slice(0,14)});},2500);
}
