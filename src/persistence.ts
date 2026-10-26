import Dexie, { type Table } from "dexie";
import type { Work, Runtime } from "./schema";
class Database extends Dexie {
  works!: Table<Work, string>;
  saves!: Table<{ id: string; state: Runtime; savedAt?: number }, string>;
  constructor() {
    super("foundphone-studio");
    this.version(1).stores({ works: "id,updatedAt", saves: "id" });
  }
}
export const db = new Database();

const mirrorKey = (id: string) => `foundphone-runtime:${id}`;

export function readRuntimeMirror(id: string) {
  try {
    const raw = localStorage.getItem(mirrorKey(id));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !("savedAt" in value) ||
      typeof value.savedAt !== "number" ||
      !("state" in value) ||
      !value.state ||
      typeof value.state !== "object" ||
      !("workId" in value.state) ||
      value.state.workId !== id
    )
      return null;
    return value as { savedAt: number; state: Runtime };
  } catch {
    return null;
  }
}

export function writeRuntimeMirror(id: string, state: Runtime) {
  const savedAt = Date.now();
  try {
    localStorage.setItem(mirrorKey(id), JSON.stringify({ savedAt, state }));
  } catch {
    // IndexedDB remains the primary save if local storage is unavailable.
  }
  return savedAt;
}
