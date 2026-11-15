import {attachAnywhere} from './nearhook.js';
/*
 * Live graphics controller (menu and in-match). Replaces the one-shot
 * gfx_apply.js + gfx_fixed_640_native.js inside the host with one owner that
 * can change settings at any time. Same verified mechanics as those files:
 *   - dvar table at libgame+0x54bd7b8, entries 0x58 bytes, value at +0x28/+0x38
 *   - resolution-preset clamp at libgame+0x2ef61f8 patched to `ret`
 *   - fixed scene size via the sizing call at libgame+0x2eaf78c (dynamic level -> 0)
 *   - reflection quality int at libgame+0x835ed9c
 * "Game default" never writes; switching back to it restores the original value.
 */

const D = (key, section, label, options, values, def, live, extra = {}) =>
  ({key, section, label, options, values, def, live, ...extra});

export const GFX_SECTIONS = ['DISPLAY', 'ANTI-ALIASING & SHARPNESS', 'TEXTURES & DETAIL',
  'LIGHTING & EFFECTS', 'ACCESSIBILITY', 'ADVANCED (UNLABELLED GAME SETTINGS — MAY CRASH)'];

const GD = 'Game default';
export const GFX_SPEC = Object.freeze([
  D('res', 'DISPLAY', 'Resolution', ['540p', '640p', '720p', '800p', 'Native'], null, '640p', true,
    {special: 'scene'}),
  D('dynamic', 'DISPLAY', 'Dynamic resolution', null, null, false, true,
    {toggle: true, special: 'dynamic', note: 'Game lowers resolution under load (this caused the blur)'}),
  D('preset', 'DISPLAY', 'Render preset',
    [GD, 'Ultra Performance', 'Max Performance', 'Balanced', 'Max Quality', 'Ultra Quality', 'Ultra Quality+', 'Native'],
    [null, 0, 1, 2, 3, 4, 5, 6], 'Native', true, {dvars: ['19e76c718fbb7351', '1b1ba5e9ed47837e'], clamp: true}),
  D('fps', 'DISPLAY', 'Frame rate cap', [GD, '30', '45', '60', 'Uncapped'], [null, 1, 2, 3, 4], '60', true,
    {dvars: ['caa98f528ccd5f26']}),

  D('aa', 'ANTI-ALIASING & SHARPNESS', 'Anti-aliasing', [GD, 'None', 'SMAA', 'SGSR'], [null, 0, 1, 2], 'SMAA', true,
    {dvars: ['d2a2a59552643885']}),
  D('smaa', 'ANTI-ALIASING & SHARPNESS', 'SMAA quality', [GD, 'Very Low', 'Low'], [null, 0, 1], 'Low', true,
    {dvars: ['7b374f8d8b8f7d8e']}),
  D('temporal', 'ANTI-ALIASING & SHARPNESS', 'Temporal mode', [GD, 'Off', 'Spatial', 'Temporal'], [null, 0, 1, 2],
    'Off', true, {dvars: ['5cd1f66da730bbca']}),
  D('upscaler', 'ANTI-ALIASING & SHARPNESS', 'Upscaler / sharpener', [GD, 'Off', 'CAS', 'FSR 1'], [null, 0, 1, 2],
    'CAS', true, {dvars: ['fa96a2168c519506']}),
  D('sharpen', 'ANTI-ALIASING & SHARPNESS', 'CAS strength', [GD, '0.2', '0.4', '0.6', '0.8', '1.0'],
    [null, 0.2, 0.4, 0.6, 0.8, 1.0], '0.8', true, {dvars: ['c56180de91339fec'], float: true}),

  D('tex', 'TEXTURES & DETAIL', 'Texture quality', [GD, 'Very Low', 'Low', 'Medium', 'High', 'Very High', 'Ultra'],
    [null, 6, 5, 4, 3, 2, 1], 'Very High', false, {dvars: ['791caebb225b800d'], note: 'Ultra flickers'}),
  D('detail', 'TEXTURES & DETAIL', 'Detail level',
    [GD, 'Mega Low', 'Ultra Low', 'Very Low', 'Low', 'Normal', 'High', 'Extra', 'Ultra'],
    [null, 0, 1, 2, 3, 4, 5, 6, 7], 'Ultra', false, {dvars: ['e3f56fe404e467cb']}),
  D('filter', 'TEXTURES & DETAIL', 'Texture filtering',
    [GD, 'Nearest', 'Linear', 'Aniso 2x', 'Aniso 4x', 'Aniso 8x', 'Aniso 16x'], [null, 0, 1, 2, 3, 4, 5],
    'Aniso 16x', true, {dvars: ['c89d1f42b13d341c']}),

  D('refl', 'LIGHTING & EFFECTS', 'Reflections', [GD, 'Off', 'Low', 'Medium', 'High'], [null, 0, 1, 2, 3], GD, false,
    {special: 'refl', note: 'Experimental: wrong colours on Crash'}),
  D('shadows', 'LIGHTING & EFFECTS', 'Shadow cascades', [GD, 'Low', 'Medium', 'High'], [null, 0, 1, 2], GD, false,
    {dvars: ['6d194d6c7f21172e'], note: 'Experimental'}),
  D('ao', 'LIGHTING & EFFECTS', 'Ambient occlusion / GI',
    [GD, 'Off', 'GT AO', 'GT Bent Normals', 'GT Global Illum.'], [null, 0, 1, 2, 3], GD, false,
    {dvars: ['a2745f0302a0d8df'], note: 'Experimental: GI crashed matches'}),
  D('aoq', 'LIGHTING & EFFECTS', 'AO quality', [GD, 'Low', 'Medium', 'High', 'Ultra'], [null, 0, 1, 2, 3], GD, false,
    {dvars: ['aea2a028c757852f']}),
  D('blur', 'LIGHTING & EFFECTS', 'Motion blur', [GD, 'Off', 'On'], [null, 'off', 'on'], GD, true,
    {special: 'blur'}),

  D('colorblind', 'ACCESSIBILITY', 'Colour-blind filter', [GD, 'None', 'Protanope', 'Deuteranope', 'Tritanope'],
    [null, 0, 1, 2, 3], GD, true, {dvars: ['15522c42639e2cb5']}),

  ...[
    ['adv1', '689c366076f2642f', ['Default', 'Low', 'Medium', 'High']],
    ['adv2', '899aae1c0d70cab8', ['Default', 'Low', 'Medium', 'High']],
    ['adv3', 'a68e656239d69fd4', ['Default', 'Low', 'High']],
    ['adv4', '8dfe778be90d1cbc', ['Low', 'Medium', 'High']],
    ['adv5', 'ac00162b4084f552', ['Low', 'Medium', 'High', 'Very High']],
    ['adv6', '4829dfdd07261b00', ['High', 'Medium', 'Low']],
    ['adv7', '34cffc714c3c12e1', ['Low', 'High', 'Ultra']],
    ['adv8', 'd0146f6c57c67aa3', ['Very Low', 'Low', 'Medium', 'High']],
    ['adv9', 'ee3b5ebcd6d74968', ['Low', 'Normal', 'High', 'Highest']],
    ['adv10', 'c33f4483ef872128', ['Extra Small', 'Small', 'Medium', 'Large', 'Extra Large']],
    ['adv11', 'a9b050d62cc7e37c', ['Off', '1x', '2x', '4x']],
    ['adv12', '144567a6ae426a93', ['Low', 'High']],
  ].map(([key, h, opts]) => D(key, 'ADVANCED (UNLABELLED GAME SETTINGS — MAY CRASH)', 'Setting ' + h.slice(0, 4),
    [GD, ...opts], [null, ...opts.map((_, i) => i)], GD, true, {dvars: [h]})),
]);

