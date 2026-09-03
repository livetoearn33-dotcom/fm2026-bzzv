import fs from "node:fs";
import path from "node:path";

import { ValidationError } from "@/shared/errors";

import type { Contact, Fact, KnowledgeStore } from "./types";

import { isTodoId, readJsonArray, resolveDataDir } from "./repository";
import { ContactSchema, FactSchema } from "./types";

/** PUT body 不含 id（id 取自路徑）；facts 額外允許省略 updatedAt，後端補今天日期。 */
export type ContactUpsertInput = Omit<Contact, "id">;
export type FactUpsertInput = Omit<Fact, "id" | "updatedAt"> & { updatedAt?: string };

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getEntryId(entry: unknown): string | undefined {
  if (typeof entry === "object" && entry !== null && "id" in entry) {
    const id = (entry as { id: unknown }).id;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

/** 先寫暫存檔再 rename，避免寫到一半壞檔（rename 在同一個檔案系統內是原子操作）。 */
function writeJsonArrayAtomic(filePath: string, data: unknown[]): void {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}-${Date.now()}.tmp`);
  const content = `${JSON.stringify(data, null, 2)}\n`;
  fs.writeFileSync(tmpPath, content, "utf-8");
  fs.renameSync(tmpPath, filePath);
}

/**
 * 知識庫的可寫入版本：記憶體為真源，每次寫入後 write-through 到磁碟。
 *
 * `facts`／`contacts` 是 getter（不是啟動時算好的快照），所以任何持有這個物件參考的
 * 呼叫端（/analyze、/guard 的 services）每次存取都會拿到當下最新資料——不用額外接線。
 *
 * `_TODO` 前綴的骨架筆會原樣保留在磁碟上（不會被寫入操作洗掉），只是不會出現在
 * `facts`／`contacts`／list API 裡，也不能透過 PUT／DELETE 存取（見 data/README-知識庫.md）。
 */
export class LiveKnowledgeStore implements KnowledgeStore {
  private rawFacts: unknown[];
  private rawContacts: unknown[];
  private readonly dataDir: string;

  constructor(dataDir: string = resolveDataDir()) {
    this.dataDir = dataDir;
    this.rawFacts = readJsonArray(this.factsFile);
    this.rawContacts = readJsonArray(this.contactsFile);
  }

  private get factsFile(): string {
    return path.join(this.dataDir, "facts.json");
  }

  private get contactsFile(): string {
    return path.join(this.dataDir, "contacts.json");
  }

  get facts(): Fact[] {
    return this.rawFacts
      .filter((entry) => {
        const id = getEntryId(entry);
        return id !== undefined && !isTodoId(id);
      })
      .map(entry => FactSchema.parse(entry));
  }

  get contacts(): Contact[] {
    return this.rawContacts
      .filter((entry) => {
        const id = getEntryId(entry);
        return id !== undefined && !isTodoId(id);
      })
      .map(entry => ContactSchema.parse(entry));
  }

  listFacts(): Fact[] {
    return this.facts;
  }

  listContacts(): Contact[] {
    return this.contacts;
  }

  upsertFact(id: string, body: FactUpsertInput): Fact {
    if (isTodoId(id)) {
      throw new ValidationError(`id 不可為保留前綴 _TODO：${id}`);
    }
    const updatedAt = body.updatedAt && body.updatedAt.length > 0 ? body.updatedAt : todayDateString();
    const fact = FactSchema.parse({ ...body, id, updatedAt });
    const index = this.rawFacts.findIndex(entry => getEntryId(entry) === id);
    if (index >= 0) {
      this.rawFacts[index] = fact;
    }
    else {
      this.rawFacts.push(fact);
    }
    writeJsonArrayAtomic(this.factsFile, this.rawFacts);
    return fact;
  }

  deleteFact(id: string): boolean {
    if (isTodoId(id)) {
      return false;
    }
    const index = this.rawFacts.findIndex(entry => getEntryId(entry) === id);
    if (index < 0) {
      return false;
    }
    this.rawFacts.splice(index, 1);
    writeJsonArrayAtomic(this.factsFile, this.rawFacts);
    return true;
  }

  upsertContact(id: string, body: ContactUpsertInput): Contact {
    if (isTodoId(id)) {
      throw new ValidationError(`id 不可為保留前綴 _TODO：${id}`);
    }
    const contact = ContactSchema.parse({ ...body, id });
    const index = this.rawContacts.findIndex(entry => getEntryId(entry) === id);
    if (index >= 0) {
      this.rawContacts[index] = contact;
    }
    else {
      this.rawContacts.push(contact);
    }
    writeJsonArrayAtomic(this.contactsFile, this.rawContacts);
    return contact;
  }

  deleteContact(id: string): boolean {
    if (isTodoId(id)) {
      return false;
    }
    const index = this.rawContacts.findIndex(entry => getEntryId(entry) === id);
    if (index < 0) {
      return false;
    }
    this.rawContacts.splice(index, 1);
    writeJsonArrayAtomic(this.contactsFile, this.rawContacts);
    return true;
  }
}
