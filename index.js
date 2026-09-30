import Schema from '@deepseek-ai/schemastery';

/**
 * Plugin configuration, following the Harness rule that anything two
 * deployments may want to set differently is a configuration field rather than
 * a hardcoded value.
 *
 * Every field here is `.volatile()`: the framework turns such a field into a
 * live value, read on the Host with `config.<field>.get()`, and the browser half
 * reads the same value through the settings mirror (`ctx.configForms`). That is
 * what lets the user's choice persist in the profile's settings document rather
 * than in browser storage.
 */
export const Config = Schema.object({
  /** Master switch for completion sounds. */
  enabled: Schema.boolean().default(true).volatile(),
  /** Default preset, and the fallback when the stored choice is unknown. */
  preset: Schema.union(['chime', 'wood', 'soft', 'deep', 'drop']).default('chime').volatile(),
  /** Chime for subagent sessions finishing while the lead keeps working. */
  includeSubagents: Schema.boolean().default(false).volatile(),
  /** Minimum spacing between two completion chimes, in milliseconds. */
  minGapMs: Schema.number().step(1).min(0).max(10000).default(500).volatile(),
  /** Master gain, 0–1, applied on top of every preset's own peaks. */
  volume: Schema.number().step(0.05).min(0).max(1).default(1).volatile(),
});

/**
 * Host half of the completion-sound bundle.
 *
 * Playback belongs to the page, so this half registers nothing of its own: its
 * job is to hold the Loader row the browser half is served for, and to own the
 * validated configuration above. The browser half reads those values through the
 * settings mirror and writes the user's preset choice back into them.
 */
export function apply() {}
