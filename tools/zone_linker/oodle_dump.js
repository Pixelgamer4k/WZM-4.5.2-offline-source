// Dump OodleLZ_Decompress (0x51186d8) results for the streaming caller (0x40b14f8) and the other non-FF caller.
const b=Process.getModuleByName('libgame.so').base;let n=0,total=0;const CAP=600*1024*1024;const stats={};
Interceptor.attach(b.add(0x51186d8),{onEnter(a){this.ra=this.returnAddress.sub(b).toUInt32();this.cb=a[0];this.cl=a[1].toUInt32();this.rb=a[2];this.rl=a[3].toUInt32();},
 onLeave(r){const ra=this.ra;stats[ra]=(stats[ra]||0)+1;if(ra===0x199b7f8)return;const got=r.toInt32();
  let head='';try{head=Array.from(new Uint8Array(this.cb.readByteArray(Math.min(48,this.cl)))).map(x=>x.toString(16).padStart(2,'0')).join('');}catch(e){}
  n++;const meta={s:'dec',n,ra:'0x'+ra.toString(16),cl:this.cl,rl:this.rl,got,head};
  if(got>0&&total+got<CAP){total+=got;send(meta,this.rb.readByteArray(got));}else send(meta);}});
setInterval(()=>send({s:'stats',stats,total}),10000);
send({s:'oodleReady'});
