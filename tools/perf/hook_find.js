// Read-only: per-4KB checksums of libgame and libeevsdgz executable segments, to diff against the files on disk.
const cm = new CModule(`
#include <stdint.h>
void sums(const uint32_t *p, uint64_t pages, uint64_t *out){ for(uint64_t i=0;i<pages;i++){ uint64_t s=1469598103934665603ULL; const uint32_t *q=p+i*1024; for(int j=0;j<1024;j++){ s^=q[j]; s*=1099511628211ULL; } out[i]=s; } }`);
const f = new NativeFunction(cm.sums, 'void', ['pointer', 'uint64', 'pointer']);
rpc.exports = {
  ranges(name) { const m = Process.getModuleByName(name); return { base: m.base.toString(), r: Process.enumerateRanges('r-x').filter(r => r.base.compare(m.base) >= 0 && r.base.compare(m.base.add(m.size)) < 0).map(r => [r.base.sub(m.base).toString(), r.size]) }; },
  sums(name, off, size) { const m = Process.getModuleByName(name); const n = size / 4096; const out = Memory.alloc(n * 8); f(m.base.add(off), n, out); return out.readByteArray(n * 8); },
  read(name, off, size) { return Process.getModuleByName(name).base.add(off).readByteArray(size); }
};
