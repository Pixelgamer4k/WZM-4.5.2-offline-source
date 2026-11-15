-- Original chunk456c113aacbb78d0: proto0 PC0..5 calls Engine[key]("team_select", TeamSelection).
-- Proto2 PC27..29 sets AutoAssignButton.TeamSelection=2. No menu is opened.
for k,v in pairs(Engine) do
 local ks=tostring(k)
 if ks:find('76055c55456f05df',1,true) then
  local vs=tostring(v)
  local dump_ok=pcall(string.dump,v)
  if type(v)~='function' then return 'k='..ks..' v='..vs..' type='..type(v) end
  local ok,r=pcall(v,'team_select',2)
  return 'k='..ks..' v='..vs..' dump='..tostring(dump_ok)..' call='..tostring(ok)..' '..tostring(r)
 end
end
return 'team_select Engine binding missing'
