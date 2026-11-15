local out={}
local function val(v) if type(v)=='table' and v.GetValue then local o,r=pcall(v.GetValue,v,0) if o then return tostring(r) end end return nil end
local function walk(t,p,d)
  if d>4 or #out>400 then return end
  for k,v in pairs(t) do
    local name=p..'.'..tostring(k)
    local x=val(v)
    if x then out[#out+1]=name..' = '..x
    elseif type(v)=='table' then walk(v,name,d+1)
    else out[#out+1]=name..' : '..type(v)..' '..tostring(v) end
  end
end
walk(DataSources.alwaysLoaded.mobile.graphics,'graphics',0)
return table.concat(out,'\n')
