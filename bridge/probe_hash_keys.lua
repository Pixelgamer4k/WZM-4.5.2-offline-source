local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
-- keys matching a pattern across a table, as "#x0<hex that ends with the 16-hex hash>"
local function collect(t)
  local r={}
  for k,v in pairs(t or {}) do
    local s=tostring(k)
    local h=s:match('(%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x)$')
    if h then r[#r+1]=h:lower() end
  end
  return r
end
local function dump(name,t)
  local r=collect(t)
  add(name..'_n',#r)
  add(name,table.concat(r,','))
end
dump('LOADOUT',rawget(_G,'LOADOUT'))
dump('GUNSMITH',rawget(_G,'GUNSMITH'))
dump('WEAPON',rawget(_G,'WEAPON'))
dump('PROGRESSION',rawget(_G,'PROGRESSION'))
dump('LOOT',rawget(_G,'LOOT'))
dump('OPERATOR',rawget(_G,'OPERATOR'))
return table.concat(out,'\n')
