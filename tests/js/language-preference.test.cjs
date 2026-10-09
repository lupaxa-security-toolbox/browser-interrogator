"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const lib = require(path.join(
  __dirname,
  "..",
  "..",
  "mkdocs",
  "assets",
  "javascript",
  "language-preference.js",
));

function memoryStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

function element(tag, attrs, children) {
  const el = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    attributes: attrs || {},
    childNodes: children || [],
    parentElement: null,
    getAttribute(name) {
      if (!Object.prototype.hasOwnProperty.call(this.attributes, name)) {
        return null;
      }
      return this.attributes[name];
    },
    classList: {
      contains: (name) =>
        String((attrs && attrs.class) || "")
          .split(/\s+/)
          .includes(name),
    },
  };
  for (const child of el.childNodes) {
    child.parentElement = el;
  }
  return el;
}

function text(value) {
  return { nodeType: 3, nodeValue: value, parentElement: null };
}

describe("readPreference", () => {
  it("defaults to en when empty", () => {
    assert.equal(lib.readPreference(memoryStorage()), "en");
  });

  it("returns a stored locale", () => {
    assert.equal(
      lib.readPreference(memoryStorage({ "lupaxa-lang": "fr" })),
      "fr",
    );
  });

  it("rewrites an unknown value to en", () => {
    const storage = memoryStorage({ "lupaxa-lang": "zz" });
    assert.equal(lib.readPreference(storage), "en");
    assert.equal(storage.getItem("lupaxa-lang"), "en");
  });
});

describe("writePreference", () => {
  it("stores fr", () => {
    const storage = memoryStorage();
    assert.equal(lib.writePreference(storage, "fr"), "fr");
    assert.equal(storage.getItem("lupaxa-lang"), "fr");
  });

  it("accepts the extended locale list", () => {
    assert.deepEqual(lib.LOCALES, [
      "en",
      "fr",
      "de",
      "es",
      "pt",
      "it",
      "nl",
      "pl",
      "bg",
      "cs",
      "da",
      "el",
      "fi",
      "hr",
      "hu",
      "lt",
      "no",
      "ro",
      "sv",
      "tr",
      "uk",
    ]);
    const storage = memoryStorage();
    assert.equal(lib.writePreference(storage, "pl"), "pl");
    assert.equal(lib.writePreference(storage, "bg"), "bg");
    assert.equal(lib.writePreference(storage, "uk"), "uk");
  });

  it("stores en for an unknown value", () => {
    const storage = memoryStorage();
    assert.equal(lib.writePreference(storage, "zz"), "en");
    assert.equal(storage.getItem("lupaxa-lang"), "en");
  });
});

describe("shouldSkipNode", () => {
  it("skips text inside pre and code", () => {
    const codeText = text("print('hi')");
    const code = element("code", {}, [codeText]);
    const pre = element("pre", {}, [code]);
    assert.equal(lib.shouldSkipNode(codeText), true);
    assert.equal(lib.shouldSkipNode(pre.childNodes[0].childNodes[0] || codeText), true);
  });

  it("skips translate=no and .notranslate ancestors", () => {
    const brand = text("The Lupaxa Project");
    const strong = element("strong", { translate: "no" }, [brand]);
    const skipped = text("Acme");
    const named = element("span", { class: "notranslate" }, [skipped]);
    assert.equal(lib.shouldSkipNode(brand), true);
    assert.equal(lib.shouldSkipNode(skipped), true);
  });

  it("does not skip a normal paragraph", () => {
    const copy = text("Browse projects");
    element("p", {}, [copy]);
    assert.equal(lib.shouldSkipNode(copy), false);
  });

  it("skips the GitHub source chip", () => {
    const label = text("snippets");
    const version = text("v0.2.4");
    const repo = element("div", { class: "md-source__repository" }, [
      label,
      element("ul", { class: "md-source__facts" }, [
        element("li", {}, [version]),
      ]),
    ]);
    element("a", { class: "md-source" }, [repo]);
    assert.equal(lib.shouldSkipNode(label), true);
    assert.equal(lib.shouldSkipNode(version), true);
  });

  it("skips text inside the site footer", () => {
    const reserved = text("All rights reserved.");
    const tagline = text("Where exploration meets precision.");
    const copyright = element("span", { class: "footer-copyright" }, [reserved]);
    const slogan = element("span", { class: "footer-tagline" }, [tagline]);
    const inner = element("div", { class: "md-copyright" }, [copyright, slogan]);
    element("footer", { class: "md-footer" }, [inner]);
    assert.equal(lib.shouldSkipNode(reserved), true);
    assert.equal(lib.shouldSkipNode(tagline), true);
  });
});

