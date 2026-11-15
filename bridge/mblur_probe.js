// Read-only: radial motion blur inputs per frame. Render-view builder 0x2eb7040(out=x0,in=x1,...)
// copies in+0x4398 (u8 enabled, f32 a, f32 b) to out+0x8e50 when the radial dvar is on.
{
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const f=x=>{const m=Process.findModuleByAddress(x);return m?(m.name==='libgame.so'?'+'+x.sub(b).toString(16):m.name):x.toString();};
let inp=null,frames=0,nonzero=0,last='';const seen={};
Interceptor.attach(at(0x2eb7040),{onEnter(a){this.o=a[0];inp=a[1];},onLeave(){
 frames++;try{const i=inp.add(0x4398),o=this.o.add(0x8e50);
  const v=[i.readU8(),i.add(4).readFloat().toFixed(3),i.add(8).readFloat().toFixed(3),o.readU8(),o.add(4).readFloat().toFixed(3),o.add(8).readFloat().toFixed(3)].join(',');
  if(v!==last){last=v;if(nonzero++<40)send({s:'mbInput',frame:frames,in_en_a_b__out_en_a_b:v});}
 }catch(e){}}});
setInterval(()=>{send({s:'mbStats',frames,changes:nonzero,last});},5000);
}
