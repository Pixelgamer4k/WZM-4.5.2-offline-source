local FM = LUI.FlowManager
local W = rawget(_G, 'WZM_FMC')
if not W then
  W = {n = 0, fg = 0, orig = FM.Frame, origFG = FM.FenceGroupFrame}
  rawset(_G, 'WZM_FMC', W)
  FM.Frame = function(...) W.n = W.n + 1; return W.orig(...) end
  FM.FenceGroupFrame = function(...) W.fg = W.fg + 1; return W.origFG(...) end
  return 'armed'
end
local root = rawget(LUI, 'primaryRoot')
local kids = 0
pcall(function() local c = root:getFirstChild(); while c do kids = kids + 1; c = c:getNextSibling() end end)
return 'FM.Frame calls=' .. W.n .. ' FenceGroupFrame=' .. W.fg .. ' primaryRoot=' .. tostring(root) .. ' children=' .. kids
