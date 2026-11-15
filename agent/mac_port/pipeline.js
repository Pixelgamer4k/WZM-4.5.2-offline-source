/*
 * In-process replay of the proven Mac/root "menu" workflow (./wzm: menu, unlock, "<game> from menu"):
 *
 *  menu.sh -> play_offline.sh -> run_host.sh (WZM_MENU_ONLY=1)
 *      fake_player_data.py      frame hook once + fake_player_data.lua
 *      restore_loadouts.py      phone-local saved loadouts, if any
 *      host_spawn.py            host_spawn.js + flags loaded, NO go() yet (menuOnlyArmed)
 *  unlock_all_menu.sh (WZM_NO_OPEN=1)
 *      frontend_preview_guard.js (stays) ; prepare_loadout_frontend.sh (catalog, profile, hub, offline_unlocks)
 *      offline_client_fence, seed_all_loadouts (once), restore, unlocks_ext, unlocks_level [, open_gear_up]
 *  menu_keeper.sh           every 10 s: check_unlock_state -> re-fence + unlock; every 30 s save loadouts
 *  match_from_menu.sh       save + restore loadouts, go(map, gametype, enemies)
 *      bot_ready_watch.py   matchProbe spec=false -> party_bot_inject.js (stays)
 *      both_sides_bots.py   botInjectFinal -> native_ai_both_sides.js -> unload -> native_ai_veteran_guard.js
 *
 * Every script is the unmodified Mac file (generate_mac_sources.py). Native
 * messages are queued and handled on the JS loop, as the Python drivers did.
 */
import {runStage} from './stage.js';
import {attachAnywhere} from './nearhook.js';
import * as S from './mac_sources.js';

export const MAPS = Object.freeze([
  {id: 'nuketown', label: 'Nuketown', native: 'mp_mgl_nuketown'},
  {id: 'crash', label: 'Crash', native: 'mp_mgl_crash2'},
  {id: 'verdansk', label: 'Verdansk', native: 'mp_mgl_wz2_sierra'},
  {id: 'hardhat', label: 'Hardhat', native: 'mp_mgl_hardhat'},
  {id: 'slaughterhouse', label: 'Slaughterhouse', native: 'mp_mgl_slaughterhouse'},
  {id: 'downtown', label: 'Downtown', native: 'mp_mgl_ftue_downtown'},
  {id: 'rebirth', label: 'Rebirth Island', native: 'mp_mgl_escape4'},
]);
export const MODES = Object.freeze([
  {id: 'tdm', label: 'Team Deathmatch', native: '0x3f9bd6e4038d651d'},
  {id: 'domination', label: 'Domination', native: '0x6cec28f740df15db'},
  {id: 'hardpoint', label: 'Hardpoint', native: '0x7727d380d55d0e58'},
  {id: 'kill_confirmed', label: 'Kill Confirmed', native: '0x39e8297d7f7df31d'},
  {id: 'sd', label: 'Search & Destroy', native: '0x1dbcd710fe215368'},
  {id: 'frontline', label: 'Frontline', native: '0x7aa5ae4c378e7c80'},
]);
export const DIFFICULTIES = Object.freeze(['Recruit', 'Regular', 'Hardened', 'Veteran']);

// Graphics are owned by mac_port/gfx_live.js (live, menu + match); the host's
// one-shot gfx_apply.js / fixed-640 code is switched off (WZM_GFX_ENV.off).

// Gear Up needs CLIENT_CONNECT reported as 4 (offline_client_fence.lua), but a
// match load must see the real fence or a loader thread reads a missing client.
const LUA_CLIENT_FENCE_RESTORE = "local S=rawget(_G,'WZM_CLIENT_FENCE') " +
  "if S and S.orig then Fences[S.key]=S.orig S.orig=nil return 'CLIENT_CONNECT restored' end " +
  "return 'client fence not installed'";
// Session-only ownership overrides make every item "owned"; the match load then
// builds per-item data until an engine pool runs out (DEV ERROR 0x1BEE3C2D at
// libgame+0x3e4396c). Loadouts are already in the profile, so switch them off
// for the match like the cold-boot path (which never had them).
const LUA_UNLOCKS_OFF = "local n=0 for _,g in ipairs({'WZM_UNLOCK','WZM_UNLOCK_EXT','WZM_UNLOCK_LVL'}) do " +
  "local S=rawget(_G,g) if S and S.restore then S.restore() n=n+1 end end " +
  "return 'unlock overrides restored: '..n";
// GEAR UP tap detection: the tile asks Fences(…, 'WEAPON_DEF') when tapped. Count
// those queries without changing the answer; a burst after a quiet period = tap.
const LUA_GEAR_WATCH = "local S=rawget(_G,'WZM_WDEF') if not S then S={n=0} rawset(_G,'WZM_WDEF',S) end " +
  "if not S.installed then local k,q for kk,v in pairs(Fences) do if tostring(kk):find('b06c6d08978b8c65',1,true) then k,q=kk,v end end " +
  "if not q then return 'no fence query' end S.installed=true " +
  "Fences[k]=function(c,name,...) if name=='WEAPON_DEF' then S.n=S.n+1 end return q(c,name,...) end end " +
  "return 'gear watch '..S.n";
