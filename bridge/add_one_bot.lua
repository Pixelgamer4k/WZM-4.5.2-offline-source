-- Shipped AddBots menu uses Lobby.AddBots(parentArg0,1,0).
-- Test controller0 in the running local match; call success alone does not prove a bot spawned.
for k,v in pairs(Lobby) do
 if tostring(k):lower():find('f45add213e99c39e',1,true) or tostring(k):lower():find('745add213e99c39e',1,true) then
  local ok,r=pcall(v,0,1,0)
  return 'Lobby.AddBots(0,1,0): '..tostring(ok)..' '..tostring(r)
 end
end
return 'Lobby.AddBots binding missing'
