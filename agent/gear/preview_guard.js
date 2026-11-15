/* Explicit in-process native 4.5.2 preview crash guard, not model streaming.
 * Based on original frontend_preview_guard.js, does not install a new LUI hook.
 */
export class NativePreviewSafety {
  constructor({notify=()=>{}}={}) {
    this.notify=notify;this.installed=false;this.disposeNative=null;
    this.skipped=0;this.passed=0;this.error=null;this.disposed=false;
  }
  emit(x){try{this.notify(x);}catch(_){}return x;}
  status() {return {installed:this.installed,skipped:this.skipped,
    passed:this.passed,error:this.error,disposed:this.disposed,
    modelStreamingVerified:false};}
  install(adapter,{explicitGearUpIntent=false}={}) {
    if(this.disposed)return this.emit({ok:false,code:'PREVIEW_GUARD_DISPOSED'});
    if(this.installed)return this.emit({ok:true,code:'PREVIEW_GUARD_ALREADY_OWNED',
      previewCrashProtectionOnly:true,modelStreamingVerified:false});
    if(!explicitGearUpIntent)return this.emit({ok:false,code:'EXPLICIT_PREVIEW_GUARD_INTENT_REQUIRED'});
    if(this.error)return this.emit({ok:false,code:'PREVIEW_PREVIOUS_FAILURE',
      error:this.error});
    try {
      this.disposeNative=adapter.installPreview((original,a,index,name)=>{
        const status=adapter.previewClient();
        if(!status.ready){
          this.skipped++;
          if(this.skipped<=5)this.emit({event:'PREVIEW_CLIENT_MISSING_SKIP',skipped:this.skipped,
            client:status});
          return 0;
        }
        try{const ret=original(a,index,name);this.passed++;return ret;}
        catch(e){this.error='PREVIEW_CALLBACK_EXCEPTION: '+String(e).slice(0,100);
          this.emit({event:'PREVIEW_CALLBACK_EXCEPTION',error:this.error});return 0;}
      });
      this.installed=true;
      return this.emit({ok:true,code:'PREVIEW_NULL_CLIENT_GUARD_OWNED',
        previewCrashProtectionOnly:true,modelStreamingVerified:false,
        nativeClientConnected:false});
    } catch(e) {
      this.error=String(e).slice(0,200);
      return this.emit({ok:false,code:'PREVIEW_GUARD_NATIVE_INSTALL_FAILED',error:this.error});
    }
  }
  dispose() {
    if(this.disposed)return;
    if(this.disposeNative) {
      try{this.disposeNative();}catch(e){this.error=String(e).slice(0,200);}
    }
    this.installed=false;this.disposed=true;
  }
}