describe("collectTextNodes", () => {
  it("returns only translatable text nodes", () => {
    const para = text("Hello");
    const brand = text("The Lupaxa Project");
    const root = element("div", {}, [
      element("p", {}, [para]),
      element("h1", { translate: "no" }, [brand]),
      element("code", {}, [text("id")]),
    ]);
    const nodes = lib.collectTextNodes(root);
    assert.deepEqual(
      nodes.map((node) => node.nodeValue),
      ["Hello"],
    );
  });

  it("does not collect footer copyright or taglines", () => {
    const reserved = text("All rights reserved.");
    const tagline = text("Where exploration meets precision.");
    const footer = element("footer", { class: "md-footer" }, [
      element("div", { class: "md-copyright" }, [
        element("span", { class: "footer-copyright" }, [reserved]),
        element("span", { class: "footer-tagline" }, [tagline]),
      ]),
    ]);
    assert.deepEqual(
      lib.collectTextNodes(footer).map((node) => node.nodeValue),
      [],
    );
  });
});

describe("isUrlLikeText", () => {
  it("detects http(s) and www URLs", () => {
    assert.equal(lib.isUrlLikeText("https://github.com/org/repo"), true);
    assert.equal(lib.isUrlLikeText("View on GitHub"), false);
  });
});

describe("uiString", () => {
  it("returns chrome copy in the selected locale", () => {
    assert.match(lib.uiString("fr", "downloading"), /pack de langue/i);
    assert.match(lib.uiString("de", "downloading"), /sprachpaket/i);
    assert.match(lib.uiString("uk", "downloading"), /мовного пакета/i);
    assert.equal(
      lib.uiString("zz", "downloading"),
      lib.uiString("en", "downloading"),
    );
  });
});

describe("network translator", () => {
  it("parses a clients5 JSON array", () => {
    assert.deepEqual(lib.parseNetworkTranslations(["Bonjour"]), ["Bonjour"]);
    assert.deepEqual(
      lib.parseNetworkTranslations(["Bonjour", "Parcourir les projets"]),
      ["Bonjour", "Parcourir les projets"],
    );
  });

  it("builds a multi-q translate URL", () => {
    const url = lib.buildNetworkTranslateUrl("fr", ["Hello", "Browse projects"]);
    assert.match(url, /clients5\.google\.com\/translate_a\/t/);
    assert.match(url, /tl=fr/);
    assert.match(url, /q=Hello/);
    assert.match(url, /q=Browse/);
  });

  it("translates via fetch when Translator is missing", async () => {
    const calls = [];
    const api = lib.createNetworkTranslatorApi({
      fetchImpl: async (url) => {
        calls.push(String(url));
        return {
          ok: true,
          async json() {
            return ["Bonjour"];
          },
        };
      },
    });
    const translator = await api.create({
      sourceLanguage: "en",
      targetLanguage: "fr",
    });
    assert.equal(await translator.translate("Hello"), "Bonjour");
    assert.equal(calls.length, 1);
    assert.match(calls[0], /q=Hello/);
  });

  it("uses the network API when the on-device translator cannot do the locale", async () => {
    const copy = text("Hello");
    const root = element("p", {}, [copy]);
    const result = await lib.runTranslation({
      locale: "fr",
      api: {
        availability: async () => "unavailable",
        create: async () => {
          throw new Error("should not create native");
        },
      },
      networkApi: lib.createNetworkTranslatorApi({
        fetchImpl: async () => ({
          ok: true,
          async json() {
            return ["Bonjour"];
          },
        }),
      }),
      roots: [root],
      document: { documentElement: { lang: "en" } },
      generation: 41,
      currentGeneration: () => 41,
    });
    assert.equal(result.status, "ok");
    assert.equal(copy.nodeValue, "Bonjour");
  });

  it("rewrites page copy through the network API", async () => {
    const copy = text("Hello");
    const root = element("p", {}, [copy]);
    const api = lib.createNetworkTranslatorApi({
      fetchImpl: async () => ({
        ok: true,
        async json() {
          return ["Bonjour"];
        },
      }),
    });
    const result = await lib.runTranslation({
      locale: "fr",
      api,
      roots: [root],
      document: { documentElement: { lang: "en" } },
      generation: 40,
      currentGeneration: () => 40,
    });
    assert.equal(result.status, "ok");
    assert.equal(copy.nodeValue, "Bonjour");
  });
});

