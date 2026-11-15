// Capture distinct Vulkan vertex input layouts (vkCreateGraphicsPipelines) + vertex buffer binds.
const b=Process.getModuleByName('libgame.so').base;const T=b.add(0xadfa000);
let cgp=null,bind=null;const names={};
for(let o=0;o<0x900;o+=8){let p;try{p=T.add(o).readPointer();}catch(e){continue}
 if(p.isNull())continue;const s=DebugSymbol.fromAddress(p);const n=(s&&s.name)||'';names[o]=n;
 if(/CreateGraphicsPipelines/.test(n))cgp=p;if(/CmdBindVertexBuffers$/.test(n))bind=p;}
send({s:'vkTable',cgp:cgp&&cgp.toString(),bind:bind&&bind.toString(),sample:Object.entries(names).filter(([o,n])=>/Pipeline|VertexBuffer/.test(n)).slice(0,12)});
const seen={};let n=0;
function layout(vi){const nb=vi.add(20).readU32(),pb=vi.add(24).readPointer(),na=vi.add(32).readU32(),pa=vi.add(40).readPointer();
 const B=[],A=[];for(let i=0;i<nb;i++){const e=pb.add(i*12);B.push([e.readU32(),e.add(4).readU32(),e.add(8).readU32()]);}
 for(let i=0;i<na;i++){const e=pa.add(i*16);A.push([e.readU32(),e.add(4).readU32(),e.add(8).readU32(),e.add(12).readU32()]);}
 return {B,A};}
if(cgp)Interceptor.attach(cgp,{onEnter(a){const cnt=a[2].toUInt32(),ci=a[3];
 for(let i=0;i<cnt;i++){const c=ci.add(i*144);let vi;try{vi=c.add(32).readPointer();}catch(e){continue}
  if(vi.isNull())continue;try{const L=layout(vi);const k=JSON.stringify(L);if(!seen[k]){seen[k]=1;n++;if(n<=300)send({s:'layout',n,L});}}catch(e){}}}});
send({s:'vkReady'});
