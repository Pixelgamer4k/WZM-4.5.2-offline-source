-- Read-only: how require resolves xhash modules in this Lua state.
local out={}
local p=package
out[#out+1]="loaders="..tostring(p.loaders and #p.loaders)
for i,f in ipairs(p.loaders or {}) do out[#out+1]="L"..i.."="..tostring(f) end
local n,types,hit,hitk=0,{},nil,nil
for k,v in pairs(p.loaded) do
 n=n+1 local t=type(k) types[t]=(types[t] or 0)+1
 local s=tostring(k)
 if s:find("56794f44b636e9f1",1,true) then hit=v hitk=k end
 if s:find("1cf5250031b63c42",1,true) then out[#out+1]="K30loaded="..type(v) end
end
local ts={} for t,c in pairs(types) do ts[#ts+1]=t..":"..c end
out[#out+1]="loaded="..n.." keytypes="..table.concat(ts,",")
out[#out+1]="K29loaded="..tostring(hitk~=nil).." "..type(hit)
-- a sample key, to learn how xhash keys print
for k,v in pairs(p.loaded) do if type(k)~="string" then out[#out+1]="sample="..tostring(k).." "..type(k) break end end
return table.concat(out," ")
