local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
local PD=rawget(_G,'PLAYER_DATA')
if type(PD)~='table' then return 'no PLAYER_DATA' end
local pkey,pdo
for k,v in pairs(PD) do if tostring(k):find('08b73907b55c4d71',1,true) then pkey,pdo=k,v end end
add('pdo',tostring(pkey)..' '..type(pdo))
local C=rawget(_G,'CoD')
add('CoD',type(C))
local groups={}
if type(C)=='table' and type(C.StatsGroup)=='table' then
  for k,v in pairs(C.StatsGroup) do groups[#groups+1]={tostring(k),v} end
  table.sort(groups,function(a,b) return a[1]<b[1] end)
  local t={} for i=1,math.min(#groups,14) do t[#t+1]=groups[i][1]..'='..tostring(groups[i][2]) end
  add('StatsGroup',table.concat(t,','))
end
if type(pdo)~='function' then return table.concat(out,'\n') end
local list=#groups>0 and groups or {{'raw',0},{'raw',1},{'raw',2},{'raw',3}}
local lines={}
for i=1,math.min(#list,8) do
  local name,g=list[i][1],list[i][2]
  local ok,root=pcall(pdo,0,g)
  local line=name..'('..tostring(g)..')='..tostring(ok)
  if ok and type(root)=='table' then
    local has={}
    for _,f in ipairs({'loadouts','squadMembers','weaponSetups','customizationSetup','progression'}) do
      if root[f]~=nil then has[#has+1]=f end
    end
    line=line..' fields='..table.concat(has,'+')
    local sm=root.squadMembers
    if type(sm)=='table' then
      local n=0 for _ in pairs(sm) do n=n+1 end
      line=line..' squadMembers.n='..n
      local lo=sm.loadouts
      if type(lo)=='table' then
        local c=0 for _ in pairs(lo) do c=c+1 end
        line=line..' loadouts.n='..c
        local first=lo[0] or lo[1]
        if type(first)=='table' then
          local f={} for k,v in pairs(first) do f[#f+1]=tostring(k)..'('..type(v)..')' end
          line=line..' loadout0={'..table.concat(f,','):sub(1,160)..'}'
        end
      end
    end
  elseif ok then line=line..' root='..type(root)
  else line=line..' err='..tostring(root):sub(1,90) end
  lines[#lines+1]=line
end
add('groups',table.concat(lines,' || '):sub(1,1400))
return table.concat(out,'\n')
