local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
local function keys(t,lim)
  local r={} for k in pairs(t or {}) do r[#r+1]=tostring(k) end table.sort(r)
  local s=table.concat(r,","); if lim and #s>lim then s=s:sub(1,lim).."..." end return s
end

-- 1. native weapon-definition counters (read-only)
local top=rawget(_G,'WZM_FT')
add('WZM_FT',type(top))

-- 2. menu navigation surface
local MN=rawget(_G,'MenuNavigator')
add('MenuNavigator',type(MN))
if type(MN)=='table' then add('MN_keys',keys(MN,300)) end
local MB=rawget(_G,'MenuBuilder')
add('MenuBuilder',type(MB))
if type(MB)=='table' then add('MB_keys',keys(MB,300)) end

-- 3. LOOT surface for catalog access
local L=rawget(_G,'LOOT')
if type(L)=='table' then add('LOOT_keys',keys(L,700)) end

-- 4. INSTANCE_INV / GUNSMITH / OPERATOR surfaces
for _,n in ipairs({'INSTANCE_INV','GUNSMITH','OPERATOR','BR_GAMEBATTLES','BUNDLES','STORE','CAC'}) do
  local t=rawget(_G,n)
  add('G_'..n,type(t))
  if type(t)=='table' then add('K_'..n,keys(t,300)) end
end

-- 5. LOADOUT surface (loadout API for later)
local LO=rawget(_G,'LOADOUT')
if type(LO)=='table' then add('LOADOUT_keys',keys(LO,700)) end

-- 6. WEAPON: does a definition list exist?
local W=rawget(_G,'WEAPON')
if type(W)=='table' then
  local n=0 for _ in pairs(W) do n=n+1 end
  add('WEAPON_count',n)
  local tab={}
  for k,v in pairs(W) do if type(v)=='table' then tab[#tab+1]=tostring(k)..'('..tostring(#v)..')' end end
  table.sort(tab);
  add('WEAPON_tables',table.concat(tab,','):sub(1,500))
end

-- 7. PROGRESSION: other functions of interest + level data
local P=rawget(_G,'PROGRESSION')
if type(P)=='table' then
  local r={} for k,v in pairs(P) do if type(v)=='function' then r[#r+1]=tostring(k) end end
  table.sort(r); add('PROG_fns',table.concat(r,','):sub(1,900))
end
return table.concat(out,'\n')
