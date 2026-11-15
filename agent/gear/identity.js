/* Validate original ELF identity per onVerifiedLuiFrame callback before
 * native reads, native calls, DDL memory mutation, or preview replacement.
 * Complements (does not replace) the prime-owned native_boot verification.
 */
import {GAME_452_FINGERPRINT as FP} from './embedded_assets.js';
export function validateGearFrame(ctx) {
  if(!ctx || !ctx.L || !ctx.native || !ctx.moduleBase || !ctx.runtime)
    return {ok:false,code:'MISSING_VERIFIED_LUI_FRAME'};
  const r=ctx.runtime;
  if(!['arch','findModule','range','hexBytes','readPointer'].every(k=>typeof r[k]==='function'))
    return {ok:false,code:'UNSUPPORTED_FRAME_RUNTIME_ADAPTER'};
  try {
    if(r.arch()!=='arm64')return {ok:false,code:'WRONG_NATIVE_ARCH'};
    const m=r.findModule(FP.module);
    if(!m||m.name!==FP.module||m.size<FP.mapped_min_size||
       m.size>FP.mapped_max_size||String(m.base)!==String(ctx.moduleBase))
      return {ok:false,code:'GAME_MODULE_IDENTITY_MISMATCH'};
    const visible=(address,n,flag='r')=>{
      if(!address||address.isNull())return false;
      const region=r.range(address);
      return !!region && region.protection.includes('r') &&
        region.protection.includes(flag) &&
        address.add(n).compare(region.base.add(region.size))<=0;
    };
    const at=n=>ctx.moduleBase.add(n);
    const build=at(FP.build_id_rva);
    if(!visible(build,FP.build_id.length/2) ||
      r.hexBytes(build,FP.build_id.length/2).toLowerCase()!==FP.build_id)
      return {ok:false,code:'GAME_BUILD_ID_MISMATCH'};
    for(const window of FP.code_windows) {
      const loc=at(window.rva);
      if(!visible(loc,window.hex.length/2,'x') ||
        r.hexBytes(loc,window.hex.length/2).toLowerCase()!==window.hex)
        return {ok:false,code:'GAME_CODE_WINDOW_MISMATCH',site:window.site};
    }
    if(!visible(ctx.L,0x30,'w'))return {ok:false,code:'LUA_STATE_UNREADABLE'};
    const topAddress=ctx.L.add(0x28);
    const top=r.readPointer(topAddress);
    if(!visible(top,1))return {ok:false,code:'LUA_STACK_UNREADABLE'};
    if(!['load','pcall','toString'].every(k=>typeof ctx.native[k]==='function'))
      return {ok:false,code:'MISSING_ORIGINAL_LUA_NATIVE_FUNCTIONS'};
    return {ok:true,code:'EXACT_WZM452_NATIVE_FRAME',
      buildId:FP.build_id,frameIdentity:String(ctx.identity??ctx.L)};
  } catch(e) {
    return {ok:false,code:'GEAR_FRAME_GUARD_EXCEPTION',error:String(e).slice(0,200)};
  }
}
