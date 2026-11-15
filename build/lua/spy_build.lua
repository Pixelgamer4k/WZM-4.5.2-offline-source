local MB = rawget(_G, 'MenuBuilder')
if rawget(_G, 'WZM_BLOG') == nil then
  rawset(_G, 'WZM_BLOG', {})
  local orig = MB.BuildRegisteredType
  rawset(_G, 'WZM_BORIG', orig)
  MB.BuildRegisteredType = function(name, opts, ...)
    local L = rawget(_G, 'WZM_BLOG')
    if #L < 600 then
      local o = {}
      if type(opts) == 'table' then for k, v in pairs(opts) do o[#o + 1] = tostring(k) .. '=' .. (type(v) == 'table' and 'T' or tostring(v)) end end
      L[#L + 1] = tostring(name) .. ' {' .. table.concat(o, ',') .. '}'
    end
    return orig(name, opts, ...)
  end
end
-- reopen the topmost menu (Graphics page) so it is built again
local FM = LUI.FlowManager
local info = FM.GetTopmostMenu()
local name = info.name
local ok1, e1 = pcall(FM.RequestLeaveMenu, info.menu)
local ok2, e2 = pcall(FM.RequestAddMenu, name, false, 0, false, {})
return 'reopen ' .. tostring(name) .. ' leave=' .. tostring(ok1) .. tostring(e1) .. ' add=' .. tostring(ok2) .. tostring(e2)