export const GFX_DEFAULTS = Object.freeze(Object.fromEntries(
  [['on', true], ...GFX_SPEC.map(s => [s.key, s.def])]));

export function sanitizeGfx(g) {
  const out = {...GFX_DEFAULTS};
  if (!g || typeof g !== 'object') return out;
  if (typeof g.on === 'boolean') out.on = g.on;
  for (const s of GFX_SPEC) {
    if (s.toggle) { if (typeof g[s.key] === 'boolean') out[s.key] = g[s.key]; }
    else if (s.options.includes(g[s.key])) out[s.key] = g[s.key];
  }
  return out;
}

const PCT_DVARS = ['270baabe0eb3399e', 'ba9243ff7e168cf'];
const SCALE_DVARS = ['80362e18112ccf7d', 'd3d2a87b1e1ae9ac'];

export function createGfxLive({log = () => {}} = {}) {
  let started = false, base = null, idx = {}, hook = null, timer = null;
  let settings = {...GFX_DEFAULTS};
  const orig = {};          // hash -> {v28, v38, float}
  let clampOrig = null, reflOrig = null;
  let lastScene = null;

  const at = n => base.add(n);
  function ok(p) {
    try {
      const h = p.readU64(); const t = p.add(0x15).readU8(), z = p.add(8).readU64();
      return !h.equals(0) && z.equals(0) && t < 16 && p.add(0x14).readU8() <= 1;
    } catch (_) { return false; }
  }
  function index() {
    const d1 = at(0x54bd7b8).readPointer().readPointer(); const S = 0x58;
    for (const dir of [-1, 1]) {
      let p = dir > 0 ? d1.add(S) : d1; let miss = 0;
      while (miss < 400) { if (ok(p)) { miss = 0; idx[p.readU64().toString(16)] = p; } else miss++; p = p.add(dir * S); }
    }
  }
  function isFloat(p) { return p.add(0x15).readU8() === 1; }
  function read(p) { return isFloat(p) ? p.add(0x28).readFloat() : p.add(0x28).readS32(); }
  function write(h, v) {
    const p = idx[h]; if (!p) return false;
    const f = isFloat(p);
    if (!(h in orig)) orig[h] = {v28: read(p), v38: f ? p.add(0x38).readFloat() : p.add(0x38).readS32(), f};
    const cur = read(p);
    if (f ? Math.abs(cur - v) < 1e-4 : cur === v) return false;
    if (f) { p.add(0x28).writeFloat(v); p.add(0x38).writeFloat(v); }
    else { p.add(0x28).writeS32(v); p.add(0x38).writeS32(v); }
    return true;
  }
  function restore(h) {
    const p = idx[h], o = orig[h]; if (!p || !o) return;
    if (o.f) { p.add(0x28).writeFloat(o.v28); p.add(0x38).writeFloat(o.v38); }
    else { p.add(0x28).writeS32(o.v28); p.add(0x38).writeS32(o.v38); }
    delete orig[h];
  }

  function setClamp(on) {
    const c = at(0x2ef61f8);
    if (on) {
      if (clampOrig === null) clampOrig = c.readU32();
      if (c.readU32() !== 0xd65f03c0) Memory.patchCode(c, 4, w => w.writeU32(0xd65f03c0));
    } else if (clampOrig !== null && c.readU32() !== clampOrig) {
      const v = clampOrig; Memory.patchCode(c, 4, w => w.writeU32(v));
    }
  }

  function sceneTarget() {
    return settings.res === 'Native' ? 'native' : parseInt(settings.res, 10);
  }

  // Desired pct for a given source width (verified: 1376 px width = 640 scene height).
  function pctFor(w) {
    const t = sceneTarget();
    if (t === 'native') return 100;
    return Math.max(40, Math.min(100, Math.round(Math.round(t * 1376 / 640) * 100 / w)));
  }

  function installHook() {
    const site = at(0x2eaf78c);
    if (site.readU32() !== 0xd101c3ff) { log('gfx: sizing site changed, resolution control off'); return; }
    hook = attachAnywhere(site, {onEnter(args) {
      if (!settings.on || settings.dynamic) return;
      try {
        const w = args[0].toUInt32(), h = args[1].toUInt32(), level = args[6].toUInt32();
        const dynamic = (args[5].add(0x1c).readU32() & 1) !== 0;
        if (!(dynamic && w >= 1200 && h >= 600 && w > h && level <= 15)) return;
        const pct = pctFor(w);
        lastScene = {w, h, pct};
        for (const d of PCT_DVARS) {
          const p = idx[d];
          if (p && p.add(0x28).readS32() !== pct) { p.add(0x28).writeS32(pct); p.add(0x38).writeS32(pct); }
        }
        this.context.x6 = ptr(0);
      } catch (_) {}
    }});
  }

  function applyAll() {
    const changed = [];
    const on = settings.on;
    for (const s of GFX_SPEC) {
      if (s.special === 'refl') {
        const slot = at(0x835ed9c);
        const v = on ? s.values[s.options.indexOf(settings[s.key])] : null;
        if (v === null || v === undefined) {
          if (reflOrig !== null) { slot.writeS32(reflOrig); reflOrig = null; }
        } else {
          if (reflOrig === null) reflOrig = slot.readS32();
          if (slot.readS32() !== v) { slot.writeS32(v); changed.push('refl'); }
        }
        continue;
      }
      if (s.special === 'blur') {
        const v = on ? s.values[s.options.indexOf(settings[s.key])] : null;
        if (v === null) { restore('43a74b2ca0523ded'); restore('980aa1522036313'); continue; }
        if (write('43a74b2ca0523ded', v === 'on' ? 1 : 0)) changed.push('blur');
        write('980aa1522036313', v === 'on' ? 2 : 1);
        continue;
      }
      if (!s.dvars) continue;
      const v = on ? s.values[s.options.indexOf(settings[s.key])] : null;
      for (const h of s.dvars) {
        if (v === null || v === undefined) restore(h);
        else if (write(h, v)) changed.push(s.key);
      }
    }
    // render scale floats (dynamic-resolution limits) and render percent
    if (on) {
      for (const h of SCALE_DVARS) write(h, 1.0);
      if (sceneTarget() === 'native') for (const h of PCT_DVARS) write(h, 100);
    } else {
      for (const h of [...SCALE_DVARS, ...PCT_DVARS]) restore(h);
    }
    const presetOn = on && settings.preset !== GD;
    setClamp(presetOn);
    return changed;
  }

  function start(initial) {
    if (started) { update(initial); return; }
    base = Process.getModuleByName('libgame.so').base;
    index();
    settings = {...GFX_DEFAULTS, ...(initial || {})};
    installHook();
    const c = applyAll();
    log('gfx live: ' + Object.keys(idx).length + ' dvars, applied ' + JSON.stringify(c));
    timer = setInterval(() => { try { applyAll(); } catch (e) { log('gfx reapply: ' + e); } }, 1000);
    started = true;
  }

  function update(next) {
    settings = {...GFX_DEFAULTS, ...(next || {})};
    if (!started) return [];
    const c = applyAll();
    log('gfx update ' + JSON.stringify(settings) + ' -> ' + JSON.stringify(c));
    return c;
  }

  function status() {
    if (!started) return 'not started';
    const p = idx[PCT_DVARS[0]];
    const pct = p ? p.add(0x28).readS32() : '?';
    if (lastScene) {
      const sw = Math.round(lastScene.w * lastScene.pct / 100), sh = Math.round(lastScene.h * lastScene.pct / 100);
      return 'render ' + sw + 'x' + sh + ' (' + pct + '% of ' + lastScene.w + 'x' + lastScene.h + ')';
    }
    return 'render scale ' + pct + '%';
  }

  return {start, update, status, get started() { return started; }};
}
