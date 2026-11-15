/* WZM 4.5.2 autonomous, in-app ownership unlock controller.
 * Uses worker16's *single* original-game LUI frame interceptor. This module
 * must never call Interceptor.attach(), run an ADB command or open any socket.
 * The four original ./wzm Lua payloads are embedded byte-for-byte; this
 * controller is a separately audited in-process adaptation, not original Lua.
 */
import {UnlockController} from './controller.js';
import {byteLengthUtf8} from './controller.js';
import {EMBEDDED_LUA} from './payloads.js';
import {verifyEmbeddedLua} from './source_integrity.js';
import {WeaponCatalogPort} from './weapon_catalog.js';

const MAX_QUEUE_MS = 120000;

export class UnifiedUnlock {
  constructor({notify = () => {}, clock = () => Date.now()} = {}) {
    this.notify = notify;
    this.clock = clock;
    this.source = verifyEmbeddedLua(EMBEDDED_LUA);
    this.context = null;
    this.statusCode = this.source.ok ? 'WAIT_NATIVE_MAINMENU' : this.source.code;
    this.catalog = new WeaponCatalogPort({notify: event => this.emit(event)});
    this.pendingOwnership = null;
    this.requestSerial = 0;
    this.lastError = null;
    this.inFrame = false;
    this.controller = new UnlockController({
      engine: {
        getLuaState: () => this.context && this.context.L || null,
        runLua: (state, script) => this.runLua(state, script),
        frontendSnapshot: () => this.frontendSnapshot(),
      },
      payloads: EMBEDDED_LUA,
      emit: event => this.emit(event),
      token: 'wzm-452-single-native-hook',
      clock: this.clock
    });
  }

  emit(event) {
    try { this.notify({channel: 'wzm.autonomousUnlock', ...event}); }
    catch (_) { /* Never let callbacks escape into the native game frame */ }
  }

  request(stage) {
    if (!this.source.ok) return {accepted: false, code: this.source.code};
    if (stage === 'clientFence' || stage === 'full') {
      // The original TUI's Lua CLIENT_CONNECT shim is only a reported value:
      // no in-game native client/model preview or Gear Up stream proof yet.
      const missing = [
        'NATIVE_DDL_PROFILE_BIND_UNVERIFIED',
        'ORIGINAL_CUSTOMIZATION_HUB_UNPORTED',
        'PREVIEW_GUARD_NOT_OWNED',
        'NATIVE_CLIENT_AND_MODEL_STREAMING_UNVERIFIED'
      ];
      if (!this.catalog.completed()) missing.unshift('ORIGINAL_WEAPON_CATALOG_NOT_VERIFIED');
      return {accepted: false, code: 'UI_PORT_INCOMPLETE', missing};
    }
    if (stage === 'inspect') return this.controller.prepareUnlock({type: 'prepareUnlock', stage});
    if (stage !== 'ownership') return {accepted: false, code: 'INVALID_PREPARE_STAGE'};
    if (this.pendingOwnership) return {accepted: true, code: 'CATALOG_STILL_PREPARING',
      requestId: this.pendingOwnership.id, catalog: this.catalog.snapshot()};
    if (this.catalog.stage === 'FAILED') {
      // Never retry a possibly partially registered native callback sequence:
      // restarting at index 1 could duplicate entries in the original engine.
      if (this.catalog.cursor > 0) return {accepted: false,
        code: 'PARTIAL_CATALOG_REQUIRES_LUI_RESET', catalog: this.catalog.snapshot()};
      this.catalog = new WeaponCatalogPort({notify: event => this.emit(event)});
    }
    const id = `ownership-${this.clock().toString(36)}-${(++this.requestSerial).toString(36)}`;
    this.pendingOwnership = {id, startedAt: this.clock()};
    this.catalog.start();
    this.statusCode = 'WAIT_ORIGINAL_WEAPON_CATALOG';
    this.emit({event: 'ACCEPTED', stage, code: this.statusCode, requestId: id});
    return {accepted: true, code: this.statusCode, requestId: id};
  }

  runLua(state, script) {
    const ctx = this.context;
    if (!ctx || !state || state !== ctx.L) return {ok: false, code: 'NOT_ORIGINAL_LUI_FRAME'};
    const {native, runtime} = ctx;
    const src = String(script.text ?? '');
    if (!src || src.includes('\0') || script.byteLength !== byteLengthUtf8(src))
      return {ok: false, code: 'LUA_SOURCE_LENGTH_MISMATCH'};
    const topAddress = state.add(0x28);
    let oldTop;
    try { oldTop = runtime.readPointer(topAddress); }
    catch (e) { return {ok: false, code: 'UNREADABLE_LUA_TOP', error: String(e)}; }
    if (!oldTop || oldTop.isNull()) return {ok: false, code: 'INVALID_LUA_STACK'};
    const outcome = {ok: false, code: 'LUA_CHUNK_NOT_RUN'};
    try {
      const buffer = Memory.allocUtf8String(src);
      const load = native.load(state, buffer, script.byteLength, native.chunkName,
                               runtime.nullPointer());
      outcome.load = load;
      outcome.pcall = load === 0 ? native.pcall(state, 0, 1, 0) : -1;
      outcome.ok = load === 0 && outcome.pcall === 0;
      outcome.code = !load ? (outcome.pcall === 0 ? 'OK' : 'LUA_PCALL_FAILED') : 'LUA_LOAD_FAILED';
      const p = native.toString(state, -1, runtime.nullPointer());
      if (p && !p.isNull()) outcome.value = runtime.readUtf8(p, 4096);
    } catch (e) { outcome.ok = false; outcome.code = 'LUA_CHUNK_EXCEPTION'; outcome.error = String(e); }
    finally {
      // Non-negotiable: never leave an altered Lua stack after our frame.
      runtime.writePointer(topAddress, oldTop);
    }
    return outcome;
  }

