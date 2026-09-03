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

/**
 * 沒設 DATA_DIR 時的預設順序：先找 repo 根目錄的 `../data`（本機開發、
 * build context 是 repo 根目錄時都在），不存在再退回 `assets/data`
 * （build context 只有 backend/ 時的副本，見 scripts/sync-assets.mjs）。
 */
export function resolveDataDir(): string {
  if (env.DATA_DIR) {
    return env.DATA_DIR;
  }
  const repoRootDataDir = path.resolve(process.cwd(), "../data");
  if (fs.existsSync(repoRootDataDir)) {
    return repoRootDataDir;
  }
  return path.resolve(process.cwd(), "assets/data");
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
