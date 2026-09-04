import { extractText, getDocumentProxy } from "unpdf";

export interface ParsedPdf {
  text: string;
  pageCount: number;
}

/** getDocumentProxy 對非 PDF／損毀檔案丟出的錯誤，統一包一層方便呼叫端判斷。 */
export class PdfParseError extends Error {}

/**
 * 解析 PDF 二進位內容，回傳全文（合併所有頁）與頁數。
 * 用 unpdf（純 ESM、無 Node 專屬依賴，PDF.js 的 serverless 打包版）——
 * 不用 pdf-parse，它是 CJS 在本專案的 "type":"module" 環境會卡。
 */
export async function parsePdf(bytes: Uint8Array): Promise<ParsedPdf> {
  let pdf;
  try {
    pdf = await getDocumentProxy(bytes);
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PdfParseError(`PDF 檔案讀取失敗：${message}`);
  }

  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text: text.trim(), pageCount: totalPages };
}
