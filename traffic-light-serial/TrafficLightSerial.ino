#define RED_PIN     14  // D5
#define YEL_PIN     12  // D6
#define GRE_PIN     13  // D7

enum Mode {
  MODE_OFF,
  MODE_WORKING,
  MODE_DONE,
  MODE_INPUT
};

Mode currentMode = MODE_DONE;
unsigned long lastBlinkAt = 0;
bool yellowOn = false;

void setLights(bool red, bool yellow, bool green) {
  digitalWrite(RED_PIN, red ? HIGH : LOW);
  digitalWrite(YEL_PIN, yellow ? HIGH : LOW);
  digitalWrite(GRE_PIN, green ? HIGH : LOW);
}

void applyMode(Mode mode) {
  currentMode = mode;
  yellowOn = false;
  lastBlinkAt = millis();

  if (mode == MODE_OFF) {
    setLights(false, false, false);
  } else if (mode == MODE_DONE) {
    setLights(false, false, true);
  } else if (mode == MODE_INPUT) {
    setLights(true, false, false);
  } else if (mode == MODE_WORKING) {
    setLights(false, true, false);
    yellowOn = true;
  }
}

void handleCommand(String command) {
  command.trim();
  command.toUpperCase();

  if (command == "WORKING" || command == "THINKING" || command == "BUSY") {
    applyMode(MODE_WORKING);
    Serial.println("OK WORKING");
  } else if (command == "DONE" || command == "READY" || command == "IDLE") {
    applyMode(MODE_DONE);
    Serial.println("OK DONE");
  } else if (command == "NEED_INPUT" || command == "INPUT" || command == "WAITING" || command == "ERROR" || command == "RED") {
    applyMode(MODE_INPUT);
    Serial.println("OK NEED_INPUT");
  } else if (command == "OFF") {
    applyMode(MODE_OFF);
    Serial.println("OK OFF");
  } else if (command.length() > 0) {
    Serial.print("UNKNOWN ");
    Serial.println(command);
  }
}

void updateBlink() {
  if (currentMode != MODE_WORKING) {
    return;
  }

  unsigned long now = millis();
  if (now - lastBlinkAt >= 350) {
    lastBlinkAt = now;
    yellowOn = !yellowOn;
    setLights(false, yellowOn, false);
  }
}

void setup() {
  pinMode(RED_PIN, OUTPUT);
  pinMode(YEL_PIN, OUTPUT);
  pinMode(GRE_PIN, OUTPUT);

  Serial.begin(115200);
  applyMode(MODE_DONE);
  Serial.println("TRAFFIC_LIGHT_READY");
}

void loop() {
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    handleCommand(command);
  }

  updateBlink();
}
