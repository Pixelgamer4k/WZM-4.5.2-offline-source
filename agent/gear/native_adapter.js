/* Game-internal operations only. Construct from a validated LUI-frame context;
 * no independent hook/thread, shell, root, ADB, filesystem or network.
 * Inject a fake adapter in tests instead of executing this Frida path.
 */
export function createGearNativeAdapter(ctx) {
  const base=ctx.moduleBase, runtime=ctx.runtime;
  const at=rva=>base.add(rva);
  const view={
    at, readPointer:p=>runtime.readPointer(p),
    writePointer:(p,v)=>runtime.writePointer(p,v),
    readU8:p=>p.readU8(), readU32:p=>p.readU32(), readS32:p=>p.readS32(),
    writeU8:(p,v)=>p.writeU8(v),writeU32:(p,v)=>p.writeU32(v),
    readable(p,n=1,write=false){
      if(!p||p.isNull())return false;
      const range=runtime.range(p);
      return !!range&&range.protection.includes('r')&&
        (!write||range.protection.includes('w'))&&
        p.add(n).compare(range.base.add(range.size))<=0;
    },
    map(size) {
      const symbol=Module.getGlobalExportByName('mmap');
      if(!symbol||symbol.isNull())throw Error('mmap export missing');
      const fn=new NativeFunction(symbol,'pointer',['pointer','size_t','int','int','int','long']);
      const out=fn(ptr(0),size,3,0x22,-1,0);
      if(!out||out.isNull()||out.equals(ptr(-1))||!view.readable(out,size,true))
        throw Error('mmap failed / returned unmapped buffer');
      return out;
    },
    bindStats(controller,localClient,group){
      const fn=new NativeFunction(at(0x331aaec),'void',['int','int','int']);
      fn(controller,localClient,group);
    },
    luaChunk(source,name) {
      if(typeof source!=='string'||!source||source.includes('\0'))throw Error('Invalid Lua source');
      const bytes=Memory.allocUtf8String(source);
      return view.luaRaw(bytes,Memory.allocUtf8String(name),
        // explicit UTF8 length rather than JS UTF-16 length
        utf8Length(source));
    },
    luaRaw(buf,chunkName,n) {
      const L=ctx.L, top=L.add(0x28),old=runtime.readPointer(top);
      if(!view.readable(old,1))return {ok:false,code:'UNREADABLE_LUA_STACK'};
      let load=-1,pcall=-1,value='';
      try{
        load=ctx.native.load(L,buf,n,chunkName,runtime.nullPointer());
        if(load===0)pcall=ctx.native.pcall(L,0,1,0);
        const result=ctx.native.toString(L,-1,runtime.nullPointer());
        if(result&&!result.isNull())value=result.readUtf8String().slice(0,4096);
      } catch(e) {
        return {ok:false,code:'ORIGINAL_LUA_EXCEPTION',error:String(e).slice(0,180),load,pcall};
      } finally {runtime.writePointer(top,old);}
      return {ok:load===0&&pcall===0,code:load!==0?'ORIGINAL_LUA_LOAD_FAILED':
        pcall!==0?'ORIGINAL_LUA_PCALL_FAILED':'ORIGINAL_LUA_INVOKED',load,pcall,value:String(value).slice(0,4096)};
    },
    luaHub(bytes,menuKey) {
      // Exact restore_hub_binary.py sequence: lua_load binary, lua_load menu
      // arg, lua_pcall(selector,0,1), lua_pcall(hub,1,1) on native LUI frame.
      const top=ctx.L.add(0x28),old=runtime.readPointer(top);
      if(!view.readable(old,1))return {ok:false,code:'UNREADABLE_LUA_STACK'};
      const p=Memory.alloc(bytes.length);p.writeByteArray(bytes);
      const chunk=Memory.allocUtf8String('=wzm_original_hub_v4');
      const arg=Memory.allocUtf8String(menuKey);
      const nil=runtime.nullPointer();
      const result={ok:false,code:'HUB_LUA_NOT_EXECUTED'};
      try {
        result.hubLoad=ctx.native.load(ctx.L,p,bytes.length,chunk,nil);
        if(result.hubLoad!==0){result.code='HUB_BINARY_LOAD_FAILED';return result;}
        result.argLoad=ctx.native.load(ctx.L,arg,utf8Length(menuKey),chunk,nil);
        if(result.argLoad!==0){result.code='HUB_KEY_LOAD_FAILED';return result;}
        result.argCall=ctx.native.pcall(ctx.L,0,1,0);
        if(result.argCall!==0){result.code='HUB_KEY_CALL_FAILED';return result;}
        result.hubCall=ctx.native.pcall(ctx.L,1,1,0);
        if(result.hubCall!==0){result.code='HUB_CALLBACK_FAILED';return result;}
        const response=ctx.native.toString(ctx.L,-1,nil);
        if(response&&!response.isNull())result.value=response.readUtf8String().slice(0,1024);
        result.code='HUB_ORIGINAL_CALLBACK_INVOKED';result.ok=true;
      } catch(e) {
        result.code='HUB_NATIVE_EXCEPTION';result.error=String(e).slice(0,240);
      } finally {runtime.writePointer(top,old);}
      return result;
    },
    installPreview(callback) {
      const target=at(0x355ca54);
      if(!view.readable(target,4)||target.readU32()!==0xd10703ff)
        throw Error('ORIGINAL_PREVIEW_OPCODE_MISMATCH');
      const original=new NativeFunction(target,'int',['pointer','int','pointer']);
      const replacement=new NativeCallback((a,index,name)=>callback(original,a,index,name),
        'int',['pointer','int','pointer']);
      let replaced=false;
      try {
        Interceptor.replace(target,replacement);replaced=true;
        Interceptor.flush();
      } catch(e) {
        if(replaced){
          try{Interceptor.revert(target);Interceptor.flush();}catch(_){}
        }
        throw e;
      }
      return ()=>{Interceptor.revert(target);Interceptor.flush();};
    },
    previewClient() {
      try {
        const count=runtime.readPointer(at(0x54bcd30)),
          flag=runtime.readPointer(at(0x54bcd38)),
          arr=runtime.readPointer(at(0x54bcd40));
        if(!view.readable(count,4)||!view.readable(flag,4)||!view.readable(arr,8))
          return {ready:false,reason:'PREVIEW_INDIRECT_GLOBAL_UNREADABLE'};
        const countValue=count.readS32(),flagValue=flag.readS32();
        const arrayPtr=runtime.readPointer(arr);
        return {ready:countValue>0&&flagValue!==0&&!arrayPtr.isNull(),
          count:countValue,flag:flagValue,arrayPresent:!arrayPtr.isNull()};
      } catch(e) {return {ready:false,reason:'PREVIEW_PROBE_EXCEPTION',
        error:String(e).slice(0,120)};}
    }
  };
  return view;
}

export function utf8Length(s) {
  let n=0;
  for(let i=0;i<s.length;i++){
    const c=s.charCodeAt(i);
    if(c<128)n++;
    else if(c<2048)n+=2;
    else if(c>=0xd800&&c<=0xdbff&&i+1<s.length){
      const next=s.charCodeAt(i+1);
      if(next>=0xdc00&&next<=0xdfff){n+=4;i++;}else n+=3;
    }else n+=3;
  }
  return n;
}
