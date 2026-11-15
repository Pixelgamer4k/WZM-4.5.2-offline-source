local W = rawget(_G, 'WZM_FGS')
local C = LUI.FenceGroup
if not W then
  W = {seen = {}, n = 0}
  rawset(_G, 'WZM_FGS', W)
  local fr = C.Frame
  C.Frame = function(self, ...)
    W.n = W.n + 1
    local k = tostring(self)
    local e = W.seen[k] or {c = 0}
    e.c = e.c + 1; e.active = self._activeFenceIndex; e.state = self._state
    local f = self._fences and self._fences[self._activeFenceIndex]
    e.fence = f and f._name; e.nf = self._fences and #self._fences; e.wzm = self._wzm
    W.seen[k] = e
    return fr(self, ...)
  end
return 'armed'
end
local m = (LUI.FlowManager.GetMenuStack(0) or {})[1]
local out = {'frames=' .. W.n .. ' stackGroup=' .. tostring(m and m.fenceGroup) .. ' fenced=' .. tostring(m and m.fenced)}
for k, e in pairs(W.seen) do out[#out+1] = k .. ' c=' .. e.c .. ' active=' .. tostring(e.active) .. '/' .. tostring(e.nf) .. ' fence=' .. tostring(e.fence) .. ' state=' .. tostring(e.state) .. ' wzm=' .. tostring(e.wzm) end
return table.concat(out, '\n')
