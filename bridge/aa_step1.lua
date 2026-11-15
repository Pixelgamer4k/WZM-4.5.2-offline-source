-- Find the hashed global the team menu handler calls with "team_select", then send auto-assign through it.
local o={}
local G0,K0
for k,v in pairs(_G) do if tostring(k):find('76055c55456f05df',1,true) then G0,K0=v,k end end
o[#o+1]='G0 type='..type(G0)..' '..tostring(G0)
if type(G0)=='table' then local ks={} for k,v in pairs(G0) do if #ks<40 then ks[#ks+1]=tostring(k)..':'..type(v) end end o[#o+1]='G0 keys='..table.concat(ks,',') end
if type(G0)=='function' then
 local ok,a,b=pcall(G0,0,'team_select','autoassign')
 o[#o+1]='call(0,team_select,autoassign)='..tostring(ok)..':'..tostring(a)..','..tostring(b)
end
return table.concat(o,' | ')
