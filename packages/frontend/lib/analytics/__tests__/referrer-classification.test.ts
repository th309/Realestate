/**
 * Cases are drawn from referrer domains actually observed in production
 * (90-day window), so this pins the classifier against real traffic rather
 * than invented hostnames.
 */

import { describe, it, expect } from "vitest";
import {
  classifyReferrer,
  isInternalHost,
  referrerHostname,
} from "../referrer-classification";

describe("classifyReferrer separates AI assistants from organic search", () => {
  it.each([
    "https://chatgpt.com/",
    "https://claude.ai/chat/abc",
    "https://www.perplexity.ai/search?q=best+markets",
    "https://copilot.microsoft.com/",
    "https://duck.ai/",
  ])("classifies %s as ai", (referrer) => {
    expect(classifyReferrer(referrer).channel).toBe("ai");
  });

  it("classifies notebooklm.google.com as ai, not search, despite the google.com tail", () => {
    expect(classifyReferrer("https://notebooklm.google.com/").channel).toBe(
      "ai",
    );
  });

  it("classifies gemini.google.com as ai rather than inheriting google search", () => {
    expect(classifyReferrer("https://gemini.google.com/app").channel).toBe(
      "ai",
    );
  });
});

describe("classifyReferrer identifies search engines", () => {
  it.each([
    "https://www.google.com/",
    "https://www.bing.com/search?q=x",
    "https://duckduckgo.com/",
    "https://search.yahoo.com/",
    "https://search.brave.com/",
    "https://kagi.com/",
  ])("classifies %s as search", (referrer) => {
    expect(classifyReferrer(referrer).channel).toBe("search");
  });

  it("handles the Android quick-search app referrer, which is not a valid URL", () => {
    const result = classifyReferrer("com.google.android.googlequicksearchbox");
    expect(result.channel).toBe("search");
    expect(result.sourceDomain).toBe("com.google.android.googlequicksearchbox");
  });
});

describe("classifyReferrer identifies social and email sources", () => {
  it.each([
    "https://facebook.com/",
    "https://lm.facebook.com/",
    "https://l.facebook.com/",
    "https://m.facebook.com/",
  ])("classifies the %s variant as social", (referrer) => {
    expect(classifyReferrer(referrer).channel).toBe("social");
  });

  it("classifies webmail as email", () => {
    expect(classifyReferrer("https://mail.google.com/").channel).toBe("email");
  });

  it("classifies the Gmail Android app package as email", () => {
    expect(classifyReferrer("com.google.android.gm").channel).toBe("email");
  });
});

describe("classifyReferrer separates genuine backlinks from our own pages", () => {
  it("classifies an unknown third-party site as referral", () => {
    const result = classifyReferrer("https://moneyinc.com/some-article");
    expect(result.channel).toBe("referral");
    expect(result.sourceDomain).toBe("moneyinc.com");
  });

  it("classifies our own domain as internal, not an acquisition source", () => {
    expect(classifyReferrer("https://www.propertyiq.app/markets").channel).toBe(
      "internal",
    );
  });

  it("classifies localhost as internal so local dev never pollutes acquisition", () => {
    expect(classifyReferrer("http://localhost:3000/").channel).toBe("internal");
  });
});

describe("classifyReferrer precedence and fallbacks", () => {
  it("returns direct when there is no referrer", () => {
    const result = classifyReferrer(undefined);
    expect(result).toEqual({ channel: "direct", sourceDomain: null });
  });

  it("lets an explicit utm_source win over the referrer domain", () => {
    const result = classifyReferrer("https://www.google.com/", "newsletter");
    expect(result.channel).toBe("utm");
    expect(result.sourceDomain).toBe("www.google.com");
  });

  it("does not treat a lookalike domain as ours", () => {
    expect(classifyReferrer("https://notpropertyiq.app/").channel).toBe(
      "referral",
    );
  });
});

describe("referrerHostname and isInternalHost", () => {
  it("returns null for an empty referrer", () => {
    expect(referrerHostname(undefined)).toBeNull();
    expect(referrerHostname("")).toBeNull();
  });

  it("lowercases the hostname", () => {
    expect(referrerHostname("https://WWW.Google.COM/")).toBe("www.google.com");
  });

  it("treats subdomains of our host as internal", () => {
    expect(isInternalHost("www.propertyiq.app")).toBe(true);
    expect(isInternalHost("propertyiq.app")).toBe(true);
    expect(isInternalHost("zillow.com")).toBe(false);
  });
});
