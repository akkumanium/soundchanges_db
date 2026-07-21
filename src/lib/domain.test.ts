import { describe, expect, it } from "vitest";
import { composeRule, isWiktionaryUrl, normalizeUnicode, slugify } from "./domain";

describe("sound-change domain", () => {
  it("composes the conventional rule without losing IPA", () => {
    expect(composeRule("k", "tʃ", "_ {i, e}", "sporadically")).toBe("k > tʃ / _ {i, e} (sporadically)");
  });

  it("uses compact exception notation", () => {
    expect(composeRule("p", "f", "V_V", "", "loanwords")).toBe("p > f / V_V / ! loanwords");
  });

  it("normalizes combining sequences to NFC", () => {
    expect(normalizeUnicode("e\u0301")).toBe("é");
  });

  it("retains meaningful IPA diacritics", () => {
    expect(normalizeUnicode("kʷ > k")).toContain("ʷ");
  });

  it("accepts only secure Wiktionary links", () => {
    expect(isWiktionaryUrl("https://en.wiktionary.org/wiki/word")).toBe(true);
    expect(isWiktionaryUrl("http://en.wiktionary.org/wiki/word")).toBe(false);
    expect(isWiktionaryUrl("https://wiktionary.org.example.com/word")).toBe(false);
  });

  it("creates restrained URL slugs", () => {
    expect(slugify("Proto-Slavic to Russian")).toBe("proto-slavic-to-russian");
  });
});