describe("shouldShowFallback", () => {
  it("shows only when a non-en locale has no API and is not dismissed", () => {
    assert.equal(lib.shouldShowFallback("fr", false, false), true);
    assert.equal(lib.shouldShowFallback("fr", true, false), false);
    assert.equal(lib.shouldShowFallback("en", false, false), false);
    assert.equal(lib.shouldShowFallback("de", false, true), false);
  });
});

describe("applyDocumentLang", () => {
  it("sets documentElement.lang", () => {
    const doc = { documentElement: { lang: "en" } };
    lib.applyDocumentLang(doc, "fr");
    assert.equal(doc.documentElement.lang, "fr");
  });
});

describe("translateTextNodes", () => {
  it("rewrites a normal paragraph with the translator", async () => {
    const copy = text("Browse projects");
    element("p", {}, [copy]);
    const translator = {
      async translate(value) {
        return `FR:${value}`;
      },
    };
    await lib.translateTextNodes([copy], translator, () => true);
    assert.equal(copy.nodeValue, "FR:Browse projects");
  });

  it("leaves a node in English when translate throws", async () => {
    const copy = text("Browse projects");
    const translator = {
      async translate() {
        throw new Error("quota");
      },
    };
    await lib.translateTextNodes([copy], translator, () => true);
    assert.equal(copy.nodeValue, "Browse projects");
  });

  it("does not apply a stale generation", async () => {
    const copy = text("Browse projects");
    let allow = true;
    const translator = {
      async translate(value) {
        return `FR:${value}`;
      },
    };
    await lib.translateTextNodes([copy], translator, () => allow && ((allow = false), false));
    assert.equal(copy.nodeValue, "Browse projects");
  });

  it("does not prefix again on a second pass", async () => {
    const copy = text("Hello");
    const translator = {
      async translate(value) {
        return `FR:${value}`;
      },
    };
    await lib.translateTextNodes([copy], translator, () => true);
    await lib.translateTextNodes([copy], translator, () => true);
    assert.equal(copy.nodeValue, "FR:Hello");
  });

  it("preserves leading and trailing whitespace", async () => {
    const copy = text(" Hello ");
    const translator = {
      async translate(value) {
        return `FR:${value}`;
      },
    };
    await lib.translateTextNodes([copy], translator, () => true);
    assert.equal(copy.nodeValue, " FR:Hello ");
  });

  it("uses a cache hit without calling the translator", async () => {
    const copy = text("Hello");
    let calls = 0;
    const translator = {
      async translate() {
        calls += 1;
        return "NON";
      },
    };
    const cache = memoryStorage({
      [lib.CACHE_KEY]: JSON.stringify({ fr: { Hello: "Bonjour" } }),
    });
    await lib.translateTextNodes([copy], translator, () => true, {
      locale: "fr",
      storage: cache,
    });
    assert.equal(copy.nodeValue, "Bonjour");
    assert.equal(calls, 0);
  });

  it("stores a successful translation in the cache", async () => {
    const copy = text("Hello");
    const cache = memoryStorage();
    await lib.translateTextNodes(
      [copy],
      {
        async translate(value) {
          return `FR:${value}`;
        },
      },
      () => true,
      { locale: "fr", storage: cache },
    );
    assert.equal(copy.nodeValue, "FR:Hello");
    const stored = JSON.parse(cache.getItem(lib.CACHE_KEY));
    assert.equal(stored.fr.Hello, "FR:Hello");
  });
});

