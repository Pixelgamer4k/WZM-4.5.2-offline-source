// Read-only: record the GPU pass sequence of one frame (render passes, subpasses, draws, dispatches, copies).
{
const b=Process.getModuleByName('libgame.so').base,slot=o=>b.add(0xadfa000+o).readPointer();
let rec=false,done=false,seq=[],cur=new Map(),frame=0;const hs=[];
function ev(cb,e){if(!rec)return;seq.push(e);}
hs.push(Interceptor.attach(slot(0x788),{onEnter(){frame++;if(done)return;if(rec){rec=false;done=true;send({s:'frameSeq',n:seq.length,seq:seq.slice(0,400)});return;}if(frame>=3)rec=true;}}));
hs.push(Interceptor.attach(slot(0x370),{onEnter(a){if(!rec)return;const i=a[1];cur.set(a[0].toString(),{t:'RP',cb:a[0].toString().slice(-6),rp:i.add(16).readPointer().toString().slice(-8),fb:i.add(24).readPointer().toString().slice(-8),w:i.add(40).readU32(),h:i.add(44).readU32(),clears:i.add(48).readU32(),draws:0,sub:0});}}));
hs.push(Interceptor.attach(slot(0x430),{onEnter(a){const c=cur.get(a[0].toString());if(c)c.sub++;}}));
hs.push(Interceptor.attach(slot(0x418),{onEnter(a){if(!rec)return;const k=a[0].toString(),c=cur.get(k);if(c){seq.push(c);cur.delete(k);}}}));
for(const o of [0x3f0,0x3f8,0x400])hs.push(Interceptor.attach(slot(o),{onEnter(a){if(!rec)return;const c=cur.get(a[0].toString());if(c)c.draws++;}}));
hs.push(Interceptor.attach(slot(0x3e0),{onEnter(a){if(!rec)return;const c=cur.get(a[0].toString());if(!c)seq.push({t:'DISPATCH',cb:a[0].toString().slice(-6),x:a[1].toInt32(),y:a[2].toInt32()});}}));
hs.push(Interceptor.attach(slot(0x3c8),{onEnter(a){if(rec)seq.push({t:'COPY',cb:a[0].toString().slice(-6)});}}));
hs.push(Interceptor.attach(slot(0x398),{onEnter(a){if(rec)seq.push({t:'BLIT',cb:a[0].toString().slice(-6)});}}));
setTimeout(()=>{hs.forEach(h=>h.detach());if(!done)send({s:'frameSeqPartial',frame,n:seq.length,seq:seq.slice(0,400)});},4000);
}
