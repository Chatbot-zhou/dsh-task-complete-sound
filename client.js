/**
 * Client half of the task-completion chime bundle.
 *
 * Four contributions share this module:
 *   - a headless monitor in the frame-wide `shell.overlay` slot that plays the
 *     selected preset when any top-level session finishes;
 *   - a headless monitor in `conversation.composer.dock` that does the same for
 *     the open session, so either observation path is enough;
 *   - a one-click unlock prompt, shown only while the browser is still gating
 *     audio, because Chromium refuses to start audio before the first gesture;
 *   - a preference row in `settings.general.item` that picks and previews the
 *     preset.
 *
 * Settings come from the plugin's own Host `Config` through the settings mirror
 * (`ctx.configForms`), so the choice lives in the profile's settings document.
 * The previous browser-storage value is still read as a fallback, so the plugin
 * keeps its selection in deployments that compose no settings document.
 *
 * Every preset is synthesized through Web Audio, so the bundle ships no audio
 * asset and requests no module beyond React.
 */
window.__ModuleLoader__.load({
  id: 'dsh-task-complete-sound',
  factory(require) {
    const React = require('react');

    /** The row id, the locale namespace and the settings namespace coincide. */
    const NS = 'task-complete-sound';
    const LOCALE_NS = NS;
    /** Pre-config storage key, kept as the fallback source for the preset. */
    const PRESET_STORAGE_KEY = 'dsh.task-complete-sound.preset';
    /** Mirrors the Host `Config` defaults; used until the settings mirror is served. */
    const DEFAULTS = {
      enabled: true,
      preset: 'chime',
      includeSubagents: false,
      minGapMs: 500,
      volume: 1,
    };
    /** Default attack/release ramp; a tone's own `attackMs` overrides it. */
    const RAMP_SECONDS = 0.005;

    /**
     * Preset catalog. Each tone is
     * [frequency Hz, start offset ms, duration ms, peak gain, oscillator type,
     *  end Hz, attack ms].
     *
     * `end Hz` glides the tone (`0` means no glide). `attack ms` overrides the
     * default 5 ms ramp: a longer attack trades the initial click for weight,
     * which is what makes `deep` feel heavy rather than sharp.
     *
     * Layered partials get shorter durations and lower peaks so a struck tone
     * decays instead of stopping abruptly. Peaks are chosen so the loudest
     * partial set sums well under full scale and cannot clip.
     */
    const PRESETS = [
      {
        id: 'chime',
        tones: [
          [880, 0, 180, 0.5, 'sine'],
          [1318.5, 130, 380, 0.45, 'sine'],
        ],
      },
      {
        id: 'wood',
        tones: [
          [260, 0, 130, 0.32, 'sine'],
          [520, 0, 100, 0.5, 'sine'],
          [1040, 0, 45, 0.18, 'sine'],
        ],
      },
      {
        id: 'soft',
        tones: [
          [261.63, 0, 900, 0.45, 'sine'],
          [392, 0, 700, 0.22, 'sine'],
          [523.25, 30, 400, 0.1, 'sine'],
        ],
      },
      {
        id: 'deep',
        tones: [
          [196, 0, 950, 0.44, 'sine', 0, 22],
          [196, 0, 600, 0.18, 'triangle', 0, 22],
          [293.66, 0, 720, 0.18, 'sine', 0, 28],
          [392, 0, 430, 0.09, 'sine', 0, 34],
        ],
      },
      {
        id: 'drop',
        tones: [
          [1300, 0, 140, 0.45, 'sine'],
          [900, 100, 240, 0.35, 'sine'],
        ],
      },
    ];

    /** Simplified Chinese dictionary (the key-set source of truth). */
    const zh = {
      'title': '任务完成提示音',
      'description': '任务结束时播放的音效；点击任一选项即可试听。',
      'preset.chime': '清脆',
      'preset.wood': '木鱼',
      'preset.soft': '柔和',
      'preset.deep': '厚重',
      'preset.drop': '水滴',
      'unlock.message': '提示音需要一次点击才能播放',
      'unlock.action': '点此试听',
      'unlock.dismiss': '不再提示',
    };
    /** English dictionary, checked complete against the zh key set. */
    const en = {
      'title': 'Task completion sound',
      'description': 'Played when a task finishes. Click any option to preview it.',
      'preset.chime': 'Chime',
      'preset.wood': 'Woodblock',
      'preset.soft': 'Soft',
      'preset.deep': 'Deep',
      'preset.drop': 'Drop',
      'unlock.message': 'The sound needs one click before it can play',
      'unlock.action': 'Preview it',
      'unlock.dismiss': 'Do not ask again',
    };

    /** Row styles: host spacing and tokens, copied from the shipped General rows. */
    const ROW_CSS = [
      '.tcs-row{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:12px;padding:16px 0;display:flex}',
      '.tcs-text{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:24px;display:flex}',
      '.tcs-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}',
      '.tcs-desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}',
      '.tcs-control{flex-wrap:wrap;align-items:center;gap:8px;display:flex}',
      '.tcs-option{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;height:36px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex;align-items:center}',
      '.tcs-option:hover:not(.tcs-selected){background:var(--dsw-alias-interactive-bg-hover)}',
      '.tcs-selected{background:var(--dsw-alias-bg-module-platform);border-color:var(--dsw-static-neutral-bluish-400)}',
    ].join('');

    /** Unlock-prompt styles: one small pill in the frame-wide layer. */
    const NOTICE_CSS = [
      '.tcs-notice{position:fixed;left:16px;bottom:16px;display:flex;align-items:center;gap:10px;padding:8px 10px 8px 14px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;pointer-events:auto}',
      '.tcs-notice-action{font:inherit;color:var(--dsw-alias-brand-primary);background:0 0;border:none;padding:0;cursor:pointer;text-decoration:underline}',
      '.tcs-notice-dismiss{font:inherit;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;padding:0 2px;cursor:pointer}',
    ].join('');

    let audioContext = null;
    let audioUnavailable = false;
    let lastChimeAt = 0;
    /** The settings mirror bound to this plugin's Config, when one is composed. */
    let configForm = null;

    /** @returns whether an id names a catalogued preset. */
    function isPreset(id) {
      return PRESETS.some((preset) => preset.id === id);
    }

    /** @returns the pre-config stored preset, or the default when absent or unknown. */
    function readStoredPreset() {
      try {
        const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
        return isPreset(raw) ? raw : DEFAULTS.preset;
      } catch (error) {
        return DEFAULTS.preset;
      }
    }

    /** Mirror one choice into browser storage, so the plugin survives without a settings document. */
    function writeStoredPreset(id) {
      try {
        window.localStorage.setItem(PRESET_STORAGE_KEY, id);
      } catch (error) {
        console.warn('task-complete-sound: preset could not be stored', error);
      }
    }

    /**
     * Effective settings: the Host Config when its namespace is served, otherwise
     * the stored preset and the schema defaults.
     * @returns the resolved settings object.
     */
    function readSettings() {
      let value = null;
      if (configForm !== null) {
        try {
          const snapshot = configForm.getSnapshot();
          if (snapshot !== null && typeof snapshot === 'object'
            && snapshot.value !== null && typeof snapshot.value === 'object') {
            value = snapshot.value;
          }
        } catch (error) {
          value = null;
        }
      }
      return {
        enabled: value !== null && value.enabled === false ? false : DEFAULTS.enabled,
        preset: value !== null && isPreset(value.preset) ? value.preset : readStoredPreset(),
        includeSubagents: value !== null && value.includeSubagents === true,
        minGapMs: value !== null && typeof value.minGapMs === 'number' && value.minGapMs >= 0
          ? value.minGapMs
          : DEFAULTS.minGapMs,
        volume: value !== null && typeof value.volume === 'number' && value.volume >= 0 && value.volume <= 1
          ? value.volume
          : DEFAULTS.volume,
      };
    }

    /** Persist one preset choice through the settings mirror, mirroring it locally too. */
    function setChimePreset(id) {
      if (!isPreset(id)) return;
      writeStoredPreset(id);
      if (configForm === null) return;
      try {
        const result = configForm.set('preset', id);
        if (result !== null && typeof result === 'object' && typeof result.catch === 'function') {
          result.catch((error) => {
            console.warn('task-complete-sound: preset write was refused', error);
          });
        }
      } catch (error) {
        console.warn('task-complete-sound: preset write failed', error);
      }
    }

    /** Guards the one-time migration below so it runs at most once per page. */
    let migrationChecked = false;

    /**
     * Carry a pre-config browser-stored choice into the Config, once, and only
     * while the Config still holds the schema default. Without this, upgrading
     * from a version that stored the preset in the browser would silently reset
     * the user's choice to the default.
     */
    function migrateStoredPreset() {
      if (migrationChecked) return;
      migrationChecked = true;
      if (configForm === null) return;
      const stored = readStoredPreset();
      if (stored === DEFAULTS.preset) return;
      let value = null;
      try {
        const snapshot = configForm.getSnapshot();
        if (snapshot !== null && typeof snapshot === 'object'
          && snapshot.value !== null && typeof snapshot.value === 'object') {
          value = snapshot.value;
        }
      } catch (error) {
        return;
      }
      if (value === null || value.preset !== DEFAULTS.preset) return;
      setChimePreset(stored);
    }

    /** Tiny observable store for this module's own state (not the settings mirror). */
    function createStore(initial) {
      let snapshot = initial;
      const listeners = new Set();
      return {
        get() {
          return snapshot;
        },
        getSnapshot() {
          return snapshot;
        },
        set(next) {
          if (next === snapshot) return;
          snapshot = next;
          for (const listener of [...listeners]) listener();
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      };
    }

    /** React binding for this module's own stores. */
    function useStoreValue(store) {
      const [value, setValue] = React.useState(store.getSnapshot);
      React.useEffect(() => {
        const sync = () => setValue(store.getSnapshot());
        sync();
        return store.subscribe(sync);
      }, []);
      return value;
    }

    /**
     * Whether Web Audio still refuses to start. `locked` is only ever written
     * from an observed context state, so a window that needs no gesture never
     * shows the prompt.
     */
    const audioStore = createStore({ locked: false, dismissed: false });

    /** @param locked - observed AudioContext state. */
    function reportAudioState(locked) {
      const current = audioStore.get();
      if (current.locked === locked) return;
      audioStore.set({ locked: locked, dismissed: current.dismissed });
    }

    /** @param answer - the operator's answer to the unlock prompt. */
    function dismissAudioPrompt(answer) {
      const current = audioStore.get();
      audioStore.set({ locked: current.locked, dismissed: answer });
    }

    /** Hook for the unlock prompt's live state. */
    function useAudioPromptState() {
      return useStoreValue(audioStore);
    }

    /**
     * Create, or return, the single AudioContext this bundle owns.
     * @returns the live context, or null when this page cannot provide one.
     */
    function ensureAudioContext() {
      if (audioContext !== null) return audioContext;
      if (audioUnavailable) return null;
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (typeof Ctor !== 'function') {
        audioUnavailable = true;
        console.warn('task-complete-sound: Web Audio is unavailable in this page');
        return null;
      }
      try {
        audioContext = new Ctor();
      } catch (error) {
        audioUnavailable = true;
        console.warn('task-complete-sound: AudioContext creation failed', error);
        return null;
      }
      return audioContext;
    }

    /**
     * Start the context if the browser is holding it suspended.
     * @returns the context, or null when this page has no audio at all.
     */
    function unlockAudio() {
      const context = ensureAudioContext();
      if (context === null) {
        // Nothing to unlock and nothing worth prompting about.
        reportAudioState(false);
        return null;
      }
      if (context.state === 'running') {
        reportAudioState(false);
        return context;
      }
      void context.resume().then(
        () => {
          reportAudioState(context.state !== 'running');
        },
        () => {
          reportAudioState(true);
        },
      );
      return context;
    }

    /**
     * @param context - the live context.
     * @param tones - one preset's schedule.
     * @param volume - master gain multiplier from the settings.
     */
    function scheduleTones(context, tones, volume) {
      const scale = typeof volume === 'number' && volume >= 0 && volume <= 1 ? volume : 1;
      const origin = context.currentTime;
      for (const [frequency, offsetMs, durationMs, peak, type, endFrequency, attackMs] of tones) {
        const from = origin + offsetMs / 1000;
        const to = from + durationMs / 1000;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, from);
        if (typeof endFrequency === 'number' && endFrequency > 0) {
          oscillator.frequency.exponentialRampToValueAtTime(endFrequency, to);
        }
        // A longer attack trades the initial click for weight; it is capped at
        // half the tone so the release ramp can never be scheduled out of order.
        const attack = Math.min(
          typeof attackMs === 'number' && attackMs > 0 ? attackMs / 1000 : RAMP_SECONDS,
          durationMs / 2000,
        );
        gain.gain.setValueAtTime(0, from);
        gain.gain.linearRampToValueAtTime(peak * scale, from + attack);
        gain.gain.linearRampToValueAtTime(0, to);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(from);
        oscillator.stop(to + 0.02);
        oscillator.onended = () => {
          try {
            gain.disconnect();
          } catch (error) {
            /* the context may already be closed; nothing to release */
          }
        };
      }
    }

    /**
     * Play one preset. Every failure path stays silent rather than breaking the
     * slot that asked for it.
     * @param id - preset id; unknown ids fall back to the first catalog entry.
     * @param throttle - true for completion chimes, which coalesce and honor the
     * `enabled` setting; previews pass false so an explicit click always sounds.
     */
    function playPreset(id, throttle) {
      const settings = readSettings();
      if (throttle && !settings.enabled) return;
      const now = Date.now();
      if (throttle && now - lastChimeAt < settings.minGapMs) return;
      const context = ensureAudioContext();
      if (context === null) {
        reportAudioState(false);
        return;
      }
      lastChimeAt = now;
      const preset = PRESETS.find((candidate) => candidate.id === id) || PRESETS[0];
      const play = () => {
        try {
          scheduleTones(context, preset.tones, settings.volume);
        } catch (error) {
          console.warn('task-complete-sound: chime scheduling failed', error);
        }
      };
      try {
        if (context.state === 'running') {
          reportAudioState(false);
          play();
          return;
        }
        void context.resume().then(
          () => {
            reportAudioState(context.state !== 'running');
            play();
          },
          () => {
            // Still gated by autoplay: the prompt explains the one click needed.
            reportAudioState(true);
          },
        );
      } catch (error) {
        console.warn('task-complete-sound: chime scheduling failed', error);
      }
    }

    /**
     * Reduce the sessions store to one comparable string of run states, so the
     * default selector equality suffices and a fresh array or object per read
     * never causes churn. Every session is included, subagents too: the
     * `includeSubagents` setting decides at comparison time whether a subagent
     * counts, and keeping them in the signature means flipping that setting can
     * never be mistaken for a completion.
     * @param state - the `useSessions` store snapshot.
     * @returns sorted `"<sessionId>|<0|1>|<n|s>"` entries joined by commas.
     */
    function runningSignature(state) {
      const byId = state !== null && typeof state === 'object' && state.byId !== undefined ? state.byId : {};
      const parts = [];
      for (const id of Object.keys(byId)) {
        const session = byId[id];
        if (session === null || session === undefined) continue;
        const kind = session.origin === 'subagent' ? 's' : 'n';
        parts.push(id + '|' + (session.running === true ? '1' : '0') + '|' + kind);
      }
      parts.sort();
      return parts.join(',');
    }

    /**
     * @param signature - a value produced by {@link runningSignature}.
     * @returns session id to its run state.
     */
    function parseSignature(signature) {
      const running = new Map();
      if (typeof signature !== 'string' || signature === '') return running;
      for (const part of signature.split(',')) {
        const fields = part.split('|');
        if (fields.length < 3) continue;
        running.set(fields[0], { running: fields[1] === '1', subagent: fields[2] === 's' });
      }
      return running;
    }

    /** Selector hook used when the slot does not supply `useSessions`. */
    const idleSelector = () => '';
    /** Selector hook used when the slot does not supply `useSession`. */
    const idleSessionSelector = () => false;
    /** @param snapshot - the per-session snapshot. @returns whether it is running. */
    const sessionRunning = (snapshot) => (
      snapshot !== null && snapshot !== undefined && snapshot.running === true
    );
    /** @param snapshot - the per-session snapshot. @returns whether it is a subagent session. */
    const sessionIsSubagent = (snapshot) => (
      snapshot !== null && snapshot !== undefined
      && snapshot.subagent !== null && snapshot.subagent !== undefined
    );
    /** Selector hook used when the settings mirror is not composed. */
    const fallbackConfigHook = () => ({ value: DEFAULTS });

    /**
     * Frame-wide baseline. It lives at module scope on purpose: a slot entry can
     * be torn down and rebuilt (a module swap, a profile reload) while a run is
     * in flight, and a per-instance ref would silently lose the running state and
     * swallow that completion.
     */
    let overlayBaseline = null;
    /** Per-session baselines for the conversation-scoped monitor. */
    const dockBaseline = new Map();

    /**
     * Frame-wide monitor: chime once when any counted session stops running.
     * Sessions that vanished from the store, sessions seen for the first time,
     * and the very first observation never chime.
     * @param props - the slot's standard props, including the `useSessions` seat.
     * @returns nothing; this entry renders no DOM.
     */
    function CompletionMonitor(props) {
      const useSessions = typeof props.useSessions === 'function' ? props.useSessions : idleSelector;
      const signature = useSessions(runningSignature);
      React.useEffect(() => {
        try {
          const running = parseSignature(signature);
          const before = overlayBaseline;
          overlayBaseline = running;
          if (before === null) return;
          const settings = readSettings();
          for (const entry of before) {
            const now = running.get(entry[0]);
            if (entry[1].running !== true) continue;
            if (now === undefined || now.running !== false) continue;
            if (!settings.includeSubagents && now.subagent) continue;
            playPreset(settings.preset, true);
            return;
          }
        } catch (error) {
          console.warn('task-complete-sound: completion check failed', error);
        }
      }, [signature]);
      return null;
    }

    /**
     * Session-scoped monitor for the open conversation. It reaches the same
     * conclusion as the frame-wide one through an independent observation, and
     * the shared throttle collapses the duplicate into a single chime.
     * @param props - the slot's standard props, including the `useSession` seat.
     * @returns nothing; this entry renders no DOM.
     */
    function SessionCompletionMonitor(props) {
      const useSession = typeof props.useSession === 'function' ? props.useSession : idleSessionSelector;
      const running = useSession(sessionRunning);
      const isSubagent = useSession(sessionIsSubagent);
      const sessionId = typeof props.sessionId === 'string' ? props.sessionId : 'unknown';
      React.useEffect(() => {
        const before = dockBaseline.get(sessionId);
        dockBaseline.set(sessionId, running);
        if (before !== true || running !== false) return;
        const settings = readSettings();
        if (!settings.includeSubagents && isSubagent) return;
        playPreset(settings.preset, true);
      }, [running, sessionId, isSubagent]);
      return null;
    }

    /**
     * One-click unlock prompt for a page whose AudioContext is still gated.
     * @param props - composed slot props (`t`).
     * @returns the prompt, or nothing once audio runs or the prompt is dismissed.
     */
    function AudioUnlockNotice(props) {
      const state = useAudioPromptState();
      const t = typeof props.t === 'function' ? props.t : (key) => key;
      if (!state.locked || state.dismissed) return null;
      return React.createElement(
        'div',
        { className: 'tcs-notice' },
        React.createElement('style', null, NOTICE_CSS),
        React.createElement('span', null, t('unlock.message')),
        React.createElement('button', {
          type: 'button',
          className: 'tcs-notice-action',
          onClick: () => {
            unlockAudio();
            playPreset(readSettings().preset, false);
          },
        }, t('unlock.action')),
        React.createElement('button', {
          type: 'button',
          className: 'tcs-notice-dismiss',
          'aria-label': t('unlock.dismiss'),
          onClick: () => dismissAudioPrompt(true),
        }, '\u00d7'),
      );
    }

    /**
     * General-settings row: pick a preset, previewing it on click.
     *
     * The settings mirror arrives through the slot's `hooks` seat, which takes a
     * store and derives the `use<Key>` prop itself; the writer is a plain prop.
     *
     * @param props - composed slot props (`t`, the injected hook, the writer).
     * @returns the preference row.
     */
    function ChimeRow(props) {
      const useConfig = typeof props.useSoundConfig === 'function' ? props.useSoundConfig : fallbackConfigHook;
      const snapshot = useConfig((value) => value);
      const value = snapshot !== null && typeof snapshot === 'object'
        && snapshot.value !== null && typeof snapshot.value === 'object'
        ? snapshot.value
        : null;
      const current = value !== null && isPreset(value.preset) ? value.preset : readStoredPreset();
      const t = typeof props.t === 'function' ? props.t : (key) => key;
      const setPreset = typeof props.setChimePreset === 'function' ? props.setChimePreset : setChimePreset;
      return React.createElement(
        'div',
        { className: 'tcs-row' },
        // Component-local stylesheet: unmounting the row removes it.
        React.createElement('style', null, ROW_CSS),
        React.createElement(
          'div',
          { className: 'tcs-text' },
          React.createElement('div', { className: 'tcs-title' }, t('title')),
          React.createElement('div', { className: 'tcs-desc' }, t('description')),
        ),
        React.createElement(
          'div',
          { className: 'tcs-control', role: 'group', 'aria-label': t('title') },
          PRESETS.map((preset) => React.createElement(
            'button',
            {
              key: preset.id,
              type: 'button',
              className: current === preset.id ? 'tcs-option tcs-selected' : 'tcs-option',
              'aria-pressed': current === preset.id,
              onClick: () => {
                setPreset(preset.id);
                playPreset(preset.id, false);
              },
            },
            t('preset.' + preset.id),
          )),
        ),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'task-complete-sound: dictionaries');

        // Optional service: when no settings document is composed the sound still
        // works from the schema defaults, and the row is simply not offered,
        // instead of the whole plugin going inactive.
        const configForms = ctx.get('configForms');
        if (configForms !== undefined && configForms !== null && typeof configForms.get === 'function') {
          try {
            configForm = configForms.get(NS);
          } catch (error) {
            configForm = null;
            console.warn('task-complete-sound: settings namespace is unavailable', error);
          }
        }

        // Chromium gates Web Audio behind a user gesture on a plain page, so
        // learn the true state at activation, then retry on every interaction.
        ctx.effect(() => {
          const unlock = () => {
            unlockAudio();
          };
          window.addEventListener('pointerdown', unlock, true);
          window.addEventListener('keydown', unlock, true);
          unlock();
          return () => {
            window.removeEventListener('pointerdown', unlock, true);
            window.removeEventListener('keydown', unlock, true);
            const context = audioContext;
            audioContext = null;
            if (context !== null) {
              try {
                void context.close();
              } catch (error) {
                console.warn('task-complete-sound: AudioContext close failed', error);
              }
            }
          };
        }, 'task-complete-sound: audio lifetime');

        ctx.slots.inject('shell.overlay', () => ctx.slots.register(
          { name: 'shell.overlay', id: NS, order: 100 },
          CompletionMonitor,
        ));

        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register(
          { name: 'conversation.composer.dock', id: NS, order: 5 },
          SessionCompletionMonitor,
        ));

        ctx.slots.inject('shell.overlay', () => ctx.slots.register(
          { name: 'shell.overlay', id: NS + '-unlock', order: 101, locale: LOCALE_NS },
          AudioUnlockNotice,
        ));

        // The row exists only while the Host serves this Config namespace, which
        // is what makes the choice outlive browser storage.
        if (configForms !== undefined && configForms !== null && typeof configForms.whileServed === 'function') {
          ctx.effect(() => configForms.whileServed([NS], () => {
            migrateStoredPreset();
            return ctx.slots.inject(
              'settings.general.item',
              () => ctx.slots.register({
                name: 'settings.general.item',
                id: NS,
                order: 21,
                locale: LOCALE_NS,
                inject: () => ({
                  hooks: { soundConfig: configForm },
                  setChimePreset: (id) => setChimePreset(id),
                }),
              }, ChimeRow),
            );
          }), 'task-complete-sound: settings row');
        }
      },
    };
  },
});
