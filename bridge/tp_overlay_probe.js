'use strict';
import Java from 'frida-java-bridge';
send({step:'bridge',available:Java.available});
if(Java.available){Java.perform(function(){
 let a=null;
 Java.choose('com.activision.game.MainActivity',{
 onMatch:function(activity){a=Java.retain(activity);return 'stop';},
 onComplete:function(){
  send({step:'activity',found:!!a});
  if(!a)return;
  Java.scheduleOnMainThread(function(){
   let b=null, decor=null;
   let step='begin';
   try{
    step='classes'; const B=Java.use('android.widget.Button'), P=Java.use('android.widget.FrameLayout$LayoutParams'), VM=Java.use('android.view.ViewGroup'), JL=Java.use('java.lang.String'), L=Java.use('android.view.View$OnClickListener');
    step='button'; b=B.$new(a);
    step='text'; b.setText(JL.$new('3P TEST'));
    step='caps'; b.setAllCaps(false);
    step='textColor'; b.setTextColor(-1);
    step='alpha'; b.setAlpha(0.8);
    step='params'; const params=P.$new(185,72);
    step='gravity'; params.gravity.value=49; params.topMargin.value=22;
    step='listener'; const Click=Java.registerClass({name:'com.wzm.offline.TestClick'+Date.now(),implements:[L],methods:{onClick:function(){send({step:'clicked'});}}});
    step='setListener'; b.setOnClickListener(Click.$new());
    step='decor'; decor=Java.cast(a.getWindow().getDecorView(),VM);
    step='addView'; decor.addView(b,params);
    send({step:'buttonVisible'});
    setTimeout(function(){Java.scheduleOnMainThread(function(){try{decor.removeView(b);send({step:'buttonRemoved'});}catch(e){send({step:'removeError',err:String(e)});}});},3000);
   }catch(e){send({step,err:String(e),stack:e.stack||''});}
  });
 }
 });
});}
