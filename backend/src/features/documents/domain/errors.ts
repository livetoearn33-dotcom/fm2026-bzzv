import * as HttpStatusCodes from "stoker/http-status-codes";

import { AppError } from "@/shared/errors";

/** 上傳的檔案不是 PDF——415，不建立 document 列（見 services/documents.ts）。 */
export class UnsupportedFileTypeError extends AppError {
  constructor(message = "只接受 PDF 檔案") {
    super(message, "UNSUPPORTED_FILE_TYPE", HttpStatusCodes.UNSUPPORTED_MEDIA_TYPE);
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
