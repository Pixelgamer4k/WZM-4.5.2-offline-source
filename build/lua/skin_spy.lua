local LOGP = '/data/user/0/com.activision.callofduty.warzone/files/wzm_skin_spy.txt'
if rawget(_G, 'WZM_SKINSPY') then return 'already armed' end
local SP = {orig = {}, counts = {}}
rawset(_G, 'WZM_SKINSPY', SP)
local function FL(s) local f = io.open(LOGP, 'a'); if f then f:write(s .. '\n'); f:close() end end
local function a2s(...)
  local n = select('#', ...); local p = {}
  for i = 1, math.min(n, 5) do local v = select(i, ...); local s = tostring(v); if #s > 50 then s = s:sub(1, 50) end; p[#p+1] = s end
  return table.concat(p, ', ')
end
local wrapped = 0
for _, mn in ipairs({'CustomizationEditManager','OPERATOR_SKIN','OPERATOR','Operator','UICustomization','CUSTOMIZE_MENU','UI_CUSTOMIZATION','ClientCharacter','CLIENTCHARACTER'}) do
  local t = rawget(_G, mn)
  if type(t) == 'table' then
    for k, f in pairs(t) do
      if type(f) == 'function' then
        local name = mn .. '.' .. tostring(k):gsub('xhash: ', '')
        SP.orig[#SP.orig+1] = {t, k, f}
        t[k] = function(...)
          local c = (SP.counts[name] or 0) + 1; SP.counts[name] = c
          if c <= 3 and SP.on then FL(os.date('%H:%M:%S') .. ' ' .. name .. '(' .. a2s(...) .. ')') end
          return f(...)
        end
        wrapped = wrapped + 1
      end
    end
  end
end
SP.on = true
FL('--- armed ' .. wrapped)
return 'armed ' .. wrapped
