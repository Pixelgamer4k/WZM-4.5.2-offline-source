local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
local PD=rawget(_G,'PLAYER_DATA')
local pdo
for k,v in pairs(PD or {}) do if tostring(k):find('08b73907b55c4d71',1,true) then pdo=v end end
if type(pdo)~='function' then return 'no pdo' end
local function probe(root,path,label)
  local ok,res=pcall(function()
    local t=root
    for part in path:gmatch('[^.]+') do t=t[part] end
    return t
  end)
  if not ok then return label..'=ERR' end
  local ty=type(res)
  local extra=''
  if ty=='table' or ty=='userdata' then
    local c=pcall(function() local n=0 for _ in pairs(res) do n=n+1 if n>50 then break end end return n end)
    extra=''
  end
  return label..'='..ty..extra
end
local lines={}
for g=0,13 do
  local ok,root=pcall(pdo,0,g)
  if ok and root~=nil then
    local parts={}
    parts[#parts+1]=probe(root,'loadouts','loadouts')
    parts[#parts+1]=probe(root,'squadMembers','squadMembers')
    parts[#parts+1]=probe(root,'squadMembers.loadouts','sm.loadouts')
    parts[#parts+1]=probe(root,'squadMembers.loadouts[0]','sm.lo[0]')
    parts[#parts+1]=probe(root,'weaponSetups','weaponSetups')
    parts[#parts+1]=probe(root,'customizationSetup','custom')
    parts[#parts+1]=probe(root,'progression','prog')
    lines[#lines+1]='g'..g..':'..table.concat(parts,',')
  end
end
add('ddl',table.concat(lines,' || '):sub(1,1600))
return table.concat(out,'\n')
