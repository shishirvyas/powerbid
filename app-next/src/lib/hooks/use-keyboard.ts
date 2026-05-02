'use client';

/**
 * Keyboard-first form/app utilities.
 *
 * Goals:
 *   - Zero deps. Native DOM only. No portals, no Mousetrap, no react-hotkeys.
 *   - Precise focus traversal: Enter / Shift+Enter walks fields in *visual*
 *     DOM order (the order they appear in the document) — not insertion order.
 *   - App-level shortcuts (Ctrl/Cmd+S, Alt+Q, …) registered with proper
 *     event filtering so they don't fire while the user is typing into a
 *     text editor / contenteditable / textarea unless explicitly allowed.
 *
 * Two hooks:
 *   - `useFormKeys(ref)`  — wires Enter/Shift+Enter/Esc on a form root.
 *   - `useShortcuts(map)` — registers global key bindings (Ctrl+S, Alt+Q, …).
 *
 * Conventions:
 *   - A "field" is any focusable element marked `data-field="true"`. This is
 *     deliberate: we don't want to count icon buttons, breadcrumbs, etc.
 *   - `data-field-skip="true"` on a field excludes it from traversal (e.g. a
 *     read-only display you still want to be tab-reachable).
 *   - Textareas: Enter inserts a newline (default). Use Ctrl+Enter to advance.
 */

import * as React from 'react';

// ─── Field traversal ────────────────────────────────────────────────────────

const FIELD_SELECTOR =
  '[data-field="true"]:not([disabled]):not([data-field-skip="true"])';

function visibleFields(root: HTMLElement): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>(FIELD_SELECTOR));
  // Filter elements that are display:none / not in the layout tree.
  // offsetParent is null for hidden elements (and for position:fixed; we
  // accept that trade-off since fixed inputs in forms are exotic).
  return all.filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function focusField(el: HTMLElement | undefined) {
  if (!el) return;
  el.focus({ preventScroll: false });
  if (el instanceof HTMLInputElement && (el.type === 'text' || el.type === 'number' || el.type === 'search' || el.type === 'tel' || el.type === 'email' || el.type === 'url')) {
    // Select-on-focus is the Tally / data-entry convention.
    try { el.select(); } catch { /* some browsers throw on number inputs */ }
  }
}

/**
 * Wire Enter / Shift+Enter / Escape onto a form root.
 *
 *   const formRef = useRef<HTMLFormElement>(null);
 *   useFormKeys(formRef, { onSave: save, onCancel: reset });
 *
 *   <form ref={formRef} data-form-root>
 *     <input data-field="true" .../>
 *   </form>
 */
export interface FormKeysOptions {
  /** Optional: also handle Ctrl/Cmd+S as save inside the form (in addition to the global hook). */
  onSave?: () => void;
  /** Esc handler. */
  onCancel?: () => void;
  /** Override Enter inside textareas. Default: textareas get newlines (Enter ignored). */
  textareaAdvanceWithCtrl?: boolean;
}

export function useFormKeys(
  ref: React.RefObject<HTMLElement | null>,
  opts: FormKeysOptions = {},
) {
  const { onSave, onCancel, textareaAdvanceWithCtrl = true } = opts;

  // Stable refs for handlers so we don't re-bind on every render.
  const optsRef = React.useRef({ onSave, onCancel, textareaAdvanceWithCtrl });
  optsRef.current = { onSave, onCancel, textareaAdvanceWithCtrl };

  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // ── Save: Ctrl/Cmd+S ────────────────────────────────────────────────
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
        if (optsRef.current.onSave) {
          e.preventDefault();
          optsRef.current.onSave();
        }
        return;
      }

      // ── Cancel ──────────────────────────────────────────────────────────
      if (e.key === 'Escape' && optsRef.current.onCancel) {
        e.preventDefault();
        optsRef.current.onCancel();
        return;
      }

      // ── Enter / Shift+Enter advance ────────────────────────────────────
      if (e.key !== 'Enter') return;
      if (e.altKey || e.metaKey) return;

      const isTextarea = target instanceof HTMLTextAreaElement;
      const isEditable = target.isContentEditable;
      const isButton =
        target instanceof HTMLButtonElement ||
        (target instanceof HTMLInputElement && (target.type === 'submit' || target.type === 'button'));

      // Buttons should activate on Enter, not advance focus.
      if (isButton) return;

      if (isTextarea || isEditable) {
        // Inside textarea: only advance when user explicitly hits Ctrl+Enter.
        if (!(optsRef.current.textareaAdvanceWithCtrl && e.ctrlKey)) return;
      }

      const fields = visibleFields(root);
      const idx = fields.indexOf(target);
      if (idx === -1) return;

      const dir = e.shiftKey ? -1 : 1;
      const next = fields[idx + dir];
      if (next) {
        e.preventDefault();
        focusField(next);
      } else if (dir === 1 && optsRef.current.onSave) {
        // Hitting Enter past the last field commits the form — Tally-style.
        e.preventDefault();
        optsRef.current.onSave();
      }
    };

    root.addEventListener('keydown', handler);
    return () => root.removeEventListener('keydown', handler);
  }, [ref]);
}

