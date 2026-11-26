import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../core/types.ts';
import { computeLayout, type Circle, type Layout } from './layout.ts';
import {
  BUTTON_GAP, BUTTON_IDS, CONTROLS_KEY, SCALE_MAX, SCALE_MIN, SCALE_STEP, applyControls, circleHitsRect, drawnRadius, configFromLayout, defaultControlsConfig, loadControlsConfig,
  moveButton, pickButton, resizeButton, saveControlsConfig, withOrientation, type ControlsConfig, type OrientationConfig,
} from './controls-config.ts';

const P = (c?: ControlsConfig) => computeLayout(390, 844, { top: 47, right: 0, bottom: 34, left: 0 }, c);
const Q = (c?: ControlsConfig) => computeLayout(844, 390, { top: 0, right: 47, bottom: 21, left: 47 }, c);
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
const circleInside = (c: Circle, r: { x: number; y: number; w: number; h: number }) =>
  c.cx - c.r >= r.x && c.cx + c.r <= r.x + r.w && c.cy - c.r >= r.y && c.cy + c.r <= r.y + r.h;
const noOverlap = (l: Layout) => {
  const cs = BUTTON_IDS.map((id) => l[id]);
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    if (Math.hypot(cs[i]!.cx - cs[j]!.cx, cs[i]!.cy - cs[j]!.cy) < cs[i]!.r + cs[j]!.r + BUTTON_GAP) return false;
  }
  return true;
};
const place = (fx: number, fy: number, scale = 1) => ({ fx, fy, scale });

