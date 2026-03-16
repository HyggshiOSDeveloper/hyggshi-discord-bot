const { getConfig } = require("./config");

const spamState = new Map();
let cacheVersion = null;
let cachedEntries = [];
let cachedWhitelist = new Set();

const LEET_MAP = {
  "@": "a",
  "4": "a",
  "3": "e",
  "1": "i",
  "!": "i",
  "0": "o",
  "$": "s",
  "5": "s",
  "7": "t"
};

function stripDiacritics(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeText(text) {
  if (!text) return "";
  const lowered = stripDiacritics(text.toLowerCase());
  let mapped = "";
  for (const ch of lowered) {
    mapped += LEET_MAP[ch] || ch;
  }
  return mapped.replace(/[^a-z0-9]/g, "");
}

function buildWordRegex(word) {
  const cleaned = stripDiacritics(word.toLowerCase());
  const chars = cleaned.replace(/[^a-z0-9]/g, "").split("");
  if (!chars.length) return null;

  const charPattern = (ch) => {
    switch (ch) {
      case "a": return "[a@4]+";
      case "e": return "[e3]+";
      case "i": return "[i1!]+";
      case "o": return "[o0]+";
      case "s": return "[s$5]+";
      case "t": return "[t7]+";
      default: return `[${ch}]+`;
    }
  };

  const parts = chars.map(charPattern);
  const body = parts.join("[^a-z0-9]*");
  return new RegExp(body, "i");
}

function rebuildCache(config) {
  cachedEntries = [];
  cachedWhitelist = new Set((config.whitelist || []).map(w => normalizeText(w)));

  for (const [category, rule] of Object.entries(config.rules || {})) {
    const severity = rule.severity || "LOW";
    const words = Array.isArray(rule.words) ? rule.words : [];

    for (const word of words) {
      const normalized = normalizeText(word);
      const regex = buildWordRegex(word);
      if (!normalized && !regex) continue;
      cachedEntries.push({
        category,
        severity,
        word,
        normalized,
        regex
      });
    }
  }

  cacheVersion = config.version;
}

function detectSpam(content, authorId, config) {
  const spamCfg = config.spam;
  if (!spamCfg) return null;

  const now = Date.now();
  const entry = spamState.get(authorId) || { recent: [] };
  entry.recent = entry.recent.filter(item => now - item.time < spamCfg.repeatWindowMs);

  const normalized = normalizeText(content);
  entry.recent.push({ time: now, normalized });
  spamState.set(authorId, entry);

  const sameCount = entry.recent.filter(item => item.normalized === normalized).length;
  if (sameCount >= spamCfg.repeatCount) {
    return { reason: "Spam (repeated message)", detected: "repeat" };
  }

  const mentions = (content.match(/<@!?\d+>/g) || []).length;
  if (mentions >= spamCfg.maxMentions) {
    return { reason: "Spam (mention flood)", detected: "mentions" };
  }

  const links = (content.match(/https?:\/\//gi) || []).length;
  if (links >= spamCfg.maxLinks) {
    return { reason: "Spam (link flood)", detected: "links" };
  }

  if (content.length >= spamCfg.maxLength) {
    return { reason: "Spam (excessive length)", detected: "length" };
  }

  if (/(.)\1{6,}/.test(content)) {
    return { reason: "Spam (character spam)", detected: "repeated characters" };
  }

  return null;
}

function matchRules(content, config) {
  const lower = content.toLowerCase();
  const normalized = normalizeText(content);

  for (const entry of cachedEntries) {
    if (!entry) continue;

    if (entry.regex && entry.regex.test(lower)) {
      const whitelistKey = entry.normalized;
      if (cachedWhitelist.has(whitelistKey)) continue;
      return entry;
    }

    if (entry.normalized && normalized.includes(entry.normalized)) {
      if (cachedWhitelist.has(entry.normalized)) continue;
      return entry;
    }
  }

  return null;
}

function analyzeText(content, authorId, configOverride) {
  const config = configOverride || getConfig();
  if (!content) return { blocked: false };

  if (cacheVersion !== config.version) {
    rebuildCache(config);
  }

  const spamHit = detectSpam(content, authorId, config);
  if (spamHit) {
    return {
      blocked: true,
      category: "spam",
      reason: spamHit.reason,
      detectedWord: spamHit.detected,
      severity: config.spam.severity || "MEDIUM"
    };
  }

  const matched = matchRules(content, config);
  if (!matched) return { blocked: false };

  const reasonMap = {
    inappropriate: "Inappropriate language",
    harassment: "Harassment or insults",
    sexual: "Sexual content"
  };

  return {
    blocked: true,
    category: matched.category,
    reason: reasonMap[matched.category] || "Policy violation",
    detectedWord: matched.word,
    severity: matched.severity || "LOW"
  };
}

module.exports = {
  analyzeText,
  normalizeText
};
