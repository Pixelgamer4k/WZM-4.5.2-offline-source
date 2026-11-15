local o={};local core
for k,f in pairs(_WZM.pdo or {}) do if tostring(k):find('08b73907b55',1,true) then core=f end end
if not core then return 'no original player-data getter' end
for _,g in ipairs({CoD.StatsGroup.RankedLoadouts,CoD.StatsGroup.PrivateLoadouts,CoD.StatsGroup.WZRankedLoadouts}) do
 local ok,node=pcall(core,0,g);o[#o+1]='group '..g..' root='..tostring(ok)..':'..tostring(node)
 if ok and node then
  local ok2,vals=pcall(function() return node:get() end)
  o[#o+1]='get='..tostring(ok2)..':'..type(vals)
  if ok2 and type(vals)=='table' then local n=0;for k,v in pairs(vals) do n=n+1;if n<25 then o[#o+1]='field '..tostring(k)..'='..tostring(v) end end;o[#o+1]='fields='..n end
 end
end
return table.concat(o,'\n')