const LUA_GEAR_POLL = "local S=rawget(_G,'WZM_WDEF') if not S or not S.installed then return '-1' end return tostring(S.n)";
const PARTY_ENV = 'globalThis.WZM_BOT_ENV={partyMembers:true,teamFields:false,count:2,team:1,calls:2,friends:0};\n';
// Menu 3D room (12 Nov): after the room's UI rebuild the old skip leaves stale "_WZM" flags and does not
// re-hook the new LUI classes; and the squad-model code loops to SOCIAL[166b1673577a0458]'s party size,
// which is nil offline. Clear the flags and give the party size 0 when empty.
const LUA_SKIP_REARM_HEAD = `do
  local S = rawget(_G, 'SOCIAL')
  local key
  for k in pairs(S or {}) do if tostring(k) == 'xhash: #x0166b1673577a0458' then key = k end end
  local orig = key and rawget(S, key)
  if orig and rawget(_G, 'WZM_SOCIALFIX') ~= orig then
    local wrapped = function(...)
      local a, b = orig(...)
      if a ~= nil then
        local real = a
        a = setmetatable({}, {__index = function(_, k2)
          if k2 == 'GetValue' then return function(_, c) local v = real:GetValue(c); if v == nil then return 0 end return v end end
          local v = real[k2]
          if type(v) == 'function' then return function(_, ...) return v(real, ...) end end
          return v
        end})
      end
      return a, b
    end
    rawset(S, key, wrapped)
    rawset(_G, 'WZM_SOCIALFIX', wrapped)
  end
end
rawset(_G, '_WZM', nil)
`;
const LUA_TIMEOUTS = {fence: 10000, seed: 15000, ext: 15000, level: 15000, open: 20000, restore: 60000};

