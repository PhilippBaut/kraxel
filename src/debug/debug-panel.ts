// Einklappbares DOM-Panel (nur mit ?debug): Schieberegler für alle Tuning-Werte, direkt am Tuning-Objekt.
import { DEFAULT_TUNING, saveTuning, type Tuning } from '../core/tuning.ts';
import type { KeyValueStore } from '../core/types.ts';

const MIN_FACTOR = 0.25, MAX_FACTOR = 2.5, STEPS = 90;

function fmt(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}

export class DebugPanel {
  private readonly root = document.createElement('div');
  private readonly rows: { key: keyof Tuning; input: HTMLInputElement; out: HTMLElement }[] = [];

  private readonly tuning: Tuning;
  private readonly store: KeyValueStore | null;

  constructor(tuning: Tuning, store: KeyValueStore | null) {
    this.tuning = tuning;
    this.store = store;
    const root = this.root;
    root.style.cssText = 'position:fixed;top:max(4px,env(safe-area-inset-top));right:max(4px,env(safe-area-inset-right));z-index:10;'
      + 'font:12px/1.3 monospace;color:#fff;touch-action:auto;text-align:right';
    // Nichts vom Panel darf als Spielereingabe ankommen.
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'mousedown', 'click', 'wheel']) {
      root.addEventListener(type, (e) => e.stopPropagation());
    }

    const toggle = this.button('Debug');
    const body = document.createElement('div');
    body.style.cssText = 'display:none;margin-top:4px;background:rgba(27,18,48,.92);border:1px solid #2ec4b6;padding:6px;'
      + 'width:min(280px,calc(100vw - 16px));max-height:60vh;overflow-y:auto;overscroll-behavior:contain;text-align:left;-webkit-overflow-scrolling:touch';
    toggle.onclick = () => { body.style.display = body.style.display === 'none' ? 'block' : 'none'; };

    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:6px;margin-bottom:6px';
    const reset = this.button('Zurücksetzen');
    const copy = this.button('Werte kopieren');
    const fallback = document.createElement('textarea');
    fallback.readOnly = true;
    fallback.style.cssText = 'display:none;width:100%;height:80px;box-sizing:border-box;margin-bottom:6px;font:11px monospace;user-select:text;-webkit-user-select:text';
    reset.onclick = () => {
      Object.assign(this.tuning, DEFAULT_TUNING);
      this.refresh();
      saveTuning(this.store, this.tuning);
    };
    copy.onclick = () => {
      const json = JSON.stringify(this.tuning);
      const showText = () => { fallback.value = json; fallback.style.display = 'block'; fallback.select(); };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(json).then(() => { copy.textContent = 'Kopiert'; setTimeout(() => { copy.textContent = 'Werte kopieren'; }, 1200); }, showText);
      else showText();
    };
    bar.append(reset, copy);
    body.append(bar, fallback);

    for (const key of Object.keys(DEFAULT_TUNING) as (keyof Tuning)[]) {
      const def = DEFAULT_TUNING[key];
      const row = document.createElement('label');
      row.style.cssText = 'display:grid;grid-template-columns:96px 1fr 48px;gap:4px;align-items:center;min-height:28px';
      const name = document.createElement('span');
      name.textContent = key;
      name.style.cssText = 'overflow:hidden;text-overflow:ellipsis;font-size:11px';
      const input = document.createElement('input');
      input.type = 'range';
      // Standardwert 0 würde den Regler festnageln; dann gibt es nichts zu skalieren.
      input.min = String(def * MIN_FACTOR);
      input.max = String(def * MAX_FACTOR);
      input.step = String((def * (MAX_FACTOR - MIN_FACTOR)) / STEPS || 1);
      input.style.cssText = 'width:100%;min-width:0;margin:0';
      const out = document.createElement('span');
      out.style.textAlign = 'right';
      input.oninput = () => {
        this.tuning[key] = Number(input.value);
        out.textContent = fmt(this.tuning[key]);
        saveTuning(this.store, this.tuning);
      };
      row.append(name, input, out);
      body.append(row);
      this.rows.push({ key, input, out });
    }
    this.refresh();
    root.append(toggle, body);
    document.body.append(root);
  }

  destroy(): void {
    this.root.remove();
  }

  private refresh(): void {
    for (const { key, input, out } of this.rows) {
      input.value = String(this.tuning[key]);
      out.textContent = fmt(this.tuning[key]);
    }
  }

  private button(label: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = 'font:12px monospace;color:#fff;background:#1b1230;border:1px solid #2ec4b6;border-radius:4px;padding:6px 10px;min-height:32px';
    return b;
  }
}
