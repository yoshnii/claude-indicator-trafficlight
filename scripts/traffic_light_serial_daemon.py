#!/usr/bin/env python3
import errno
import glob
import os
import selectors
import signal
import sys
import termios
import time

FIFO = os.environ.get("TRAFFIC_LIGHT_FIFO", "/tmp/traffic-light-commands.fifo")
LOG_FILE = os.environ.get("TRAFFIC_LIGHT_LOG", "/tmp/traffic-light-daemon.log")
BAUD = termios.B115200
PORT_PATTERNS = (
    "/dev/cu.usbserial*",
    "/dev/cu.wchusbserial*",
    "/dev/cu.SLAB_USBtoUART*",
    "/dev/cu.usbmodem*",
)

running = True


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


def open_serial():
    port = find_serial_port()
    fd = os.open(port, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
    configure_serial(fd)
    log(f"serial_open port={port}")
    # ESP8266 USB-UART boards often reset when the serial port opens.
    time.sleep(2)
    return fd


def ensure_fifo():
    if os.path.exists(FIFO):
        if not os.path.exists(FIFO) or not stat_is_fifo(FIFO):
            raise RuntimeError(f"{FIFO} exists but is not a FIFO")
        return
    os.mkfifo(FIFO, 0o666)
    log(f"fifo_created path={FIFO}")


def stat_is_fifo(path):
    import stat

    return stat.S_ISFIFO(os.stat(path).st_mode)


def handle_signal(_signum, _frame):
    global running
    running = False


def main():
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    ensure_fifo()
    serial_fd = open_serial()
    fifo_fd = os.open(FIFO, os.O_RDWR | os.O_NONBLOCK)

    selector = selectors.DefaultSelector()
    selector.register(fifo_fd, selectors.EVENT_READ)

    buffer = ""
    log("daemon_ready")

    while running:
        for key, _mask in selector.select(timeout=1):
            if key.fd != fifo_fd:
                continue
            try:
                data = os.read(fifo_fd, 4096)
            except BlockingIOError:
                continue
            if not data:
                continue

            buffer += data.decode("utf-8", errors="ignore")
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                command = line.strip().upper()
                if not command:
                    continue
                os.write(serial_fd, f"{command}\n".encode("utf-8"))
                log(f"sent command={command}")

    log("daemon_stopping")
    os.close(fifo_fd)
    os.close(serial_fd)


if __name__ == "__main__":
    try:
        main()
    except OSError as exc:
        if exc.errno == errno.ENOENT:
            log("error serial_missing")
        else:
            log(f"error errno={exc.errno} message={exc}")
        sys.exit(1)
    except Exception as exc:
        log(f"error message={exc}")
        sys.exit(1)
