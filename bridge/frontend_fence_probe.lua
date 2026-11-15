local o={};local function add(s)o[#o+1]=s end
local function fn(t,h)for k,v in pairs(t or {}) do if tostring(k):find(h,1,true) then return v,k end end end
local f=fn(Fences,'b06c6d08978b8c65')
if f then for _,name in ipairs({'WEAPON_DEF','CLIENT_CONNECT','OPERATOR','LOADOUT'}) do local ok,r=pcall(f,0,name);add('fence '..name..'='..tostring(ok)..':'..tostring(r)) end end
for k,v in pairs(Fences or {}) do add('Fences.'..tostring(k)..'='..tostring(v)) end
for k,v in pairs(WEAPON or {}) do if type(v)~='function' then add('WEAPON.'..tostring(k)..'='..tostring(v)) end end
local p=fn(PROGRESSION,'13d8bd2b211db6cc')
if p then for _,ref in ipairs({'iw9_m4','iw9_m4_mp'}) do local ok,r=pcall(p,0,LOOT.itemTypes.WEAPON,ref);add('unlock '..ref..'='..tostring(ok)..':'..tostring(r)) end end
for k,v in pairs(MenuBuilder) do add('MenuBuilder.'..tostring(k)..'='..tostring(v)) end
return table.concat(o,'\n')
