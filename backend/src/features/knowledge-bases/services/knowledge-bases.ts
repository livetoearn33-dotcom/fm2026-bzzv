import type { AppError } from "@/shared/errors";
import type {
  ExtractedFactItem,
  Fact,
  KnowledgeBaseCommitItemInput,
  KnowledgeBaseDetail,
  KnowledgeBaseFile,
  KnowledgeBaseSummary,
} from "@/shared/knowledge";

import { NotFoundError, ValidationError } from "@/shared/errors";

import type { KnowledgeBaseServiceDeps } from "../domain/entities";

import {
  DocumentExtractionError,
  FileTooLargeError,
  InvalidPdfError,
  UnextractableContentError,
  UnsupportedFileTypeError,
} from "../domain/errors";
import { extractFactsFromDocument } from "./extract";
import { parsePdf, PdfParseError } from "./pdf";
import { generateSuggestedIds } from "./slug";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface CreateKnowledgeBaseResult {
  knowledgeBaseId: string;
  name: string | null;
  status: "draft";
  files: KnowledgeBaseFile[];
  extracted: boolean;
  reason: string | null;
  items: ExtractedFactItem[];
}

export interface CommitKnowledgeBaseResult {
  knowledgeBaseId: string;
  status: "committed";
  facts: Fact[];
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

export function createKnowledgeBaseServices(deps: KnowledgeBaseServiceDeps) {
  const { model, bases, knowledge, promptLayers } = deps;

  /**
   * 一次上傳 1..N 個 PDF 建立知識庫（contract 的 POST /v1/knowledge-bases）。
   * 「跳過壞檔繼續」：單一檔案非 PDF／毀損／無文字／過大／LLM 失敗時，只把那個檔
   * 標成 failed 收進 files[]，其餘檔照抽；全部檔案都失敗才讓整個 create 失敗
   * （以第一個檔的錯誤類別決定狀態碼），並把知識庫標成 failed 留紀錄。
   */
  async function createKnowledgeBase(files: File[], name?: string): Promise<CreateKnowledgeBaseResult> {
    if (files.length === 0) {
      throw new ValidationError("至少要上傳一個 PDF 檔案");
    }

    const base = await bases.createBase(name);
    const resultFiles: KnowledgeBaseFile[] = [];
    const mergedItems: ExtractedFactItem[] = [];
    const noFactReasons: string[] = [];
    const fileErrors: AppError[] = [];
    let extractedAnything = false;

    const existingIds = new Set((await knowledge.listFacts()).map(fact => fact.id));

    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const document = await bases.addDocument(base.id, {
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        byteSize: bytes.byteLength,
      });
      const fileEntry: KnowledgeBaseFile = {
        id: document.id,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        byteSize: bytes.byteLength,
        pageCount: null,
        status: "parsing",
        errorReason: null,
      };
      resultFiles.push(fileEntry);

      const fail = async (error: AppError) => {
        await bases.markDocumentFailed(document.id, error.message, fileEntry.pageCount ?? undefined);
        fileEntry.status = "failed";
        fileEntry.errorReason = error.message;
        fileErrors.push(error);
      };

      if (!isPdfFile(file)) {
        await fail(new UnsupportedFileTypeError(`只接受 PDF 檔案，收到：${file.type || "未知格式"}`));
        continue;
      }
      if (bytes.byteLength > MAX_FILE_BYTES) {
        await fail(new FileTooLargeError(`檔案超過 10MB 上限：${file.name}`));
        continue;
      }

      let parsed;
      try {
        parsed = await parsePdf(bytes);
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // PdfParseError＝讀不出 PDF 結構（毀損檔／假 PDF）→ 400；讀得到結構但沒文字→ 422
        await fail(error instanceof PdfParseError
          ? new InvalidPdfError(`PDF 檔案讀取失敗：${file.name}（${message}）`)
          : new UnextractableContentError(message));
        continue;
      }
      fileEntry.pageCount = parsed.pageCount;

      if (parsed.text.length === 0) {
        await fail(new UnextractableContentError(`${file.name} 讀不到可抽取的文字內容，可能是掃描檔或純圖片`));
        continue;
      }

      let llmOutput;
      try {
        llmOutput = await extractFactsFromDocument(model, promptLayers, {
          fileName: file.name,
          text: parsed.text,
        });
      }
      catch (error) {
        await fail(error instanceof DocumentExtractionError
          ? error
          : new DocumentExtractionError(error instanceof Error ? error.message : String(error)));
        continue;
      }

      if (!llmOutput.extracted) {
        await bases.markDocumentExtracted(document.id, parsed.pageCount, {
          extracted: false,
          reason: llmOutput.reason,
        });
        fileEntry.status = "extracted";
        noFactReasons.push(llmOutput.reason);
        extractedAnything = true;
        continue;
      }

      const suggestedIds = generateSuggestedIds(file.name, llmOutput.items.length, existingIds);
      suggestedIds.forEach(id => existingIds.add(id));
      const items: ExtractedFactItem[] = llmOutput.items.map((item, index) => ({
        suggestedId: suggestedIds[index],
        label: item.label,
        content: item.content,
        tags: item.tags,
        volatility: item.volatility,
        usage: item.usage,
      }));

      await bases.markDocumentExtracted(document.id, parsed.pageCount, { extracted: true, items });
      fileEntry.status = "extracted";
      mergedItems.push(...items);
      extractedAnything = true;
    }

    if (!extractedAnything) {
      const reason = fileErrors.map(error => error.message).join("；");
      await bases.finalizeBase(base.id, "failed", reason);
      // 全部檔案都失敗：整個 create 失敗，以第一個檔的錯誤類別決定狀態碼（415/413/400/422/502）
      throw fileErrors[0];
    }

    await bases.finalizeBase(base.id, "draft");

    const extracted = mergedItems.length > 0;
    return {
      knowledgeBaseId: base.id,
      name: name ?? null,
      status: "draft",
      files: resultFiles,
      extracted,
      reason: extracted ? null : (noFactReasons.join("；") || null),
      items: mergedItems,
    };
  }

  async function listKnowledgeBases(): Promise<KnowledgeBaseSummary[]> {
    return bases.list();
  }

  async function getKnowledgeBase(id: string): Promise<KnowledgeBaseDetail | undefined> {
    return bases.getById(id);
  }

  async function commitKnowledgeBase(id: string, items: KnowledgeBaseCommitItemInput[]): Promise<CommitKnowledgeBaseResult> {
    const existing = await bases.getById(id);
    if (!existing) {
      throw new NotFoundError(`知識庫：${id}`);
    }
    const facts = await bases.commit(id, items);
    return { knowledgeBaseId: id, status: "committed", facts };
  }

  async function deleteKnowledgeBase(id: string): Promise<boolean> {
    return bases.remove(id);
  }

  return { createKnowledgeBase, listKnowledgeBases, getKnowledgeBase, commitKnowledgeBase, deleteKnowledgeBase };
}

export type KnowledgeBaseServices = ReturnType<typeof createKnowledgeBaseServices>;
