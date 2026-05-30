# Claude Indicator Traffic Light

A small USB traffic-light indicator for Claude Code, built around an ESP8266 D1 mini and a red/yellow/green LED module.

## Status Colors

- Yellow blinking: Claude is working or thinking
- Green solid: Claude finished
- Red solid: Claude needs user input, permission, or attention
- Off: disabled

## Hardware

Tested hardware:

- ESP8266 D1 mini compatible board
- Traffic light LED module with `VCC`, `GND`, `Red`, `Yellow`, `Green`
- USB-C data cable
- Female-to-female Dupont wires

Wiring:

| LED Module | ESP8266 D1 mini |
| --- | --- |
| VCC | 3V3 or expansion board V |
| GND | G / GND |
| Red | D5 / GPIO14 |
| Yellow | D6 / GPIO12 |
| Green | D7 / GPIO13 |

The LED module is active-high: `HIGH` turns a light on, `LOW` turns it off.

## Flash Firmware

Open `traffic-light-serial/TrafficLightSerial.ino` in Arduino IDE.

Use:

- Board: `LOLIN(WEMOS) D1 R2 & mini`
- Port: the `/dev/cu...` USB serial port for the ESP8266

Upload the sketch. After boot, the default state is green.

## Manual Test

From this repository:

```bash
./scripts/send_traffic_light.sh WORKING
./scripts/send_traffic_light.sh DONE
./scripts/send_traffic_light.sh NEED_INPUT
./scripts/send_traffic_light.sh OFF
```

The sender auto-detects common macOS USB serial devices:

- `/dev/cu.usbserial*`
- `/dev/cu.wchusbserial*`
- `/dev/cu.SLAB_USBtoUART*`
- `/dev/cu.usbmodem*`

If auto-detection picks the wrong device, override it:

```bash
TRAFFIC_LIGHT_PORT=/dev/cu.usbserial-xxxx ./scripts/send_traffic_light.sh WORKING
```

Note: many ESP8266 USB-UART boards reset when the serial port opens. The sender waits briefly before writing the command.

## Install Claude Code Hooks

Run:

```bash
node scripts/install_claude_traffic_light_hooks.mjs
```

Then restart Claude Code.

Installed hook behavior:

- `UserPromptSubmit` -> `WORKING`
- `PreToolUse` -> `WORKING`
- `PermissionRequest` -> `NEED_INPUT`
- `Notification` -> `NEED_INPUT`
- `Stop` -> `DONE`
- `StopFailure` -> `NEED_INPUT`

Logs:

```bash
tail -n 50 /tmp/claude-traffic-light-hook.log
tail -n 50 /tmp/traffic-light-send.log
```

## Install Codex Support

Codex has a different integration surface than Claude Code. This repository includes two Codex integrations:

- `notify`: reliable turn-ended notification, used to set the light back to green when Codex finishes a turn.
- `hooks.path`: optional Codex lifecycle hooks for `user_prompt_submit`, `pre_tool_use`, `permission_request`, `post_tool_use`, and `stop`.
- `scripts/codex_with_traffic_light.sh`: a reliable wrapper for one-shot Codex CLI tasks.

Run:

```bash
node scripts/install_codex_traffic_light.mjs
```

The installer updates `~/.codex/config.toml`, creates a one-time backup at `~/.codex/config.toml.traffic-light.bak`, and preserves the existing Computer Use notification by chaining it from `scripts/codex_notify_traffic_light.sh`.

Restart Codex after installing.

Expected behavior, if the current Codex build accepts lifecycle hooks:

- Prompt submitted or tool use starts -> `WORKING`
- Permission request -> `NEED_INPUT`
- Turn stop -> `DONE`

If lifecycle hooks are not accepted in a future Codex build, the `notify` fallback should still set `DONE` at turn end.

### Codex CLI Wrapper

For a more reliable command-line workflow, run Codex through the wrapper:

```bash
./scripts/codex_with_traffic_light.sh exec "your task"
```

The wrapper behavior is process-based:

- Before Codex starts -> `WORKING`
- Codex exits successfully -> `DONE`
- Codex exits with an error, is interrupted, or the Codex CLI is missing -> `NEED_INPUT`

By default, the wrapper starts Codex with `--dangerously-bypass-hook-trust` so the configured local traffic-light hooks can run in Terminal sessions. To disable that for one command:

```bash
CODEX_TRAFFIC_LIGHT_BYPASS_HOOK_TRUST=0 ./scripts/codex_with_traffic_light.sh exec "your task"
```

If your Codex CLI is not named `codex` or is not on `PATH`, set `CODEX_BIN`:

```bash
CODEX_BIN=/path/to/codex ./scripts/codex_with_traffic_light.sh exec "your task"
```

This wrapper is best for `codex exec ...` style one-shot tasks. In an interactive Codex session, it only tracks the lifetime of the whole CLI process, not each individual prompt inside that process.

### Terminal Command Integration

To make the wrapper automatic in macOS Terminal or any zsh terminal, install the shell integration:

```bash
node scripts/install_codex_terminal_integration.mjs
```

The installer writes `~/.codex/codex-traffic-light.zsh`, updates `~/.zshrc`, and keeps a one-time backup at `~/.zshrc.codex-traffic-light.bak`. It auto-detects the Codex CLI from common locations, including `/Applications/Codex.app/Contents/Resources/codex`.

Then restart Terminal, or run:

```bash
source ~/.zshrc
```

After that, typing `codex ...` in Terminal calls the traffic-light wrapper automatically:

- `codex exec "your task"` -> yellow while the Codex CLI process is running, then green on success
- `codex` -> yellow while the interactive Codex CLI session is open, then green after you exit
- failed or interrupted Codex process -> red
- if Codex emits a `permission_request` hook -> red

To bypass the wrapper for one command:

```bash
CODEX_TRAFFIC_LIGHT_DISABLE=1 codex --version
```

## ChatGPT

ChatGPT web/desktop does not expose a local Claude-style hook that can observe every model state and directly write to USB serial. ChatGPT custom apps use MCP/Apps, and remote MCP servers can expose explicit tools, but that is not the same as automatic local status hooks.

A practical ChatGPT integration would be manual/tool-driven: expose a `set_traffic_light` tool through an MCP app and ask ChatGPT to call it. Automatic "thinking/done/input-required" status mirroring is not currently available through the normal ChatGPT app UI.

## Limitations

Claude Code has the cleanest lifecycle hook support. Codex support depends on the currently installed Codex build accepting lifecycle hooks from `hooks.path`; `notify` remains available as a turn-ended fallback, and the Codex CLI wrapper is available for one-shot CLI tasks. Claude desktop/web, ChatGPT desktop/web, and Cursor do not use this repository's local hook files automatically.