  frontendSnapshot() {
    if (!this.context) throw new Error('Frontend readback requires a validated LUI frame');
    const base = this.context.moduleBase;
    const at = rva => base.add(rva);
    const state = {
      catalogCount: at(0x6cb1ab0).readU32(),
      catalogBusy: at(0x6cb1abc).readU8(),
      previewCount: null, previewFlag: null, previewArray: false,
      previewUsable: false, profileBindOwnedByPort: false,
      previewGuardOwnedByPort: false, hubLoaderOwnedByPort: false
    };
    try {
      const count = at(0x54bcd30).readPointer();
      const flag = at(0x54bcd38).readPointer();
      const array = at(0x54bcd40).readPointer();
      if (!count.isNull() && !flag.isNull() && !array.isNull()) {
        state.previewCount = count.readS32();
        state.previewFlag = flag.readS32();
        state.previewArray = !array.readPointer().isNull();
        state.previewUsable = state.previewCount > 0 && state.previewFlag !== 0 && state.previewArray;
      }
    } catch (error) { state.previewProbeError = String(error).slice(0, 160); }
    return state;
  }

  timeoutPendingOwnership(now) {
    if (!this.pendingOwnership || now - this.pendingOwnership.startedAt < MAX_QUEUE_MS)
      return false;
    const expired = this.pendingOwnership;
    this.pendingOwnership = null;
    // A previously completed catalog can be waiting on a fresh ownership
    // request solely because the LUI callback stopped. Do not invalidate the
    // verified native registration just because this request timed out.
    if (!this.catalog.completed()) {
      this.catalog.fail('CATALOG_REQUEST_TIMEOUT',
        `no completed registration within ${MAX_QUEUE_MS} ms`);
    }
    this.statusCode = 'ORIGINAL_CATALOG_TIMEOUT';
    this.lastError = 'ORIGINAL_CATALOG_TIMEOUT';
    this.emit({event:'RESULT', requestId: expired.id, stage:'ownership',
      status:'FAILED', code:'ORIGINAL_CATALOG_TIMEOUT',
      catalog:this.catalog.snapshot()});
    return true;
  }

  onVerifiedLuiFrame(context) {
    if (!this.source.ok || this.inFrame) return;
    this.inFrame = true;
    this.context = context;
    try {
      if (this.pendingOwnership) {
        if (!this.timeoutPendingOwnership(this.clock())) {
          this.catalog.tick(context);
          if (this.catalog.completed()) {
            const p = this.pendingOwnership;
            this.pendingOwnership = null;
            const response = this.controller.prepareUnlock({type:'prepareUnlock',
              stage:'ownership', requestId:p.id});
            if (response.accepted) {
              this.emit({event:'ORIGINAL_CATALOG_READY', response, catalog:this.catalog.snapshot()});
            } else {
              // The initial request was already acknowledged. If the shared
              // Lua queue is full, give it a terminal result rather than
              // silently dropping the ownership request after catalog prep.
              this.emit({event:'RESULT',requestId:p.id,stage:'ownership',
                status:'FAILED',code:response.code, catalog:this.catalog.snapshot()});
            }
          } else if (this.catalog.stage === 'FAILED') {
            this.lastError = this.catalog.error;
            this.emit({event:'RESULT', requestId:this.pendingOwnership.id,
              status:'UNSUPPORTED', code:'ORIGINAL_CATALOG_UNAVAILABLE',
              catalog:this.catalog.snapshot()});
            this.pendingOwnership = null;
          }
        }
      }
      // Executes original preflight + at most ONE original ownership Lua
      // chunk on this same verified frame; no second native interception.
      this.controller.frame();
      const queue = this.controller.status();
      this.statusCode = this.catalog.stage === 'FAILED' ? 'ORIGINAL_CATALOG_UNAVAILABLE' :
        this.pendingOwnership ? 'WAIT_ORIGINAL_WEAPON_CATALOG' :
        queue.queue.length ? 'LUI_QUEUE_ACTIVE' :
        queue.lastResult?.code ?? 'LUI_IDLE';
    } catch (error) {
      this.lastError = String(error).slice(0, 280);
      this.emit({event:'ERROR',code:'UNIFIED_LUI_FRAME_ERROR',error:this.lastError});
    } finally { this.context = null; this.inFrame = false; }
  }

  onLuaReset() {
    this.controller.resetGeneration();
    if (this.pendingOwnership) {
      this.emit({event:'RESULT',requestId:this.pendingOwnership.id,
        status:'FAILED',code:'LUA_STATE_CHANGED'});
      this.pendingOwnership = null;
    }
    // Native DB may retain registration but a new LUI may not. Revalidate
    // readback on a subsequent explicit unlock request.
    this.catalog = new WeaponCatalogPort({notify: event => this.emit(event)});
    this.statusCode = 'WAIT_NATIVE_MAINMENU';
    this.lastError = null;
  }

  heartbeat(now = this.clock()) {
    this.timeoutPendingOwnership(now);
    if (this.controller.expire(MAX_QUEUE_MS, now) > 0) {
      this.statusCode = 'LUI_FRAME_TIMEOUT';
      this.lastError = 'LUI_FRAME_TIMEOUT';
    }
  }
  dispose() { this.onLuaReset(); this.statusCode = 'DISPOSED'; }
  snapshot() { return {status: this.statusCode, sourceVerification: this.source,
    pendingOwnership: this.pendingOwnership, catalog: this.catalog.snapshot(),
    lastError: this.lastError, controller: this.controller.status()}; }
}

export function createUnifiedUnlock(options) { return new UnifiedUnlock(options); }
