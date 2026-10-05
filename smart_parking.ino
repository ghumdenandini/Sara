/*
 * =====================================================================
 * Smart Parking System - ESP32 Firmware
 * =====================================================================
 * 
 * Hardware Connections:
 * - IR Sensor 1 (Slot 1)  -> GPIO 18
 * - IR Sensor 2 (Slot 2)  -> GPIO 19
 * - Status LED 1 (Slot 1) -> GPIO 25 (via 220Ω-330Ω resistor)
 * - Status LED 2 (Slot 2) -> GPIO 26 (via 220Ω-330Ω resistor)
 * - 16x2 LCD I2C SDA      -> GPIO 21
 * - 16x2 LCD I2C SCL      -> GPIO 22
 * - LCD I2C Address       -> 0x27
 * 
 * Required Arduino Libraries (Install via Arduino Library Manager):
 * 1. "LiquidCrystal I2C" by Frank de Brabander or Marco Schwartz
 * 2. "ArduinoJson" by Benoit Blanchon (v6 or v7)
 * 3. Built-in ESP32 "WiFi", "HTTPClient", "WiFiClientSecure", "Wire"
 * =====================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

// ---------------------------------------------------------------------
// CONFIGURATION (Set your WiFi & Render/Local URL here)
// ---------------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Render Deployed URL or Local Server URL (Do not include trailing slash)
// Example Local:  "http://192.168.1.100:3000"
// Example Render: "https://smart-parking-system.onrender.com"
const char* SERVER_URL    = "YOUR_RENDER_URL";

// ---------------------------------------------------------------------
// HARDWARE PIN DEFINITIONS
// ---------------------------------------------------------------------
#define IR_PIN_1      18
#define IR_PIN_2      19
#define LED_PIN_1     25
#define LED_PIN_2     26
#define I2C_SDA       21
#define I2C_SCL       22

// Standard IR obstacle sensors output LOW when an obstacle is detected
#define SENSOR_DETECTED_STATE LOW

// 16x2 LCD with I2C Module at address 0x27
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ---------------------------------------------------------------------
// GLOBAL TELEMETRY STATE
// ---------------------------------------------------------------------
bool slot1_vehicle = false;
bool slot2_vehicle = false;

String slot1_status = "AVAILABLE";
String slot2_status = "AVAILABLE";

bool slot1_reserved = false;
bool slot2_reserved = false;

int totalSlots    = 2;
int availableSlots = 2;
int reservedSlots = 0;
int occupiedSlots = 0;

// LCD Cycling Screen Management (non-blocking)
unsigned long lastLcdCycleTime = 0;
int lcdScreenIndex = 0;
const unsigned long LCD_CYCLE_INTERVAL = 2500; // 2.5 seconds per screen

// Telemetry HTTP Transmission Timer (non-blocking)
unsigned long lastServerSyncTime = 0;
const unsigned long SERVER_SYNC_INTERVAL = 1500; // 1.5 seconds

// ---------------------------------------------------------------------
// FUNCTION DECLARATIONS
// ---------------------------------------------------------------------
void initLcdDisplay();
void connectWiFi();
void readSensors();
void sendTelemetryToServer();
void updateLeds();
void updateLcdScreen();

// ---------------------------------------------------------------------
// SETUP
// ---------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n--- Starting Smart Parking System ESP32 ---");

  // Initialize GPIO Pins
  pinMode(IR_PIN_1, INPUT_PULLUP);
  pinMode(IR_PIN_2, INPUT_PULLUP);
  pinMode(LED_PIN_1, OUTPUT);
  pinMode(LED_PIN_2, OUTPUT);

  digitalWrite(LED_PIN_1, LOW);
  digitalWrite(LED_PIN_2, LOW);

  // Initialize I2C and LCD
  Wire.begin(I2C_SDA, I2C_SCL);
  lcd.init();
  lcd.backlight();
  lcd.clear();

  // Startup Screen:
  // SMART PARKING
  // SYSTEM
  // Delay 3 seconds
  lcd.setCursor(1, 0);
  lcd.print("SMART PARKING");
  lcd.setCursor(5, 1);
  lcd.print("SYSTEM");
  Serial.println("LCD: SMART PARKING SYSTEM");
  delay(3000);

  // WiFi Connection Screen
  connectWiFi();
}

// ---------------------------------------------------------------------
// WIFI CONNECTION
// ---------------------------------------------------------------------
void connectWiFi() {
  lcd.clear();
  lcd.setCursor(1, 0);
  lcd.print("CONNECTING TO");
  lcd.setCursor(2, 1);
  lcd.print("WiFi........");
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  lcd.clear();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected! IP: " + WiFi.localIP().toString());
    lcd.setCursor(6, 0);
    lcd.print("WiFi");
    lcd.setCursor(3, 1);
    lcd.print("CONNECTED");
    delay(1500);
  } else {
    Serial.println("\nWiFi Connection Failed! Proceeding in offline mode.");
    lcd.setCursor(1, 0);
    lcd.print("WiFi OFFLINE");
    lcd.setCursor(0, 1);
    lcd.print("Check Config!");
    delay(2000);
  }
  lcd.clear();
}

// ---------------------------------------------------------------------
// MAIN LOOP
// ---------------------------------------------------------------------
void loop() {
  // 1. Read IR sensors continuously
  readSensors();

  // 2. Transmit telemetry to server & fetch reservation status periodically
  if (millis() - lastServerSyncTime >= SERVER_SYNC_INTERVAL) {
    lastServerSyncTime = millis();
    sendTelemetryToServer();
  }

  // 3. Update Hardware LEDs based on latest status
  updateLeds();

  // 4. Update LCD display smoothly through its 3 cycle screens
  if (millis() - lastLcdCycleTime >= LCD_CYCLE_INTERVAL) {
    lastLcdCycleTime = millis();
    lcdScreenIndex = (lcdScreenIndex + 1) % 3;
    updateLcdScreen();
  }

  delay(20); // Small cooperative multitasking yield
}

// ---------------------------------------------------------------------
// SENSOR READING
// ---------------------------------------------------------------------
void readSensors() {
  // Read Sensor 1 (Slot 1)
  int val1 = digitalRead(IR_PIN_1);
  slot1_vehicle = (val1 == SENSOR_DETECTED_STATE);

  // Read Sensor 2 (Slot 2)
  int val2 = digitalRead(IR_PIN_2);
  slot2_vehicle = (val2 == SENSOR_DETECTED_STATE);
}

// ---------------------------------------------------------------------
// SERVER SYNCHRONIZATION (HTTP REST APIs)
// ---------------------------------------------------------------------
void sendTelemetryToServer() {
  if (WiFi.status() != WL_CONNECTED) {
    // Local fallback calculation if WiFi not connected
    slot1_status = slot1_vehicle ? "OCCUPIED" : (slot1_reserved ? "RESERVED" : "AVAILABLE");
    slot2_status = slot2_vehicle ? "OCCUPIED" : (slot2_reserved ? "RESERVED" : "AVAILABLE");
    
    occupiedSlots = (slot1_vehicle ? 1 : 0) + (slot2_vehicle ? 1 : 0);
    reservedSlots = (!slot1_vehicle && slot1_reserved ? 1 : 0) + (!slot2_vehicle && slot2_reserved ? 1 : 0);
    availableSlots = 2 - (occupiedSlots + reservedSlots);
    return;
  }

  String serverBase = String(SERVER_URL);
  if (serverBase == "YOUR_RENDER_URL" || serverBase.length() < 7) {
    // URL not yet configured by user
    return;
  }

  // Determine if using HTTPS (Render) or HTTP (Local)
  bool isHttps = serverBase.startsWith("https://");

  WiFiClientSecure clientSecure;
  WiFiClient clientHttp;

  HTTPClient http;

  if (isHttps) {
    clientSecure.setInsecure(); // Bypass SSL fingerprint check on Render's Let's Encrypt cert
    http.begin(clientSecure, serverBase + "/api/parking/update");
  } else {
    http.begin(clientHttp, serverBase + "/api/parking/update");
  }

  http.addHeader("Content-Type", "application/json");

  // Build JSON Payload for POST /api/parking/update:
  // {
  //   "slot1": { "vehicleDetected": true/false },
  //   "slot2": { "vehicleDetected": true/false }
  // }
  StaticJsonDocument<256> reqDoc;
  JsonObject s1Obj = reqDoc.createNestedObject("slot1");
  s1Obj["vehicleDetected"] = slot1_vehicle;

  JsonObject s2Obj = reqDoc.createNestedObject("slot2");
  s2Obj["vehicleDetected"] = slot2_vehicle;

  String requestJson;
  serializeJson(reqDoc, requestJson);

  int httpCode = http.POST(requestJson);

  if (httpCode == HTTP_CODE_OK || httpCode == 201) {
    String responseJson = http.getString();
    
    // Parse response
    StaticJsonDocument<512> resDoc;
    DeserializationError error = deserializeJson(resDoc, responseJson);

    if (!error) {
      totalSlots     = resDoc["totalSlots"] | 2;
      availableSlots = resDoc["availableSlots"] | 0;
      reservedSlots  = resDoc["reservedSlots"] | 0;
      occupiedSlots  = resDoc["occupiedSlots"] | 0;

      JsonObject slots = resDoc["slots"];
      if (slots.containsKey("slot1")) {
        const char* s1St = slots["slot1"]["status"];
        slot1_status = String(s1St);
        slot1_status.toUpperCase();
        slot1_reserved = slots["slot1"]["reserved"] | false;
      }
      if (slots.containsKey("slot2")) {
        const char* s2St = slots["slot2"]["status"];
        slot2_status = String(s2St);
        slot2_status.toUpperCase();
        slot2_reserved = slots["slot2"]["reserved"] | false;
      }
    }
  } else {
    Serial.printf("HTTP POST /api/parking/update failed, code: %d\n", httpCode);
  }

  http.end();
}

// ---------------------------------------------------------------------
// LED HARDWARE CONTROL
// ---------------------------------------------------------------------
void updateLeds() {
  // LED 1 (Slot 1 -> GPIO 25):
  // LED ON  -> Slot is occupied or reserved
  // LED OFF -> Slot is available
  if (slot1_vehicle || slot1_reserved || slot1_status == "OCCUPIED" || slot1_status == "RESERVED") {
    digitalWrite(LED_PIN_1, HIGH);
  } else {
    digitalWrite(LED_PIN_1, LOW);
  }

  // LED 2 (Slot 2 -> GPIO 26):
  // LED ON  -> Slot is occupied or reserved
  // LED OFF -> Slot is available
  if (slot2_vehicle || slot2_reserved || slot2_status == "OCCUPIED" || slot2_status == "RESERVED") {
    digitalWrite(LED_PIN_2, HIGH);
  } else {
    digitalWrite(LED_PIN_2, LOW);
  }
}

// ---------------------------------------------------------------------
// LCD 16x2 CYCLING DISPLAY
// ---------------------------------------------------------------------
void updateLcdScreen() {
  lcd.clear();

  switch (lcdScreenIndex) {
    case 0:
      // Screen 1:
      // S1: AVAILABLE / OCCUPIED / RESERVED
      // S2: AVAILABLE / OCCUPIED / RESERVED
      lcd.setCursor(0, 0);
      lcd.print("S1: " + slot1_status.substring(0, 12));
      lcd.setCursor(0, 1);
      lcd.print("S2: " + slot2_status.substring(0, 12));
      break;

    case 1:
      // Screen 2:
      // TOTAL: 2
      // AVAIL: X
      lcd.setCursor(0, 0);
      lcd.print("TOTAL: " + String(totalSlots));
      lcd.setCursor(0, 1);
      lcd.print("AVAIL: " + String(availableSlots));
      break;

    case 2:
      // Screen 3:
      // RES: X
      // OCC: X
      lcd.setCursor(0, 0);
      lcd.print("RES: " + String(reservedSlots));
      lcd.setCursor(0, 1);
      lcd.print("OCC: " + String(occupiedSlots));
      break;
  }
}
