-- Read-only: find GetToggleOverlays in the in-match Lua globals and hex-dump its bytecode.
local NAME="GetToggleOverlays"
local seen,found,path={},nil,nil
local function walk(t,p,d)
 if found or d>4 or seen[t] then return end
 seen[t]=true
 for k,v in pairs(t) do
  if k==NAME and type(v)=="function" then found=v path=p.."."..tostring(k) return end
  if type(v)=="table" then walk(v,p.."."..tostring(k),d+1) end
 end
end
walk(_G,"_G",0)
if not found then return "not found" end
local ok,bc=pcall(string.dump,found)
if not ok then return path.." dump failed: "..tostring(bc) end
local hex={} for i=1,#bc do hex[i]=string.format("%02x",bc:byte(i)) end
return path.." len="..#bc.." hex="..table.concat(hex)