describe('Knopf-Anordnung', () => {
  it('Standard-Anordnung ändert das Layout nicht (beide Ansichten)', () => {
    for (const base of [P(), Q()]) expect(applyControls(base, configFromLayout(base))).toEqual(base);
    expect(P(defaultControlsConfig())).toEqual(P());
  });

  it('Standard-Knöpfe liegen in controlsArea', () => {
    for (const l of [P(), Q()]) for (const id of BUTTON_IDS) expect(circleInside(l[id], l.controlsArea)).toBe(true);
  });

  it('Hin und zurück: configFromLayout(applyControls(base, oc)) ≈ oc', () => {
    const oc: OrientationConfig = { dpad: place(0.2, 0.5, 1.25), jump: place(0.8, 0.5), action: place(0.5, 0.9) };
    for (const base of [P(), Q()]) {
      const back = configFromLayout(applyControls(base, oc));
      for (const id of BUTTON_IDS) {
        // r wird gerundet; bei den Standardgrößen und 1,25 ist der Maßstab daher nur auf Rundung genau.
        expect(back[id].fx).toBeCloseTo(oc[id].fx, 6);
        expect(back[id].fy).toBeCloseTo(oc[id].fy, 6);
        expect(back[id].scale).toBeCloseTo(oc[id].scale, 1);
      }
    }
  });

  it('Anordnung wird wirklich angewendet', () => {
    const oc: OrientationConfig = { dpad: place(0.2, 0.5, 1.25), jump: place(0.8, 0.5), action: place(0.5, 0.9) };
    const l = applyControls(P(), oc);
    const a = l.controlsArea;
    expect(l.dpad.r).toBe(Math.round(42 * 1.25));
    expect(l.dpad.hitR).toBe(Math.round(60 * 1.25));
    expect(l.dpad.cx).toBeCloseTo(a.x + l.dpad.r + 0.2 * (a.w - 2 * l.dpad.r), 6);
    expect(l.jump.cy).toBeCloseTo(a.y + l.jump.r + 0.5 * (a.h - 2 * l.jump.r), 6);
  });

  it('computeLayout nimmt die Anordnung der passenden Ansicht', () => {
    const oc: OrientationConfig = { dpad: place(0.2, 0.5, 1.25), jump: place(0.8, 0.5), action: place(0.5, 0.9) };
    const c = withOrientation(defaultControlsConfig(), 'portrait', oc);
    expect(P(c)).toEqual(applyControls(P(), oc));
    expect(Q(c)).toEqual(Q());
  });

  it('Ungültige Anordnung (Überlappung) lässt das Layout unverändert', () => {
    const bad: OrientationConfig = { dpad: place(0.5, 0.5), jump: place(0.5, 0.5), action: place(0.5, 0.5) };
    expect(applyControls(P(), bad)).toEqual(P());
  });

  it('Ziehen über den Rand klemmt', () => {
    const l = moveButton(P(), 'jump', 9999, 9999)!;
    expect(l).not.toBeNull();
    expect(l.jump.cx + l.jump.r).toBeLessThanOrEqual(l.controlsArea.x + l.controlsArea.w);
    expect(l.jump.cy + l.jump.r).toBeLessThanOrEqual(l.controlsArea.y + l.controlsArea.h);
  });

  it('Ziehen auf einen anderen Knopf wird abgelehnt', () => {
    const l = P();
    expect(moveButton(l, 'jump', l.dpad.cx, l.dpad.cy)).toBeNull();
  });

  it('Größe wird auf 0,75 bis 1,5 geklemmt, Überlappung abgelehnt', () => {
    expect(resizeButton(P(), 'jump', 9)!.jump.r).toBe(Math.round(28 * 1.5));
    expect(resizeButton(P(), 'jump', 0)!.jump.r).toBe(Math.round(28 * 0.75));
    const l = P();
    const d = l.dpad;
    // Sprung knapp über das Steuerkreuz setzen (Abstand = Summe der Radien + Lücke), dann vergrößern.
    const next = moveButton(l, 'jump', d.cx, d.cy - drawnRadius('dpad', d.r) - drawnRadius('jump', l.jump.r) - BUTTON_GAP);
    expect(next).not.toBeNull();
    expect(resizeButton(next!, 'jump', 1.5)).toBeNull();
  });

  it('quer schneidet kein Knopf die Pause-Fläche', () => {
    const l = Q();
    expect(moveButton(l, 'jump', l.pauseHit.x + 16, l.pauseHit.y + 30)).toBeNull();
  });

  it('hochkant: Knopf oben rechts unter dem Pause-Streifen wird abgelehnt', () => {
    const l = P();
    const a = l.controlsArea;
    expect(moveButton(l, 'jump', a.x + a.w, a.y)).toBeNull();
    const oc: OrientationConfig = { dpad: place(0, 1), jump: place(1, 0), action: place(0.5, 0.5) };
    expect(applyControls(l, oc)).toEqual(l);
  });

  it.each([[375, 667, { top: 20, right: 0, bottom: 0, left: 0 }], [667, 375, { top: 0, right: 0, bottom: 0, left: 0 }]])(
    'gespeicherte Anordnung auf anderem Bildschirm (%ix%i): im Bereich oder Standard', (w, h, ins) => {
      const big = computeLayout(430, 932, { top: 59, right: 0, bottom: 34, left: 0 });
      const bigL = computeLayout(932, 430, { top: 0, right: 59, bottom: 21, left: 59 });
      for (const src of [big, bigL]) {
        const oc: OrientationConfig = { dpad: place(0, 1, 1.5), jump: place(1, 1, 1.5), action: place(0.5, 0, 1.5) };
        const cfg = withOrientation(withOrientation(defaultControlsConfig(), 'portrait', oc), 'landscape', oc);
        expect(applyControls(src, oc).orientation).toBe(src.orientation);
        const base = computeLayout(w, h, ins);
        const l = computeLayout(w, h, ins, cfg);
        const ok = BUTTON_IDS.every((id) => circleInside(l[id], l.controlsArea)) && noOverlap(l);
        expect(ok || JSON.stringify(l) === JSON.stringify(base)).toBe(true);
      }
    });

  it('withOrientation ändert nur die genannte Ansicht', () => {
    const oc: OrientationConfig = { dpad: place(0.1, 0.1), jump: place(0.9, 0.9), action: place(0.5, 0.5) };
    const c = withOrientation(defaultControlsConfig(), 'portrait', oc);
    expect(c.portrait).toEqual(oc);
    expect(c.landscape).toBeNull();
    const c2 = withOrientation(c, 'landscape', oc);
    expect(c2.portrait).toEqual(oc);
    expect(c2.landscape).toEqual(oc);
    const c3 = withOrientation(c2, 'portrait', null);
    expect(c3.portrait).toBeNull();
    expect(c3.landscape).toEqual(oc);
    expect(c.portrait).toEqual(oc); // Eingabe bleibt unverändert
  });

  it('pickButton trifft den Kreis + 4 px, sonst null', () => {
    const l = P();
    expect(pickButton(l, l.dpad.cx + l.dpad.r + 3, l.dpad.cy)).toBe('dpad');
    expect(pickButton(l, l.dpad.cx + l.dpad.r + 5, l.dpad.cy)).toBeNull();
    expect(pickButton(l, l.view.x + 10, l.view.y + 10)).toBeNull();
  });

  it('Laden: fehlend, kaputt, falsche Version, werfender Speicher, falsche Form → Standard; Speichern wirft nie', () => {
    const of = (raw: string): KeyValueStore => ({ getItem: () => raw, setItem: () => {} });
    const def = defaultControlsConfig();
    expect(loadControlsConfig(mem())).toEqual(def);
    expect(loadControlsConfig(null)).toEqual(def);
    expect(loadControlsConfig(of('{x'))).toEqual(def);
    expect(loadControlsConfig(of(JSON.stringify({ version: 9, portrait: null, landscape: null })))).toEqual(def);
    expect(loadControlsConfig({ getItem: () => { throw new Error(); }, setItem: () => {} })).toEqual(def);
    expect(loadControlsConfig(of('5'))).toEqual(def);
    expect(loadControlsConfig(of(JSON.stringify({ version: 1, portrait: 'x', landscape: 3 })))).toEqual(def);
    const good: OrientationConfig = { dpad: place(0.1, 0.1), jump: place(0.9, 0.9), action: place(0.5, 0.5) };
    const withBad = (bad: unknown) => loadControlsConfig(of(JSON.stringify({ version: 1, portrait: bad, landscape: good })));
    // Eine kaputte Ansicht fällt auf Standard, die andere bleibt.
    const fxOut = { ...good, dpad: place(1.5, 0.5) };
    const fyNeg = { ...good, jump: place(0.5, -0.1) };
    const scaleBig = { ...good, action: place(0.5, 0.5, 2) };
    const scaleSmall = { ...good, action: place(0.5, 0.5, 0.5) };
    const nan = { ...good, dpad: { fx: null, fy: 0.5, scale: 1 } };
    const missing = { dpad: good.dpad, jump: good.jump };
    for (const bad of [fxOut, fyNeg, scaleBig, scaleSmall, nan, missing]) {
      const c = withBad(bad);
      expect(c.portrait).toBeNull();
      expect(c.landscape).toEqual(good);
    }
    expect(() => saveControlsConfig({ getItem: () => null, setItem: () => { throw new Error('voll'); } }, def)).not.toThrow();
    expect(() => saveControlsConfig(null, def)).not.toThrow();
  });

  it('Speichern und Laden ergibt dieselbe Anordnung', () => {
    const store = mem();
    const oc: OrientationConfig = { dpad: place(0.2, 0.5, 1.25), jump: place(0.8, 0.5, 0.875), action: place(0.5, 0.9, 1.5) };
    const c = withOrientation(defaultControlsConfig(), 'landscape', oc);
    saveControlsConfig(store, c);
    expect(store.getItem(CONTROLS_KEY)).not.toBeNull();
    expect(loadControlsConfig(store)).toEqual(c);
  });

  it.each([
    [844, 390, { top: 0, right: 47, bottom: 21, left: 47 }],
    [667, 375, { top: 0, right: 0, bottom: 0, left: 0 }],
    [390, 844, { top: 47, right: 0, bottom: 34, left: 0 }],
    [375, 667, { top: 20, right: 0, bottom: 0, left: 0 }],
  ])('Größe ändern, speichern, neu laden ergibt dieselbe Anordnung (%ix%i)', (w, h, ins) => {
    const base = computeLayout(w, h, ins);
    let tested = 0;
    for (const id of BUTTON_IDS) for (let s = SCALE_MIN; s <= SCALE_MAX + 1e-9; s += SCALE_STEP) {
      const edited = resizeButton(base, id, s);
      if (!edited) continue; // Überlappung: abgelehnt
      tested++;
      const store = mem();
      saveControlsConfig(store, withOrientation(defaultControlsConfig(), base.orientation, configFromLayout(edited)));
      const back = computeLayout(w, h, ins, loadControlsConfig(store));
      for (const b of BUTTON_IDS) {
        expect(back[b].r, `${id} ${s} ${b}`).toBe(edited[b].r);
        expect(back[b].hitR).toBe(edited[b].hitR);
        expect(back[b].cx).toBeCloseTo(edited[b].cx, 6);
        expect(back[b].cy).toBeCloseTo(edited[b].cy, 6);
      }
    }
    expect(tested).toBeGreaterThan(10);
  });

  it('Mindestabstand: gezeichnete Ausdehnung (Rand, Steuerkreuz-Ecken) hält 4 px Abstand', () => {
    for (const l of [P(), Q()]) for (const a of BUTTON_IDS) for (const b of BUTTON_IDS) {
      if (a >= b) continue;
      let minGap = Infinity;
      // Knopf b von weit rechts an a heranschieben; jede angenommene Stellung muss Abstand halten.
      for (let x = l.controlsArea.x + l.controlsArea.w; x > l.controlsArea.x; x -= 0.25) {
        const base = moveButton(l, a, l[a].cx, l[a].cy) ?? l;
        const m = moveButton(base, b, x, base[a].cy);
        if (!m) continue;
        const d = Math.hypot(m[a].cx - m[b].cx, m[a].cy - m[b].cy);
        minGap = Math.min(minGap, d - drawnRadius(a, m[a].r) - drawnRadius(b, m[b].r));
      }
      if (minGap !== Infinity) expect(minGap).toBeGreaterThanOrEqual(BUTTON_GAP - 1e-6);
    }
    // Bei größter Größe (Steuerkreuz-Ecke am weitesten außen) ebenso.
    let big: Layout | null = null;
    for (let sc = SCALE_MAX; !big && sc >= SCALE_MIN; sc -= SCALE_STEP) big = resizeButton(P(), 'dpad', sc);
    expect(big).not.toBeNull();
    big = big!;
    for (let x = big.controlsArea.x + big.controlsArea.w; x > big.dpad.cx; x -= 0.25) {
      const m = moveButton(big, 'jump', x, big.dpad.cy);
      if (m) expect(Math.hypot(m.dpad.cx - m.jump.cx, 0) - drawnRadius('dpad', m.dpad.r) - drawnRadius('jump', m.jump.r)).toBeGreaterThanOrEqual(BUTTON_GAP - 1e-6);
    }
  });

  it('circleHitsRect: Kreis berührt Rechteck erst bei Überschneidung', () => {
    const r = { x: 10, y: 10, w: 10, h: 10 };
    expect(circleHitsRect(r, { cx: 5, cy: 15, r: 5, hitR: 0 })).toBe(false);
    expect(circleHitsRect(r, { cx: 5, cy: 15, r: 5.5, hitR: 0 })).toBe(true);
    expect(circleHitsRect(r, { cx: 15, cy: 15, r: 1, hitR: 0 })).toBe(true);
  });
});
