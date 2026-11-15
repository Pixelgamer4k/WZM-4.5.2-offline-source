for k,v in pairs(Lobby or {}) do
 if tostring(k):lower():find('f45add213e99c39e',1,true) or tostring(k):lower():find('745add213e99c39e',1,true) then return tostring(k)..' '..tostring(v) end
end
return 'AddBots missing'
