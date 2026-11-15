import assert from 'node:assert/strict';
import {HOST_BINARY,createFridaHostRuntime} from './native_proof.js';

class Ptr {
  constructor(value, state) {this.value=value;this.state=state;}
  add(delta){return new Ptr(this.value+delta,this.state);}
  compare(other){return this.value<other.value?-1:this.value>other.value?1:0;}
  isNull(){return this.value===0;}
  toString(){return '0x'+this.value.toString(16);}
  readByteArray(count){
    const bytes=this.state.bytes.get(this.value);
    if(!bytes||bytes.length<count)throw new Error('read outside expected source ELF');
    return bytes.subarray(0,count);
  }
  readPointer(){
    if(this.value!==this.state.base+HOST_BINARY.botVeneerOffset+8)
      throw new Error('unexpected pointer read');
    return new Ptr(this.state.veneerTarget,this.state);
  }
}

function fixture() {
  const state={base:0x100000000,veneerTarget:0,arch:'arm64',size:HOST_BINARY.mappedMax,
    bytes:new Map(),evaluateCalls:[],sink:null};
  const write=(offset,hex)=>state.bytes.set(state.base+offset,Buffer.from(hex,'hex'));
  write(HOST_BINARY.buildIdOffset,HOST_BINARY.buildIdHex);
  for(const item of [...HOST_BINARY.codeWindows,...HOST_BINARY.nativeHooks])
    write(item.offset,item.hex);
  write(HOST_BINARY.botVeneerOffset,HOST_BINARY.botVeneerHex);
  const base=new Ptr(state.base,state);
  const ranges=[
    {base,size:0x2000,protection:'r--'},
    {base:base.add(0x10a6000),size:0x4290170,protection:'r-x'},
    {base:base.add(0x5337170),size:0x1b6af8,protection:'rw-'},
    {base:new Ptr(0x70000000,state),size:0x100000,protection:'r-x'}
  ];
  const mod={name:'libgame.so',base,size:state.size};
  const proc={
    get arch(){return state.arch;},
    findModuleByName(name){return name==='libgame.so'?{...mod,size:state.size}:null;},
    findRangeByAddress(p){return ranges.find(r=>p.value>=r.base.value &&
      p.value<r.base.value+r.size)||null;}
  };
  const scripts={evaluate(name,src){state.evaluateCalls.push({name,src});return {go(){return 1;}};}};
  return {state,write,runtime:createFridaHostRuntime({processApi:proc,scriptApi:scripts})};
}

const f=fixture();
assert.equal(f.runtime.checkBinary().ok,true,'Exact build ID plus 13 original native windows');
assert.equal(f.runtime.botVeneer().code,'HOST_SERVER_VENEER_TARGET_INVALID',
  'Fresh ELF has no genuine server veneer thunk');
f.state.veneerTarget=0x70000000;
assert.equal(f.runtime.botVeneer().ok,true,'Only a valid executable server thunk passes');
assert.equal(f.runtime.evaluate('wzm-test','source').go(),1);
assert.equal(f.state.evaluateCalls.length,1);

const wrongBinary=fixture();
wrongBinary.write(HOST_BINARY.nativeHooks[0].offset,'00'.repeat(8));
assert.equal(wrongBinary.runtime.checkBinary().code,'HOST_BINARY_OPCODE_MISMATCH');
assert.equal(wrongBinary.runtime.checkBinary().site,'host_manager');
const wrongId=fixture();
wrongId.write(HOST_BINARY.buildIdOffset,'00'.repeat(16));
assert.equal(wrongId.runtime.checkBinary().site,'GNU_BUILD_ID');
const wrongArch=fixture();wrongArch.state.arch='x64';
assert.equal(wrongArch.runtime.checkBinary().code,'HOST_UNSUPPORTED_ARCH');
const wrongSize=fixture();wrongSize.state.size=0x1000;
assert.equal(wrongSize.runtime.checkBinary().code,'HOST_WRONG_LIBGAME_SIZE');

let thrown=false;
try{createFridaHostRuntime({processApi:{arch:'arm64',findModuleByName:()=>null},scriptApi:{}})
  .evaluate('x','bad');}catch(e){thrown=/Script.evaluate/.test(String(e));}
assert.equal(thrown,true,'No external Frida client fallback for missing Script.evaluate');
console.log('PASS native WZM4.5.2 host proof: exact build ID, bounded ARM64 code-window guards, real executable server thunk, fail-closed tamper/arch/size, no default external debugger');
