// Zeigt jeden unbehandelten Fehler als kleine Meldung über dem Spiel. Das Handy hat keine Konsole,
// sonst friert das Spiel stumm ein. Läuft immer (nicht nur mit ?debug) und darf selbst nie werfen.

let box: HTMLDivElement | null = null;

function show(msg: string): void {
  try {
    if (!box) {
      box = document.createElement('div');
      box.style.cssText =
        'position:fixed;left:0;right:0;top:0;z-index:99999;max-height:40%;overflow:auto;margin:0;padding:6px 8px;' +
        'background:rgba(20,6,10,.92);color:#ffb4a8;font:11px/1.35 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word;' +
        'pointer-events:none;-webkit-user-select:text;user-select:text';
      document.body.appendChild(box);
    }
    box.textContent = (box.textContent ? box.textContent + '\n' : '') + msg.slice(0, 600);
  } catch { /* Anzeige darf keinen zweiten Fehler auslösen */ }
}

function describe(e: unknown): string {
  try {
    if (e instanceof Error) return `${e.name}: ${e.message}${e.stack ? '\n' + e.stack.split('\n').slice(1, 4).join('\n') : ''}`;
    return String(e);
  } catch { return 'Unbekannter Fehler'; }
}

window.addEventListener('error', (ev) => show(ev.error !== undefined && ev.error !== null ? describe(ev.error) : String(ev.message)));
window.addEventListener('unhandledrejection', (ev) => show('Promise: ' + describe(ev.reason)));