export function createMacSession({log = () => {}, status = () => {}, event = () => {},
                                  storage = null, relaunch = null, beforeMatch = () => {}} = {}) {
  let phase = 'IDLE';          // IDLE PREPARING MENU (host armed) HOSTING PARTY AI PLAYING FAILED
  let busy = null;             // name of the menu task in progress
  let host = null, party = null, creator = null, guard = null, previewGuard = null;
  let unlocked = false, seeded = false;
  let catalogCountBefore = null;
  // The frontend weapon catalog (needed for Gear Up's gun list) cannot be undone
  // in-process: a match loaded afterwards exhausts an engine pool (DEV ERROR
  // 0x1BEE3C2D). Play then restarts the game and starts the match in a clean process.
  let catalogRegistered = false;
  let frontendStarted = false, playButtonFixed = false, gearAfterRoom = false;
  // In-place match after the menu 3D room is unfinished (client still draws the room when the match world
  // loads: main-thread fault 0x4d597a0). Until solved, a match after the room uses the clean restart.
  const ROOM_INPLACE = !!(storage && storage.read('wzm_room_inplace'));   // menu 3D room running: its connect used the host's one-time steer hooks
  let aiRetries = 0;
  let profileReady = false;
  // Bot scripts patch the server veneer pointer to their own native code; their
  // code must outlive the match (Mac kept them attached), so they are retired, never unloaded.
  const retired = [];
  let wasInWorld = false, menuWatch = null, matchCount = 0, hostClass = 0;
  let req = null;
  let snapTimer = null, keeperTimer = null, keeperTicks = 0;
  let lastSnap = null;
  let inWorld = false;
  const queue = [];
  let draining = false;

  function setPhase(p, text) {
    phase = p;
    log('phase ' + p + (text ? ': ' + text : ''));
    if (text) status(text);
  }

  function sink(stage) {
    return payload => {
      queue.push([stage, payload]);
      if (!draining) { draining = true; setImmediate(drain); }
    };
  }
  function drain() {
    draining = false;
    while (queue.length) {
      const [stage, p] = queue.shift();
      try { event(stage, p); } catch (_) {}
      try { handle(stage, p); } catch (e) { log('handler ' + stage + ': ' + e); }
    }
  }

  // A one-shot Mac script: load, wait for a message, unload.
  function oneShot(name, source, isDone, timeoutMs, start, quiet = false) {
    return new Promise((resolve, reject) => {
      let stage = null, settled = false;
      const timer = setTimeout(() => settle(false, new Error(name + ' timed out')), timeoutMs);
      function settle(ok, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        setImmediate(() => {
          if (stage !== null) stage.unload();
          ok ? resolve(value) : reject(value);
        });
      }
      try {
        stage = runStage(name, source, {onMessage(p) {
          if (!quiet) sink(name)(p);
          if (isDone(p)) settle(true, p);
        }});
        if (start) start(stage);
      } catch (e) { settle(false, e); }
    });
  }

  async function lua(name, source, timeoutMs = 15000, quiet = false) {
    const r = await oneShot('lua_' + name, S.LUA_EXEC, p => p && p.kind === 'lua_result',
      timeoutMs, st => st.exports.run(source), quiet);
    const out = r.out || {};
    if (!quiet) log('lua ' + name + ': load=' + out.load + ' pcall=' + out.pcall + ' ' +
      String(out.result ?? out.exception ?? '').slice(0, 160));
    return out;
  }

  // ---- loadout persistence (replaces ~/.wzm_loadouts.tsv) ----
  function restoreLoadoutsLua(tsv) {
    const rows = tsv.split('\n').filter(l => l && !l.startsWith('#')).map(l => {
      const i = l.indexOf('\t'), j = l.indexOf('\t', i + 1);
      return [l.slice(0, i), l.slice(i + 1, j), l.slice(j + 1)];
    }).filter(r => r[0] && r[1]);
    if (!rows.length) return null;
    const val = (t, v) => (t === 'number' || t === 'boolean') ? v :
      '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    const items = rows.map(([p, t, v]) => '{"' + p + '",' + val(t, v) + '}').join(',\n');
    return `local V={
${items}
}
local PD=rawget(_G,'PLAYER_DATA');local core
for k,v in pairs(PD or {}) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local ok_n,bad_n=0,0
for _,gn in ipairs({'WZRankedLoadouts','RankedLoadouts','PrivateLoadouts','WZPrivateLoadouts'}) do
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
return 'restored '..ok_n..' fields ('..bad_n..' skipped) from wzm_loadouts.tsv'
`;
  }

  // ---- operator persistence (wzm_operator.tsv) ----
  // Gear Up → Operator → EQUIP writes customizationSetup.operators[0..1] (operator skin
  // refs, xhash) and selectedOperatorIndex in every loadout group. Lua cannot build an
  // xhash from text, so restore looks the saved value up by its text in the game tables.
  const OP_GROUPS = "{'WZRankedLoadouts','RankedLoadouts','PrivateLoadouts','WZPrivateLoadouts'}";
  const OP_CORE = "local PD=rawget(_G,'PLAYER_DATA');local core\n" +
    "for k,v in pairs(PD or {}) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end\n";
  const LUA_DUMP_OPERATOR = OP_CORE + `local out={}
for _,gn in ipairs(${OP_GROUPS}) do
  local ok,r=pcall(core,0,CoD.StatsGroup[gn])
  if ok and r then pcall(function()
    local cs=r.customizationSetup
    out[#out+1]=gn..'\\tsel\\t'..tostring(cs.selectedOperatorIndex:get())
    for i=0,1 do out[#out+1]=gn..'\\top'..i..'\\t'..tostring(cs.operators[i]:get()) end
    local done={}
    for i=0,1 do
      local op=tostring(cs.operators[i]:get())
      if not done[op] and op~='xhash: #x40' then done[op]=true
        local e=cs.operatorCustomization[(op:gsub('^xhash: ',''))]
        out[#out+1]=gn..'\\tcust\\t'..op..'\\t'..tostring(e.skin:get())..'\\t'..tostring(e.chroma:get())..'\\t'..
          tostring(e.execution:get())..'\\t'..tostring(e.taunt:get())..'\\t'..tostring(e.intro:get())
      end
    end
  end) end
end
return table.concat(out,'\\n')`;
  function restoreOperatorLua(tsv) {
    const safe = v => /^[\w:# .-]+$/.test(v);
    const rows = tsv.split('\n').map(l => l.split('\t')).filter(r => /^[A-Za-z]+$/.test(r[0] || '') && r.slice(2).every(safe) &&
      ((r.length === 3 && /^(sel|op[01])$/.test(r[1])) || (r.length === 8 && r[1] === 'cust')));
    if (!rows.length) return null;
    const items = rows.map(r => '{' + r.map(v => `'${v}'`).join(',') + '}').join(',');
    return OP_CORE + `local V={${items}}
local function fk(t,h) if type(t)~='table' then return nil end for k,v in pairs(t) do if tostring(k)=='xhash: #x'..h then return v end end end
local opData=fk(OPERATOR,'072145c734039267f')
local okn,bad=0,0
for _,e in ipairs(V) do
  local good=pcall(function()
    local cs=core(0,CoD.StatsGroup[e[1]]).customizationSetup
    if e[2]=='sel' then cs.selectedOperatorIndex:set(tonumber(e[3])); return end
    if e[2]=='cust' then
      local c=cs.operatorCustomization[(e[3]:gsub('^xhash: ',''))]
      c.execution:set(tonumber(e[6])); c.taunt:set(tonumber(e[7])); c.intro:set(tonumber(e[8]))
      if e[4]~='xhash: #x40' and tostring(c.skin:get())~=e[4] then
        -- skin slots reject '#x' text: take the real skin value from the operator's own skin list
        local slot=cs.operators[1]; local keep=slot:get()
        slot:set((e[3]:gsub('^xhash: ',''))); local opX=slot:get(); slot:set(keep)
        local T=opData(opX); local list=fk(T,'0a44bec41ef81a271'); local skinX
        for _,it in pairs(list or {}) do local v=type(it)=='table' and fk(it,'03f1a2d18de6ad138'); if v and tostring(v)==e[4] then skinX=v end end
        if not skinX then error('skin not in list') end
        c.skin:set(skinX)
      end
      if tostring(c.skin:get())~=e[4] then error('skin mismatch') end
      return
    end
    -- the DDL setter parses '#x<hex>' into the xhash itself
    local h=e[3]:gsub('^xhash: ','')
    local n=cs.operators[tonumber(e[2]:sub(3))]
    n:set(h)
    if tostring(n:get())~=e[3] then error('mismatch') end
  end)
  if good then okn=okn+1 else bad=bad+1 end
end
return 'operator restored '..okn..' ('..bad..' skipped)'`;
  }

  // Never auto-save until this process restored the saved pick cleanly: otherwise the
  // default operator of a fresh boot would overwrite the player's choice.
  let opRestored = false, opBaseline = null;
  async function restoreOperator() {
    const tsv = storage ? storage.read('wzm_operator.tsv') : null;
    if (!tsv) { opRestored = true; return; }
    const src = restoreOperatorLua(tsv);
    if (!src) { opRestored = true; return; }
    const out = await lua('restore_operator', src, LUA_TIMEOUTS.restore);
    if (/\(0 skipped\)/.test(String(out.result || ''))) { opRestored = true; return; }
    // restore incomplete: remember what the game holds now; save only after the player changes it
    try { opBaseline = (await lua('dump_operator', LUA_DUMP_OPERATOR, 20000, true)).result; } catch (_) {}
  }

  async function saveOperator() {
    const out = await lua('dump_operator', LUA_DUMP_OPERATOR, 20000, true);
    const res = out.result;
    if (typeof res !== 'string' || out.pcall !== 0 || !res.includes('\top0\t')) return;
    if (!opRestored) { if (opBaseline === null || res === opBaseline) return; opRestored = true; }
    // keep the skins of operators equipped earlier (rows for operators not equipped now)
    const old = storage.read('wzm_operator.tsv') || '';
    const key = l => l.split('\t').slice(0, 3).join('\t');
    const have = new Set(res.split('\n').filter(l => l.split('\t')[1] === 'cust').map(key));
    const keep = old.split('\n').filter(l => { const f = l.split('\t'); return f[1] === 'cust' && f.length === 8 && !have.has(key(l)); });
    const merged = keep.length ? res + '\n' + keep.join('\n') : res;
    if (old === merged) return;
    storage.write('wzm_operator.tsv', merged);
    log('saved operator: ' + (res.split('\n').find(l => l.includes('\top0\t')) || ''));
  }

  async function restoreLoadouts() {
    try { await restoreOperator(); } catch (e) { log('restore operator: ' + e); }
    const tsv = storage ? storage.read('wzm_loadouts.tsv') : null;
    if (!tsv) { log('no saved loadouts'); return; }
    const src = restoreLoadoutsLua(tsv);
    if (src) await lua('restore_loadouts', src, LUA_TIMEOUTS.restore);
  }

  async function saveLoadouts() {
    if (!storage) return;
    try { await saveOperator(); } catch (e) { log('save operator: ' + e); }
    const out = await lua('dump_loadouts', S.LUA_DUMP_LOADOUTS, 60000);
    const res = out.result;
    if (typeof res !== 'string' || out.pcall !== 0) return;
    if (res === 'NOTHING_EDITED') return;
    const old = storage.read('wzm_loadouts.tsv') || '';
    if (old.split('\n').slice(1).join('\n') === res.split('\n').slice(1).join('\n')) return;
    if (old) storage.write('wzm_loadouts.tsv.bak', old);
    storage.write('wzm_loadouts.tsv', res);
    log('saved ' + (res.split('\n').length - 1) + ' loadout fields');
  }

  // Frontend weapon registry (frontend_weapon_catalog.py): count u32 at +0x6cb1ab0,
  // entries at +0x6cb1ac0. Match load walks entries 0..count (libgame+0x1de939c)
  // and faults on an empty one, so the cold-boot registry state is restored first.
  function weaponRegistry() {
    const b = Process.getModuleByName('libgame.so').base;
    const count = b.add(0x6cb1ab0).readU32();
    const table = b.add(0x6cb1ac0);
    const empty = [];
    for (let i = 0; i <= Math.min(count, 4096); i++)
      if (table.add(i * 8).readPointer().isNull()) empty.push(i);
    return {count, empty, countAddr: b.add(0x6cb1ab0)};
  }

  // The game's fatal-error path (libgame+0x12a1300 writes to 0x13) never reaches
  // logcat; capture its message at the log call so failures are explainable.
  let fatalHook = null;
  function armFatalWitness() {
    if (fatalHook !== null) return;
    const b = Process.getModuleByName('libgame.so').base;
    fatalHook = attachAnywhere(b.add(0x12a12f4), function () {
      let msg = '?';
      try { msg = this.context.x3.readCString(600); } catch (_) {}
      log('GAME FATAL ERROR: ' + msg);
    });
  }

  function restoreWeaponRegistry() {
    if (catalogCountBefore === null) return;
    const r = weaponRegistry();
    log('weapon registry before match: count=' + r.count + ' empty=' + JSON.stringify(r.empty.slice(0, 20)) +
      ' -> restoring count ' + catalogCountBefore);
    r.countAddr.writeU32(catalogCountBefore);
    unlocked = false;  // the catalog has to be registered again after the match
  }

  // ---- menu.sh: profile, saved loadouts, armed host ----
  function ensureHost(o) {
    if (host !== null) return;
    const cls = o && Number.isInteger(o.classIndex) && o.classIndex >= 0 && o.classIndex < 10 ? o.classIndex : 0;
    const base = o && o.map === 'mp_mgl_wz2_sierra' ? S.HOST_VERDANSK : S.HOST_PLAY;
    // wzmSetFlow: lets the frontend 3D-world start use the same protection bypass as a match start.
    const FLOW_DECL = 'let pending=null,flowOverride=false;';
    const src = base.split('__WZM_CLASS_INDEX__').join(String(cls)).split(FLOW_DECL)
      .join(FLOW_DECL + 'globalThis.wzmSetFlow=v=>{flowOverride=!!v;FASTMEM.writeS32(v?1:0);return flowOverride;};')
      // the menu's 3D room is not a match: no in-match UI restart, no automatic class select
      .split('if(UI_RETRY&&!UI_WAIT_ASSET)setTimeout(').join('if(UI_RETRY&&!UI_WAIT_ASSET&&!globalThis.wzmFrontend)setTimeout(')
      .split('  if(conn!==8)return;').join('  if(conn!==8||globalThis.wzmFrontend)return;')
      // the room's client entering its world must not use up the connect-steer hooks the match needs
      .split('if(BOTS&&!humanInWorld){humanInWorld=true;').join('if(BOTS&&!humanInWorld&&!globalThis.wzmFrontend){humanInWorld=true;')
      // From the menu 3D room: stop the room's server and unload its world FIRST (prep2 stops the server
      // thread), then switch game type; switching under the running room server crashed it (0x2678d90).
      // From the menu 3D room: no manual teardown; the game's own server spawn changes the map (as online),
      // while the room server's frames are held (holdRoomServer) so it does not run during the switch.
      // From the menu 3D room: pause the 3D world update counter (*0xbeb07f4, read by 0x3a5579c before the ECS
      // render pass) so freed room entities are not drawn, tear the room down first (pops its allocations before
      // the match frees older ones: DEV ERROR 0x663393C3 otherwise), then switch game type; restore after start.
      .split('if(pending){const j=pending;pending=null;').join('if(pending){const j=pending;pending=null;if(globalThis.wzmFromRoom&&!globalThis.wzmRoomStopped){try{const wc=at(0xbeb07f4);globalThis.wzmWorldCount=wc.readS32();wc.writeS32(0);prep1(0);prep2();prep3();worldUnload(1);globalThis.wzmRoomStopped=true;send({s:"roomStopped",worlds:globalThis.wzmWorldCount});}catch(e){send({s:"roomStopErr",e:""+e});}}')
      .split('prep1(0);prep2();prep3();worldUnload(1);send({s:').join('if(!globalThis.wzmRoomStopped){prep1(0);prep2();prep3();worldUnload(1);}send({s:')
      .split("hostStart();send({s:'hostStartReturned'});").join("hostStart();send({s:'hostStartReturned',worlds:at(0xbeb07f4).readS32()});")
      ;
    host = runStage('host_spawn', src,
      {onMessage: sink('host'), globals: {WZM_GFX_ENV: {off: true}}});
    hostClass = cls;
    log('host loaded (class ' + (cls + 1) + ')');
    globalThis.wzmHost = host;
  }

  async function prepareMenu(defaults) {
    if (phase !== 'IDLE') return;
    setPhase('PREPARING', 'Preparing offline profile…');
    try {
if (!profileReady) {
      const fp = await oneShot('fake_player', S.FAKE_PLAYER_JS,
        p => p && typeof p === 'object' && 'bound' in p, 10000);
      log('fake player data: ' + JSON.stringify(fp));
      await lua('fake_player_data', S.FAKE_PLAYER_LUA, 10000);
        profileReady = true;
      }
      await restoreLoadouts();
      let pending = null;
      try { pending = JSON.parse(storage && storage.read('wzm_pending_match.json') || 'null'); } catch (_) {}
      if (pending) storage.write('wzm_pending_match.json', '{}');
      if (pending && pending.req && Date.now() - pending.at < 15 * 60 * 1000) {
        setPhase('MENU', 'Game restarted. Starting your match now — do not tap anything…');
        setTimeout(() => play({...pending.req, fromRestart: true}).then(status), 1500);
        startKeeper();
        return;
      }
      // menu.sh order: host armed at the menu BEFORE unlocks. Without it the
      // protected exit path closes the game when the loadout editor opens.
      ensureHost(defaults);
      if (storage && storage.read('wzm_test_no_auto_unlock')) {
        setPhase('MENU', 'Ready (auto-unlock off for this test).');
      } else {
        setPhase('MENU', 'Ready. Unlocking everything…');
        await unlockAll({open: false, catalog: false});
        await installGearWatch();
      }
      startKeeper();
    } catch (e) {
      setPhase('FAILED', 'Offline setup failed: ' + (e && e.message || e));
    }
  }

  // ---- unlock_all_menu.sh ----
  async function unlockAll({open = false, catalog = true} = {}) {
    if (busy) return 'Busy: ' + busy;
    if (phase !== 'MENU') return 'Unlocks work in the main menu only';
    busy = 'unlock';
    try {
      status('Unlocking guns, operators, skins and camos…');
      if (previewGuard === null) {
        previewGuard = runStage('frontend_preview_guard', S.PREVIEW_GUARD, {onMessage: sink('preview_guard')});
      }
      // prepare_loadout_frontend.sh
      // With the menu 3D room running the editor gets weapon models without the catalog, and the catalog is
      // what used to break the next match load (DEV ERROR 0x1BEE3C2D).
      if (frontendStarted) catalog = false;
      if (catalog && !catalogRegistered && unlocked) {
        // Gear Up requested after the boot unlock: only the weapon catalog is missing.
        catalogCountBefore = weaponRegistry().count;
        const cat = await oneShot('weapon_catalog', S.WEAPON_CATALOG, p => p && p.kind === 'done', 45000);
        log('weapon catalog: ' + JSON.stringify(cat).slice(0, 200));
        catalogRegistered = true;
      }
      if (!unlocked) {
        if (catalog && catalogCountBefore === null) catalogCountBefore = weaponRegistry().count;
        const skip = (storage && storage.read('wzm_test_skip')) || '';
        if (catalog && !catalogRegistered && !skip.includes('catalog')) {
          const cat = await oneShot('weapon_catalog', S.WEAPON_CATALOG,
            p => p && p.kind === 'done', 45000);
          log('weapon catalog: ' + JSON.stringify(cat).slice(0, 200));
          catalogRegistered = true;
        } else log('TEST: weapon catalog skipped');
        if (!profileReady) {
        const fp = await oneShot('fake_player', S.FAKE_PLAYER_JS,
          p => p && typeof p === 'object' && 'bound' in p, 10000);
        log('fake player data: ' + JSON.stringify(fp));
        await lua('fake_player_data', S.FAKE_PLAYER_LUA, 10000);
          profileReady = true;
        }
        const hub = await oneShot('hub_restore', S.HUB_RESTORE, p => p && p.kind === 'lua_result',
          15000, st => st.exports.run('go'));
        log('hub: ' + JSON.stringify(hub.out || hub).slice(0, 200));
        await lua('offline_unlocks', S.LUA_OFFLINE_UNLOCKS, 10000);
      }
      await lua('client_fence', S.LUA_CLIENT_FENCE, LUA_TIMEOUTS.fence);
      if (!seeded) { await lua('seed_loadouts', S.LUA_SEED_LOADOUTS, LUA_TIMEOUTS.seed); seeded = true; }
      await restoreLoadouts();
      const ext = await lua('unlocks_ext', S.LUA_UNLOCKS_EXT, LUA_TIMEOUTS.ext);
      await lua('unlocks_level', S.LUA_UNLOCKS_LEVEL, LUA_TIMEOUTS.level);
      if (open) await lua('open_gear_up', S.LUA_OPEN_GEAR_UP, LUA_TIMEOUTS.open);
      unlocked = true;
      const msg = 'Everything unlocked. ' + (open ? 'Gear Up opened. Next PLAY restarts the game once.' :
        (catalogRegistered || matchCount > 0 ? 'Ready. PLAY restarts the game once.' : 'Ready. PLAY starts instantly.'));
      status(msg);
      log('unlocks_ext: ' + String(ext.result || '').slice(0, 200));
      return msg;
    } catch (e) {
      const msg = 'Unlock failed: ' + (e && e.message || e);
      status(msg);
      return msg;
    } finally {
      busy = null;
    }
  }

  // ---- menu 3D room (operator / weapon previews, menu backdrop) ----
  // The frontend manager 0x3aae118 waits in state 3 for fences ONLINE(13) and NETWORKING(2), checked by
  // 0x36ae29c from 0x3aae2a0/0x3aae2b0; ONLINE never completes offline. Pass those two checks only, and
  // when the room's "Local FrontEnd" server starts (0x3cc990c) turn on the host's protection bypass,
  // marked as frontend so no match-only UI steps run.
  let feHooks = [];
  // Room → match: the room's server thread keeps running frontend game code while the match request switches
  // the game type (server-thread fault at 0x2678d90). Skip its frames (SV_Frame 0x3cf10e0, called from the server thread
  // loop 0x3cbd0e8) until the game's host start 0x1621ab0 has spawned the match server.
  let svHold = null;
  function holdRoomServer() {
    if (svHold !== null) return;
    try {
      const B = Process.getModuleByName('libgame.so').base;
      const frame = B.add(0x3cf10e0);  // SV_Frame, called in the server thread's loop 0x3cf253c
      svHold = {on: true, skipped: 0};
      const orig = new NativeFunction(frame, 'pointer', ['pointer', 'pointer', 'pointer', 'pointer']);
      const cb = new NativeCallback((a, b, c, d) => {
        if (svHold.on) { svHold.skipped++; return ptr(0); }
        return orig(a, b, c, d);
      }, 'pointer', ['pointer', 'pointer', 'pointer', 'pointer']);
      svHold.cb = cb;
      Interceptor.replace(frame, cb);
      svHold.hs = Interceptor.attach(B.add(0x1621ab0), {onLeave() {
        if (!svHold.on) return;
        svHold.on = false;
        log('room server hold released after ' + svHold.skipped + ' skipped frames');
        setTimeout(() => { try { Interceptor.revert(frame); svHold.hs.detach(); } catch (e) { log('hold revert: ' + e); } }, 2000);
      }});
      log('room server held for the match switch');
    } catch (e) { log('room hold: ' + e); svHold = null; }
  }
  function startFrontendRoom() {
    if (feHooks.length || host === null || (storage && storage.read('wzm_no_frontend_room'))) return;
    try {
      const B = Process.getModuleByName('libgame.so').base;
      const r1 = B.add(0x3aae2a0), r2 = B.add(0x3aae2b0);
      feHooks.push(Interceptor.attach(B.add(0x36ae29c), {
        onEnter() { this.fe = this.returnAddress.equals(r1) || this.returnAddress.equals(r2); },
        onLeave(r) { if (this.fe && !frontendStarted && (r.toInt32() & 1) === 0) r.replace(ptr(1)); }
      }));
      feHooks.push(Interceptor.attach(B.add(0x3cc990c), {onEnter() {
        if (frontendStarted || host === null) return;
        frontendStarted = true;
        try { host.global.wzmFrontend = true; host.global.wzmSetFlow(true); } catch (e) { log('frontend flow: ' + e); }
        gw.quietUntil = Date.now() + 30000; gw.armed = false; gw.last = null; gw.idle = 0;
        log('menu 3D room starting');
      }}));
      log('menu 3D room armed');
    } catch (e) { log('frontend room: ' + e); }
  }

  // ---- GEAR UP on demand (keeps PLAY instant until Gear Up is used) ----
  const gw = {last: null, idle: 0, armed: false, noisy: 0, disabled: false, timer: null, quietUntil: 0};
  async function installGearWatch() {
    if (catalogRegistered || gw.disabled) return;
    try {
      const r = await lua('gear_watch', LUA_GEAR_WATCH, 10000);
      gw.last = null; gw.idle = 0; gw.armed = false; gw.noisy = 0;
      if (gw.timer === null) gw.timer = setInterval(gearPoll, 700);
      if (!String(r.result || '').startsWith('gear watch')) gw.disabled = true;
    } catch (e) { log('gear watch: ' + e); }
  }
  async function gearPoll() {
    if (phase !== 'MENU' || busy || catalogRegistered || gw.disabled) return;
    // After a UI reset the menu re-asks WEAPON_DEF by itself; that is not a tap.
    if (Date.now() < gw.quietUntil) { gw.last = null; gw.idle = 0; gw.armed = false; return; }
    busy = 'gearwatch';
    try {
      const n = parseInt((await lua('gear_poll', LUA_GEAR_POLL, 5000, true)).result, 10);
      if (!Number.isFinite(n) || n < 0) { busy = null; gw.quietUntil = Date.now() + 25000; await installGearWatch(); return; }
      if (gw.last === null) { gw.last = n; return; }
      const d = n - gw.last;
      gw.last = n;
      if (d === 0) { if (++gw.idle >= 3) gw.armed = true; return; }
      if (!gw.armed) {
        // The menu keeps asking on its own: no clean tap signal. Fall back to
        // registering the guns right away (Gear Up ready, PLAY restarts).
        if (++gw.noisy >= 6) {
          gw.disabled = true;
          log('WEAPON_DEF is polled continuously; registering the weapon catalog now');
          busy = null;
          await unlockAll({open: false, catalog: true});
        }
        return;
      }
      gw.armed = false; gw.idle = 0;
      log('GEAR UP tap detected (WEAPON_DEF asked ' + d + 'x)');
      busy = null;
      // Owner choice (12 Nov): the menu 3D room starts only when Gear Up is opened (first match of a session).
      // Its start rebuilds the UI once; Gear Up is opened again after that (keeper, after the PLAY fix pass).
      if (!frontendStarted && matchCount === 0 && host !== null && !(storage && storage.read('wzm_no_frontend_room'))) {
        status('Loading 3D Gear Up (about 1 minute; Gear Up opens by itself)… Your next match will need a game restart (RESTART & PLAY).');
        gearAfterRoom = true;
        startFrontendRoom();
        setTimeout(async () => {
          if (!gearAfterRoom) return;
          gearAfterRoom = false;
          log('3D room did not finish; opening Gear Up without it');
          try { await unlockAll({open: true, catalog: true}); } catch (e) { log('gear fallback: ' + e); }
        }, 150000);
        return;
      }
      status('Opening Gear Up… Your next match will need a game restart (RESTART & PLAY).');
      await unlockAll({open: true, catalog: true});
    } catch (e) {
      log('gear poll: ' + e);
    } finally {
      if (busy === 'gearwatch') busy = null;
    }
  }

  // ---- menu_keeper.sh ----
  function startKeeper() {
    if (keeperTimer !== null) return;
    keeperTimer = setInterval(async () => {
      if (phase !== 'MENU' || busy) return;
      busy = 'keeper';
      try {
        const r = await lua('check_unlock_state', S.LUA_CHECK_UNLOCK, 10000);
        if (String(r.result || '').includes('unlock=false')) {
          log('UI was reset: restoring main menu and unlocks');
          gw.quietUntil = Date.now() + 15000; gw.armed = false; gw.last = null; gw.idle = 0;
          await lua('skip_online_fences', LUA_SKIP_REARM_HEAD + S.LUA_SKIP_ONLINE_FENCES, 10000);
          playButtonFixed = false;
          busy = null;
          await new Promise(r2 => setTimeout(r2, 4000));
          unlocked = false;
          await unlockAll({open: false, catalog: catalogRegistered || matchCount > 0});
          await installGearWatch();
        }
        // After the menu 3D room's UI rebuild the skip runs once with fresh flags; its second
        // pass fixes the game's own PLAY button (status "FINALIZING INSTALL" otherwise).
        if (frontendStarted && !playButtonFixed) {
          const pb = await lua('skip_play_button', S.LUA_SKIP_ONLINE_FENCES, 10000, true);
          if (String(pb.result || '').includes('play button ready')) {
            playButtonFixed = true; log('play button fixed');
            if (gearAfterRoom) { gearAfterRoom = false; busy = null; await unlockAll({open: true, catalog: true}); }
          }
        }
        keeperTicks++;
        if (keeperTicks % 3 === 0) await saveLoadouts();
      } catch (e) {
        log('keeper: ' + e);
      } finally {
        if (busy === 'keeper') busy = null;
      }
    }, 10000);
  }

  function stopKeeper() {
    if (keeperTimer !== null) { clearInterval(keeperTimer); keeperTimer = null; }
  }

  // ---- match_from_menu.sh ----
  async function play(o) {
    if (phase === 'PREPARING') return 'Still preparing the menu, try again in a moment';
    if (phase !== 'MENU') return 'A match is already running (' + phase + ')';
    for (let i = 0; i < 40 && busy; i++) await new Promise(r => setTimeout(r, 250));
    if (busy) return 'Busy: ' + busy;
    const wantClass = Number.isInteger(o.classIndex) ? o.classIndex : 0;
    log('play: catalogRegistered=' + catalogRegistered + ' host=' + (host !== null) + ' class ' + wantClass + '/' + hostClass + ' matches=' + matchCount);
    // Owner choice (11 Nov): only the first match of a game session starts in
    // place; every later match starts from a fresh game session (automatic restart).
    if ((catalogRegistered || matchCount > 0 || (frontendStarted && !ROOM_INPLACE)) && relaunch) {
      busy = 'play';
      stopKeeper();
      status('Saving loadouts. The game will restart and start your match by itself…');
      try { await saveLoadouts(); } catch (e) { log('save before restart: ' + e); }
      storage.write('wzm_pending_match.json', JSON.stringify({req: o, at: Date.now()}));
      setPhase('RESTARTING', 'Restarting the game (about 1 minute). ' + o.mapLabel + ' starts automatically — do not tap anything.');
      setTimeout(relaunch, 400);
      return 'Restarting into the match…';
    }
    busy = 'play';
    req = o;
    stopKeeper();
    try {
      setPhase('HOSTING', 'Saving loadouts…');
      if (!o.fromRestart) { try { await saveLoadouts(); } catch (e) { log('save before match: ' + e); } }
      // From the menu 3D room its server thread is live: changing unlocks/player data under it crashed it
      // (server-thread fault at 0x2678d90). Loadouts and operator were restored at boot already.
      const fromRoom = frontendStarted && matchCount === 0;
      if (!fromRoom) {
      await lua('client_fence_restore', LUA_CLIENT_FENCE_RESTORE, 10000);
      await lua('unlocks_off', LUA_UNLOCKS_OFF, 10000);
      }
      restoreWeaponRegistry();
      try { armFatalWitness(); } catch (e) { log('fatal witness: ' + e); }
      // run_host.sh order: fake_player_data once per process (done in prepareMenu),
      // then the saved loadouts. Re-running the fake profile over restored loadouts
      // trips the game's protection (traps in libeevsdgz, window removed later).
      if (!fromRoom) { try { await restoreLoadouts(); } catch (e) { log('restore before match: ' + e); } }
      if (menuWatch !== null) { menuWatch.unload(); menuWatch = null; }
      for (const st of [party, creator, guard]) if (st !== null) retired.push(st);
      party = creator = guard = null;
      inWorld = false; wasInWorld = false; aiRetries = 0; lastSnap = null;
      const cls = Number.isInteger(o.classIndex) && o.classIndex >= 0 && o.classIndex < 10 ? o.classIndex : 0;
      // host_spawn.js keeps one-match state (connect handshake flags). Each match
      // after the first gets a fresh copy, like a new Mac session: the old one's
      // hooks and code patches are removed, its memory stays pinned.
      if (host !== null && matchCount > 0) {
        log('fresh host for match ' + (matchCount + 1));
        host.unload({keepScope: true});
        retired.push(host);
        host = null;
        if (snapTimer !== null) { clearInterval(snapTimer); snapTimer = null; }
      }
      // menu 3D room → match on the same host (its server thread runs the host's hooks; never unload them)
      if (host !== null && frontendStarted) { try { host.global.wzmFrontend = false; host.global.wzmFromRoom = true; } catch (e) { log('frontend flag: ' + e); } }
      try { beforeMatch(o); } catch (e) { log('beforeMatch: ' + e); }
      if (host === null) ensureHost(o);
      try { host.global.luiSendReset(cls); } catch (e) { log('lui reset: ' + e); }
      matchCount++;
      const r = host.exports.go(o.map, o.gametype, o.enemies);
      log('go(' + o.map + ',' + o.gametype + ',' + o.enemies + ') class ' + (cls + 1) + ' -> ' + r);
      status('Loading ' + o.mapLabel + ' (' + o.modeLabel + ')…');
      snapTimer = setInterval(pollSnap, 500);
      return 'Starting ' + o.mapLabel + '…';
    } catch (e) {
      setPhase('FAILED', 'Start failed: ' + (e && e.message || e));
      return 'Start failed';
    } finally {
      busy = null;
    }
  }

  function pollSnap() {
    if (host === null) return;
    try {
      const snap = host.exports.snap();
      if (Number.isInteger(snap.clc0)) {
        if (snap.clc0 >= 7) wasInWorld = true;
        else if (wasInWorld && snap.clc0 < 5 && ['HOSTING', 'PARTY', 'AI', 'PLAYING'].includes(phase)) {
          wasInWorld = false;
          setImmediate(onMatchLeft);
        }
      }
      const key = JSON.stringify(snap);
      if (key !== lastSnap) { lastSnap = key; sink('host')({s: 'state', ...snap}); }
    } catch (e) { log('snap: ' + e); }
  }

  // menu_return_watch.py: after "Main Menu" the front end runs the online fence
  // checks again and stays black unless skip_online_fences.lua is loaded again.
  async function onMatchLeft() {
    log('match left (client state dropped below 5)');
    if (snapTimer !== null) { clearInterval(snapTimer); snapTimer = null; }
    for (const st of [party, creator, guard]) if (st !== null) retired.push(st);
    party = creator = guard = null;
    setPhase('RETURNING', 'Returning to the main menu…');
    try {
      menuWatch = runStage('menu_return_watch', S.WATCH_JS, {onMessage: sink('menu_watch')});
      menuWatch.exports.start(S.LUA_SKIP_ONLINE_FENCES);
    } catch (e) { log('menu watch: ' + e); }
    await new Promise(r => setTimeout(r, 12000));
    setPhase('MENU', 'Back in the main menu. Restoring unlocks…');
    unlocked = false;  // new front-end Lua state: every unlock step has to run again
    // No weapon catalog here, so the next match can start without a restart.
    await unlockAll({open: false, catalog: true});
    startKeeper();
  }

  function startParty() {
    setPhase('PARTY', 'You spawned. Adding bots…');
    party = runStage('party_bot_inject', PARTY_ENV + S.PARTY_INJECT + '\nglobalThis.wzmBotArm();',
      {onMessage: sink('party')});
  }

  function startBothSides() {
    setPhase('AI', 'Creating ' + (req.enemies + req.friends) + ' AI soldiers…');
    const prefix = 'globalThis.WZM_BOTH_SIDES_AI=' + JSON.stringify({count: req.enemies + req.friends}) + ';\n';
    creator = runStage('native_ai_both_sides', prefix + S.BOTH_SIDES_AI + '\nglobalThis.wzmBotArm();\n',
      {onMessage: sink('both_sides')});
    setTimeout(() => {
      if (phase === 'AI') {
        if (creator !== null) { retired.push(creator); creator = null; }
        setPhase('PLAYING', 'Bots did not report back in time; the match keeps running.');
      }
    }, 150000);
  }

  function startGuard() {
    if (creator !== null) { creator.unload(); creator = null; }
    guard = runStage('native_ai_veteran_guard',
      'globalThis.WZM_BOT_DIFF=' + req.difficulty + ';\n' + S.VETERAN_GUARD + '\nglobalThis.wzmBotArm();\n',
      {onMessage: sink('guard')});
    setPhase('PLAYING', 'Match running: ' + req.enemies + ' enemy, ' + req.friends + ' friendly, ' +
      DIFFICULTIES[req.difficulty] + ' AI.');
  }

  function handle(stage, p) {
    if (!p || typeof p !== 'object') return;
    const s = p.s || p.k || p.kind;
    if (stage === 'host') {
      if (s === 'clientEnterWorld' && !inWorld) {
        inWorld = true;
        if (phase === 'HOSTING') status('Map loaded. Spawning with class ' + ((req.classIndex || 0) + 1) + '…');
      }
      if (s === 'matchProbe' && phase === 'HOSTING' && String(p.text || '').includes('spec=false'))
        startParty();
      if (s === 'FAULT') log('host FAULT ' + JSON.stringify(p).slice(0, 300));
      return;
    }
    if (stage === 'party') {
      if (s === 'botInjectError' && phase === 'PARTY')
        setPhase('PLAYING', 'Bot injection failed; the match keeps running without bots.');
      else if (s === 'botInjectFinal' && phase === 'PARTY') startBothSides();
      return;
    }
    if (stage === 'both_sides' && phase === 'AI') {
      if (s === 'botInjectFinal') setImmediate(startGuard);
      else if (s === 'botInjectError') {
        if (creator !== null) { retired.push(creator); creator = null; }
        if (aiRetries < 3) {
          aiRetries++;
          log('AI creator retry ' + aiRetries + ': ' + (p.error || ''));
          setTimeout(() => { if (phase === 'AI') startBothSides(); }, 2000);
        } else setPhase('PLAYING', 'AI creation failed; the match keeps running.');
      }
    }
  }

  function snapshot() {
    return {phase, busy, unlocked, seeded, lastSnap, req};
  }

  return {
    prepareMenu, unlockAll, play, saveLoadouts, snapshot,
    runLua: (name, src, ms = 20000) => lua(name, src, ms, true),
    openGearUp: async () => {
      if (phase !== 'MENU') return 'Gear Up is only in the main menu';
      // Fresh boot: the loadout editor has no frontend client yet and runs away
      // with memory (OS kills the game at ~12 GB). Mac: unlock_all after a match.
      if (matchCount === 0) return 'Play one match first, then come back to the main menu for Gear Up';
      const r = await unlockAll({open: true, catalog: true});
      return r;
    },
    get phase() { return phase; },
    get frontendStarted() { return frontendStarted; },
    get nextPlayRestarts() { return catalogRegistered || matchCount > 0 || (frontendStarted && !ROOM_INPLACE); },
    get matchActive() { return ['HOSTING', 'PARTY', 'AI', 'PLAYING', 'RESTARTING'].includes(phase); }
  };
}
