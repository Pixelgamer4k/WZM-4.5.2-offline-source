/* Read-only, Frida-17 game-binary guard for the ORIGINAL WZM 4.5.2 host.
 * Does not patch any memory, attach hooks, use root or open a network socket.
 * A matching ELF makes an instrumented call-site eligible, NOT a playable host.
 */

export const HOST_BINARY = Object.freeze({
  moduleName: 'libgame.so', arch: 'arm64',
  mappedMin: 233086992, mappedMax: 233091072,
  fileSha256: 'c8f5e9df317b7442567e61255ac7894bbf1b6693c30fcfd3a6ee6cde6c04b7d7',
  buildIdOffset: 0x610,
  buildIdHex: '9528f1d264b40639b57e14998e01d080',
  codeWindows: Object.freeze([
    // Original ELF PT_LOAD VA -> file mapping, not raw RVA as file offset.
    {name:'lui_frame',offset:0x337c1e0,hex:'fd830091ff0306d11b0a019058d03bd5081740f9f303002a7b8746f9a8831cf8'},
    {name:'lua_load',offset:0x4490798,hex:'a81640f97f0000f109000090291121914a01839aa8831ff8e8230091e18b00a9'},
    {name:'lua_pcall',offset:0x4486be4,hex:'494d298b6ae208913f0108eb29318a9a0c000014081440f9e3031faa09210091'},
    {name:'lua_tostring',offset:0x4483740,hex:'284d288b1f010aebc3050054080840f908e10891080140f909fd6f933f150031'},
  ]),
  nativeHooks: Object.freeze([
    {name:'host_manager',offset:0x1617e74,hex:'ff8302d1fd7b04a9'},
    {name:'party_host_start',offset:0x1621ab0,hex:'ffc301d1fd7b02a9'},
    {name:'gametype_set',offset:0x1e51c3c,hex:'fd7bbfa9fd030091'},
    {name:'bot_creator',offset:0x3cd6960,hex:'ff4302d1fd7b05a9'},
    {name:'bot_difficulty_set',offset:0x265ea3c,hex:'ff8301d1fd7b02a9'},
    {name:'bot_gamestate',offset:0x3cd53bc,hex:'ffc302d1fd7b05a9'},
    {name:'bot_enterworld',offset:0x3cd0a00,hex:'fd7bbaa9fb0b00f9'},
    {name:'server_tick',offset:0x3cf10e0,hex:'ff4303d1e923066d'},
    {name:'team_readback',offset:0x3cd7598,hex:'ff0301d1fd7b01a9'},
  ]),
  // The original bot creator patches this veneer only AFTER party and host
  // setup. Stock file contains zero padding, not a callable thunk.
  botVeneerOffset: 0x3cd7b20,
  botVeneerHex: '50000058' + '00021fd6', // ldr x16, #8 ; br x16
});

function hexOf(byteArray) {
  return Array.from(new Uint8Array(byteArray || [])).map(x=>x.toString(16).padStart(2,'0')).join('');
}

export function createFridaHostRuntime({processApi=null, scriptApi=null, logger=()=>{}}={}) {
  // Resolve Frida globals only when runtime methods are invoked, so this file
  // remains importable in offline Node tests without a connected Android phone.
  const proc = () => processApi || (typeof Process === 'undefined' ? null : Process);
  const scripts = () => scriptApi || (typeof Script === 'undefined' ? null : Script);
  const findRange = address => proc()?.findRangeByAddress(address) || null;

  function safeReadable(address, length, executable=false) {
    if (!address || address.isNull()) return false;
    const range = findRange(address);
    if (!range || !range.protection.includes('r') ||
        (executable && !range.protection.includes('x'))) return false;
    return address.add(length).compare(range.base.add(range.size)) <= 0;
  }

  function module() {
    const p = proc();
    return p ? p.findModuleByName(HOST_BINARY.moduleName) : null;
  }

  function checkBinary() {
    try {
      const p=proc();
      if(!p || p.arch!==HOST_BINARY.arch) return {ok:false,code:'HOST_UNSUPPORTED_ARCH'};
      const mod=module();
      if(!mod || mod.name!==HOST_BINARY.moduleName ||
         mod.size<HOST_BINARY.mappedMin || mod.size>HOST_BINARY.mappedMax)
        return {ok:false,code:'HOST_WRONG_LIBGAME_SIZE'};
      const windows=[{name:'GNU_BUILD_ID',offset:HOST_BINARY.buildIdOffset,hex:HOST_BINARY.buildIdHex},
        ...HOST_BINARY.codeWindows,...HOST_BINARY.nativeHooks];
      for(const {name,offset,hex} of windows){
        const addr=mod.base.add(offset);
        if(!safeReadable(addr,hex.length/2,name!=='GNU_BUILD_ID'))
          return {ok:false,code:'HOST_BINARY_WINDOW_UNREADABLE',site:name};
        const actual=hexOf(addr.readByteArray(hex.length/2));
        if(actual!==hex) return {ok:false,code:'HOST_BINARY_OPCODE_MISMATCH',site:name};
      }
      return {ok:true,code:'EXACT_452_HOST_BINARY_CONFIRMED',
        moduleBase:mod.base.toString(),mappedBytes:mod.size,
        buildId:HOST_BINARY.buildIdHex};
    }catch(e){
      return {ok:false,code:'HOST_BINARY_PROBE_EXCEPTION',error:String(e).slice(0,180)};
    }
  }

  function botVeneer() {
    try{
      const mod=module();
      if(!mod) return {ok:false,code:'HOST_LIBGAME_UNMAPPED'};
      const pos=mod.base.add(HOST_BINARY.botVeneerOffset);
      if(!safeReadable(pos,16,true))return {ok:false,code:'HOST_BOT_VENEER_UNREADABLE'};
      const op=hexOf(pos.readByteArray(8));
      if(op!==HOST_BINARY.botVeneerHex) return {ok:false,code:'HOST_SERVER_VENEER_NOT_PREPARED',actual:op};
      const thunk=pos.add(8).readPointer();
      if(thunk.isNull() || !safeReadable(thunk,4,true))
        return {ok:false,code:'HOST_SERVER_VENEER_TARGET_INVALID'};
      return {ok:true,code:'HOST_SERVER_VENEER_VERIFIED',target:thunk.toString()};
    }catch(e){return {ok:false,code:'HOST_SERVER_VENEER_EXCEPTION',error:String(e).slice(0,180)};}
  }

  function evaluate(name,source) {
    const s=scripts();
    if(!s || typeof s.evaluate!=='function')
      throw new Error('Frida 17 Script.evaluate is unavailable; cannot run native host module');
    const out=s.evaluate(name,source);
    if(out && typeof out.then==='function')
      throw new Error('Async Script.evaluate requires a separate stateful loader; sync dispatch refused');
    return out;
  }

  function setEventSink(handler) {
    const old=globalThis.WZM_STANDALONE_EVENT_SINK;
    globalThis.WZM_STANDALONE_EVENT_SINK=handler;
    return () => {if(globalThis.WZM_STANDALONE_EVENT_SINK===handler)
      globalThis.WZM_STANDALONE_EVENT_SINK=old;};
  }

  function invokeFrameProbe() {
    const f=globalThis.WZM_HOST_MATCH_PROBE_FRAME;
    if(typeof f==='function') f();
  }

  return Object.freeze({checkBinary,botVeneer,evaluate,setEventSink,invokeFrameProbe,
    now:()=>Date.now(),log:message=>logger(String(message))});
}
