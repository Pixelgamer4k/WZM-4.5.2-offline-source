local MN=rawget(_G,'MenuNavigator')
if type(MN)~='table' then return 'no MenuNavigator' end
local S=rawget(_G,'WZM_NAV')
if not S then S={events={}};rawset(_G,'WZM_NAV',S) end
local function hook(k,label)
  local f=MN[k]
  if type(f)~='function' then return end
  if S['hooked_'..k] then return end
  S['hooked_'..k]=true
  MN[k]=function(a,...)
    local info={label=label,type=type(a)}
    if type(a)=='table' then
      for i=1,4 do info[i]=tostring(a[i]) end
      info.n=#a
      S.ns=a[1] S.name=a[2] S.arg=a
    else
      info.val=tostring(a)
    end
    local parts={label..'('..type(a)..')'}
    for i=1,4 do if info[i] then parts[#parts+1]='['..i..']='..info[i] end end
    if info.val then parts[#parts+1]='val='..info.val end
    S.events[#S.events+1]=table.concat(parts,', ')
    if #S.events>40 then table.remove(S.events,1) end
    return f(a,...)
  end
end
hook('QueueURI','QueueURI')
hook('QueueURIXHash','QueueURIXHash')
return 'hooked; prior events='..#S.events
