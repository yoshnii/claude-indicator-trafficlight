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

## Limitations

This setup targets Claude Code hooks. It does not automatically integrate with Claude desktop, Claude web, Cursor, or Codex.
