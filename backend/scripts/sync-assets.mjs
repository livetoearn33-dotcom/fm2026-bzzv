#!/usr/bin/env node
// 把 repo 根目錄的 data/、prompts/ 同步進 backend/assets/。
//
// 為什麼需要這份 assets 副本（且要 commit 進 git）：
// Zeabur 用根目錄 Dockerfile，但 build context 有時只給 backend/ 子目錄，
// 這種情況下 ../data、../prompts 在 build 階段完全拿不到。這份副本讓
// backend/ 自己就是一個能獨立 build 的單位。
//
// 用法：pnpm sync:assets（改了 data/ 或 prompts/ 之後要重新跑一次並 commit）。
// 純 Node、無外部依賴，故意不用任何套件。

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendRoot, "..");

const sourceDataDir = path.join(repoRoot, "data");
const sourcePromptsDir = path.join(repoRoot, "prompts");
const targetDataDir = path.join(backendRoot, "assets", "data");
const targetPromptsDir = path.join(backendRoot, "assets", "prompts");

const DATA_FILES = ["facts.json", "contacts.json"];

function resetDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function copyFile(srcPath, destPath) {
  writeFileSync(destPath, readFileSync(srcPath));
}

function syncData() {
  if (!existsSync(sourceDataDir)) {
    console.log(`[sync-assets] 找不到 ${sourceDataDir}，略過 data 同步`);
    return;
  }
  resetDir(targetDataDir);
  for (const filename of DATA_FILES) {
    const src = path.join(sourceDataDir, filename);
    if (!existsSync(src)) {
      throw new Error(`[sync-assets] 缺少必要檔案：${src}`);
    }
    copyFile(src, path.join(targetDataDir, filename));
    console.log(`[sync-assets] data/${filename} -> assets/data/${filename}`);
  }
}

function syncPrompts() {
  if (!existsSync(sourcePromptsDir)) {
    console.log(`[sync-assets] 找不到 ${sourcePromptsDir}，略過 prompts 同步`);
    return;
  }
  resetDir(targetPromptsDir);
  const mdFiles = readdirSync(sourcePromptsDir).filter(name => name.endsWith(".md"));
  for (const filename of mdFiles) {
    copyFile(path.join(sourcePromptsDir, filename), path.join(targetPromptsDir, filename));
    console.log(`[sync-assets] prompts/${filename} -> assets/prompts/${filename}`);
  }
}

syncData();
syncPrompts();
console.log("[sync-assets] 完成");
