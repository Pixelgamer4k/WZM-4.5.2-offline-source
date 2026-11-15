'use strict';
// Temporary: pass the hardcoded gate only for Lobby.StartServer, and log the party checks behind it.
const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x);
Interceptor.attach(at(0x3439b14),{onEnter(){send('native StartServer entered');}});
Interceptor.attach(at(0x3ee1df0),{onEnter(a){send('impl entered w1='+a[1].toInt32());}});
Interceptor.attach(at(0x3ee1e04),{onEnter(){send('gate w0 was '+this.context.x0.toInt32());this.context.x0=ptr(1);}});
for(const [n,a] of [['partyStart',0x162184c],['chk1_160ec58',0x160ec58],['chk2_160b800',0x160b800],['chk3_160ff5c',0x160ff5c],['chk4_160b4e8',0x160b4e8],['start_161f280',0x161f280]])
 Interceptor.attach(at(a),{onEnter(){this.ok=n==='partyStart'||n==='start_161f280'||this.returnAddress.sub(b).compare(ptr(0x1621860))>=0&&this.returnAddress.sub(b).compare(ptr(0x1621890))<0;if(this.ok)send(n+' enter');},onLeave(r){if(this.ok)send(n+' ret '+r.toInt32());}});
