// Track Vulkan buffers -> memory -> host mappings, and descriptor writes for the vertex-pulling bindings.
// rpc.exports.dump(buffer) returns the buffer bytes if its memory is host-mapped.
const S = {};
for (const m of Process.enumerateModules()) {
  if (!/libvulkan/.test(m.name)) continue;
  for (const s of m.enumerateSymbols()) {
    const k = (s.name.match(/3api\d+_GLOBAL__N_\d+(\d+)?([A-Za-z0-9]+)E/) || [])[2];
    if (k && !S[k]) S[k] = s.address;
  }
}
send({ s: 'syms', have: Object.keys(S).filter(n => /Buffer|Memory|Descriptor|Copy/.test(n)).slice(0, 60) });
const bufSize = {}, bufMem = {}, memMap = {}, desc = {}, copies = {};
const WANT = new Set([100, 101, 102, 200, 24, 25, 26, 44, 60, 1, 2, 3]);
const h = p => p.toString();
function att(name, cb) { if (S[name]) Interceptor.attach(S[name], cb); else send({ s: 'missing', name }); }
att('CreateBuffer', { onEnter(a) { this.ci = a[1]; this.out = a[3]; }, onLeave(r) { try { bufSize[h(this.out.readPointer())] = this.ci.add(24).readU64().toNumber(); } catch (e) {} } });
att('BindBufferMemory', { onEnter(a) { bufMem[h(a[1])] = [h(a[2]), a[3].toString()]; } });
att('BindBufferMemory2', { onEnter(a) { const n = a[1].toUInt32(), info = a[2]; for (let i = 0; i < n; i++) { const e = info.add(i * 40); bufMem[h(e.add(16).readPointer())] = [h(e.add(24).readPointer()), e.add(32).readU64().toString()]; } } });
att('MapMemory', { onEnter(a) { this.mem = h(a[1]); this.off = a[2].toString(); this.size = a[3].toString(); this.pp = a[5]; }, onLeave(r) { try { memMap[this.mem] = [this.pp.readPointer(), this.off, this.size]; } catch (e) {} } });
att('UpdateDescriptorSets', { onEnter(a) {
  const n = a[1].toUInt32(), w = a[2];
  for (let i = 0; i < n; i++) {
    const e = w.add(i * 64); const set = h(e.add(16).readPointer()), binding = e.add(24).readU32(), cnt = e.add(32).readU32(), type = e.add(36).readU32();
    if (!WANT.has(binding) || (type !== 6 && type !== 7 && type !== 8 && type !== 9)) continue;
    const bi = e.add(48).readPointer(); if (bi.isNull()) continue;
    const buf = h(bi.readPointer()), off = bi.add(8).readU64().toString(), range = bi.add(16).readU64().toString();
    const k = binding + ':' + buf; if ([24,25,44,60,100,101,200].includes(binding)) interesting[buf] = binding; if (!desc[k]) { desc[k] = 1; send({ s: 'desc', binding, type, buf, off, range, size: bufSize[buf], mem: bufMem[buf], mapped: !!(bufMem[buf] && memMap[bufMem[buf][0]]) }); }
  }
} });
const interesting = {}; let sent = 0; const CAP = 400 * 1024 * 1024;
function mapped(buf) { const bm = bufMem[buf]; if (!bm) return null; const mm = memMap[bm[0]]; if (!mm) return null; return mm[0].add(parseInt(bm[1]) - parseInt(mm[1])); }
att('CmdCopyBuffer', { onEnter(a) {
  const src = h(a[1]), dst = h(a[2]), n = a[3].toUInt32(); let tot = 0;
  for (let i = 0; i < n; i++) {
    const r = a[4].add(i * 24); const so = r.readU64().toNumber(), dof = r.add(8).readU64().toNumber(), sz = r.add(16).readU64().toNumber(); tot += sz;
    if (interesting[dst] !== undefined && sent + sz < CAP) { const p = mapped(src); if (p) { sent += sz; send({ s: 'upload', binding: interesting[dst], dst, dof, sz }, p.add(so).readByteArray(sz)); } else send({ s: 'uploadUnmapped', binding: interesting[dst], dst, dof, sz }); }
  }
  copies[dst] = (copies[dst] || 0) + tot; } });

const templ = {};
att('CreateDescriptorUpdateTemplate', { onEnter(a) { this.ci = a[1]; this.out = a[3]; }, onLeave(r) { try {
  const ci = this.ci, n = ci.add(20).readU32(), ents = ci.add(24).readPointer(); const E = [];
  for (let i = 0; i < n; i++) { const e = ents.add(i * 32); E.push([e.readU32(), e.add(4).readU32(), e.add(8).readU32(), e.add(12).readU32(), e.add(16).readU64().toNumber(), e.add(24).readU64().toNumber()]); }
  templ[h(this.out.readPointer())] = E; } catch (e) {} } });
att('UpdateDescriptorSetWithTemplate', { onEnter(a) {
  const E = templ[h(a[2])]; if (!E) return; const data = a[3];
  for (const [binding, arrEl, cnt, type, off, stride] of E) {
    if (!WANT.has(binding) || (type !== 6 && type !== 7 && type !== 8 && type !== 9)) continue;
    for (let j = 0; j < Math.min(cnt, 4); j++) { const bi = data.add(off + j * stride); const buf = h(bi.readPointer());
      const k = binding + ':' + buf; if ([24,25,44,60,100,101,200].includes(binding)) interesting[buf] = binding;
      if (!desc[k]) { desc[k] = 1; send({ s: 'desc', via: 'template', binding, type, buf, size: bufSize[buf], mem: bufMem[buf], mapped: !!(bufMem[buf] && memMap[bufMem[buf][0]]) }); } }
  } } });
rpc.exports = {
  info() { return { nbuf: Object.keys(bufSize).length, nmem: Object.keys(memMap).length, copies }; },
  dump(buf, max) {
    const bm = bufMem[buf]; if (!bm) return null; const mm = memMap[bm[0]]; if (!mm) return null;
    const size = Math.min(bufSize[buf] || 0, max || 64 * 1024 * 1024);
    const p = mm[0].add(parseInt(bm[1]) - parseInt(mm[1]));
    return p.readByteArray(size);
  }
};
send({ s: 'vkBufReady' });
