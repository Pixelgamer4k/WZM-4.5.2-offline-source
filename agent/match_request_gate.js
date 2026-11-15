/*
 * Original-TUI offline match request gate for a future standalone Gadget.
 * This module does not hook libgame, load host_spawn.js, or start a match.
 * Nothing is trusted merely because the in-game panel supplied a map name.
 * All readiness capabilities must come from separately verified native stages.
 */
import {validateOfflineMatchRequest} from './match_contract.js';

export const REQUIRED_NATIVE_MATCH_STAGES = Object.freeze([
  'EXACT_452_BINARY_VERIFIED',
  'MAINMENU_FENCE_READY',
  'LOCAL_DDL_PROFILE_BOUND',
  'CUSTOMIZATION_AND_LOADOUT_READY',
  'HOST_MODULE_VERIFIED',
  'PARTY_CLIENT_PATH_VERIFIED',
  'NATIVE_MARKER2_AI_VERIFIED',
  'WORLD_PLAYER_SPAWN_VERIFIED'
]);

/**
 * Capability updates are delivered separately via bindNativeVerifier(), NOT
 * on the returned UI match-port. Only the private native boot/host owner may
 * retain this callback; never expose it to Activity buttons, IPC or RPC.
 * This bookkeeping is not itself binary attestation: each native stage must
 * still be independently verified by its original version-gated owner.
 */
export function createMatchRequestGate({notify = () => {}, hostAdapter = null,
    bindNativeVerifier = () => {}} = {}) {
  const proven = new Set();
  let pending = null;
  let disposed = false;
  let generation = 0;
  let requestId = 0;

  const emit = (event) => { try { notify(event); } catch (_) {} };
  const validateStage = (stage) => {
    if (![...REQUIRED_NATIVE_MATCH_STAGES,
          'VERDANSK_PACK_REGISTRY','VERDANSK_LOCAL_ZONE',
          'BROADCAST_ZONE_INJECTION','ENTITY_CHECK_GUARD'].includes(stage))
      throw new Error('Unknown native capability: ' + String(stage));
  };
  const verifier = Object.freeze({
    /** Record only externally confirmed native readiness, never UI input. */
    set(stage, isReady) {
      if (disposed) throw new Error('Native verification unavailable');
      validateStage(stage);
      if (isReady === true) proven.add(stage);
      else {
        proven.delete(stage);
        if (pending) { emit({code:'MATCH_CANCELLED_NATIVE_RESET',id:pending.id}); pending = null; }
      }
    },
    reset(reason = 'LUI_GENERATION_CHANGED') {
      if (disposed) return;
      proven.clear(); generation++;
      if (pending) { emit({code:'MATCH_CANCELLED_NATIVE_RESET',id:pending.id,reason}); pending = null; }
    }
  });
  // This is only given to the owning native supervisor at construction time.
  // The public match gate returned below has no mutable native-stage setter.
  bindNativeVerifier(verifier);

  function inspect(input) {
    const config = validateOfflineMatchRequest(input);
    if (!config.ok) return {accepted:false,code:config.code};
    const required = [...REQUIRED_NATIVE_MATCH_STAGES,...config.requires];
    const missing = required.filter((stage) => !proven.has(stage));
    if (hostAdapter === null || typeof hostAdapter.go !== 'function')
      missing.push('HOST_GADGET_NOT_INTEGRATED');
    else if (typeof hostAdapter.configure !== 'function')
      missing.push('HOST_BOT_DIFFICULTY_DURATION_UNWIRED');
    return {
      accepted:false,
      code:missing.length ? 'NATIVE_MATCH_PREREQUISITES_MISSING' : 'VERIFIED_MATCH_READY_TO_QUEUE',
      map:config.map,mode:config.mode,enemyBots:config.enemies,
      friendlyBots:config.friends,difficulty:config.difficulty,
      nativeMapId:config.nativeMapId,nativeModeHash:config.nativeModeHash,
      missing,required, source:'ORIGINAL_WZM_TUI',
      // The catalog can describe a historical tested map, but not prove a
      // match has started or that a bot AI has spawned on this phone.
      matchStarted:false,realAIVerified:proven.has('NATIVE_MARKER2_AI_VERIFIED')
    };
  }

  function request(input) {
    if (disposed) return {accepted:false,code:'MATCH_PORT_DISPOSED'};
    if (pending) return {accepted:false,code:'MATCH_ALREADY_QUEUED',id:pending.id};
    const result = inspect(input);
    if (result.code !== 'VERIFIED_MATCH_READY_TO_QUEUE') {
      emit({event:'BLOCKED',...result});
      return result;
    }
    const config = validateOfflineMatchRequest(input);
    const id = ++requestId;
    pending = {id, config, generation};
    emit({event:'QUEUED',code:'MATCH_QUEUED_NOT_STARTED',id});
    return {accepted:true,code:'MATCH_QUEUED_NOT_STARTED',id};
  }

  /**
   * Future owner calls drain() at a safe point, outside the native LUI hook.
   * Before go(map, gametype, enemyAI), a verified host adapter must explicitly
   * configure the ORIGINAL runner's friendly-bot count, difficulty and match
   * duration. These are not arguments to the old host_spawn.js `go` RPC.
   * A returned value is NOT interpreted as a player/world/AI success receipt.
   */
  function drain() {
    if (disposed) return {accepted:false,code:'MATCH_PORT_DISPOSED'};
    if (!pending) return {accepted:false,code:'NO_MATCH_REQUEST'};
    const job = pending;
    const live = inspect(job.config);
    if (job.generation !== generation || live.code !== 'VERIFIED_MATCH_READY_TO_QUEUE') {
      pending = null;
      return {accepted:false,code:'MATCH_CANCELLED_NATIVE_RESET',missing:live.missing};
    }
    pending = null;
    try {
      const config = Object.freeze({
        nativeMapId:job.config.nativeMapId,
        nativeModeHash:job.config.nativeModeHash,
        enemyBots:job.config.enemies,
        friendlyBots:job.config.friends,
        difficulty:job.config.difficulty,
        nativeDifficulty:job.config.nativeDifficulty,
        durationSeconds:job.config.durationSeconds,
        requiredZones:Object.freeze([...job.config.requires])
      });
      // No caller can silently ignore UI-controlled friendly bots/difficulty/
      // duration: explicit full configuration confirmation is mandatory.
      if (hostAdapter.configure(config) !== true) {
        emit({event:'FAILED',code:'HOST_CONFIGURATION_UNVERIFIED',id:job.id});
        return {accepted:false,code:'HOST_CONFIGURATION_UNVERIFIED',id:job.id};
      }
      const hostReply = hostAdapter.go(job.config.nativeMapId,job.config.nativeModeHash,job.config.enemies);
      emit({event:'HOST_DISPATCHED',code:'HOST_REQUEST_SENT_WORLD_NOT_VERIFIED',id:job.id});
      return {accepted:true,code:'HOST_REQUEST_SENT_WORLD_NOT_VERIFIED',id:job.id,
        hostReply,matchStarted:false};
    } catch (err) {
      const error = String(err).slice(0,240);
      emit({event:'FAILED',code:'HOST_REQUEST_FAILED',id:job.id,error});
      return {accepted:false,code:'HOST_REQUEST_FAILED',error};
    }
  }

  function snapshot() {
    return {generation,verified:[...proven].sort(),pending:pending?.id ?? null,
      adapterPresent:hostAdapter !== null,disposed};
  }
  function dispose() { verifier.reset('DISPOSED');disposed = true; }
  return Object.freeze({inspect,request,drain,snapshot,dispose});
}
