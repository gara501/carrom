import type { Difficulty } from '@carrom/core';

/** Preferencias del jugador, guardadas en el navegador (si el almacenamiento no está disponible, solo en memoria). */
export interface Settings { music: boolean; sfx: boolean; difficulty: Difficulty; blitz: boolean }

const KEY = 'carrom:settings:v1';
const DEFAULTS: Settings = { music: true, sfx: true, difficulty: 'medium', blitz: true };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch { /* sin almacenamiento */ }
  return { ...DEFAULTS };
}

export const settings: Settings = load();

export function saveSettings(patch: Partial<Settings> = {}) {
  Object.assign(settings, patch);
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* sin almacenamiento */ }
}
