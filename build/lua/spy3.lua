local LOG = {}
rawset(_G, 'WZM_S3', LOG)
local function short(v, d)
  d = d or 0
  if type(v) == 'table' then
    if d > 1 then return 'T' end
    local p, n = {}, 0
    for k, x in pairs(v) do n = n + 1; if n <= 10 then p[#p + 1] = tostring(k):gsub('xhash: #x0?', '#') .. '=' .. short(x, d + 1) end end
    return '{' .. table.concat(p, ',') .. (n > 10 and ',..' .. n or '') .. '}'
  elseif type(v) == 'function' then return 'f' end
  return (tostring(v):gsub('xhash: #x0?', '#'))
end
local counts = {}
local function wrapAll(tbl, name)
  for k, f in pairs(tbl) do
    if type(f) == 'function' then
      local key = name .. '.' .. tostring(k):gsub('xhash: #x0?', '#')
      tbl[k] = function(...)
        counts[key] = (counts[key] or 0) + 1
        if counts[key] <= 3 and #LOG < 300 then
          local a, s = {...}, {}
          for i = 1, math.min(select('#', ...), 4) do s[#s + 1] = short(a[i]) end
          LOG[#LOG + 1] = key .. '(' .. table.concat(s, ' | ') .. ')'
        end
        return f(...)
      end
    end
  end
end
rawset(_G, 'WZM_S3C', counts)
wrapAll(OPTIONS.Menu, 'Menu'); wrapAll(OPTIONS, 'OPT'); wrapAll(MobileSettingsHubUtils, 'Hub')
local FM = LUI.FlowManager
local info = FM.GetTopmostMenu()
pcall(FM.RequestLeaveMenu, info.menu)
pcall(FM.RequestAddMenu, info.name, false, 0, false, {})
return 'ok'
