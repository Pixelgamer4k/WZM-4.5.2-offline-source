-- Wrap OPTIONS.Menu.* and MobileSettingsHubUtils/MOBILE_SETTINGS functions; record calls into WZM_SPY.
if rawget(_G,'WZM_SPY')==nil then rawset(_G,'WZM_SPY',{}) end
if rawget(_G,'WZM_SPY_ORIG')==nil then rawset(_G,'WZM_SPY_ORIG',{}) end
local WZM_SPY, WZM_SPY_ORIG = rawget(_G,'WZM_SPY'), rawget(_G,'WZM_SPY_ORIG')
local function short(v)
  if type(v) == 'table' then
    local p, n = {}, 0
    for k, x in pairs(v) do
      n = n + 1
      if n <= 8 then p[#p + 1] = tostring(k) .. '=' .. (type(x) == 'table' and 'T' or type(x) == 'function' and 'f' or tostring(x)) end
    end
    return '{' .. table.concat(p, ',') .. (n > 8 and ',..' .. n or '') .. '}'
  end
  return tostring(v)
end
local function wrap(tbl, name)
  if type(tbl) ~= 'table' then return 0 end
  local c = 0
  for k, f in pairs(tbl) do
    if type(f) == 'function' and not (WZM_SPY_ORIG and WZM_SPY_ORIG[f]) then
      local key = name .. '.' .. tostring(k)
      local orig = f
      local w = function(...)
        if #WZM_SPY < 400 then
          local a = {...}
          local s = {}
          for i = 1, math.min(select('#', ...), 4) do s[#s + 1] = short(a[i]) end
          WZM_SPY[#WZM_SPY + 1] = key .. '(' .. table.concat(s, ' | ') .. ')'
        end
        return orig(...)
      end
      WZM_SPY_ORIG[w] = orig
      tbl[k] = w
      c = c + 1
    end
  end
  return c
end
local n = wrap(OPTIONS.Menu, 'OPTIONS.Menu') + wrap(MobileSettingsHubUtils, 'Hub') + wrap(MOBILE_SETTINGS, 'MS')
  + wrap(OPTIONS, 'OPTIONS') + wrap(VIDEO, 'VIDEO') + wrap(SystemSettings, 'SS')
return 'wrapped ' .. n
