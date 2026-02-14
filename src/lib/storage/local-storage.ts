// ============================================================
// LocalStorage Repository — client-side persistence
// ============================================================

"use client";

import { Repository } from "./repository";
import {
  StorageSchema,
  CURRENT_SCHEMA_VERSION,
  Campaign,
  Session,
  Character,
  MemoryEntry,
  NarrationEntry,
} from "@/types";

const STORAGE_KEY = "rpg-narrator-data";

// ---- Schema helpers ----

function getStorage(): StorageSchema {
  if (typeof window === "undefined") {
    return emptySchema();
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initStorage();

  const parsed: StorageSchema = JSON.parse(raw);
  if (parsed.version < CURRENT_SCHEMA_VERSION) {
    return migrateSchema(parsed);
  }
  return parsed;
}

function saveStorage(data: StorageSchema): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function emptySchema(): StorageSchema {
  return {
    version: CURRENT_SCHEMA_VERSION,
    campaigns: [],
    sessions: [],
    characters: [],
    memories: [],
    narrations: [],
  };
}

function initStorage(): StorageSchema {
  const schema = emptySchema();
  saveStorage(schema);
  return schema;
}

function migrateSchema(old: StorageSchema): StorageSchema {
  const migrated = { ...old } as StorageSchema;

  // v1 → v2: add narrations array
  if (old.version < 2) {
    if (!migrated.narrations) {
      migrated.narrations = [];
    }
  }

  migrated.version = CURRENT_SCHEMA_VERSION;
  saveStorage(migrated);
  return migrated;
}

function generateId(): string {
  return crypto.randomUUID();
}

// ---- Generic local repository factory ----

type CollectionKey = "campaigns" | "sessions" | "characters" | "memories" | "narrations";

function createLocalRepo<T extends { id: string; createdAt: string }>(
  collectionKey: CollectionKey
): Repository<T> {
  return {
    async getAll(filter?: Partial<T>): Promise<T[]> {
      const data = getStorage();
      let items = data[collectionKey] as unknown as T[];
      if (filter) {
        items = items.filter((item) =>
          Object.entries(filter).every(
            ([key, value]) => (item as Record<string, unknown>)[key] === value
          )
        );
      }
      return items;
    },

    async getById(id: string): Promise<T | null> {
      const data = getStorage();
      const items = data[collectionKey] as unknown as T[];
      return items.find((i) => i.id === id) ?? null;
    },

    async create(input: Omit<T, "id" | "createdAt">): Promise<T> {
      const data = getStorage();
      const item = {
        ...input,
        id: generateId(),
        createdAt: new Date().toISOString(),
      } as unknown as T;
      (data[collectionKey] as unknown as T[]).push(item);
      saveStorage(data);
      return item;
    },

    async update(id: string, updates: Partial<T>): Promise<T> {
      const data = getStorage();
      const items = data[collectionKey] as unknown as T[];
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) throw new Error(`Item ${id} not found in ${collectionKey}`);
      items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() } as T;
      saveStorage(data);
      return items[idx];
    },

    async delete(id: string): Promise<void> {
      const data = getStorage();
      const items = data[collectionKey] as unknown as T[];
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) return;
      items.splice(idx, 1);
      saveStorage(data);
    },
  };
}

// ---- Exported repositories ----

export const campaignRepo = createLocalRepo<Campaign>("campaigns");
export const sessionRepo = createLocalRepo<Session>("sessions");
export const characterRepo = createLocalRepo<Character>("characters");
export const memoryRepo = createLocalRepo<MemoryEntry>("memories");
export const narrationRepo = createLocalRepo<NarrationEntry>("narrations");
