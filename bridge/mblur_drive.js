// Motion-driven radial motion blur (memory-only, opt-in). The engine's only motion blur is the radial
// effect in 0x2cee158; it is enabled (dvar 6eeba106b70638d9=1) but nothing ever sets its per-frame
// trigger offline. Each frame, after the render-view builder 0x2eb7040(out=x0,...) returns:
//  - centre: world point dvar 841b904ab274bece (vec3) = camera origin (out+0x100) + forward (out+0x80)*8000
//  - strength out+0x8e54 and shape out+0x8e58 from camera speed + turn rate; enable byte out+0x8e50.
{
const E=globalThis.WZM_MB_ENV||{};
const MAXA=E.max===undefined?0.08:E.max, GAIN=E.gain===undefined?1.0:E.gain, SHAPE=E.shape===undefined?0.35:E.shape;
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const centre=at(0x54d3598).readPointer().readPointer();
let prevO=null,prevF=null,prevT=0,smooth=0,frames=0,logged=0;
function v3(p){return [p.readFloat(),p.add(4).readFloat(),p.add(8).readFloat()];}
Interceptor.attach(at(0x2eb7040),{onEnter(a){this.o=a[0];},onLeave(){
 try{
  const o=this.o,org=v3(o.add(0x100)),fr=v3(o.add(0x80)),t=Date.now();
  const fl=Math.hypot(fr[0],fr[1],fr[2])||1,fw=[fr[0]/fl,fr[1]/fl,fr[2]/fl];
  let target=0;
  if(prevO&&t>prevT){
   const dt=Math.min(0.1,(t-prevT)/1000)||0.016;
   const dx=org[0]-prevO[0],dy=org[1]-prevO[1],dz=org[2]-prevO[2];
   const speed=Math.sqrt(dx*dx+dy*dy+dz*dz)/dt;                 // units/s (sprint ~ 250-300)
   const dot=Math.max(-1,Math.min(1,fw[0]*prevF[0]+fw[1]*prevF[1]+fw[2]*prevF[2]));
   const turn=Math.acos(dot)*180/Math.PI/dt;                      // degrees/s
   if(speed<5000)target=GAIN*(Math.max(0,speed-120)/300*0.04+Math.max(0,turn-60)/360*0.05);
  }
  smooth+= (Math.min(MAXA,target)-smooth)*0.25;
  prevO=org;prevF=fw;prevT=t;
  centre.add(0x28).writeFloat(org[0]+fw[0]*8000);centre.add(0x2c).writeFloat(org[1]+fw[1]*8000);centre.add(0x30).writeFloat(org[2]+fw[2]*8000);
  const on=smooth>0.004;
  o.add(0x8e50).writeU8(on?1:0);o.add(0x8e54).writeFloat(on?smooth:0);o.add(0x8e58).writeFloat(on?SHAPE:0);
  if(logged<12&&++frames%90===0){logged++;send({s:'mbDrive',org:org.map(x=>+x.toFixed(1)),fwRaw:fr.map(x=>+x.toFixed(3)),strength:+smooth.toFixed(4),target:+target.toFixed(4)});}
 }catch(e){if(logged<5){logged++;send({s:'mbDriveErr',e:String(e)});}}
}});
send({s:'mbDriveLoaded',max:MAXA,gain:GAIN,shape:SHAPE});
}
