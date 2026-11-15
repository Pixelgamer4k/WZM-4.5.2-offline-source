do
  local S = rawget(_G, 'SOCIAL')
  local key
  for k in pairs(S) do if tostring(k) == 'xhash: #x0166b1673577a0458' then key = k end end
  local orig = key and rawget(S, key)
  if orig and not rawget(_G, 'WZM_SOCIALFIX') then
    rawset(_G, 'WZM_SOCIALFIX', true)
    rawset(S, key, function(...)
      local a, b = orig(...)
      if a ~= nil then
        local real = a
        a = setmetatable({}, {__index = function(_, k2)
          if k2 == 'GetValue' then return function(_, c) local v = real:GetValue(c); if v == nil then return 0 end return v end end
          local v = real[k2]
          if type(v) == 'function' then return function(_, ...) return v(real, ...) end end
          return v
        end})
      end
      return a, b
    end)
  end
end