describe("runTranslation", () => {
  it("skips work for en and leaves lang en", async () => {
    const copy = text("Hello");
    const root = element("p", {}, [copy]);
    const doc = { documentElement: { lang: "en" } };
    const result = await lib.runTranslation({
      locale: "en",
      api: { create: async () => ({ translate: async () => "nope" }) },
      roots: [root],
      document: doc,
      generation: 1,
      currentGeneration: () => 1,
    });
    assert.equal(result.status, "skipped");
    assert.equal(copy.nodeValue, "Hello");
    assert.equal(doc.documentElement.lang, "en");
  });

  it("translates and sets html lang on success", async () => {
    const copy = text("Hello");
    const root = element("p", {}, [copy]);
    const doc = { documentElement: { lang: "en" } };
    const result = await lib.runTranslation({
      locale: "fr",
      api: {
        create: async () => ({
          translate: async (value) => `FR:${value}`,
        }),
      },
      roots: [root],
      document: doc,
      generation: 2,
      currentGeneration: () => 2,
    });
    assert.equal(result.status, "ok");
    assert.equal(copy.nodeValue, "FR:Hello");
    assert.equal(doc.documentElement.lang, "fr");
  });

  it("returns fallback when the API is missing", async () => {
    const copy = text("Hello");
    const root = element("p", {}, [copy]);
    const doc = { documentElement: { lang: "en" } };
    const result = await lib.runTranslation({
      locale: "de",
      api: null,
      roots: [root],
      document: doc,
      generation: 3,
      currentGeneration: () => 3,
    });
    assert.equal(result.status, "fallback");
    assert.equal(copy.nodeValue, "Hello");
    assert.equal(doc.documentElement.lang, "en");
  });

  it("returns failed when create throws and does not loop", async () => {
    const copy = text("Hello");
    const root = element("p", {}, [copy]);
    const doc = { documentElement: { lang: "en" } };
    let creates = 0;
    const result = await lib.runTranslation({
      locale: "fr",
      api: {
        create: async () => {
          creates += 1;
          throw new Error("blocked");
        },
      },
      roots: [root],
      document: doc,
      generation: 4,
      currentGeneration: () => 4,
    });
    assert.equal(result.status, "failed");
    assert.equal(creates, 1);
    assert.equal(copy.nodeValue, "Hello");
    assert.equal(doc.documentElement.lang, "en");
  });

  it("does not prefix again when run twice on the same nodes", async () => {
    const copy = text("Hello");
    const root = element("p", {}, [copy]);
    const doc = { documentElement: { lang: "en" } };
    let creates = 0;
    const api = {
      create: async () => {
        creates += 1;
        return {
          translate: async (value) => `FR:${value}`,
        };
      },
    };
    const base = {
      locale: "fr",
      api,
      roots: [root],
      document: doc,
    };
    await lib.runTranslation({
      ...base,
      generation: 10,
      currentGeneration: () => 10,
    });
    await lib.runTranslation({
      ...base,
      generation: 11,
      currentGeneration: () => 11,
    });
    assert.equal(copy.nodeValue, "FR:Hello");
    assert.equal(doc.documentElement.lang, "fr");
    assert.equal(creates, 1);
  });

  it("does not create when the pack is downloadable without a user gesture", async () => {
    let creates = 0;
    const copy = text("Hello");
    const root = element("p", {}, [copy]);
    const doc = { documentElement: { lang: "en" } };
    const result = await lib.runTranslation({
      locale: "fr",
      api: {
        availability: async () => "downloadable",
        create: async () => {
          creates += 1;
          throw new Error("should not create");
        },
      },
      roots: [root],
      document: doc,
      generation: 20,
      currentGeneration: () => 20,
      userActivation: false,
    });
    assert.equal(result.status, "needs-activation");
    assert.equal(creates, 0);
    assert.equal(copy.nodeValue, "Hello");
    assert.equal(doc.documentElement.lang, "en");
  });

  it("creates when the pack is downloadable and the picker provided a gesture", async () => {
    let creates = 0;
    const copy = text("Hello");
    const root = element("p", {}, [copy]);
    const result = await lib.runTranslation({
      locale: "fr",
      api: {
        availability: async () => "downloadable",
        create: async (options) => {
          creates += 1;
          assert.equal(typeof options.monitor, "function");
          return {
            translate: async (value) => `FR:${value}`,
          };
        },
      },
      roots: [root],
      document: { documentElement: { lang: "en" } },
      generation: 21,
      currentGeneration: () => 21,
      userActivation: true,
    });
    assert.equal(result.status, "ok");
    assert.equal(creates, 1);
    assert.equal(copy.nodeValue, "FR:Hello");
  });

  it("does not treat a cached pack progress event as a download", async () => {
    const progress = [];
    const copy = text("Hello");
    const root = element("p", {}, [copy]);
    await lib.runTranslation({
      locale: "fr",
      api: {
        availability: async () => "available",
        create: async (options) => {
          options.monitor({
            addEventListener(type, fn) {
              if (type === "downloadprogress") {
                fn({ loaded: 1 });
              }
            },
          });
          return {
            translate: async (value) => `FR:${value}`,
          };
        },
      },
      roots: [root],
      document: { documentElement: { lang: "en" } },
      generation: 24,
      currentGeneration: () => 24,
      userActivation: true,
      onProgress(event) {
        progress.push(event);
      },
    });
    assert.deepEqual(progress, []);
  });

  it("reports progress only while a pack is still downloading", async () => {
    const progress = [];
    const copy = text("Hello");
    const root = element("p", {}, [copy]);
    await lib.runTranslation({
      locale: "fr",
      api: {
        availability: async () => "downloadable",
        create: async (options) => {
          options.monitor({
            addEventListener(type, fn) {
              if (type !== "downloadprogress") {
                return;
              }
              fn({ loaded: 0.4 });
              fn({ loaded: 1 });
            },
          });
          return {
            translate: async (value) => `FR:${value}`,
          };
        },
      },
      roots: [root],
      document: { documentElement: { lang: "en" } },
      generation: 25,
      currentGeneration: () => 25,
      userActivation: true,
      onProgress(event) {
        progress.push(event.loaded);
      },
    });
    assert.deepEqual(progress, [0.4]);
  });

  it("returns fallback when availability is unavailable", async () => {
    let creates = 0;
    const copy = text("Hello");
    const root = element("p", {}, [copy]);
    const result = await lib.runTranslation({
      locale: "de",
      api: {
        availability: async () => "unavailable",
        create: async () => {
          creates += 1;
          return { translate: async () => "nope" };
        },
      },
      roots: [root],
      document: { documentElement: { lang: "en" } },
      generation: 22,
      currentGeneration: () => 22,
      userActivation: true,
    });
    assert.equal(result.status, "fallback");
    assert.equal(creates, 0);
    assert.equal(copy.nodeValue, "Hello");
  });

  it("applies a full string cache without creating a translator", async () => {
    let creates = 0;
    const copy = text("Hello");
    const root = element("p", {}, [copy]);
    const cache = memoryStorage({
      [lib.CACHE_KEY]: JSON.stringify({ fr: { Hello: "Bonjour" } }),
    });
    const result = await lib.runTranslation({
      locale: "fr",
      api: {
        availability: async () => "downloadable",
        create: async () => {
          creates += 1;
          throw new Error("should not create");
        },
      },
      roots: [root],
      document: { documentElement: { lang: "en" } },
      generation: 23,
      currentGeneration: () => 23,
      userActivation: false,
      cacheStorage: cache,
    });
    assert.equal(result.status, "ok");
    assert.equal(creates, 0);
    assert.equal(copy.nodeValue, "Bonjour");
  });
});

