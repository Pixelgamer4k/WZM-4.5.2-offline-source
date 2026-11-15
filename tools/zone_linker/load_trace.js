// Records the real zone loader's stream consumption on the device.
// Record = 4 x u32: kind(1=read,2=asset,3=insert), a, b, c
//   read:  a = caller of Load_Stream (loader call site, libgame offset), b = direct caller of raw read, c = size
//   asset: a = asset type, b = asset index in list, c = 0
const b=Process.getModuleByName('libgame.so').base;const off=p=>{const o=p.sub(b);return o.compare(0x6000000)<0?o.toUInt32():0xffffffff;};
const CAP=1<<18;let buf=new Uint32Array(CAP*4),n=0,total=0,active=false,idx=0;
function flush(){if(!n)return;send({s:'chunk',n},buf.buffer.slice(0,n*16));total+=n;n=0;}
function rec(k,a,c1,c2){buf[n*4]=k;buf[n*4+1]=a;buf[n*4+2]=c1;buf[n*4+3]=c2;if(++n===CAP)flush();}
Interceptor.attach(b.add(0x1aafb68),{onEnter(a){active=true;idx=0;rec(4,0,0,0);send({s:'zoneStart'});},onLeave(){flush();send({s:'zoneEnd',total});}});
Interceptor.attach(b.add(0x17a7880),{onEnter(a){if(!active)return;let t=0;try{t=a[1].readU32();}catch(e){}rec(2,t,idx++,0);}});
Interceptor.attach(b.add(0x199e98c),{onEnter(a){if(!active)return;const fp=this.context.fp;let up=0;try{up=off(fp.add(8).readPointer());}catch(e){}
 rec(1,up,off(this.returnAddress),a[1].toUInt32());}});
Interceptor.attach(b.add(0x1ab0198),{onEnter(a){if(active)rec(3,off(this.returnAddress),0,0);}});
send({s:'loadTraceReady'});
