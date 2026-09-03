/**
 * 截圖模式的 base64 正規化。前端形式不只一種：
 * - Android app（EQAccessibilityService.kt）送裸 base64，mime type 另外用欄位帶
 * - 網頁前端常見送完整 data URL（data:image/png;base64,...）
 * 這裡統一轉成 { data, mediaType } 給 services/analyze.ts 組 image content part 用。
 */

const DATA_URL_PATTERN = /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,([\s\S]+)$/;

const DEFAULT_MEDIA_TYPE = "image/png";

export interface NormalizedScreenshot {
  /** 純 base64 字串，不含 data: 前綴 */
  data: string;
  mediaType: string;
}

/**
 * mimeTypeHint（request 的 screenshotMimeType）優先於 data URL 裡帶的 mime type，
 * 因為那是呼叫端明確指定的；都沒有時退回 image/png。
 */
export function normalizeScreenshot(screenshot: string, mimeTypeHint?: string): NormalizedScreenshot {
  const trimmed = screenshot.trim();
  const match = DATA_URL_PATTERN.exec(trimmed);

  if (match) {
    const [, mediaTypeFromUrl, base64] = match;
    return { data: base64, mediaType: mimeTypeHint ?? mediaTypeFromUrl };
  }

  return { data: trimmed, mediaType: mimeTypeHint ?? DEFAULT_MEDIA_TYPE };
}
