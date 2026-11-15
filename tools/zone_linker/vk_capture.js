// After-boot capture: SPIR-V modules (vkCreateShaderModule) and graphics pipelines (vertex input + stage modules).
let csm=null,cgp=null;
for(const m of Process.enumerateModules()){if(!/libvulkan/.test(m.name))continue;
 for(const s of m.enumerateSymbols()){if(/3api.*CreateShaderModule/.test(s.name)&&!csm)csm=s.address;if(/3api.*CreateGraphicsPipelines/.test(s.name)&&!cgp)cgp=s.address;}}
send({s:'vkHooks',csm:csm&&csm.toString(),cgp:cgp&&cgp.toString()});
let n=0;
if(csm)Interceptor.attach(csm,{onEnter(a){this.out=a[3];const ci=a[1];this.size=ci.add(24).readU64().toNumber();this.code=ci.add(32).readPointer();},
 onLeave(r){n++;let h='0';try{h=this.out.readPointer().toString();}catch(e){}send({s:'spv',n,h,size:this.size},this.code.readByteArray(this.size));}});
function layout(vi){if(vi.isNull())return null;const nb=vi.add(20).readU32(),pb=vi.add(24).readPointer(),na=vi.add(32).readU32(),pa=vi.add(40).readPointer();
 const B=[],A=[];for(let i=0;i<nb;i++){const e=pb.add(i*12);B.push([e.readU32(),e.add(4).readU32(),e.add(8).readU32()]);}
 for(let i=0;i<na;i++){const e=pa.add(i*16);A.push([e.readU32(),e.add(4).readU32(),e.add(8).readU32(),e.add(12).readU32()]);}return {B,A};}
if(cgp)Interceptor.attach(cgp,{onEnter(a){const cnt=a[2].toUInt32(),ci=a[3];
 for(let i=0;i<cnt;i++){const c=ci.add(i*144);try{const sc=c.add(20).readU32(),st=c.add(24).readPointer();const stages=[];
  for(let j=0;j<sc;j++){const s=st.add(j*48);stages.push([s.add(20).readU32(),s.add(24).readPointer().toString()]);}
  send({s:'pipe',stages,L:layout(c.add(32).readPointer())});}catch(e){send({s:'pipeErr',e:String(e)});}}}});
send({s:'vkReady'});
