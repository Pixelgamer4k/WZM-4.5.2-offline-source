local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
local PD=rawget(_G,'PLAYER_DATA')
local pdo
for k,v in pairs(PD or {}) do if tostring(k):find('08b73907b55c4d71',1,true) then pdo=v end end
if type(pdo)~='function' then return 'no pdo' end
local G=4 -- PrivateLoadouts
local ok,root=pcall(pdo,0,G)
if not ok or root==nil then return 'no root g4' end
local lo=root.loadouts
add('loadouts_type',type(lo))
local function f(t,field)
  local o,r=pcall(function() return t[field] end)
  if not o then return 'ERR' end
  return type(r)..':'..tostring(r):sub(1,60)
end
for i=0,3 do
  local o,l=pcall(function() return lo[i] end)
  local line='lo['..i..']='..tostring(o)
  if o and l~=nil then
    line=line..' {'..table.concat({
      'name='..f(l,'name'),
      'inUse='..f(l,'inUse'),
      'wsetups='..f(l,'weaponSetups'),
      'settings='..f(l,'loadoutSettings'),
    },', ')..'}'
    local o2,ws=pcall(function() return l.weaponSetups end)
    if o2 and ws~=nil then
      for s=0,2 do
        local o3,w=pcall(function() return ws[s] end)
        if o3 and w~=nil then
          line=line..' ws['..s..']{'..table.concat({
            'lootID='..f(w,'weaponLootID'),
            'variant='..f(w,'weaponVariantID'),
            'weapon='..f(w,'weapon'),
          },', ')..'}'
        end
      end
    end
  end
  add('L'..i,line:sub(1,420))
end
-- customizationSetup on the same group
local o,c=pcall(function() return root.customizationSetup end)
add('customizationSetup',tostring(o)..':'..type(c))
if o and c~=nil then
  local o2,oc=pcall(function() return c.operatorCustomization end)
  add('operatorCustomization',tostring(o2)..':'..type(oc))
  if o2 and oc~=nil then
    local o3,probe=pcall(function() return oc[1] end)
    add('oc[1]',tostring(o3)..':'..type(probe))
  end
end
return table.concat(out,'\n')
