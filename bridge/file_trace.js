// Which file does the engine ask for, and does it get it?
//
// Built for the Verdansk fatal: libgame.so+0x199d818 raises
// Com_Error(1, "\x1f%s [%s]", "DEV ERROR 0x723AC2A5", "/ww_mp_mgl_wz2_sierra.ff")
// after building that path with fmt "%s%c%s" ('/'). The open below this call is what
// actually fails, so log every interesting open with its result and errno.
//
// Included by host_spawn.py under WZM_FILE_TRACE=1. Read-only: hooks call originals.
{
'use strict';
// Shards are opened by BARE 16-hex hash through a dirfd on this build, so a
// path-only filter misses them entirely (0 fileOpen events during a full Verdansk
// load). Match hash-like names as well, and record the dirfd for openat.
const INTERESTING=/\.ff$|\.ff\.|\.xpak|\.xsub|ww_|zone\/|maps_|shard_cache|\/br_|_br\b|^[0-9a-f]{16}$/i;
const seen={};
let logged=0;
function short(p){ try{ const s=p.readUtf8String(160)||''; return s; }catch(e){ return null; } }
function note(name,path,ret,err,dirfd){
  if(!path||!INTERESTING.test(path))return;
  const key=name+'|'+path;
  if(seen[key]!==undefined){ seen[key]++; return; }
  seen[key]=0;
  if(logged++>250)return;
  send({s:'fileOpen',fn:name,path:path.slice(0,180),dirfd:dirfd===undefined?null:String(dirfd),ret:ret===undefined?null:String(ret),errno:err});
}
const errnoLoc=null;
function hookOpen(name,idx){
  try{
    const p=Module.getGlobalExportByName(name);
    Interceptor.attach(p,{
      onEnter(a){ this.path=short(a[idx]); this.dirfd=(idx===1)?a[0]:null; },
      onLeave(r){
        let err=null;
        try{ const q=Module.getGlobalExportByName('__errno'); if(q){ const fp=new NativeFunction(q,'pointer',[]); err=fp().readS32(); } }catch(e){}
        note(name,this.path,r,err,this.dirfd);
      }
    });
    send({s:'fileTraceHooked',fn:name});
    return true;
  }catch(e){ send({s:'fileTraceHookFailed',fn:name,error:String(e).slice(0,120)}); return false; }
}
for(const [n,i] of [['open',0],['__open_2',0],['open64',0],['openat',1],['__openat_2',1],['fopen',0],['access',0],['stat',0],['__statx',1]])hookOpen(n,i);

// The engine's own resolver: 0x19a9930(type, hash, 0) -> pointer or NULL.
try{
  Interceptor.attach(Process.getModuleByName('libgame.so').base.add(0x19a9930),{
    onEnter(a){ this.k=a[0].toInt32(); this.h=a[1]; },
    onLeave(r){ if(this.k===0x4b||r.isNull()) send({s:'assetLookup',kind:this.k,hash:this.h.toString(),hit:!r.isNull()}); }
  });
  send({s:'assetLookupHooked'});
}catch(e){ send({s:'assetLookupHookFailed',error:String(e).slice(0,120)}); }
}

// Bound Verdansk lookup -> shard descriptor evidence; observes original returns.
{
 const base=Process.getModuleByName('libgame.so').base;
 const targets=new Set(); let n=0;
 function report(v){if(n++<80)send(v);}
 Interceptor.attach(base.add(0x12d5890),{
  onEnter(a){try{this.name=a[0].readUtf8String(160);}catch(e){this.name='';}},
  onLeave(r){if(this.name&&/sierra/.test(this.name)){
   const v={s:'sierraRegistry',name:this.name,record:r.toString()};
   if(!r.isNull()){targets.add(r.toString());try{v.state50=r.add(0x50).readU8();v.shards=r.add(0x5a).readU16();}catch(e){v.error=String(e);}}
   report(v);
  }}
 });
 Interceptor.attach(base.add(0x12d5c08),{
  onEnter(a){this.target=targets.has(a[0].toString());this.ordinal=a[1].toInt32();},
  onLeave(r){if(this.target){const v={s:'sierraShard',ordinal:this.ordinal,descriptor:r.toString()};if(!r.isNull())try{v.kind=r.readU8();v.size=r.add(4).readU32();v.hash=r.add(8).readU64().toString(16);}catch(e){v.error=String(e);}report(v);}}
 });
}
// Actual ww-file failure: 0x199d3d8 -> 0x199e724 -> native open.
{
 const b=Process.getModuleByName('libgame.so').base; let count=0;
 Interceptor.attach(b.add(0x1cd05bc),{
  onEnter(a){this.kind=a[0].toInt32();this.root=a[1].toInt32();this.flags=a[3].toInt32();try{this.path=a[2].readUtf8String(256);}catch(e){this.path=null;}},
  onLeave(r){if(this.path&&/sierra/.test(this.path)&&count++<40)send({s:'sierraNativeOpen',path:this.path,kind:this.kind,root:this.root,flags:this.flags,handle:r.toInt32()});}
 });
}
