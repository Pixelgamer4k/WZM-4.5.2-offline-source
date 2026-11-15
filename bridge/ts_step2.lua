-- Step 2: find the AUTO-ASSIGN button element in the open menu and activate it like a press.
local o={}
local roots={}
if type(LUI.roots)=='table' then for k,v in pairs(LUI.roots) do roots[#roots+1]=v end end
o[#o+1]='roots='..#roots..' rootType='..type(roots[1])
local found
local IDS={}
local seen={}
local function visit(e,d)
 local te=type(e)
 if found or (te~='table' and te~='userdata') or seen[e] or d>60 then return end
 seen[e]=true
 local okid,id=pcall(function() return e.id end)
 if okid and type(id)=='string' then
  local l=id:lower()
  if (l:find('button') or l:find('assign') or l:find('team') or l:find('spectat')) and #IDS<60 then IDS[#IDS+1]=id end
  if l:find('autoassign') or l:find('auto_assign') then found=e return end
 end
 local okc,c=pcall(function() return e:getFirstChild() end)
 if not okc then c=nil end
 while c do visit(c,d+1); local okn,nx=pcall(function() return c:getNextSibling() end); c=okn and nx or nil end
end
for _,r in ipairs(roots) do visit(r,0) end
o[#o+1]='visited='..(function() local c=0 for _ in pairs(seen) do c=c+1 end return c end)()
if found then
 local ks={}; if type(found)=='table' then for k,v in pairs(found) do if #ks<40 then ks[#ks+1]=tostring(k)..':'..type(v) end end end
 o[#o+1]='found id='..tostring(found.id)..' keys='..table.concat(ks,',')
 local mt=getmetatable(found); local ms={}
 if mt and type(mt.__index)=='table' then for k,v in pairs(mt.__index) do if type(v)=='function' and #ms<80 then local s=tostring(k):lower() if s:find('event') or s:find('action') or s:find('press') or s:find('click') or s:find('button') then ms[#ms+1]=tostring(k) end end end end
 o[#o+1]='methods='..table.concat(ms,',')
 for _,ev in ipairs({'button_action','gain_focus'}) do
  local ok,err=pcall(function() return found:processEvent({name=ev,controller=0,controllerIndex=0,mouse=false}) end)
  o[#o+1]=ev..'='..tostring(ok)..':'..tostring(err)
 end
end
o[#o+1]='ids='..table.concat(IDS,',')
o[#o+1]='log='..table.concat(rawget(_G,'WZM_LOG') or {},' ; ')
return table.concat(o,' | ')
