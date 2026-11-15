'use strict';
const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x);
const selectParty=new NativeFunction(at(0x160ebc8),'pointer',[]);  // returns selected party ptr
const g=at(0xc115000); // just to confirm module live
function dump(){
 let p;try{p=selectParty();}catch(e){return {err:'selectParty '+e};}
 const o={party:p.sub(b).toString(),sel61c6991:at(0x61c6991).readU8(),sel61c6992:at(0x61c6992).readU8()};
 if(!p.isNull()){
  const rd=(off,n)=>{try{return Array.from(new Uint8Array(p.add(off).readByteArray(n)));}catch(e){return 'bad';}};
  o.b4418=rd(0x4418,1)[0];o.b4419=rd(0x4419,1)[0];o.b441a=rd(0x441a,1)[0];
  o.d43d0=p.add(0x43d0).readU32();o.b4595=rd(0x4595,1)[0];o.d43f4=p.add(0x43f4).readU32();
  o.b458c=rd(0x458c,1)[0];
 }
 // also the two candidate party globals
 try{o.party_61c2578=at(0x61c2578).readPointer().sub(b).toString();}catch(e){o.party_61c2578='bad';}
 return o;
}
rpc.exports={dump(){return dump();}};
send(dump());
