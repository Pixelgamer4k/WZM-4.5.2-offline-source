/* Guarded translation of fake_player_data.py native 4.5.2 routine.
 * A void original bindStats call is NEVER reported as proof of DDL validity.
 */
export const PROFILE_452 = Object.freeze({
  tableRva:0x54bcb10,sizeRva:0xc13b090,taskBaseRva:0xc1de450,
  slotsRva:0xc1df528,handlesRva:0xc1df520,
  entryStride:0x248,bufferSize:0x66000,maxSlot:16384,groups:14,
  bindStatsRva:0x331aaec,
});

export class NativeProfilePort {
  constructor({notify=()=>{}}={}) {
    this.notify=notify;this.status='NOT_INVOKED';this.inGeneration=null;
    this.mapped=[];this.last=null;this.calls=0;
  }
  report(event) {this.last=event;try{this.notify(event);}catch(_){}return event;}
  snapshot() {return {status:this.status,invokedCalls:this.calls,
    retainedMappings:this.mapped.length,last:this.last};}
  resetLua() {this.status='NOT_INVOKED';this.inGeneration=null;}
  preflight(a) {
    const at=a.at;
    const table=a.readPointer(at(PROFILE_452.tableRva));
    if(!a.readable(table,2*PROFILE_452.entryStride,true))
      throw Error('PROFILE_TABLE_NOT_WRITABLE');
    const size=a.readU32(at(PROFILE_452.sizeRva));
    if(size<0x100||size>PROFILE_452.bufferSize)
      throw Error('PROFILE_GROUP_DATA_SIZE_OUT_OF_RANGE');
    const entries=[];
    for(let i=0;i<2;i++){
      const entry=table.add(i*PROFILE_452.entryStride);
      const data=a.readPointer(entry);
      if(!data.isNull()&&!a.readable(data,size,true))
        throw Error('EXISTING_PROFILE_BUFFER_UNREADABLE_'+i);
      entries.push({entry,existing:data});
    }
    const groups=[],fetch=[];
    for(let i=0;i<PROFILE_452.groups;i++){
      const slot=a.readS32(at(PROFILE_452.slotsRva+i*16));
      const handle=a.readPointer(at(PROFILE_452.handlesRva+i*16));
      if(slot>=0){
        if(slot>PROFILE_452.maxSlot)throw Error('FETCH_TASK_SLOT_OUT_OF_RANGE_'+i);
        const target=at(PROFILE_452.taskBaseRva).add(slot*0x68+0x18);
        if(!a.readable(target,4,true))throw Error('FETCH_TASK_NOT_WRITABLE_'+i);
        fetch.push({group:i,target});
      }
      if(!handle.isNull()){
        if(!a.readable(handle,1))throw Error('STATS_GROUP_HANDLE_UNREADABLE_'+i);
        groups.push(i);
      }
    }
    if(groups.length===0)throw Error('NO_REGISTERED_STATS_GROUP_HANDLES');
    return {table,size,entries,groups,fetch};
  }
  invoke({adapter:a,generation,explicitSyntheticProfile=false}={}) {
    if(!explicitSyntheticProfile)return this.report({ok:false,code:'SYNTHETIC_PROFILE_EXPLICIT_CONSENT_REQUIRED'});
    if(!a||!generation)return this.report({ok:false,code:'VERIFIED_NATIVE_FRAME_REQUIRED'});
    if(this.status==='NATIVE_BINDS_INVOKED'&&this.inGeneration===generation)
      return this.report({ok:true,code:'PROFILE_NATIVE_ALREADY_INVOKED_NOT_DDL_PROOF',nativeInvoked:true,
        verifiedDDL:false,invokedCalls:this.calls});
    if(this.status==='FAILED'&&this.inGeneration===generation)
      return this.report({ok:false,code:'PROFILE_PREVIOUS_PARTIAL_FAILURE_REQUIRES_RESET'});
    this.inGeneration=generation;
    let plan;
    try{plan=this.preflight(a);}
    catch(e){this.status='FAILED';return this.report({ok:false,code:'PROFILE_NATIVE_PREFLIGHT_FAILED',
      error:String(e).slice(0,180)});}
    let changed=false;
    const readback={};
    try{
      const created=[];
      // Allocate buffers before writing any pointers; never unmap committed
      // memory because original engine may retain these pointers indefinitely.
      for(const rec of plan.entries){
        if(rec.existing.isNull()){
          const p=a.map(PROFILE_452.bufferSize);
          this.mapped.push(p);created.push(p);
          rec.data=p;
        }else rec.data=rec.existing;
      }
      for(const rec of plan.entries){
        if(rec.existing.isNull()){
          a.writePointer(rec.entry,rec.data);
          a.writeU32(rec.entry.add(8),plan.size);
          changed=true;
        }
        a.writeU8(rec.entry.add(0x247),0);
        a.writeU8(rec.entry.add(0x244),1);
        changed=true;
      }
      for(const task of plan.fetch)a.writeU32(task.target,2);
      for(const group of plan.groups){
        a.bindStats(0,0,group);this.calls++;
        a.bindStats(0,1,group);this.calls++;
      }
      readback.groups=plan.groups;
      readback.groupCallCount=this.calls;
      readback.fetchTaskWrites=plan.fetch.length;
      readback.dataSize=plan.size;
      readback.entryFlags=plan.entries.map(rec=>({
        dataPresent:!a.readPointer(rec.entry).isNull(),
        dataSize:a.readU32(rec.entry.add(8)),
        fetchPending:a.readU8(rec.entry.add(0x247)),
        boundFlag:a.readU8(rec.entry.add(0x244)),
      }));
      if(readback.entryFlags.some(x=>!x.dataPresent||x.dataSize<plan.size||
        x.fetchPending!==0||x.boundFlag!==1))
        throw Error('PROFILE_ENTRY_FLAGS_READBACK_MISMATCH');
      this.status='NATIVE_BINDS_INVOKED';
      return this.report({ok:true,code:'PROFILE_NATIVE_BIND_INVOKED_NOT_DDL_PROVEN',
        nativeInvoked:true,verifiedDDL:false,readback});
    } catch(e) {
      this.status='FAILED';
      return this.report({ok:false,code:'PROFILE_NATIVE_PARTIAL_FAILURE',
        error:String(e).slice(0,220),writesMayHaveOccurred:changed||this.calls>0,
        invokedCalls:this.calls,retainedMappings:this.mapped.length,
        requiresNewLuaGeneration:true});
    }
  }
}
