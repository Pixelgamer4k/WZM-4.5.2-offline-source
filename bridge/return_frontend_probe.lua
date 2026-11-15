local out={}
for k,v in pairs(LUI.Commands or {}) do
 if type(v)=='table' then for a,b in pairs(v) do
  local s=tostring(a):lower()
  if s:find('mainmenu') or s:find('disconnect') or s:find('leavegame') or s:find('leavematch') or s:find('endgame') then
   out[#out+1]=tostring(k)..'.'..tostring(a)..'='..type(b)
  end
 end end
end
return table.concat(out,'\n')