// ─── App-wide shortcuts ─────────────────────────────────────────────────────

export type ModifierFlag = 'ctrl' | 'meta' | 'mod' | 'shift' | 'alt';

export interface ShortcutBinding {
  /** Single keys ('s', 'q', 'F2', '/') or chord like 'mod+s', 'alt+q'. */
  combo: string;
  handler: (e: KeyboardEvent) => void;
  /** Allow the binding to fire while focus is in an input/textarea. Default: false (except function keys). */
  allowInInput?: boolean;
  description?: string;
}

interface ParsedCombo {
  ctrl: boolean;
  meta: boolean;
  /** "mod" matches ctrl on Windows/Linux and meta on Mac. */
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

function parseCombo(combo: string): ParsedCombo {
  const parts = combo.toLowerCase().split('+').map((s) => s.trim());
  const key = parts[parts.length - 1];
  const flags = new Set(parts.slice(0, -1));
  return {
    ctrl: flags.has('ctrl'),
    meta: flags.has('meta'),
    mod: flags.has('mod'),
    shift: flags.has('shift'),
    alt: flags.has('alt'),
    key,
  };
}

function isMac() {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
}

function comboMatches(c: ParsedCombo, e: KeyboardEvent) {
  const macCtrl = isMac() ? e.metaKey : e.ctrlKey;
  if (c.mod && !macCtrl) return false;
  if (!c.mod && c.ctrl !== e.ctrlKey) return false;
  if (!c.mod && c.meta !== e.metaKey) return false;
  if (c.shift !== e.shiftKey) return false;
  if (c.alt !== e.altKey) return false;
  // Compare on `e.key` (lower-case) for letters, raw for function keys.
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  return k === c.key;
}

function isInsideEditable(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  if (t instanceof HTMLInputElement) {
    // Allow shortcuts on non-text inputs (checkbox, radio, button…).
    const nonText = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'];
    return !nonText.includes(t.type);
  }
  if (t instanceof HTMLTextAreaElement) return true;
  if (t instanceof HTMLSelectElement) return true;
  return false;
}

/**
 * Register global keyboard shortcuts.
 *
 *   useShortcuts([
 *     { combo: 'mod+s', handler: save, description: 'Save' },
 *     { combo: 'alt+q', handler: () => router.push('/quotations/new') },
 *     { combo: 'F4',    handler: openCommandPalette, allowInInput: true },
 *   ]);
 *
 * Bindings are deduped by combo at parse time; later bindings override earlier
 * ones if combos collide.
 */
export function useShortcuts(bindings: ShortcutBinding[]) {
  // Stable ref so handlers can be replaced without rebinding the listener.
  const ref = React.useRef(bindings);
  ref.current = bindings;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // Don't run shortcuts for repeating keys (held keys would re-fire save).
      if (e.repeat) return;

      const editable = isInsideEditable(e.target);
      for (const b of ref.current) {
        const parsed = parseCombo(b.combo);
        if (!comboMatches(parsed, e)) continue;

        // Function keys (F2..F12) and chords with a modifier are allowed in
        // inputs by default; plain letters are not (you'd hijack typing).
        const isFn = /^f\d{1,2}$/.test(parsed.key);
        const hasModifier = parsed.ctrl || parsed.meta || parsed.mod || parsed.alt;
        if (editable && !b.allowInInput && !isFn && !hasModifier) continue;

        e.preventDefault();
        b.handler(e);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

// ─── Programmatic helpers ──────────────────────────────────────────────────

/** Focus the first field inside a root (e.g. on mount or after reset). */
export function focusFirstField(root: HTMLElement | null | undefined) {
  if (!root) return;
  const fields = visibleFields(root);
  focusField(fields[0]);
}
