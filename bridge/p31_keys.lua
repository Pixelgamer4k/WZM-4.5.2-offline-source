local o={}
for _,n in ipairs{"Engine","Game","Lobby","MatchRules","Playlist","ACTIONS","MP_COMMON","Dvar","MLG","CONDITIONS"} do
 local t=rawget(_G,n)
 if type(t)=="table" then for k,v in pairs(t) do local s=tostring(k):match("#x0?(%x+)"); if s then o[#o+1]=n.." "..s end end end
end
return table.concat(o,",")
