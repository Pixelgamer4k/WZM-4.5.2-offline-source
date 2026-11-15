// Live dvar writer for graphics experiments (memory-only). rpc: get(hashHex), set(hashHex, value)
const b=Process.getModuleByName('libgame.so').base;
const d1=b.add(0x54bd7b8).readPointer().readPointer();const S=0x58;
function ok(p){try{const h=p.readU64();const t=p.add(0x15).readU8(),z=p.add(8).readU64();return !h.equals(0)&&z.equals(0)&&t<16&&p.add(0x14).readU8()<=1;}catch(e){return false;}}
const idx={};
for(const dir of [-1,1]){let p=dir>0?d1.add(S):d1;let miss=0;while(miss<400){if(ok(p)){miss=0;idx[p.readU64().toString(16)]=p;}else miss++;p=p.add(dir*S);}}
function info(p){const t=p.add(0x15).readU8();return {type:t,cur:t===1?p.add(0x28).readFloat():p.add(0x28).readS32(),def:t===1?p.add(0x48).readFloat():p.add(0x48).readS32(),lo:p.add(0x18).readS32(),hi:p.add(0x1c).readS32(),flags:p.add(0x10).readU32()};}
rpc.exports={
 count(){return Object.keys(idx).length;},
 get(h){const p=idx[h];return p?info(p):null;},
 set(h,v){const p=idx[h];if(!p)return null;const t=p.add(0x15).readU8();
   if(t===1){p.add(0x28).writeFloat(v);p.add(0x38).writeFloat(v);}else{p.add(0x28).writeS32(v);p.add(0x38).writeS32(v);}
   return info(p);},
 dump(){const o={};for(const k in idx)o[k]=info(idx[k]);return o;}
};
