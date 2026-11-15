// Live first/third-person camera (port of analysis/frida_tools/lua_bridge/tp_terminal_agent.js).
// The engine's own 3P predicate (libgame+0x1f6e840) is forced true for the local player only; the local
// player state comes from the camera callsite (libgame+0x2326aac, x24). Hooks exist only while 3P is on.
import {attachAnywhere} from './nearhook.js';

export function createThirdPerson({log = () => {}} = {}) {
  let reader = null, override = null, localPs = null, seenAt = 0, calls = 0, on = false;

  function attach() {
    const game = Process.getModuleByName('libgame.so');
    if (reader === null) {
      reader = attachAnywhere(game.base.add(0x2326aac), {
        onEnter() {
          const ps = this.context.x24;
          if (ps && !ps.isNull()) { localPs = ps; seenAt = Date.now(); }
        }
      });
    }
    if (override === null) {
      override = attachAnywhere(game.base.add(0x1f6e840), {
        onEnter(args) { this.local = localPs !== null && args[1].equals(localPs); },
        onLeave(ret) {
          if (on && this.local && (ret.toInt32() & 1) === 0) { ret.replace(ptr(1)); calls++; }
        }
      });
    }
  }

  function detach() {
    for (const l of [override, reader]) { if (l) try { l.detach(); } catch (_) {} }
    override = null; reader = null; localPs = null;
  }

  return {
    get on() { return on; },
    set(enable) {
      enable = !!enable;
      if (enable === on) return;
      try {
        if (enable) { attach(); on = true; } else { on = false; detach(); }
        log('camera ' + (on ? 'third person' : 'first person'));
      } catch (e) {
        on = false; detach();
        log('camera hook failed: ' + e);
      }
    },
    status() {
      return (on ? '3P' : '1P') + ' player=' + (localPs !== null && Date.now() - seenAt < 6000) + ' overrides=' + calls;
    }
  };
}
