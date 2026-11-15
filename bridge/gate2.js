'use strict';
// Temporary: pass the gate and the four party checks for one StartServer, and log what runs next.
const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x);
for(const [n,a] of [['gate',0x3ee1e04],['chk1',0x1621864],['chk2',0x1621870],['chk3',0x162187c],['chk4',0x1621888]])
 Interceptor.attach(at(a),{onEnter(){send(n+' was '+(this.context.x0.toInt32()&1));this.context.x0=ptr(1);}});
let k=0;
Interceptor.attach(at(0x161f280),{onEnter(a){send('start body entered party='+a[0].sub(b));},onLeave(r){send('start body ret '+r.toInt32());}});
