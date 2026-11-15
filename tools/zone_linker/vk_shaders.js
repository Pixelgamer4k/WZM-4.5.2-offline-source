// Capture every SPIR-V module the game creates (vkCreateShaderModule) + pipeline vertex input layouts.
let csm=null,cgp=null;
for(const m of Process.enumerateModules()){if(!/libvulkan/.test(m.name))continue;
 for(const s of m.enumerateSymbols()){if(/CreateShaderModule/.test(s.name)&&!csm)csm=s.address;if(/CreateGraphicsPipelines/.test(s.name)&&!cgp)cgp=s.address;}}
send({s:'vkHooks',csm:csm&&csm.toString(),cgp:cgp&&cgp.toString()});
let n=0;
if(csm)Interceptor.attach(csm,{onEnter(a){const ci=a[1];const size=ci.add(24).readU64().toNumber(),code=ci.add(32).readPointer();n++;
 send({s:'spv',n,size},code.readByteArray(size));}});
