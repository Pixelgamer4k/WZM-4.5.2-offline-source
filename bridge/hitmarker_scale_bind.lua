-- Equivalent binding for the exact HitMarker scale model implicated in close trace.
local cls=LUI and LUI.UIElement
local source=DataSources.alwaysLoaded.HUD.hitMarker.scale
local model=source:GetModel(0)
local model2=source:GetModel(0)
if type(cls)~='table' or type(cls.BindScaleToModel)~='function' then return 'scale binding class unavailable' end
if model~=model2 then return 'model handles not equality-stable; binding not changed' end
local original=cls.BindScaleToModel
local state={calls=0,updates=0}
rawset(_G,'_WZM_HITMARKER_BIND',state)
rawset(cls,'BindScaleToModel',function(self,m,...)
 if m~=model then return original(self,m,...) end
 state.calls=state.calls+1
 local function update()
  local v=source:GetValue(0)
  if type(v)=='number' then self:SetScale(v,0);state.updates=state.updates+1 end
 end
 update()
 return self:SubscribeToModel(m,update)
end)
return 'hitmarker equivalent scale binding installed; model equality stable'
