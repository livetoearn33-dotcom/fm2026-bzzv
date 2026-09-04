import * as HttpStatusCodes from "stoker/http-status-codes";

import { AppError } from "@/shared/errors";

/** 上傳的檔案不是 PDF——415。多檔上傳時單一壞檔只標 failed 跳過；全部都壞才丟這個錯。 */
export class UnsupportedFileTypeError extends AppError {
  constructor(message = "只接受 PDF 檔案") {
    super(message, "UNSUPPORTED_FILE_TYPE", HttpStatusCodes.UNSUPPORTED_MEDIA_TYPE);
  }
}

/** 單一 PDF 超過大小上限——413。多檔時同樣是跳過壞檔語意。 */
export class FileTooLargeError extends AppError {
  constructor(message = "檔案超過 10MB 上限") {
    super(message, "FILE_TOO_LARGE", HttpStatusCodes.REQUEST_TOO_LONG);
  }
}

/**
 * 檔名／MIME 看起來是 PDF，但內容根本解析不出來（毀損檔、或副檔名為 .pdf 但內容不是
 * PDF）——400，不是 415（client 宣稱的類型沒錯，是內容本身有問題）也不是 422（422 專指
 * 「讀得到 PDF 結構但抽不出文字」，語意上是掃描檔／純圖，跟這裡截然不同，見
 * services/documents.ts 的 uploadDocument）。document 一樣標記為 failed。
 */
export class InvalidPdfError extends AppError {
  constructor(message: string) {
    super(message, "INVALID_PDF", HttpStatusCodes.BAD_REQUEST);
  }
}

/** PDF 讀不到任何文字（掃描檔／純圖）——422，document 會被標記 failed。 */
export class UnextractableContentError extends AppError {
  constructor(message = "這份 PDF 讀不到可抽取的文字內容，可能是掃描檔或純圖片") {
    super(message, "UNEXTRACTABLE_CONTENT", HttpStatusCodes.UNPROCESSABLE_ENTITY);
  }
}

/** LLM 呼叫失敗、或重試後仍回傳不符 schema 的內容——回 502，不靜默回假資料。 */
export class DocumentExtractionError extends AppError {
  constructor(message: string) {
    super(message, "DOCUMENT_EXTRACTION_FAILED", HttpStatusCodes.BAD_GATEWAY);
  }
}
