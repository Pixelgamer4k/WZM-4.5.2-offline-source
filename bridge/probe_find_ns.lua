local want='af63a34c'
local found={}
local seen={}
local function scan(t,path,depth)
  if depth>3 or type(t)~='table' or seen[t] then return end
  seen[t]=true
  local n=0
  for k,v in pairs(t) do
    n=n+1 if n>4000 then return end
    local ks=tostring(k)
    if ks:find(want,1,true) then found[#found+1]=path..' KEY '..ks:sub(1,40) end
    if type(v)=='table' then
      scan(v,path..'.'..n,depth+1)
    else
      local vs=tostring(v)
      if vs:find(want,1,true) then
        found[#found+1]=path..' VAL('..type(v)..') '..vs:sub(1,40)
        if type(v)=='userdata' then rawset(_G,'WZM_NS',v) end
      end
    end
  end
end
scan(_G,'_G',0)
for _,n in ipairs({'MenuNavigator','MenuBuilder','LUI'}) do
  local t=rawget(_G,n) if type(t)=='table' then scan(t,'_G.'..n,1) end
end
if #found==0 then return 'not found' end
return '#found='..#found..' :: '..table.concat(found,' ;; '):sub(1,700)
