local W=_WZM;W.frontend=W.frontend or {};local S=W.frontend
S.events=S.events or {}
if not S.tracing then
 S.tracing=true
 local function hook(t,k,label)
  local f=t and t[k];if type(f)~='function' then return end
  t[k]=function(...)
   local args={};for i=1,math.min(select('#',...),6) do args[#args+1]=tostring(select(i,...)) end
   S.events[#S.events+1]=label..'('..table.concat(args,',')..')'
   if #S.events>80 then table.remove(S.events,1) end
   return f(...)
  end
 end
 hook(MenuNavigator,'QueueURI','QueueURI');hook(MenuNavigator,'QueueURIXHash','QueueURIXHash')
 hook(LUI.Command,'Execute','Command.Execute')
 for _,k in ipairs({'RequestAddMenu','RequestPopupMenu','AddMenu','PushMenu','RegisterStackPushBehaviour'}) do hook(LUI.FlowManager,k,'Flow.'..k) end
end
return table.concat(S.events,'\n')
