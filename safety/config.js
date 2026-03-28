const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "..", "safety.config.json");
const EXAMPLE_PATH = path.join(__dirname, "..", "safety.config.example.json");

let cachedConfig = null;

function loadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[SafetyConfig] Failed to load ${filePath}: ${err.message}`);
    return null;
  }
}

function applyDefaults(config) {
  const base = {
    version: 1,
    enabled: true,
    modLogChannel: "mod-logs",
    adminBypass: true,
    bypassRoleIds: [],
    ignoreChannelIds: [],
    ignoreChannelNames: [],
    whitelist: [],
    bannedWords: [],
    defaultBannedWordSeverity: "MEDIUM",
    warningMessage: "Please keep the conversation respectful and follow the rules.",
    timeoutMs: 10 * 60 * 1000,
    severityActions: {
      LOW: { warn: true, delete: false, timeout: false },
      MEDIUM: { warn: true, delete: true, timeout: false },
      HIGH: { warn: true, delete: true, timeout: true }
    },
    spam: {
      severity: "MEDIUM",
      repeatWindowMs: 12000,
      repeatCount: 3,
      maxMentions: 5,
      maxLinks: 3,
      maxLength: 1000
    },
    rules: {
      inappropriate: { severity: "LOW", words: [] },
      harassment: { severity: "MEDIUM", words: [] },
      sexual: { severity: "MEDIUM", words: [] }
    }
  };

  const merged = { ...base, ...config };
  merged.severityActions = { ...base.severityActions, ...(config?.severityActions || {}) };
  merged.spam = { ...base.spam, ...(config?.spam || {}) };
  merged.rules = {
    inappropriate: { ...base.rules.inappropriate, ...(config?.rules?.inappropriate || {}) },
    harassment: { ...base.rules.harassment, ...(config?.rules?.harassment || {}) },
    sexual: { ...base.rules.sexual, ...(config?.rules?.sexual || {}) }
  };

  return merged;
}

function getConfig() {
  if (cachedConfig) return cachedConfig;

  const fromConfig = loadJson(CONFIG_PATH);
  const fromExample = loadJson(EXAMPLE_PATH);

  cachedConfig = applyDefaults(fromConfig || fromExample || {});
  return cachedConfig;
}

function saveConfig(nextConfig) {
  const normalized = applyDefaults(nextConfig);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(normalized, null, 2), "utf8");
  cachedConfig = normalized;
  return normalized;
}

function updateConfig(mutator) {
  const current = getConfig();
  const updated = mutator({ ...current, rules: { ...current.rules } });
  updated.version = (updated.version || 0) + 1;
  return saveConfig(updated);
}

module.exports = {
  CONFIG_PATH,
  getConfig,
  saveConfig,
  updateConfig
};
