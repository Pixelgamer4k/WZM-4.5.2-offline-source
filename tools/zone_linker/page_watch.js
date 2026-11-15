// Log memory-permission changes covering the crash page 0x6bcddb3000, with backtraces.
const PAGE = ptr('0x6bcddb3000'), b = Process.getModuleByName('libgame.so').base;
const off = p => { try { const o = p.sub(b); return o.compare(0x6000000) < 0 ? 'g+0x' + o.toString(16) : p.toString(); } catch (e) { return '?'; } };
function covers(a, len) { return PAGE.compare(a) >= 0 && PAGE.compare(a.add(len)) < 0; }
for (const name of ['mprotect', 'munmap', 'madvise', 'mmap']) {
  const f = Module.findGlobalExportByName(name); if (!f) continue;
  Interceptor.attach(f, { onEnter(a) { this.a = a[0]; this.l = a[1].toUInt32 ? a[1].toUInt32() : 0; this.x = a[2].toInt32(); this.hit = name !== 'mmap' && covers(this.a, this.l);
      if (this.hit) send({ s: 'pageop', name, addr: this.a.toString(), len: this.l, arg: this.x, tid: Process.getCurrentThreadId(), bt: Thread.backtrace(this.context, Backtracer.ACCURATE).slice(0, 12).map(off) }); },
    onLeave(r) { if (name === 'mmap' && !r.equals(ptr(-1)) && covers(r, this.a.toString() === '0x0' ? this.l : this.l)) send({ s: 'mmapNew', addr: r.toString(), len: this.l, prot: this.x, bt: Thread.backtrace(this.context, Backtracer.ACCURATE).slice(0, 8).map(off) }); } });
}
send({ s: 'pageWatchReady' });
