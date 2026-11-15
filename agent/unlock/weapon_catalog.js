import {readBoundedUtf8} from '../bounded_utf8.js';
/* Port of the original frontend_weapon_catalog.py --apply native Frida snippet.
 * ONLY called by the already verified 4.5.2 LUI-frame owner, on the original
 * game thread, and only after an explicit in-game Unlock Ownership request.
 * Never invents DB assets, counts, or readiness. No Mac/ADB/root calls.
 */

const ASSET_POOL = 0x635b940 + 60 * 0xd0;
const CALLBACK = 0x28fe554;
const GAME_CLIENT_STATE = 0x54bb7e8;
const CATALOG_COUNT = 0x6cb1ab0;
const CATALOG_BUSY = 0x6cb1abc;
const MAX_CAPACITY = 2048;
const REGISTER_PER_FRAME = 4;

function readable(pointer, length, needsExecute = false) {
  if (!pointer || pointer.isNull()) return false;
  const r = Process.findRangeByAddress(pointer);
  return Boolean(r && r.protection.includes('r') &&
    (!needsExecute || r.protection.includes('x')) &&
    pointer.add(length).compare(r.base.add(r.size)) <= 0);
}

export class WeaponCatalogPort {
  constructor({notify = () => {}} = {}) {
    this.notify = notify;
    this.stage = 'NOT_REQUESTED';
    this.details = null;
    this.base = null;
    this.refs = [];
    this.names = [];
    this.register = null;
    this.cursor = 0;
    this.frameCount = 0;
    this.error = null;
  }

  start() {
    if (this.stage === 'NOT_REQUESTED') this.stage = 'PENDING';
    return this.snapshot();
  }

  completed() { return this.stage === 'COMPLETE' || this.stage === 'ALREADY_REGISTERED'; }

  fail(code, detail = '') {
    this.stage = 'FAILED';
    this.error = code;
    this.notify({event: 'CATALOG_FAILED', code, detail: String(detail).slice(0, 200)});
  }

  enumerate(base) {
    const pool = base.add(ASSET_POOL);
    if (!readable(pool, 0xb4)) throw new Error('POOL_TABLE_UNMAPPED');
    const array = pool.readPointer();
    const stride = pool.add(20).readU32();
    const capacity = pool.add(16).readU32();
    const bits = pool.add(0xb0).readPointer();
    if (stride !== 0x530 || capacity < 1 || capacity > MAX_CAPACITY)
      throw new Error('POOL_LAYOUT_MISMATCH');
    if (!readable(bits, Math.ceil(capacity / 32) * 4) ||
        !readable(array, capacity * stride))
      throw new Error('POOL_ALLOCATIONS_UNREADABLE');
    const refs = [];
    for (let i = 0; i < capacity; i++) {
      const mask = (0x80000000 >>> (i & 31)) >>> 0;
      if ((bits.add((i >>> 5) * 4).readU32() & mask) === 0) continue;
      const asset = array.add(i * stride);
      if (!readable(asset, 16)) continue;
      const namePointer = asset.add(8).readPointer();
      if (!readable(namePointer, 1)) continue;
      try {
        const name = readBoundedUtf8(namePointer, 121);
        if (name && /^[a-zA-Z0-9_]{1,120}$/.test(name)) refs.push(name);
      } catch (_) { /* Do not register inaccessible or non-name DB records */ }
    }
    if (!refs.length) throw new Error('NO_RESIDENT_WEAPON_ASSETS');
    const callbackAddress = base.add(CALLBACK);
    if (!readable(callbackAddress, 4, true) || callbackAddress.readU32() !== 0xd101c3ff)
      throw new Error('ORIGINAL_CATALOG_CALLBACK_OPCODE_MISMATCH');
    this.refs = refs;
    this.names = refs.map(name => Memory.allocUtf8String(name));
    this.register = new NativeFunction(callbackAddress, 'void', ['int', 'pointer']);
    this.details = {resident: refs.length, capacity, stride};
    this.stage = 'REGISTERING';
    this.notify({event: 'CATALOG_RESIDENT_ASSETS', ...this.details});
  }

  tick({moduleBase}) {
    if (this.stage === 'NOT_REQUESTED' || this.stage === 'FAILED' || this.completed()) return;
    if (!moduleBase || typeof moduleBase.add !== 'function') return;
    this.frameCount++;
    if (this.frameCount > 1200) { this.fail('CATALOG_FRAME_TIMEOUT'); return; }
    const at = rva => moduleBase.add(rva);
    try {
      const catalogCount = at(CATALOG_COUNT).readU32();
      const busy = at(CATALOG_BUSY).readU8();
      // The original callback mutates its own registry. It must not run while
      // the engine reports busy, including during our first enumeration.
      if (busy !== 0) return;
      if (this.stage === 'PENDING') {
        // A positive registry count is NOT proof that all resident DB weapons
        // were registered. Compare against the actual bitset-derived count
        // before claiming this is a usable pre-existing frontend catalog.
        this.enumerate(moduleBase);
        if (catalogCount > 0) {
          if (catalogCount < this.names.length) {
            this.fail('PARTIAL_CATALOG_ALREADY_REGISTERED',
              `${catalogCount}/${this.names.length}`);
            return;
          }
          this.stage = 'ALREADY_REGISTERED';
          this.details = {...this.details, catalogCount, busy, source: 'existing_registry'};
          this.notify({event: 'CATALOG_ALREADY_REGISTERED', ...this.details});
          return;
        }
      }
      if (this.stage !== 'REGISTERING') return;
      const client = at(GAME_CLIENT_STATE).readPointer();
      if (!readable(client, 12)) return;
      const clientState = client.add(8).readU32();
      if (clientState >= 5) return; // Historical frontend guard
      for (let i = 0; i < REGISTER_PER_FRAME && this.cursor < this.names.length; i++) {
        this.register(this.cursor + 1, this.names[this.cursor]);
        this.cursor++;
      }
      if (this.cursor >= this.names.length) {
        const after = at(CATALOG_COUNT).readU32();
        const afterBusy = at(CATALOG_BUSY).readU8();
        if (after < this.names.length || afterBusy !== 0) {
          this.fail('ORIGINAL_CATALOG_POSTCHECK_FAILED',
            `count=${after} expected>=${this.names.length} busy=${afterBusy}`);
          return;
        }
        this.stage = 'COMPLETE';
        this.details = {...this.details, processed: this.cursor, catalogCount: after, busy: afterBusy};
        this.notify({event: 'CATALOG_REGISTERED', ...this.details});
      }
    } catch (error) { this.fail('CATALOG_NATIVE_EXCEPTION', error); }
  }

  snapshot() {
    return {stage: this.stage, ...this.details, processed: this.cursor,
      frameCount: this.frameCount, error: this.error};
  }
}
