import type {
  DocumentCommitItemInput,
  ExtractedFactItem,
  Fact,
  KnowledgeDocumentDetail,
  KnowledgeDocumentSummary,
} from "@/shared/knowledge";

import { NotFoundError } from "@/shared/errors";

import type { DocumentServiceDeps } from "../domain/entities";

import { DocumentExtractionError, InvalidPdfError, UnextractableContentError, UnsupportedFileTypeError } from "../domain/errors";
import { extractFactsFromDocument } from "./extract";
import { parsePdf, PdfParseError } from "./pdf";
import { generateSuggestedIds } from "./slug";

export interface UploadDocumentResult {
  documentId: string;
  status: "extracted";
  items: ExtractedFactItem[];
  extracted: boolean;
  reason?: string;
}

/**
 * 判斷是不是 PDF：MIME type 是 application/pdf，或副檔名是 .pdf，兩者其一即接受。
 * 副檔名是額外的接受路徑，不是「沒有 MIME 時才退回」的 fallback——Android／OkHttp
 * 常見送 `application/octet-stream`（file.type 有值但不是 application/pdf），若副檔名
 * 只在「完全沒有 Content-Type」時才可達，合法 .pdf 上傳會被誤擋成 415。
 */
function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf") {
    return true;
  }
  return file.name.toLowerCase().endsWith(".pdf");
}

export function createDocumentServices(deps: DocumentServiceDeps) {
  const { model, documents, knowledge, promptLayers } = deps;

  async function uploadDocument(file: File): Promise<UploadDocumentResult> {
    if (!isPdfFile(file)) {
      throw new UnsupportedFileTypeError(`只接受 PDF 檔案，收到：${file.type || "未知格式"}`);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // 415/413 都在建立 document 列之前擋掉（413 由 bodyLimit middleware 處理，見 api/routes.ts）；
    // 過了這裡才算「有一次上傳嘗試」，值得留紀錄——即使後面解析失敗也一樣（status: failed）。
    const documentSummary = await documents.create({
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      byteSize: bytes.byteLength,
    });

    let parsed;
    try {
      parsed = await parsePdf(bytes);
    }
    catch (error) {
      const message = error instanceof PdfParseError || error instanceof Error ? error.message : String(error);
      await documents.markFailed(documentSummary.id, message);
      // PdfParseError＝getDocumentProxy 讀不出 PDF 結構（毀損檔、或副檔名是 .pdf 但內容
      // 不是 PDF）——400，跟「讀得到結構但沒有文字（掃描檔／純圖）」的 422 分開，
      // 避免誤導使用者去檢查一份根本不是 PDF 的檔案是不是掃描檔。
      if (error instanceof PdfParseError) {
        throw new InvalidPdfError(message);
      }
      throw new UnextractableContentError(message);
    }

    if (parsed.text.length === 0) {
      const reason = "這份 PDF 讀不到可抽取的文字內容，可能是掃描檔或純圖片";
      await documents.markFailed(documentSummary.id, reason, parsed.pageCount);
      throw new UnextractableContentError(reason);
    }

    let llmOutput;
    try {
      llmOutput = await extractFactsFromDocument(model, promptLayers, {
        fileName: file.name,
        text: parsed.text,
      });
    }
    catch (error) {
      if (error instanceof DocumentExtractionError) {
        await documents.markFailed(documentSummary.id, error.message, parsed.pageCount);
      }
      throw error;
    }

    if (!llmOutput.extracted) {
      await documents.markExtracted(documentSummary.id, parsed.pageCount, {
        extracted: false,
        reason: llmOutput.reason,
      });
      return {
        documentId: documentSummary.id,
        status: "extracted",
        items: [],
        extracted: false,
        reason: llmOutput.reason,
      };
    }

    const existingIds = new Set((await knowledge.listFacts()).map(fact => fact.id));
    const suggestedIds = generateSuggestedIds(file.name, llmOutput.items.length, existingIds);
    const items: ExtractedFactItem[] = llmOutput.items.map((item, index) => ({
      suggestedId: suggestedIds[index],
      label: item.label,
      content: item.content,
      tags: item.tags,
      volatility: item.volatility,
      usage: item.usage,
    }));

    await documents.markExtracted(documentSummary.id, parsed.pageCount, { extracted: true, items });

    return {
      documentId: documentSummary.id,
      status: "extracted",
      items,
      extracted: true,
    };
  }

  async function listDocuments(): Promise<KnowledgeDocumentSummary[]> {
    return documents.list();
  }

  async function getDocument(id: string): Promise<KnowledgeDocumentDetail | undefined> {
    return documents.getById(id);
  }

  async function commitDocument(id: string, items: DocumentCommitItemInput[]): Promise<Fact[]> {
    const existing = await documents.getById(id);
    if (!existing) {
      throw new NotFoundError(`知識文件：${id}`);
    }
    return documents.commit(id, items);
  }

  async function deleteDocument(id: string): Promise<boolean> {
    return documents.remove(id);
  }

  return { uploadDocument, listDocuments, getDocument, commitDocument, deleteDocument };
}

export type DocumentServices = ReturnType<typeof createDocumentServices>;
