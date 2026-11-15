// Frame-blending motion blur (memory-only, opt-in WZM_MBLUR=1). Must load before the swapchain is created.
// 1) widen swapchain usage (+TRANSFER_SRC/DST) at vkCreateSwapchainKHR (table slot libgame+0xadfa770)
// 2) at vkQueuePresentKHR (slot +0xadfa788): blend previous frame H over the swapchain image with a
//    motion-scaled weight (fullscreen draw, SRC_ALPHA blend), copy result back to H, present after our submit.
// Camera motion from render-view builder 0x2eb7040: origin out+0x100, forward out+0x80.
{
const E=globalThis.WZM_MBVK_ENV||{};
const MAXW=E.max===undefined?0.55:E.max, GAIN=E.gain===undefined?1.0:E.gain;
const VERT=hex('03022307000301000b0008002e0000000000000011000200010000000b00060001000000474c534c2e7374642e343530000000000e00030000000000010000000f00080000000000040000006d61696e000000000c00000018000000200000000300030002000000c201000005000400040000006d61696e00000000050003000900000070000000050006000c000000676c5f566572746578496e6465780000050003001800000075760000050006001e000000676c5f50657256657274657800000000060006001e00000000000000676c5f506f736974696f6e00060007001e00000001000000676c5f506f696e7453697a6500000000060007001e00000002000000676c5f436c697044697374616e636500060007001e00000003000000676c5f43756c6c44697374616e636500050003002000000000000000470004000c0000000b0000002a00000047000400180000001e00000000000000470003001e00000002000000480005001e000000000000000b00000000000000480005001e000000010000000b00000001000000480005001e000000020000000b00000003000000480005001e000000030000000b0000000400000013000200020000002100030003000000020000001600030006000000200000001700040007000000060000000200000020000400080000000700000007000000150004000a0000002000000001000000200004000b000000010000000a0000003b0004000b0000000c000000010000002b0004000a0000000e000000010000002b0004000a0000001000000002000000200004001700000003000000070000003b000400170000001800000003000000170004001a0000000600000004000000150004001b00000020000000000000002b0004001b0000001c000000010000001c0004001d000000060000001c0000001e0006001e0000001a000000060000001d0000001d000000200004001f000000030000001e0000003b0004001f00000020000000030000002b0004000a00000021000000000000002b0004000600000023000000000000402b00040006000000250000000000803f2b000400060000002800000000000000200004002c000000030000001a0000003600050002000000040000000000000003000000f8000200050000003b0004000800000009000000070000003d0004000a0000000d0000000c000000c40005000a0000000f0000000d0000000e000000c70005000a000000110000000f000000100000006f0004000600000012000000110000003d0004000a000000130000000c000000c70005000a0000001400000013000000100000006f00040006000000150000001400000050000500070000001600000012000000150000003e00030009000000160000003d0004000700000019000000090000003e00030018000000190000003d0004000700000022000000090000008e0005000700000024000000220000002300000050000500070000002600000025000000250000008300050007000000270000002400000026000000510005000600000029000000270000000000000051000500060000002a0000002700000001000000500007001a0000002b000000290000002a0000002800000025000000410005002c0000002d00000020000000210000003e0003002d0000002b000000fd00010038000100'),FRAG=hex('03022307000301000b000800220000000000000011000200010000000b00060001000000474c534c2e7374642e343530000000000e00030000000000010000000f00070004000000040000006d61696e0000000009000000110000001000030004000000070000000300030002000000c201000005000400040000006d61696e000000000500040009000000636f6c6f72000000050004000d000000686973746f727900050003001100000075760000050003001600000050430000060005001600000000000000776569676874000005000300180000007063000047000400090000001e00000000000000470004000d0000002100000000000000470004000d000000220000000000000047000400110000001e000000000000004700030016000000020000004800050016000000000000002300000000000000130002000200000021000300030000000200000016000300060000002000000017000400070000000600000004000000200004000800000003000000070000003b000400080000000900000003000000190009000a000000060000000100000000000000000000000000000001000000000000001b0003000b0000000a000000200004000c000000000000000b0000003b0004000c0000000d00000000000000170004000f00000006000000020000002000040010000000010000000f0000003b000400100000001100000001000000170004001400000006000000030000001e0003001600000006000000200004001700000009000000160000003b000400170000001800000009000000150004001900000020000000010000002b000400190000001a00000000000000200004001b00000009000000060000003600050002000000040000000000000003000000f8000200050000003d0004000b0000000e0000000d0000003d0004000f00000012000000110000005700050007000000130000000e000000120000004f00080014000000150000001300000013000000000000000100000002000000410005001b0000001c000000180000001a0000003d000400060000001d0000001c00000051000500060000001e000000150000000000000051000500060000001f000000150000000100000051000500060000002000000015000000020000005000070007000000210000001e0000001f000000200000001d0000003e0003000900000021000000fd00010038000100');
function hex(h){const a=new Uint8Array(h.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(h.substr(i*2,2),16);return a.buffer;}
const keep=[];function mk(n){const p=Memory.alloc(n);p.writeByteArray(new Uint8Array(n));keep.push(p);return p;}
const G={dev:null,sc:null,info:null,ready:false,disabled:false,weight:0,frames:0,errs:0};globalThis.WZM_MBVK=G;
function log(o){send(Object.assign({s:'mbvk'},o));}
let V=null;
function fns(dev){
 const lv=Process.getModuleByName('libvulkan.so');
 const gdpa=new NativeFunction(lv.getExportByName('vkGetDeviceProcAddr'),'pointer',['pointer','pointer']);
 const P='pointer',U='uint32',I='int',L='uint64',F='float',VD='void';
 const sig={vkGetSwapchainImagesKHR:[I,[P,P,P,P]],vkCreateCommandPool:[I,[P,P,P,P]],vkAllocateCommandBuffers:[I,[P,P,P]],
  vkCreateSemaphore:[I,[P,P,P,P]],vkCreateFence:[I,[P,P,P,P]],vkWaitForFences:[I,[P,U,P,U,L]],vkResetFences:[I,[P,U,P]],
  vkCreateImage:[I,[P,P,P,P]],vkGetImageMemoryRequirements:[VD,[P,P,P]],vkAllocateMemory:[I,[P,P,P,P]],vkBindImageMemory:[I,[P,P,P,L]],
  vkCreateImageView:[I,[P,P,P,P]],vkCreateSampler:[I,[P,P,P,P]],vkCreateDescriptorSetLayout:[I,[P,P,P,P]],vkCreateDescriptorPool:[I,[P,P,P,P]],
  vkAllocateDescriptorSets:[I,[P,P,P]],vkUpdateDescriptorSets:[VD,[P,U,P,U,P]],vkCreatePipelineLayout:[I,[P,P,P,P]],vkCreateRenderPass:[I,[P,P,P,P]],
  vkCreateFramebuffer:[I,[P,P,P,P]],vkCreateShaderModule:[I,[P,P,P,P]],vkCreateGraphicsPipelines:[I,[P,P,U,P,P,P]],
  vkResetCommandBuffer:[I,[P,U]],vkBeginCommandBuffer:[I,[P,P]],vkEndCommandBuffer:[I,[P]],vkCmdBeginRenderPass:[VD,[P,P,U]],vkCmdEndRenderPass:[VD,[P]],
  vkCmdBindPipeline:[VD,[P,U,P]],vkCmdBindDescriptorSets:[VD,[P,U,P,U,U,P,U,P]],vkCmdSetViewport:[VD,[P,U,U,P]],vkCmdSetScissor:[VD,[P,U,U,P]],
  vkCmdPushConstants:[VD,[P,P,U,U,U,P]],vkCmdDraw:[VD,[P,U,U,U,U]],vkCmdPipelineBarrier:[VD,[P,U,U,U,U,P,U,P,U,P]],vkCmdCopyImage:[VD,[P,P,U,P,U,U,P]],
  vkQueueSubmit:[I,[P,U,P,P]]};
 const o={};for(const n in sig){const p=gdpa(dev,Memory.allocUtf8String(n));if(p.isNull())throw Error('no '+n);o[n]=new NativeFunction(p,sig[n][0],sig[n][1]);}
 return o;
}
function ck(r,what){if(r!==0)throw Error(what+' failed '+r);}
function out(){const p=mk(8);return p;}
function barrier(img,srcA,dstA,oldL,newL){const b=mk(72);b.writeU32(45);b.add(16).writeU32(srcA);b.add(20).writeU32(dstA);b.add(24).writeU32(oldL);b.add(28).writeU32(newL);
 b.add(32).writeU32(0xffffffff);b.add(36).writeU32(0xffffffff);b.add(40).writePointer(img);b.add(48).writeU32(1);b.add(56).writeU32(1);b.add(64).writeU32(1);return b;}
const PRESENT=1000001002,COLOR=2,SHADER=5,TSRC=6,TDST=7;
function setup(){
 const v=V,dev=G.dev,w=G.info.w,h=G.info.h,fmt=G.info.format;
 const cnt=mk(4);ck(v.vkGetSwapchainImagesKHR(dev,G.sc,cnt,ptr(0)),'getImages');const n=cnt.readU32();const arr=mk(8*n);ck(v.vkGetSwapchainImagesKHR(dev,G.sc,cnt,arr),'getImages2');
 const imgs=[];for(let i=0;i<n;i++)imgs.push(arr.add(i*8).readPointer());
 const pci=mk(24);pci.writeU32(39);pci.add(16).writeU32(2);pci.add(20).writeU32(0);const pool=out();ck(v.vkCreateCommandPool(dev,pci,ptr(0),pool),'pool');
 const cai=mk(32);cai.writeU32(40);cai.add(16).writePointer(pool.readPointer());cai.add(24).writeU32(0);cai.add(28).writeU32(n);const cbs=mk(8*n);ck(v.vkAllocateCommandBuffers(dev,cai,cbs),'cbs');
 const sci=mk(24);sci.writeU32(9);const fci=mk(24);fci.writeU32(8);fci.add(16).writeU32(1);
 const sems=[],fences=[];for(let i=0;i<n;i++){const s=out();ck(v.vkCreateSemaphore(dev,sci,ptr(0),s),'sem');sems.push(s);const f=out();ck(v.vkCreateFence(dev,fci,ptr(0),f),'fence');fences.push(f);}
 // history image
 const ici=mk(88);ici.writeU32(14);ici.add(20).writeU32(1);ici.add(24).writeU32(fmt);ici.add(28).writeU32(w);ici.add(32).writeU32(h);ici.add(36).writeU32(1);
 ici.add(40).writeU32(1);ici.add(44).writeU32(1);ici.add(48).writeU32(1);ici.add(52).writeU32(0);ici.add(56).writeU32(4|2|1);ici.add(80).writeU32(0);
 const H=out();ck(v.vkCreateImage(dev,ici,ptr(0),H),'image');const req=mk(24);v.vkGetImageMemoryRequirements(dev,H.readPointer(),req);
 const bits=req.add(16).readU32();let mt=0;while(mt<32&&!((bits>>>mt)&1))mt++;
 const mai=mk(32);mai.writeU32(5);mai.add(16).writeU64(req.readU64());mai.add(24).writeU32(mt);const mem=out();ck(v.vkAllocateMemory(dev,mai,ptr(0),mem),'alloc');
 ck(v.vkBindImageMemory(dev,H.readPointer(),mem.readPointer(),uint64(0)),'bind');
 function view(img){const c=mk(80);c.writeU32(15);c.add(24).writePointer(img);c.add(32).writeU32(1);c.add(36).writeU32(fmt);c.add(56).writeU32(1);c.add(64).writeU32(1);c.add(72).writeU32(1);const o=out();ck(v.vkCreateImageView(dev,c,ptr(0),o),'view');return o.readPointer();}
 const hView=view(H.readPointer());const scViews=imgs.map(view);
 const smi=mk(80);smi.writeU32(31);smi.add(20).writeU32(1);smi.add(24).writeU32(1);smi.add(32).writeU32(2);smi.add(36).writeU32(2);smi.add(40).writeU32(2);smi.add(52).writeFloat(1);const samp=out();ck(v.vkCreateSampler(dev,smi,ptr(0),samp),'sampler');
 const bind=mk(24);bind.writeU32(0);bind.add(4).writeU32(1);bind.add(8).writeU32(1);bind.add(12).writeU32(0x10);
 const dli=mk(32);dli.writeU32(32);dli.add(20).writeU32(1);dli.add(24).writePointer(bind);const dsl=out();ck(v.vkCreateDescriptorSetLayout(dev,dli,ptr(0),dsl),'dsl');
 const ps=mk(8);ps.writeU32(1);ps.add(4).writeU32(1);const dpi=mk(40);dpi.writeU32(33);dpi.add(20).writeU32(1);dpi.add(24).writeU32(1);dpi.add(32).writePointer(ps);const dpool=out();ck(v.vkCreateDescriptorPool(dev,dpi,ptr(0),dpool),'dpool');
 const dai=mk(40);dai.writeU32(34);dai.add(16).writePointer(dpool.readPointer());dai.add(24).writeU32(1);dai.add(32).writePointer(dsl);const set=out();ck(v.vkAllocateDescriptorSets(dev,dai,set),'set');
 const dii=mk(24);dii.writePointer(samp.readPointer());dii.add(8).writePointer(hView);dii.add(16).writeU32(SHADER);
 const wr=mk(64);wr.writeU32(35);wr.add(16).writePointer(set.readPointer());wr.add(32).writeU32(1);wr.add(36).writeU32(1);wr.add(40).writePointer(dii);v.vkUpdateDescriptorSets(dev,1,wr,0,ptr(0));
 const pcr=mk(12);pcr.writeU32(0x10);pcr.add(8).writeU32(4);const pli=mk(48);pli.writeU32(30);pli.add(20).writeU32(1);pli.add(24).writePointer(dsl);pli.add(32).writeU32(1);pli.add(40).writePointer(pcr);
 const layout=out();ck(v.vkCreatePipelineLayout(dev,pli,ptr(0),layout),'layout');
 const att=mk(36);att.add(4).writeU32(fmt);att.add(8).writeU32(1);att.add(12).writeU32(0);att.add(16).writeU32(0);att.add(20).writeU32(2);att.add(24).writeU32(1);att.add(28).writeU32(PRESENT);att.add(32).writeU32(TSRC);
 const aref=mk(8);aref.add(4).writeU32(COLOR);const sub=mk(72);sub.add(24).writeU32(1);sub.add(32).writePointer(aref);
 const dep=mk(56);dep.writeU32(0xffffffff);dep.add(4).writeU32(0);dep.add(8).writeU32(0x10000);dep.add(12).writeU32(0x400);dep.add(16).writeU32(0x10000);dep.add(20).writeU32(0x180);
 dep.add(28).writeU32(0);dep.add(32).writeU32(0xffffffff);dep.add(36).writeU32(0x400);dep.add(40).writeU32(0x1000);dep.add(44).writeU32(0x100);dep.add(48).writeU32(0x800);
 const rpi=mk(64);rpi.writeU32(38);rpi.add(20).writeU32(1);rpi.add(24).writePointer(att);rpi.add(32).writeU32(1);rpi.add(40).writePointer(sub);rpi.add(48).writeU32(2);rpi.add(56).writePointer(dep);
 const rp=out();ck(v.vkCreateRenderPass(dev,rpi,ptr(0),rp),'renderpass');
 const fbs=scViews.map(sv=>{const a=mk(8);a.writePointer(sv);const c=mk(64);c.writeU32(37);c.add(24).writePointer(rp.readPointer());c.add(32).writeU32(1);c.add(40).writePointer(a);c.add(48).writeU32(w);c.add(52).writeU32(h);c.add(56).writeU32(1);const o=out();ck(v.vkCreateFramebuffer(dev,c,ptr(0),o),'fb');return o.readPointer();});
 function mod(code){const m=Memory.alloc(code.byteLength);m.writeByteArray(code);keep.push(m);const c=mk(40);c.writeU32(16);c.add(24).writeU64(code.byteLength);c.add(32).writePointer(m);const o=out();ck(v.vkCreateShaderModule(dev,c,ptr(0),o),'shader');return o.readPointer();}
 const vm=mod(VERT),fm=mod(FRAG);const main=Memory.allocUtf8String('main');keep.push(main);
 const st=mk(96);st.writeU32(18);st.add(20).writeU32(1);st.add(24).writePointer(vm);st.add(32).writePointer(main);st.add(48).writeU32(18);st.add(68).writeU32(0x10);st.add(72).writePointer(fm);st.add(80).writePointer(main);
 const vi=mk(48);vi.writeU32(19);const ia=mk(32);ia.writeU32(20);ia.add(20).writeU32(3);const vp=mk(48);vp.writeU32(22);vp.add(20).writeU32(1);vp.add(32).writeU32(1);
 const rs=mk(64);rs.writeU32(23);rs.add(56).writeFloat(1);const ms=mk(48);ms.writeU32(24);ms.add(20).writeU32(1);
 const cba=mk(32);cba.writeU32(1);cba.add(4).writeU32(6);cba.add(8).writeU32(7);cba.add(16).writeU32(0);cba.add(20).writeU32(1);cba.add(28).writeU32(7);
 const cb=mk(56);cb.writeU32(26);cb.add(28).writeU32(1);cb.add(32).writePointer(cba);
 const dsv=mk(8);dsv.writeU32(0);dsv.add(4).writeU32(1);const ds=mk(32);ds.writeU32(27);ds.add(20).writeU32(2);ds.add(24).writePointer(dsv);
 const gp=mk(144);gp.writeU32(28);gp.add(20).writeU32(2);gp.add(24).writePointer(st);gp.add(32).writePointer(vi);gp.add(40).writePointer(ia);gp.add(56).writePointer(vp);gp.add(64).writePointer(rs);gp.add(72).writePointer(ms);
 gp.add(88).writePointer(cb);gp.add(96).writePointer(ds);gp.add(104).writePointer(layout.readPointer());gp.add(112).writePointer(rp.readPointer());gp.add(136).writeS32(-1);
 const pipe=out();ck(v.vkCreateGraphicsPipelines(dev,ptr(0),1,gp,ptr(0),pipe),'pipeline');
 // per-frame structures
 const R={n,imgs,cbs:[],sems,fences,H:H.readPointer(),rp:rp.readPointer(),fbs,pipe:pipe.readPointer(),layout:layout.readPointer(),set,w,h,hInit:false};
 for(let i=0;i<n;i++)R.cbs.push(cbs.add(i*8).readPointer());
 R.bi=mk(32);R.bi.writeU32(42);R.bi.add(16).writeU32(1);
 R.rpb=imgs.map((_,i)=>{const b=mk(64);b.writeU32(43);b.add(16).writePointer(R.rp);b.add(24).writePointer(fbs[i]);b.add(40).writeU32(w);b.add(44).writeU32(h);return b;});
 R.vpd=mk(24);R.vpd.add(8).writeFloat(w);R.vpd.add(12).writeFloat(h);R.vpd.add(20).writeFloat(1);R.sc=mk(16);R.sc.add(8).writeU32(w);R.sc.add(12).writeU32(h);
 R.wt=mk(4);R.region=mk(68);R.region.writeU32(1);R.region.add(12).writeU32(1);R.region.add(28).writeU32(1);R.region.add(40).writeU32(1);R.region.add(56).writeU32(w);R.region.add(60).writeU32(h);R.region.add(64).writeU32(1);
 R.bFirstS=imgs.map(im=>barrier(im,0x10000,0x800,PRESENT,TSRC));
 R.bH0=barrier(R.H,0,0x1000,0,TDST);R.bH1=barrier(R.H,0x20,0x1000,SHADER,TDST);R.bH2=barrier(R.H,0x1000,0x20,TDST,SHADER);
 R.bSback=imgs.map(im=>barrier(im,0x800,0,TSRC,PRESENT));
 R.submit=mk(72);R.stages=mk(4*16);for(let i=0;i<16;i++)R.stages.add(i*4).writeU32(0x10000);R.cbp=mk(8);
 G.R=R;G.ready=true;log({step:'setupDone',images:n,w,h,format:fmt,memType:mt});
}
function record(i){
 const v=V,R=G.R,cb=R.cbs[i],wgt=G.weight;
 ck(v.vkResetCommandBuffer(cb,0),'reset');ck(v.vkBeginCommandBuffer(cb,R.bi),'begin');
 if(R.hInit&&wgt>0.01){
  v.vkCmdBeginRenderPass(cb,R.rpb[i],0);v.vkCmdBindPipeline(cb,0,R.pipe);v.vkCmdBindDescriptorSets(cb,0,R.layout,0,1,R.set,0,ptr(0));
  v.vkCmdSetViewport(cb,0,1,R.vpd);v.vkCmdSetScissor(cb,0,1,R.sc);R.wt.writeFloat(wgt);v.vkCmdPushConstants(cb,R.layout,0x10,0,4,R.wt);v.vkCmdDraw(cb,3,1,0,0);v.vkCmdEndRenderPass(cb);
 }else v.vkCmdPipelineBarrier(cb,0x10000,0x1000,0,0,ptr(0),0,ptr(0),1,R.bFirstS[i]);
 v.vkCmdPipelineBarrier(cb,0x10000,0x1000,0,0,ptr(0),0,ptr(0),1,R.hInit?R.bH1:R.bH0);
 v.vkCmdCopyImage(cb,R.imgs[i],TSRC,R.H,TDST,1,R.region);
 v.vkCmdPipelineBarrier(cb,0x1000,0x10000,0,0,ptr(0),0,ptr(0),1,R.bH2);
 v.vkCmdPipelineBarrier(cb,0x1000,0x2000,0,0,ptr(0),0,ptr(0),1,R.bSback[i]);
 ck(v.vkEndCommandBuffer(cb),'end');R.hInit=true;
}
function onPresent(queue,pi){
 if(G.disabled||!G.sc)return;
 if(pi.add(32).readU32()!==1)return;
 const sc=pi.add(40).readPointer().readPointer();if(!sc.equals(G.sc))return;
 if(!G.ready)return;
 const R=G.R,i=pi.add(48).readPointer().readU32();if(i>=R.n)return;
 const f=R.fences[i];if(V.vkWaitForFences(G.dev,1,f,1,uint64(200000000))!==0)return;V.vkResetFences(G.dev,1,f);
 record(i);
 const wc=pi.add(16).readU32(),ws=pi.add(24).readPointer();
 const s=R.submit;s.writeU32(4);s.add(16).writeU32(wc);s.add(24).writePointer(ws);s.add(32).writePointer(R.stages);s.add(40).writeU32(1);R.cbp.writePointer(R.cbs[i]);s.add(48).writePointer(R.cbp);s.add(56).writeU32(1);s.add(64).writePointer(R.sems[i]);
 ck(V.vkQueueSubmit(queue,1,s,f.readPointer()),'submit');
 pi.add(16).writeU32(1);pi.add(24).writePointer(R.sems[i]);
 G.frames++;if(G.frames===1||G.frames%600===0)log({step:'frames',frames:G.frames,weight:+G.weight.toFixed(3)});
}
function hookCreate(fn){if(G.createHooked)return;G.createHooked=true;
 Interceptor.attach(fn,{onEnter(a){const ci=a[1];this.ci=ci;this.out=a[3];G.dev=a[0];const u=ci.add(56).readU32();ci.add(56).writeU32(u|3);
  this.info={format:ci.add(36).readU32(),w:ci.add(44).readU32(),h:ci.add(48).readU32(),usage:u};},
  onLeave(r){if(r.toInt32()===0){G.sc=this.out.readPointer();G.info=this.info;G.ready=false;log({step:'swapchain',info:this.info,sc:G.sc.toString()});
  setTimeout(()=>{try{if(!V)V=fns(G.dev);log({step:'fnsOk'});setup();}catch(e){G.disabled=true;log({step:'setupError',e:String(e),stack:String(e.stack).slice(0,300)});}},(E.delayMs===undefined?3000:E.delayMs));}}});}
function hookPresent(fn){if(G.presentHooked)return;G.presentHooked=true;
 Interceptor.attach(fn,{onEnter(a){try{onPresent(a[0],a[1]);}catch(e){G.errs++;if(G.errs<4)log({step:'error',e:String(e)});if(G.errs>=3){G.disabled=true;log({step:'disabled'});}}}});log({step:'presentHooked'});}
function hookMotion(b){let prevO=null,prevF=null,prevT=0,sm=0;
 Interceptor.attach(b.add(0x2eb7040),{onEnter(a){this.o=a[0];},onLeave(){try{const o=this.o,t=Date.now();
  const org=[o.add(0x100).readFloat(),o.add(0x104).readFloat(),o.add(0x108).readFloat()];const fr=[o.add(0x80).readFloat(),o.add(0x84).readFloat(),o.add(0x88).readFloat()];
  const fl=Math.hypot(fr[0],fr[1],fr[2])||1,fw=[fr[0]/fl,fr[1]/fl,fr[2]/fl];let target=0;
  if(prevO&&t>prevT){const dt=Math.min(0.1,(t-prevT)/1000)||0.016;const sp=Math.hypot(org[0]-prevO[0],org[1]-prevO[1],org[2]-prevO[2])/dt;
   const turn=Math.acos(Math.max(-1,Math.min(1,fw[0]*prevF[0]+fw[1]*prevF[1]+fw[2]*prevF[2])))*180/Math.PI/dt;
   if(sp<5000)target=GAIN*(Math.max(0,sp-150)/350*0.25+Math.max(0,turn-40)/300*0.45);}
  sm+=(Math.min(MAXW,target)-sm)*0.3;prevO=org;prevF=fw;prevT=t;G.weight=sm;}catch(e){}}});}
function arm(m){const b=m.base;
 const lv=Process.findModuleByName('libvulkan.so');
 if(lv){try{Interceptor.attach(lv.getExportByName('vkGetDeviceProcAddr'),{onEnter(a){this.n=a[1].readCString();},onLeave(r){if(r.isNull())return;if(this.n==='vkCreateSwapchainKHR')hookCreate(r);if(this.n==='vkQueuePresentKHR')hookPresent(r);}});}catch(e){log({step:'gdpaErr',e:String(e)});}}
 const t=setInterval(()=>{try{const c=b.add(0xadfa770).readPointer(),p=b.add(0xadfa788).readPointer();if(!c.isNull())hookCreate(c);if(!p.isNull())hookPresent(p);if(G.createHooked&&G.presentHooked)clearInterval(t);}catch(e){}},1);
 hookMotion(b);log({step:'armed',max:MAXW,gain:GAIN});}
const m=Process.findModuleByName('libgame.so');
if(m)arm(m);else{const t=setInterval(()=>{const mm=Process.findModuleByName('libgame.so');if(mm){clearInterval(t);arm(mm);}},2);}
}
