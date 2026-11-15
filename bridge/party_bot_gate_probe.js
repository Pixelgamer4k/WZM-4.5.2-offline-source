{
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const getParty=new NativeFunction(at(0x1601ffc),'pointer',[]);
const gate=new NativeFunction(at(0x160ac1c),'int',['pointer']);
const cap=new NativeFunction(at(0x160aa70),'int',['pointer','int']);
const p=getParty();
const dv=o=>{const d=at(o).readPointer().readPointer();return {dvar:d.sub(0).toString(),v28:d.add(0x28).readU64().toString(16)};};
send({s:'partyGate',party:p.toString(),partyOff:p.sub(b).toString(16),
 f43d0:p.add(0x43d0).readU32(),f4650:p.add(0x4650).readU64().toString(16),f54:p.add(0x54).readU64().toString(16),
 f43d0x380:p.add(0x4050+0x380).readU32(),f43c9:p.add(0x4050+0x3c9).readU8(),
 dv7b8:dv(0x54bd7b8),dv798:dv(0x54bd798),gate:gate(p)&1,cap1:cap(p,1)&1});
}
