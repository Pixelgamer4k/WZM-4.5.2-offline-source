'use strict';
const b=Process.getModuleByName('libgame.so').base;
const objs={};let n=0;
const h=Interceptor.attach(b.add(0x2326aac),{onEnter(){let p=this.context.x24.toString();objs[p]=(objs[p]||0)+1;n++;}});
setTimeout(()=>{h.detach();send({kind:'tpCameraLocalProbe',callsite:'0x2326aac',n,ps:objs});},2200);
