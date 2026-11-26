// Die Spielrunde: was Kraxel von Level zu Level mitnimmt. Kein Phaser, kein DOM.
import { START_LIVES } from '../config.ts';
import type { GameState, Session } from './game.ts';

export interface RunState { lives: number; crystals: number; helm: boolean }

/** Frische Runde: volle Leben, keine Kristalle, kein Helm. */
export function newRun(): RunState {
  return { lives: START_LIVES, crystals: 0, helm: false };
}

/** Die Sitzung für ein Level: Zeit 0, noch kein Edelweiß (das kommt aus dem Speicherstand). */
export function sessionFor(run: RunState): Session {
  return { lives: run.lives, crystals: run.crystals, time: 0, edelweiss: [false, false, false] };
}

/** Nach Ziel oder „ZUR KARTE“: Leben und Kristalle aus der Sitzung, Helm von Kraxel. */
export function runAfterLevel(_run: RunState, s: GameState): RunState {
  return { lives: s.session.lives, crystals: s.session.crystals, helm: s.player.helm };
}

/** Game Over beginnt eine neue Runde. */
export function runAfterGameOver(): RunState {
  return newRun();
}
