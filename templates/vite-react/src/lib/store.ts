import { useSyncExternalStore } from "react";
import { blueprint } from "../generated/blueprint";
import { seed } from "../generated/seed";
import type { Row } from "./types";
import { uid } from "./utils";

/**
 * Frontend-only data layer. State lives in memory and is mirrored to localStorage.
 * To use a real backend, replace `persistence` below (see AGENTS.md) or call your API from the service stubs.
 */

type State = Record<string, Row[]>;
export interface ActivityItem { id: string; at: string; text: string }

function schemaSignature(): string {
  const s = blueprint.modules
    .flatMap((m) => m.entities.map((e) => `${e.key}:${e.fields.map((f) => f.key + f.type).join(",")}`))
    .join("|");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const KEY = `rcrm:${blueprint.slug}:${schemaSignature()}`;
const EMPTY: Row[] = [];
const EMPTY_ACTIVITY: ActivityItem[] = [];

export const persistence = {
  load(): { state: State; activity: ActivityItem[] } | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  save(snapshot: { state: State; activity: ActivityItem[] }): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot));
    } catch {
      /* private mode or quota: keep working in memory */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};

const initial = persistence.load();
let state: State = initial?.state ?? (structuredClone(seed) as State);
let activity: ActivityItem[] = initial?.activity ?? EMPTY_ACTIVITY;
const listeners = new Set<() => void>();

function commit() {
  persistence.save({ state, activity });
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const store = {
  get(entity: string): Row[] {
    return state[entity] ?? EMPTY;
  },
  insert(entity: string, row: Omit<Row, "id"> & { id?: string }): Row {
    const full = { ...row, id: row.id ?? uid(entity) } as Row;
    state = { ...state, [entity]: [full, ...(state[entity] ?? [])] };
    commit();
    return full;
  },
  update(entity: string, id: string, patch: Partial<Row>): void {
    state = { ...state, [entity]: (state[entity] ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)) };
    commit();
  },
  remove(entity: string, id: string): void {
    state = { ...state, [entity]: (state[entity] ?? []).filter((r) => r.id !== id) };
    commit();
  },
  log(text: string): void {
    activity = [{ id: uid("act"), at: new Date().toISOString(), text }, ...activity].slice(0, 40);
    commit();
  },
  reset(): void {
    persistence.clear();
    state = structuredClone(seed) as State;
    activity = EMPTY_ACTIVITY;
    commit();
  },
  exportAll(): string {
    return JSON.stringify(state, null, 2);
  },
};

export function useRows(entity: string): Row[] {
  return useSyncExternalStore(subscribe, () => state[entity] ?? EMPTY);
}
export function useActivity(): ActivityItem[] {
  return useSyncExternalStore(subscribe, () => activity);
}