describe("onPickerChange", () => {
  it("writes fr and does not reload", async () => {
    const storage = memoryStorage();
    let reloads = 0;
    const apply = async () => "ok";
    await lib.onPickerChange("fr", {
      storage,
      reload: () => {
        reloads += 1;
      },
      apply,
    });
    assert.equal(storage.getItem("lupaxa-lang"), "fr");
    assert.equal(reloads, 0);
  });

  it("applies fr when the picker selects fr", async () => {
    const storage = memoryStorage();
    let applied = null;
    await lib.onPickerChange("fr", {
      storage,
      reload: () => {
        throw new Error("should not reload");
      },
      apply: async (locale) => {
        applied = locale;
      },
    });
    assert.equal(applied, "fr");
  });

  it("writes en and reloads", async () => {
    const storage = memoryStorage({ "lupaxa-lang": "fr" });
    let reloads = 0;
    await lib.onPickerChange("en", {
      storage,
      reload: () => {
        reloads += 1;
      },
      apply: async () => {
        throw new Error("should not apply");
      },
    });
    assert.equal(storage.getItem("lupaxa-lang"), "en");
    assert.equal(reloads, 1);
  });
});

function fakeDocument() {
  const changeListeners = [];
  const clickListeners = [];
  const picker = {
    id: "lupaxa-lang",
    value: "en",
    dataset: {},
    addEventListener(type, fn) {
      if (type === "change") {
        changeListeners.push(fn);
      }
    },
  };
  const seenTexts = [];
  const textEl = {
    className: "lupaxa-lang-fallback__text",
    _text: "This page is in English. Your browser can translate it.",
    get textContent() {
      return this._text;
    },
    set textContent(value) {
      this._text = value;
      seenTexts.push(value);
    },
  };
  const note = {
    id: "lupaxa-lang-fallback",
    hidden: true,
    querySelector(selector) {
      return selector === ".lupaxa-lang-fallback__text" ? textEl : null;
    },
  };
  const dismiss = {
    id: "lupaxa-lang-fallback-dismiss",
    dataset: {},
    addEventListener(type, fn) {
      if (type === "click") {
        clickListeners.push(fn);
      }
    },
  };
  const ids = {
    "lupaxa-lang": picker,
    "lupaxa-lang-fallback": note,
    "lupaxa-lang-fallback-dismiss": dismiss,
  };
  const pageCopy = text("Browse projects");
  const reserved = text("All rights reserved.");
  const tagline = text("Where exploration meets precision.");
  const main = element("div", { class: "md-main" }, [
    element("p", {}, [pageCopy]),
  ]);
  const footer = element("footer", { class: "md-footer" }, [
    element("div", { class: "md-copyright" }, [
      element("span", { class: "footer-copyright" }, [reserved]),
      element("span", { class: "footer-tagline" }, [tagline]),
    ]),
  ]);
  return {
    documentElement: { lang: "en" },
    getElementById(id) {
      return Object.prototype.hasOwnProperty.call(ids, id) ? ids[id] : null;
    },
    querySelector(selector) {
      if (selector === ".md-main") {
        return main;
      }
      if (selector === ".md-footer") {
        return footer;
      }
      return null;
    },
    picker,
    note,
    dismiss,
    changeListeners,
    clickListeners,
    pageCopy,
    reserved,
    tagline,
    seenTexts,
    noteText() {
      return textEl.textContent;
    },
  };
}

