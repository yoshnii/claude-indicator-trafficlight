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

function upsertHooksPath(text) {
  if (/\[hooks\]/.test(text)) {
    if (/^\s*path\s*=.*/m.test(text)) {
      return text.replace(/^\s*path\s*=.*/m, `path = "${escapeTomlString(hooksPath)}"`);
    }
    return text.replace(/\[hooks\]\n/, `[hooks]\npath = "${escapeTomlString(hooksPath)}"\n`);
  }
  return `${text.trimEnd()}\n\n[hooks]\npath = "${escapeTomlString(hooksPath)}"\n`;
}

function hook(command) {
  return {
    type: "command",
    command: `${hookScript} ${command}`,
    timeout: 5
  };
}

const hooksConfig = {
  user_prompt_submit: [
    {
      hooks: [hook("WORKING")]
    }
  ],
  pre_tool_use: [
    {
      matcher: "*",
      hooks: [hook("WORKING")]
    }
  ],
  permission_request: [
    {
      matcher: "*",
      hooks: [hook("NEED_INPUT")]
    }
  ],
  post_tool_use: [
    {
      matcher: "*",
      hooks: [hook("WORKING")]
    }
  ],
  stop: [
    {
      hooks: [hook("DONE")]
    }
  ]
};

fs.writeFileSync(hooksPath, `${JSON.stringify(hooksConfig, null, 2)}\n`);

let config = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
if (config && !fs.existsSync(`${configPath}.traffic-light.bak`)) {
  fs.writeFileSync(`${configPath}.traffic-light.bak`, config);
}
config = upsertLineByPrefix(
  config,
  "notify =",
  `notify = ["${escapeTomlString(notifyScript)}", "turn-ended"]`
);
config = upsertHooksPath(config);

fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, config.endsWith("\n") ? config : `${config}\n`);
console.log(`Updated ${configPath}`);
console.log(`Codex notify: ${notifyScript}`);
console.log(`Codex hooks: ${hooksPath}`);
