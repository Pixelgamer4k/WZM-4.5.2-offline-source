/* Original 12,082-byte compiled LuaJIT customization-hub loader.
 * Executing binary Lua and receiving pcall=0 is not UI/3D Gear Up proof.
 */
import {ORIGINAL_HUB} from './embedded_assets.js';
import {sha256Bytes,fromHex} from './sha256.js';
export const HUB_MENU_KEY =
  "for k,v in pairs(MobileMainMenuButtons) do if tostring(k):find('2b8a71f2b33a70b3',1,true) then return v.menuName end end error('missing gear key')";

export class OriginalHubLoader {
  constructor({notify=()=>{}}={}) {
    this.notify=notify;this.state='NOT_INVOKED';this.last=null;this.generation=null;
  }
  emit(x){this.last=x;try{this.notify(x);}catch(_){}return x;}
  resetLua(){this.state='NOT_INVOKED';this.last=null;this.generation=null;}
  status(){return {state:this.state,last:this.last,generation:this.generation,
    gearUpRenderableVerified:false};}
  load({adapter,generation}){
    if(this.state==='INVOKED'&&this.generation===generation)return this.emit({
      ok:true,code:'HUB_ALREADY_INVOKED_REQUIRES_READBACK',gearUpRenderableVerified:false});
    if(this.state==='FAILED'&&this.generation===generation)return this.emit({
      ok:false,code:'HUB_PREVIOUS_FAILURE_REQUIRES_RESET'});
    this.generation=generation;
    const bytes=fromHex(ORIGINAL_HUB.hex);
    if(bytes.length!==ORIGINAL_HUB.byteLength||
       sha256Bytes(bytes)!==ORIGINAL_HUB.sha256){
      this.state='FAILED';return this.emit({ok:false,code:'ORIGINAL_HUB_SOURCE_SHA256_MISMATCH'});
    }
    const ret=adapter.luaHub(bytes,HUB_MENU_KEY);
    if(!ret.ok){this.state='FAILED';return this.emit({ok:false,
      code:'ORIGINAL_HUB_NATIVE_INVOCATION_FAILED',original:ret});}
    this.state='INVOKED';
    return this.emit({ok:true,code:'ORIGINAL_HUB_NATIVE_INVOKED_UNVERIFIED_UI',
      byteLength:bytes.length,sha256:ORIGINAL_HUB.sha256,
      original:ret,gearUpRenderableVerified:false});
  }
}
