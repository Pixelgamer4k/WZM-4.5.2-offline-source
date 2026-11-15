-- Read-only: list graphics-related Engine functions and data sources.
local out={}
local function add(s) out[#out+1]=tostring(s) end
local keys={'mobileAASetting','mobileResolutionSetting','mobileUpscalingQualitySetting','mobileGraphicsPresetSetting','mobileShadowQualitySetting'}
for _,k in ipairs(keys) do
  local v=Engine[k]
  add(k..' engine='..type(v)..' '..tostring(v))
end
local n=0
for k,v in pairs(Engine) do
  local ks=tostring(k)
  if type(k)=='string' and (ks:lower():find('graph') or ks:lower():find('dvar') or ks:lower():find('setting') or ks:lower():find('upscal') or ks:lower():find('resol') or ks:lower():find('fps') or ks:lower():find('frame')) then
    add('Engine.'..ks..' '..type(v)); n=n+1
  end
end
add('engine string keys matched '..n)
local ok,g=pcall(function() return DataSources.alwaysLoaded.graphics end)
add('DS graphics '..tostring(ok)..' '..type(g))
if ok and type(g)=='table' then for k,v in pairs(g) do local val='' if type(v)=='table' and v.GetValue then local o,r=pcall(v.GetValue,v,0) val=tostring(r) end add('  graphics.'..tostring(k)..' '..type(v)..' '..val) end end
local ok2,m=pcall(function() return DataSources.alwaysLoaded.mobile end)
if ok2 and type(m)=='table' then for k,v in pairs(m) do add('  mobile.'..tostring(k)..' '..type(v)) end end
if Dvar then local c=0 for k,v in pairs(Dvar) do if c<40 then add('Dvar.'..tostring(k)..' '..type(v)) end c=c+1 end add('Dvar entries '..c) end
return table.concat(out,'\n')
