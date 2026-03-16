const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const { getConfig, updateConfig } = require("./config");

function getFilterCommands() {
  const cmd = new SlashCommandBuilder()
    .setName("filter")
    .setDescription("Safety filter controls")
    .addSubcommand(sc =>
      sc.setName("enable").setDescription("Enable the safety filter")
    )
    .addSubcommand(sc =>
      sc.setName("disable").setDescription("Disable the safety filter")
    )
    .addSubcommand(sc =>
      sc.setName("add-word")
        .setDescription("Add a filtered word")
        .addStringOption(o =>
          o.setName("word").setDescription("Word or phrase").setRequired(true)
        )
        .addStringOption(o =>
          o.setName("category")
            .setDescription("Category")
            .setRequired(true)
            .addChoices(
              { name: "inappropriate", value: "inappropriate" },
              { name: "harassment", value: "harassment" },
              { name: "sexual", value: "sexual" }
            )
        )
        .addStringOption(o =>
          o.setName("severity")
            .setDescription("Severity")
            .setRequired(false)
            .addChoices(
              { name: "LOW", value: "LOW" },
              { name: "MEDIUM", value: "MEDIUM" },
              { name: "HIGH", value: "HIGH" }
            )
        )
    )
    .addSubcommand(sc =>
      sc.setName("remove-word")
        .setDescription("Remove a filtered word")
        .addStringOption(o =>
          o.setName("word").setDescription("Word or phrase").setRequired(true)
        )
    )
    .addSubcommand(sc =>
      sc.setName("whitelist")
        .setDescription("Add or remove a whitelist word")
        .addStringOption(o =>
          o.setName("action")
            .setDescription("Action")
            .setRequired(true)
            .addChoices(
              { name: "add", value: "add" },
              { name: "remove", value: "remove" }
            )
        )
        .addStringOption(o =>
          o.setName("word").setDescription("Word or phrase").setRequired(true)
        )
    )
    .addSubcommand(sc =>
      sc.setName("severity")
        .setDescription("Set severity for a category")
        .addStringOption(o =>
          o.setName("category")
            .setDescription("Category")
            .setRequired(true)
            .addChoices(
              { name: "inappropriate", value: "inappropriate" },
              { name: "harassment", value: "harassment" },
              { name: "sexual", value: "sexual" },
              { name: "spam", value: "spam" }
            )
        )
        .addStringOption(o =>
          o.setName("level")
            .setDescription("Severity")
            .setRequired(true)
            .addChoices(
              { name: "LOW", value: "LOW" },
              { name: "MEDIUM", value: "MEDIUM" },
              { name: "HIGH", value: "HIGH" }
            )
        )
    );

  return [cmd.toJSON()];
}

function assertAdmin(interaction) {
  const member = interaction.member;
  if (!member?.permissions?.has(PermissionsBitField.Flags.Administrator)) {
    return false;
  }
  return true;
}

async function handleFilterCommand(interaction) {
  if (!assertAdmin(interaction)) {
    await interaction.editReply("You need Administrator permission to use this command.");
    return true;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "enable") {
    updateConfig(cfg => ({ ...cfg, enabled: true }));
    await interaction.editReply("Safety filter enabled.");
    return true;
  }

  if (sub === "disable") {
    updateConfig(cfg => ({ ...cfg, enabled: false }));
    await interaction.editReply("Safety filter disabled.");
    return true;
  }

  if (sub === "add-word") {
    const word = interaction.options.getString("word");
    const category = interaction.options.getString("category");
    const severity = interaction.options.getString("severity");

    updateConfig(cfg => {
      const next = { ...cfg };
      const rules = { ...next.rules };
      const existing = rules[category] || { severity: "LOW", words: [] };
      const words = new Set(existing.words || []);
      words.add(word);
      rules[category] = { severity: severity || existing.severity, words: Array.from(words) };
      next.rules = rules;
      return next;
    });

    await interaction.editReply(`Added "${word}" to ${category}.`);
    return true;
  }

  if (sub === "remove-word") {
    const word = interaction.options.getString("word");

    updateConfig(cfg => {
      const next = { ...cfg };
      const rules = { ...next.rules };
      for (const key of Object.keys(rules)) {
        const words = (rules[key].words || []).filter(w => w.toLowerCase() !== word.toLowerCase());
        rules[key] = { ...rules[key], words };
      }
      next.rules = rules;
      return next;
    });

    await interaction.editReply(`Removed "${word}" from all categories.`);
    return true;
  }

  if (sub === "whitelist") {
    const action = interaction.options.getString("action");
    const word = interaction.options.getString("word");

    updateConfig(cfg => {
      const next = { ...cfg };
      const list = new Set(next.whitelist || []);
      if (action === "add") list.add(word);
      if (action === "remove") list.delete(word);
      next.whitelist = Array.from(list);
      return next;
    });

    await interaction.editReply(`${action === "add" ? "Added" : "Removed"} "${word}" ${action === "add" ? "to" : "from"} whitelist.`);
    return true;
  }

  if (sub === "severity") {
    const category = interaction.options.getString("category");
    const level = interaction.options.getString("level");

    updateConfig(cfg => {
      const next = { ...cfg };
      if (category === "spam") {
        next.spam = { ...next.spam, severity: level };
      } else {
        const rules = { ...next.rules };
        const existing = rules[category] || { severity: "LOW", words: [] };
        rules[category] = { ...existing, severity: level };
        next.rules = rules;
      }
      return next;
    });

    await interaction.editReply(`Set ${category} severity to ${level}.`);
    return true;
  }

  return false;
}

module.exports = {
  getFilterCommands,
  handleFilterCommand
};
