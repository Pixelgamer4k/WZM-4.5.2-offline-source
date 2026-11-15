'use strict';
send({s:'JavaProbe',type:typeof Java,available:typeof Java==='undefined'?null:Java.available});
if(typeof Java!=='undefined'&&Java.available){Java.perform(()=>{send({s:'JavaProbeReady'});});}
