import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const configPath = path.join(os.homedir(), ".codex", "config.toml");
const notifyScript = path.join(repoRoot, "scripts", "codex_notify_traffic_light.sh");
const hooksPath = path.join(repoRoot, "codex-hooks.json");
const hookScript = path.join(repoRoot, "scripts", "claude_traffic_light_hook.sh");

function escapeTomlString(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function upsertLineByPrefix(text, prefix, line) {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((candidate) => candidate.trimStart().startsWith(prefix));
  if (index >= 0) {
    lines[index] = line;
    return lines.join("\n");
  }
  const insertAt = lines.findIndex((candidate) => candidate.trim().startsWith("["));
  if (insertAt >= 0) {
    lines.splice(insertAt, 0, line, "");
    return lines.join("\n");
  }
  return `${line}\n${text}`;
}

function hook(command) {
  return {
    type: "command",
    command: `${hookScript} ${command}`,
    async: false,
    timeoutSec: 5
  };
}

const hooksConfig = {
  SessionStart: [
    {
      hooks: [hook("DONE")]
    }
  ],
  UserPromptSubmit: [
    {
      hooks: [hook("WORKING")]
    }
  ],
  PreToolUse: [
    {
      matcher: "*",
      hooks: [hook("WORKING")]
    }
  ],
  PermissionRequest: [
    {
      matcher: "*",
      hooks: [hook("NEED_INPUT")]
    }
  ],
  PostToolUse: [
    {
      matcher: "*",
      hooks: [hook("WORKING")]
    }
  ],
  Stop: [
    {
      hooks: [hook("DONE")]
    }
  ],
  PreCompact: [],
  PostCompact: [],
  SubagentStart: [],
  SubagentStop: []
};

fs.writeFileSync(hooksPath, `${JSON.stringify(hooksConfig, null, 2)}\n`);

function tomlHook(command) {
  return `{ type = "command", command = "${escapeTomlString(`${hookScript} ${command}`)}", async = false, timeout = 5 }`;
}

function tomlGroup(command, matcher = null) {
  const matcherPart = matcher ? `matcher = "${escapeTomlString(matcher)}", ` : "";
  return `{ ${matcherPart}hooks = [${tomlHook(command)}] }`;
}

function hooksToml() {
  return [
    "[hooks]",
    `SessionStart = [${tomlGroup("DONE")}]`,
    `UserPromptSubmit = [${tomlGroup("WORKING")}]`,
    `PreToolUse = [${tomlGroup("WORKING", "*")}]`,
    `PermissionRequest = [${tomlGroup("NEED_INPUT", "*")}]`,
    `PostToolUse = [${tomlGroup("WORKING", "*")}]`,
    `Stop = [${tomlGroup("DONE")}]`,
    "PreCompact = []",
    "PostCompact = []",
    "SubagentStart = []",
    "SubagentStop = []"
  ].join("\n");
}

function removeHooksTables(text) {
  const lines = text.split(/\r?\n/);
  const kept = [];
  let skipping = false;

  for (const line of lines) {
    const section = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (section) {
      const name = section[1].trim();
      skipping = name === "hooks" || name.startsWith("hooks.");
    }
    if (!skipping) {
      kept.push(line);
    }
  }

  return kept.join("\n").trimEnd();
}

let config = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
if (config && !fs.existsSync(`${configPath}.traffic-light.bak`)) {
  fs.writeFileSync(`${configPath}.traffic-light.bak`, config);
}
config = upsertLineByPrefix(
  config,
  "notify =",
  `notify = ["${escapeTomlString(notifyScript)}", "turn-ended"]`
);
config = `${removeHooksTables(config)}\n\n${hooksToml()}\n`;

fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, config.endsWith("\n") ? config : `${config}\n`);
console.log(`Updated ${configPath}`);
console.log(`Codex notify: ${notifyScript}`);
console.log(`Codex hooks backup JSON: ${hooksPath}`);
