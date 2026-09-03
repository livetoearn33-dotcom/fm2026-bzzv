import { describe, expect, it } from "vitest";

import { loadContacts, loadFacts, loadKnowledgeStore } from "./repository";

describe("loadFacts", () => {
  it("讀到 data/facts.json 的真實筆數且過濾 _TODO 前綴", () => {
    const facts = loadFacts();
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.some(fact => fact.id.startsWith("_TODO"))).toBe(false);
    expect(facts.map(fact => fact.id)).toContain("proj-a-status");
  });

  it("internal 事實的 usage 欄位正確解析", () => {
    const facts = loadFacts();
    const internalFact = facts.find(fact => fact.id === "quote-floor-internal");
    expect(internalFact?.usage).toBe("internal");
  });
});

describe("loadContacts", () => {
  it("讀到 data/contacts.json 的真實筆數且過濾 _TODO 前綴", () => {
    const contacts = loadContacts();
    expect(contacts.length).toBeGreaterThan(0);
    expect(contacts.some(contact => contact.id.startsWith("_TODO"))).toBe(false);
    expect(contacts.map(contact => contact.id)).toContain("boss-lin");
  });
});

describe("loadKnowledgeStore", () => {
  it("同時載入 facts 與 contacts", () => {
    const store = loadKnowledgeStore();
    expect(store.facts.length).toBeGreaterThan(0);
    expect(store.contacts.length).toBeGreaterThan(0);
  });
});
