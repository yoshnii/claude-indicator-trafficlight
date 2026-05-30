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

## ChatGPT

ChatGPT web/desktop does not expose a local Claude-style hook that can observe every model state and directly write to USB serial. ChatGPT custom apps use MCP/Apps, and remote MCP servers can expose explicit tools, but that is not the same as automatic local status hooks.

A practical ChatGPT integration would be manual/tool-driven: expose a `set_traffic_light` tool through an MCP app and ask ChatGPT to call it. Automatic "thinking/done/input-required" status mirroring is not currently available through the normal ChatGPT app UI.

## Limitations

Claude Code has the cleanest lifecycle hook support. Codex support depends on the currently installed Codex build accepting lifecycle hooks from `hooks.path`; `notify` remains available as a turn-ended fallback. Claude desktop/web, ChatGPT desktop/web, and Cursor do not use this repository's local hook files automatically.
