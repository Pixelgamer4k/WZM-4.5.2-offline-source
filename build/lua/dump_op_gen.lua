local PD=rawget(_G,'PLAYER_DATA');local core
for k,v in pairs(PD or {}) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local out={}
for _,gn in ipairs({'WZRankedLoadouts','RankedLoadouts','PrivateLoadouts','WZPrivateLoadouts'}) do
  local ok,r=pcall(core,0,CoD.StatsGroup[gn])
  if ok and r then pcall(function()
    local cs=r.customizationSetup
    out[#out+1]=gn..'\tsel\t'..tostring(cs.selectedOperatorIndex:get())
    for i=0,1 do out[#out+1]=gn..'\top'..i..'\t'..tostring(cs.operators[i]:get()) end
    local done={}
    for i=0,1 do
      local op=tostring(cs.operators[i]:get())
      if not done[op] and op~='xhash: #x40' then done[op]=true
        local e=cs.operatorCustomization[(op:gsub('^xhash: ',''))]
        out[#out+1]=gn..'\tcust\t'..op..'\t'..tostring(e.skin:get())..'\t'..tostring(e.chroma:get())..'\t'..
          tostring(e.execution:get())..'\t'..tostring(e.taunt:get())..'\t'..tostring(e.intro:get())
      end
    end
  end) end
end
return table.concat(out,'\n')