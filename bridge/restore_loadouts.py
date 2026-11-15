#!/usr/bin/env python3
"""restore_loadouts.py [file]: write saved loadouts back into every loadout set of the running game
(Gear Up shows them and matches use them). Default file: ~/.wzm_loadouts.tsv"""
import pathlib,subprocess,sys
here=pathlib.Path(__file__).parent
f=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else pathlib.Path.home()/'.wzm_loadouts.tsv')
if not f.exists(): print('no saved loadouts'); sys.exit(0)
rows=[l.split('\t',2) for l in f.read_text().splitlines() if l and not l.startswith('#')]
def lua_val(t,v):
    if t=='number': return v
    if t=='boolean': return v
    return '"'+v.replace('\\','\\\\').replace('"','\\"')+'"'
items=',\n'.join('{"%s",%s}'%(p,lua_val(t,v)) for p,t,v in rows)
lua=f'''local V={{
{items}
}}
local PD=rawget(_G,'PLAYER_DATA');local core
for k,v in pairs(PD or {{}}) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local ok_n,bad_n=0,0
for _,gn in ipairs({{'WZRankedLoadouts','RankedLoadouts','PrivateLoadouts','WZPrivateLoadouts'}}) do
  local ok,root=pcall(core,0,CoD.StatsGroup[gn])
  if ok and root then
    for _,e in ipairs(V) do
      local n=root.loadouts
      local good=pcall(function()
        for part in string.gmatch(e[1],'[^%.]+') do local i=tonumber(part); n=n[i~=nil and i or part] end
        n:set(e[2]) end)
      if good then ok_n=ok_n+1 else bad_n=bad_n+1 end
    end
    collectgarbage('collect')
  end
end
return 'restored '..ok_n..' fields ('..bad_n..' skipped) from {f.name}'
'''
tmp=here/'restore_loadouts_run.lua';tmp.write_text(lua)
r=subprocess.run([str(here.parents[1]/'frida_venv/bin/python3'),str(here/'lua_exec.py'),tmp.name,'60'],cwd=here,capture_output=True,text=True)
tmp.unlink(missing_ok=True)
print((r.stdout.strip().splitlines() or ['?'])[-1][:300])
