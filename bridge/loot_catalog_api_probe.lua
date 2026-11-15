local names={['cca887ac48250918']='GetItemType',['04635c3530c32f78']='GetItemData',['9b553dfc3a65b630']='GetItemDataByID',['a27d2c96d481fdb2']='GetItemDataByRef',['f1565990d42b85c8']='GetItemBundle',['7ddf2221febfacd0']='GetItemBundleData',['88a02b7599f5b517']='GetItemLootID',['3d5d69ba555e016d']='GetItemRef',['c36548909cff94cd']='GetItemID',['b91cd1fcdfbbf06c']='GetItemIndex',['3ddeddd761299c7f']='GetItemCount',['21b62776d1df59b8']='GetItemList',['deec6cfba4b388e0']='GetItemsByType',['b0f854826690696e']='GetAllItems',['bb3bed3bdfed48c4']='GetItemsOfType',['39fed542a32ae531']='GetItemIDByRef',['e842e95ebdfd1b8c']='GetItemInfo',['332666ab4e8d7c5d']='GetItemDisplayName',['46b7ac889104ded3']='GetItemName',['6e618110dce16a60']='GetItemBundleByID'}
local o={};local function add(s)o[#o+1]=s end
for k,f in pairs(LOOT) do
 local hash=tostring(k):match('#x0?(%x+)')
 local name=hash and names[hash]
 if name then
  add(name..' '..tostring(k))
  if name=='GetItemType' or name=='GetItemData' or name=='GetItemInfo' or name=='GetItemBundle' then
   local ok,r=pcall(f,WEAPON.M4LootID);add('call '..tostring(ok)..':'..tostring(r))
   if ok and type(r)=='table' then local n=0;for a,b in pairs(r) do n=n+1;if n<18 then add(' '..tostring(a)..'='..tostring(b)) end end end
  end
 end
end
return table.concat(o,'\n')
