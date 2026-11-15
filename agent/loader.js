/*
 * Gadget script entry. Runs the embedded agent, or, when present, a newer
 * agent file in the game's private files directory (hot update without
 * reinstalling the APK). The override is only readable/writable by the game
 * itself (or root), so it cannot be planted by other apps.
 */
import {BUNDLE} from './loader_bundle.js';

const OVERRIDE = '/data/user/0/com.activision.callofduty.warzone/files/wzm_agent_override.js';
let source = BUNDLE;
let name = '/wzm/agent.js';
try {
  const text = File.readAllText(OVERRIDE);
  if (text && text.length > 10000) { source = text; name = '/wzm/agent_override.js'; }
} catch (_) {}
Script.evaluate(name, source);
