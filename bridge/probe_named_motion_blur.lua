-- Read-only inspection of the original Dvar namespace; no setters.
local out={}
for _,n in ipairs({'r_motionBlur','r_motionblur','r_motionBlurEnable','r_motionBlurEnabled','r_radialMotionBlur','r_radialMotionBlurEnable','r_radialMotionBlurEnabled','r_weaponMotionBlur','r_worldMotionBlur','r_mbEnable','r_aaTechnique'}) do
 local ok,v=pcall(function() return Dvar[n] end)
 if ok and type(v)=='table' and type(v.GetValue)=='function' then
  local yes,result=pcall(v.GetValue,v,0)
  out[#out+1]=n..'='..tostring(yes)..':'..tostring(result)
 else out[#out+1]=n..'='..tostring(ok)..':'..type(v) end
end
return table.concat(out,'\n')
