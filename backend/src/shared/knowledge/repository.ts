import fs from "node:fs";
import path from "node:path";

import env from "@/env";

import type { Contact, Fact, KnowledgeStore } from "./types";

import { ContactSchema, FactSchema } from "./types";

/**
 * `_TODO` 前綴＝等 Zeno 補真實資料的骨架筆，粗篩時要跳過。
 * 見 data/README-知識庫.md「目前狀態」段。
 */
export function isTodoId(id: string): boolean {
  return id.startsWith("_TODO");
}

export function resolveDataDir(): string {
  return env.DATA_DIR ?? path.resolve(process.cwd(), "../data");
}

export function readJsonArray(filePath: string): unknown[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new TypeError(`預期 ${filePath} 是 JSON 陣列`);
  }
  return parsed;
}

export function loadFacts(dataDir: string = resolveDataDir()): Fact[] {
  const raw = readJsonArray(path.join(dataDir, "facts.json"));
  return raw
    .filter((entry): entry is { id: string } =>
      typeof entry === "object" && entry !== null && "id" in entry && !isTodoId(String((entry as { id: unknown }).id)))
    .map(entry => FactSchema.parse(entry));
}

export function loadContacts(dataDir: string = resolveDataDir()): Contact[] {
  const raw = readJsonArray(path.join(dataDir, "contacts.json"));
  return raw
    .filter((entry): entry is { id: string } =>
      typeof entry === "object" && entry !== null && "id" in entry && !isTodoId(String((entry as { id: unknown }).id)))
    .map(entry => ContactSchema.parse(entry));
}

export function loadKnowledgeStore(dataDir: string = resolveDataDir()): KnowledgeStore {
  return {
    facts: loadFacts(dataDir),
    contacts: loadContacts(dataDir),
  };
}
