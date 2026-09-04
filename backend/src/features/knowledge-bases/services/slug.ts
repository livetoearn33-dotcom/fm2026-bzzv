/**
 * 把檔名轉成合法的 fact id 片段：小寫、非英數字元一律變成 `-`、去頭尾 `-`。
 * 檔名是中文或其他非拉丁字元時會被整段濾掉，退回 "doc"——沿用既有 fact id
 * 的命名慣例（data/facts.json 裡都是 ascii kebab-case，如 "proj-a-status"）。
 */
function slugifyFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^./]+$/, "");
  const slug = withoutExtension
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug.length > 0 ? slug : "doc";
}

/**
 * 產生 `count` 個形如 `pdf-<檔名slug>-<序號>` 的 suggestedId，且不與 `existingIds`
 * 衝突（含同一批次內部的衝突）——衝突時加後綴。`existingIds` 應該是當下 facts 表
 * 的全部 id（見 services/documents.ts 呼叫端）。
 */
export function generateSuggestedIds(fileName: string, count: number, existingIds: ReadonlySet<string>): string[] {
  const base = `pdf-${slugifyFileName(fileName)}`;
  const used = new Set(existingIds);
  const result: string[] = [];

  for (let i = 1; i <= count; i++) {
    let candidate = `${base}-${i}`;
    let bump = 1;
    while (used.has(candidate)) {
      bump += 1;
      candidate = `${base}-${i}-${bump}`;
    }
    used.add(candidate);
    result.push(candidate);
  }

  return result;
}
