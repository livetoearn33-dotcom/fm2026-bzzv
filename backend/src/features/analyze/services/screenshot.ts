/**
 * 截圖模式的 base64 正規化。前端形式不只一種：
 * - Android app（EQAccessibilityService.kt）送裸 base64，mime type 另外用欄位帶
 * - 網頁前端常見送完整 data URL（data:image/png;base64,...）
 * 這裡統一轉成 { data, mediaType } 給 services/analyze.ts 組 image content part 用。
 */

import { InvalidScreenshotError } from "../domain/errors";

const DATA_URL_PATTERN = /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,([\s\S]+)$/;

const DEFAULT_MEDIA_TYPE = "image/png";

export interface NormalizedScreenshot {
  /** 純 base64 字串，不含 data: 前綴 */
  data: string;
  mediaType: string;
}

/**
 * mimeTypeHint（request 的 screenshotMimeType）優先於 data URL 裡帶的 mime type，
 * 因為那是呼叫端明確指定的；都沒有時退回 image/png。用 `||` 而非 `??`：schema 已加
 * `.min(1)` 擋空字串，這裡再擋一層，兩邊都不信任對方單獨擋得住（見 validation/analyze.schema.ts）。
 */
export function normalizeScreenshot(screenshot: string, mimeTypeHint?: string): NormalizedScreenshot {
  const trimmed = screenshot.trim();

  // `data:` 開頭但格式不符（例如帶了 DATA_URL_PATTERN 沒預期到的參數，如 `;name=`）
  // 一律拒絕，不要落到下面當成裸 base64——那樣 `data` 會整段帶著 "data:...;base64," 前綴，
  // 送到上游 provider 必定被拒（400），重試兩次後才變成誤導的 502。
  if (trimmed.startsWith("data:")) {
    const match = DATA_URL_PATTERN.exec(trimmed);
    if (!match) {
      throw new InvalidScreenshotError(
        "screenshot 是 data URL 格式但無法解析，僅支援 data:<mime>[;charset=...];base64,<data>",
      );
    }
    const [, mediaTypeFromUrl, base64] = match;
    return { data: base64, mediaType: mimeTypeHint || mediaTypeFromUrl };
  }

  return { data: trimmed, mediaType: mimeTypeHint || DEFAULT_MEDIA_TYPE };
}
