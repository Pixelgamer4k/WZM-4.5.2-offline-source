-- Bounded read-only survey of offline frontend APIs and active menu widgets.
local out={}
local function emit(s) if #out<200 then out[#out+1]=s end end
for _,name in ipairs({'FrontEndScene','OPERATOR','ClientCharacter','LOADOUT','Loadout','LoadoutUtils','Cac','CAC','ARMORY','Armory','Inventory','INVENTORY','Customization','PLAYER_DATA','MenuNavigator','Engine','ACTIONS'}) do
 local t=rawget(_G,name)
 if type(t)=='table' then
  local keys={}
  for k,v in pairs(t) do keys[#keys+1]=tostring(k)..'='..type(v) end
  table.sort(keys);emit(name..': '..table.concat(keys,','):sub(1,2800))
 end
end
local names={}
for k,v in pairs(_G) do local s=tostring(k);if s:lower():find('weapon') or s:lower():find('loadout') or s:lower():find('operator') or s:lower():find('inventory') then names[#names+1]=s..'='..type(v) end end
table.sort(names);emit('globals '..table.concat(names,','))
local F=FrontEndScene
if F then
 emit('scene='..tostring(F.CurrentScene))
 for _,name in ipairs({'RequestedSceneStack','SocialCharacters','ClientCharacters'}) do
  local t=F[name];local n=0
  if type(t)=='table' then for k,v in pairs(t) do n=n+1;if n<5 then emit(name..'['..tostring(k)..']='..tostring(v)) end end end
  emit(name..'.count='..n)
 end
end
local n=0
local function walk(e,d)
 if d>25 or n>3500 then return end;n=n+1
 local s;pcall(function() if type(e.getText)=='function' then s=e:getText() end end)
 if type(s)=='string' and #s>0 then emit('text '..tostring(e.id)..' '..s:sub(1,130)) end
 local c=e:getFirstChild();while c do walk(c,d+1);c=c:getNextSibling() end
end
if LUI and LUI.primaryRoot then pcall(walk,LUI.primaryRoot,0) end
emit('widgets '..n)
return table.concat(out,'\n')
