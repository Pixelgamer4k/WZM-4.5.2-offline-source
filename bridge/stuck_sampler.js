// Read-only: sample the main and render threads' stacks once per second (for hangs / black screens).
{
const b=Process.getModuleByName('libgame.so').base;
const f=x=>{const m=Process.findModuleByAddress(x);return m?(m.name==='libgame.so'?'+'+x.sub(b).toString(16):m.name+'+'+x.sub(m.base).toString(16)):x.toString();};
let n=0;const N=globalThis.WZM_SAMPLES||12;
const t=setInterval(()=>{n++;
 const out=[];
 for(const th of Process.enumerateThreads()){
  if(th.id!==Process.id&&!/Thread-1[0-9]?$/.test(th.name||''))continue;
  try{out.push({id:th.id,name:th.name,state:th.state,pc:f(th.context.pc),bt:Thread.backtrace(th.context,Backtracer.FUZZY).slice(0,8).map(f)});}catch(e){out.push({id:th.id,err:String(e)});}
 }
 send({s:'sample',n,out});
 if(n>=N)clearInterval(t);},1000);
}
