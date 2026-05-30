#!/usr/bin/env python3
import errno
import glob
import os
import sys
import termios
import time

FIFO = os.environ.get("TRAFFIC_LIGHT_FIFO", "/tmp/traffic-light-commands.fifo")
LOG_FILE = os.environ.get("TRAFFIC_LIGHT_SEND_LOG", "/tmp/traffic-light-send.log")
BAUD = termios.B115200
PORT_PATTERNS = (
    "/dev/cu.usbserial*",
    "/dev/cu.wchusbserial*",
    "/dev/cu.SLAB_USBtoUART*",
    "/dev/cu.usbmodem*",
)


def log(message):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a", encoding="utf-8") as log_handle:
        log_handle.write(f"{timestamp} {message}\n")


def configure_serial(fd):
    attrs = termios.tcgetattr(fd)
    attrs[0] = 0
    attrs[1] = 0
    attrs[2] = termios.CS8 | termios.CREAD | termios.CLOCAL
    attrs[3] = 0
    attrs[4] = BAUD
    attrs[5] = BAUD
    attrs[6][termios.VMIN] = 0
    attrs[6][termios.VTIME] = 0
    termios.tcsetattr(fd, termios.TCSANOW, attrs)


def find_serial_port():
    configured = os.environ.get("TRAFFIC_LIGHT_PORT")
    if configured:
        if os.path.exists(configured):
            return configured
        raise FileNotFoundError(f"TRAFFIC_LIGHT_PORT does not exist: {configured}")

    candidates = []
    for pattern in PORT_PATTERNS:
        candidates.extend(glob.glob(pattern))

    candidates = sorted(
        port
        for port in candidates
        if "Bluetooth" not in port and "debug-console" not in port
    )
    if not candidates:
        raise FileNotFoundError(
            "No USB serial device found. Set TRAFFIC_LIGHT_PORT=/dev/cu.xxx if needed."
        )
    return candidates[0]


def send_to_fifo(command):
    if not os.path.exists(FIFO):
        return False
    try:
        fd = os.open(FIFO, os.O_WRONLY | os.O_NONBLOCK)
    except OSError as exc:
        if exc.errno in (errno.ENXIO, errno.ENOENT):
            return False
        raise
    with os.fdopen(fd, "w", encoding="utf-8", closefd=True) as handle:
        handle.write(f"{command}\n")
    log(f"sent_via_fifo command={command}")
    return True


def send_direct(command):
    port = find_serial_port()
    fd = os.open(port, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
    try:
        configure_serial(fd)
        time.sleep(2)
        os.write(fd, f"{command}\n".encode("utf-8"))
        log(f"sent_direct command={command} port={port}")
    finally:
        os.close(fd)


def main():
    command = (sys.argv[1] if len(sys.argv) > 1 else "DONE").strip().upper()
    if not command:
        return
    if send_to_fifo(command):
        return
    send_direct(command)


if __name__ == "__main__":
    main()