describe("attach", () => {
  it("does nothing when the picker is absent", async () => {
    const doc = {
      documentElement: { lang: "en" },
      getElementById() {
        return null;
      },
      querySelector() {
        throw new Error("should not walk the document");
      },
    };
    const result = await lib.attach({
      document: doc,
      storage: memoryStorage({ "lupaxa-lang": "fr" }),
      sessionStorage: memoryStorage(),
      reload: () => {
        throw new Error("should not reload");
      },
      translatorApi: {
        create: async () => {
          throw new Error("should not create a translator");
        },
      },
    });
    assert.equal(result, undefined);
    assert.equal(doc.documentElement.lang, "en");
  });

  it("shows the fallback note for fr when the API is null", async () => {
    const doc = fakeDocument();
    const storage = memoryStorage({ "lupaxa-lang": "fr" });
    const session = memoryStorage();
    await lib.attach({
      document: doc,
      storage,
      sessionStorage: session,
      reload: () => {},
      translatorApi: null,
    });
    assert.equal(doc.note.hidden, false);
    assert.equal(doc.changeListeners.length, 1);

    doc.clickListeners[0]();
    assert.equal(doc.note.hidden, true);
    assert.equal(session.getItem(lib.FALLBACK_DISMISS_KEY), "1");

    await lib.attach({
      document: doc,
      storage,
      sessionStorage: session,
      reload: () => {},
      translatorApi: null,
    });
    assert.equal(doc.changeListeners.length, 1);
    assert.equal(doc.note.hidden, true);
  });

  it("asks for another picker choice when a download needs a gesture", async () => {
    const doc = fakeDocument();
    const result = await lib.attach({
      document: doc,
      storage: memoryStorage({ "lupaxa-lang": "fr" }),
      sessionStorage: memoryStorage(),
      reload: () => {},
      translatorApi: {
        availability: async () => "downloadable",
        create: async () => {
          throw new Error("should not create on load");
        },
      },
    });
    assert.equal(result.status, "needs-activation");
    assert.equal(doc.note.hidden, false);
    assert.match(
      doc.noteText(),
      /sélectionnez à nouveau la langue/i,
    );
  });

  it("does not show a download banner when the pack is already available", async () => {
    const doc = fakeDocument();
    await lib.attach({
      document: doc,
      storage: memoryStorage({ "lupaxa-lang": "fr" }),
      sessionStorage: memoryStorage(),
      reload: () => {},
      translatorApi: {
        availability: async () => "available",
        create: async (options) => {
          options.monitor({
            addEventListener(type, fn) {
              if (type === "downloadprogress") {
                fn({ loaded: 1 });
              }
            },
          });
          return {
            translate: async (value) => `FR:${value}`,
          };
        },
      },
    });
    assert.equal(
      doc.seenTexts.some((text) =>
        /downloading the language pack|pack de langue/i.test(text),
      ),
      false,
    );
    assert.equal(doc.note.hidden, true);
  });

  it("uses the network API when Translator is missing", async () => {
    const doc = fakeDocument();
    await lib.attach({
      document: doc,
      storage: memoryStorage({ "lupaxa-lang": "fr" }),
      sessionStorage: memoryStorage(),
      reload: () => {},
      fetchImpl: async () => ({
        ok: true,
        async json() {
          return ["Parcourir les projets"];
        },
      }),
    });
    assert.equal(doc.pageCopy.nodeValue, "Parcourir les projets");
    assert.equal(
      doc.seenTexts.some((text) => /traduction/i.test(text)),
      true,
    );
    assert.equal(doc.note.hidden, true);
  });

  it("shows the fallback note when the network path fails", async () => {
    const doc = fakeDocument();
    await lib.attach({
      document: doc,
      storage: memoryStorage({ "lupaxa-lang": "fr" }),
      sessionStorage: memoryStorage(),
      reload: () => {},
      translatorApi: lib.createNetworkTranslatorApi({
        fetchImpl: async () => ({
          ok: false,
          async json() {
            return [];
          },
        }),
      }),
    });
    assert.equal(doc.pageCopy.nodeValue, "Browse projects");
    assert.equal(doc.note.hidden, false);
    assert.match(doc.noteText(), /cette page est en anglais/i);
  });

  it("translates main copy and leaves the footer in English", async () => {
    const doc = fakeDocument();
    await lib.attach({
      document: doc,
      storage: memoryStorage({ "lupaxa-lang": "fr" }),
      sessionStorage: memoryStorage(),
      reload: () => {},
      translatorApi: {
        availability: async () => "available",
        create: async () => ({
          translate: async (value) => `FR:${value}`,
        }),
      },
    });
    assert.equal(doc.pageCopy.nodeValue, "FR:Browse projects");
    assert.equal(doc.reserved.nodeValue, "All rights reserved.");
    assert.equal(doc.tagline.nodeValue, "Where exploration meets precision.");
  });
});
