// Gemeinsame Typen der Spiellogik. Kein Phaser, kein DOM.
import type { ExitKind } from './save.ts';

export const Cell = { Empty: 0, Ground: 1, Rock: 2, Crate: 3, CrateUsed: 4, HiddenCrate: 5, LeafPad: 6 } as const;
export type Cell = (typeof Cell)[keyof typeof Cell];

export interface Held { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean; action: boolean }
export interface InputFrame extends Held { jumpPressed: boolean; jumpReleased: boolean; downPressed: boolean; actionPressed: boolean }

export interface Rect { x: number; y: number; w: number; h: number }
export interface Body extends Rect { vx: number; vy: number }

export type ItemKind = 'helm' | 'sling' | 'enzian';
/** Das Spezial-Item, das Kraxel trägt (höchstens eins). */
export type SpecialItem = 'sling';
export type CrateContent = { kind: 'crystal' } | { kind: 'multi' } | { kind: 'item'; item: ItemKind };

export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void }

export type GameEvent =
  | { type: 'jump' } | { type: 'wallJump' } | { type: 'land' }
  | { type: 'pound' } | { type: 'poundLand'; x: number; y: number }
  | { type: 'bump'; cx: number; cy: number } | { type: 'bounce'; cx: number; cy: number } | { type: 'crateOpen'; cx: number; cy: number }
  | { type: 'rockBreak'; cx: number; cy: number }
  | { type: 'crystal'; x: number; y: number; fromCrate: boolean }
  | { type: 'itemSpawn'; item: ItemKind; cx: number; cy: number } | { type: 'powerUp'; item: ItemKind }
  | { type: 'stomp'; x: number; y: number } | { type: 'enemyDefeated'; x: number; y: number }
  | { type: 'shoot' } | { type: 'pebblePop'; x: number; y: number }
  | { type: 'enzianStart' } | { type: 'enzianEnd' }
  | { type: 'hurt' } | { type: 'death' } | { type: 'respawn' } | { type: 'gameOver' }
  | { type: 'checkpoint'; index: number } | { type: 'edelweiss'; index: number }
  | { type: 'extraLife' } | { type: 'goal'; bonusCrystals: number; extraLife: boolean; exit: ExitKind };
