import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * assets/ 是 ../data、../prompts 的部署用副本（見 scripts/sync-assets.mjs）。
 * 這份測試只在本機／CI（build context 是 repo 根目錄，能看到 ../data、
 * ../prompts）才有意義；容器內只有 backend/ 子目錄時來源不存在，直接 skip。
 */

const backendRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(backendRoot, "..");

const sourceDataDir = path.join(repoRoot, "data");
const sourcePromptsDir = path.join(repoRoot, "prompts");
const targetDataDir = path.join(backendRoot, "assets", "data");
const targetPromptsDir = path.join(backendRoot, "assets", "prompts");

const sourcesExist = fs.existsSync(sourceDataDir) && fs.existsSync(sourcePromptsDir);
const describeIfSources = sourcesExist ? describe : describe.skip;

function readMdFilenames(dir: string): string[] {
  return fs.readdirSync(dir).filter(name => name.endsWith(".md"));
}

describeIfSources("assets/ 與來源同步（跑 pnpm sync:assets 保持一致）", () => {
  it("assets/data 逐檔內容與 data/ 完全相同", () => {
    for (const filename of ["facts.json", "contacts.json"]) {
      const sourceContent = fs.readFileSync(path.join(sourceDataDir, filename), "utf-8");
      const targetPath = path.join(targetDataDir, filename);
      expect(fs.existsSync(targetPath), `assets/data/${filename} 不存在，請執行 pnpm sync:assets`).toBe(true);
      const targetContent = fs.readFileSync(targetPath, "utf-8");
      expect(targetContent, `assets/data/${filename} 與 data/${filename} 不同，請執行 pnpm sync:assets`).toBe(sourceContent);
    }
  });

  it("assets/prompts 逐檔內容與 prompts/ 完全相同（含檔名清單一致）", () => {
    const sourceFilenames = readMdFilenames(sourcePromptsDir).sort();
    const targetFilenames = fs.existsSync(targetPromptsDir) ? readMdFilenames(targetPromptsDir).sort() : [];
    expect(targetFilenames, "assets/prompts 檔名清單與 prompts/ 不同，請執行 pnpm sync:assets").toEqual(sourceFilenames);

    for (const filename of sourceFilenames) {
      const sourceContent = fs.readFileSync(path.join(sourcePromptsDir, filename), "utf-8");
      const targetContent = fs.readFileSync(path.join(targetPromptsDir, filename), "utf-8");
      expect(targetContent, `assets/prompts/${filename} 與 prompts/${filename} 不同，請執行 pnpm sync:assets`).toBe(sourceContent);
    }
  });
});

describe("根目錄 Dockerfile 與 backend/Dockerfile 內容一致", () => {
  it("兩份 Dockerfile 完全相同", () => {
    const rootDockerfile = path.join(repoRoot, "Dockerfile");
    const backendDockerfile = path.join(backendRoot, "Dockerfile");
    expect(fs.existsSync(rootDockerfile), "找不到根目錄 Dockerfile").toBe(true);
    expect(fs.existsSync(backendDockerfile), "找不到 backend/Dockerfile").toBe(true);
    expect(fs.readFileSync(backendDockerfile, "utf-8")).toBe(fs.readFileSync(rootDockerfile, "utf-8"));
  });
});
