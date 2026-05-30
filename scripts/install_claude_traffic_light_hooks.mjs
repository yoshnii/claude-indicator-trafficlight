import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
const repoRoot = path.resolve(import.meta.dirname, "..");
const hookScript = path.join(repoRoot, "scripts", "claude_traffic_light_hook.sh");

function command(status) {
  return `${hookScript} ${status}`;
}

const desired = {
  SessionStart: [
    {
      matcher: "startup|resume|clear|compact",
      hooks: [
        {
          type: "command",
          command: command("DONE"),
          timeout: 5,
          async: true
        }
      ]
    }
  ],
  UserPromptSubmit: [
    {
      hooks: [
        {
          type: "command",
          command: command("WORKING"),
          timeout: 5,
          async: true
        }
      ]
    }
  ],
  PreToolUse: [
    {
      matcher: "*",
      hooks: [
        {
          type: "command",
          command: command("WORKING"),
          timeout: 5,
          async: true
        }
      ]
    }
  ],
  PermissionRequest: [
    {
      matcher: "*",
      hooks: [
        {
          type: "command",
          command: command("NEED_INPUT"),
          timeout: 5,
          async: true
        }
      ]
    }
  ],
  Notification: [
    {
      matcher: "permission_prompt|idle_prompt|elicitation_dialog|elicitation_response",
      hooks: [
        {
          type: "command",
          command: command("NEED_INPUT"),
          timeout: 5,
          async: true
        }
      ]
    }
  ],
  Stop: [
    {
      hooks: [
        {
          type: "command",
          command: command("DONE"),
          timeout: 5,
          async: true
        }
      ]
    }
  ],
  StopFailure: [
    {
      matcher: "*",
      hooks: [
        {
          type: "command",
          command: command("NEED_INPUT"),
          timeout: 5,
          async: true
        }
      ]
    }
  ]
};

function readSettings() {
  if (!fs.existsSync(settingsPath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
}

function hookKey(handler) {
  return JSON.stringify({
    type: handler.type,
    command: handler.command,
  });
}

function groupKey(group) {
  return group.matcher ?? "";
}

function mergeGroup(existingGroup, desiredGroup) {
  const merged = {
    ...existingGroup,
    hooks: Array.isArray(existingGroup.hooks) ? [...existingGroup.hooks] : []
  };
  const existingHookKeys = new Set(merged.hooks.map(hookKey));

  for (const handler of desiredGroup.hooks ?? []) {
    if (!existingHookKeys.has(hookKey(handler))) {
      merged.hooks.push(handler);
    }
  }

  return merged;
}

const settings = readSettings();
settings.hooks = settings.hooks && typeof settings.hooks === "object" ? settings.hooks : {};

for (const groups of Object.values(settings.hooks)) {
  if (!Array.isArray(groups)) {
    continue;
  }
  for (const group of groups) {
    if (!Array.isArray(group.hooks)) {
      continue;
    }
    group.hooks = group.hooks.filter((handler) => handler.command !== hookScript);
  }
}

for (const [eventName, desiredGroups] of Object.entries(desired)) {
  const existingGroups = Array.isArray(settings.hooks[eventName]) ? settings.hooks[eventName] : [];
  const mergedGroups = [...existingGroups];

  for (const desiredGroup of desiredGroups) {
    const index = mergedGroups.findIndex((group) => groupKey(group) === groupKey(desiredGroup));
    if (index >= 0) {
      mergedGroups[index] = mergeGroup(mergedGroups[index], desiredGroup);
    } else {
      mergedGroups.push(desiredGroup);
    }
  }

  settings.hooks[eventName] = mergedGroups;
}

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
console.log(`Updated ${settingsPath}`);
