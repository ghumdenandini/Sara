
# Create IoT + Web Application

## IoT Details

**Project/App Name: Smart Parking System**

### Microcontroller:
ESP32

### Sensors:
- IR Sensor 1 → Parking Slot 1 → GPIO 18
- IR Sensor 2 → Parking Slot 2 → GPIO 19

### Display:
16x2 LCD with I2C Module
- SDA → GPIO 21
- SCL → GPIO 22
- I2C Address → 0x27

### LEDs:
- LED 1 → Parking Slot 1 → GPIO 25
- LED 2 → Parking Slot 2 → GPIO 26

Use suitable resistors (220Ω–330Ω) with LEDs.

### Other Hardware:
- Breadboard
- Resistors
- Jumper Wires
- USB Cable
- ESP32

---

# MOST IMPORTANT

**This Web App should be fully deployable on Render.**

The backend must listen on:

```javascript
process.env.PORT
```

and use:

```javascript
app.listen(PORT, '0.0.0.0')
```

Do not hardcode the localhost port for production.

The project must be structured so that it can be directly connected to a Render Web Service.

---

# Web Application

## Tech Stack

### Frontend:
HTML, CSS, JavaScript, Tailwind CSS

### Backend:
Node.js, Express.js

### Database:
SQLite

### Communication:
REST API between ESP32 and Node.js/Express backend.

The ESP32 must communicate with the deployed Render backend using HTTP requests.

---

# Web Application Features

## Page 1: Login Page

Create a modern login page.

Fields:

- Email
- Password

Buttons:

- Login
- Register

Registration fields:

- Name
- Email
- Password

After successful login, redirect the user to the Smart Parking Dashboard.

---

# Page 2: Web Dashboard

## Tab 1: Parking Dashboard

Show the following KPI cards with large and attractive UI:

### Card 1:
**TOTAL SLOTS**

Display:

```text
2
```

### Card 2:
**AVAILABLE SLOTS**

Display the number of currently available parking slots.

### Card 3:
**RESERVED SLOTS**

Display the number of slots currently reserved through the website.

### Card 4:
**OCCUPIED SLOTS**

Display the number of slots where a vehicle is physically detected by the IR sensors.

---

# Parking Slot Display

Display individual parking slot cards.

For example:

```text
SLOT 1

Status:
AVAILABLE

[ RESERVE ]
```

and

```text
SLOT 2

Status:
OCCUPIED

[ NOT AVAILABLE ]
```

The website must display the real-time status of each parking slot.

---

# Parking Slot Status

Each slot can have the following states:

### Available

```text
🟢 AVAILABLE
```

The IR sensor does not detect a vehicle and the slot is not reserved.

### Reserved

```text
🟡 RESERVED
```

The user has reserved the slot from the website but the vehicle has not yet been detected.

### Occupied

```text
🔴 OCCUPIED
```

The IR sensor detects a vehicle in the parking slot.

---

# Reservation Feature

The user must be able to reserve an available parking slot from the website.

Example:

```text
SLOT 1
AVAILABLE

[ RESERVE SLOT ]
```

When the user clicks **RESERVE SLOT**:

1. Send reservation request to the Node.js backend.
2. Store the reservation in SQLite.
3. Change Slot 1 status to RESERVED.
4. Update Reserved Slots count.
5. Decrease Available Slots count.
6. Send the updated reservation status to ESP32.
7. ESP32 must update the corresponding LED.
8. LCD must display the updated parking status.

A reserved slot must not be available for another reservation.

---

# IMPORTANT STATUS LOGIC

The system must distinguish between:

**Physical vehicle detection** and **Website reservation**.

The IR sensors determine whether a vehicle is physically present.

The website determines whether a slot has been reserved.

Use the following logic:

| Vehicle | Reserved | Final Status |
|---|---|---|
| No | No | AVAILABLE |
| No | Yes | RESERVED |
| Yes | No | OCCUPIED |
| Yes | Yes | OCCUPIED / RESERVED |

If a reserved slot gets a vehicle, show:

```text
OCCUPIED
```

and retain the reservation information in the database.

---

# Real-Time Parking Detection

ESP32 must continuously read both IR sensors.

### Slot 1:

```text
IR Sensor 1 → GPIO 18
```

### Slot 2:

```text
IR Sensor 2 → GPIO 19
```

When a vehicle enters Slot 1:

```text
Slot 1 → OCCUPIED
```

When the vehicle leaves:

```text
Slot 1 → AVAILABLE
```

provided that the slot is not reserved.

The same logic must apply to Slot 2.

The website must automatically update according to the latest ESP32 sensor data.

---

# Real-Time Updates

The system should continuously synchronize:

```text
ESP32
   ↓
Node.js Backend
   ↓
SQLite Database
   ↓
Website Dashboard
```

The website should update parking information automatically without requiring the user to manually refresh the page.

Use polling or another simple real-time mechanism suitable for a student IoT project.

Recommended:

```text
Website requests updated parking status every 1–2 seconds.
```

---

# Tab 2: Parking Slot Management

Create a separate dashboard tab showing all parking slots.

Display:

```text
Slot Number
Current Status
Reservation Status
Vehicle Detection
LED Status
Last Updated
```

Example:

```text
# | Slot | Status    | Reserved | Vehicle | LED
1 | S1   | Available | No       | No      | OFF
2 | S2   | Occupied  | No       | Yes     | ON
```

---

# Tab 3: Reservation Management

Display all current reservations.

Columns:

```text
# | Slot | User | Reservation Status | Date | Time | Action
```

Allow the user to cancel their reservation.

When a reservation is cancelled:

1. Remove/update the reservation in SQLite.
2. Update the slot status.
3. Update Available Slots count.
4. Update Reserved Slots count.
5. Send updated information to ESP32.
6. Update LCD.
7. Update LED.

---

# ESP32 Communication APIs

Create REST APIs for communication between ESP32 and the backend.

## ESP32 → Server

Create API:

```text
POST /api/parking/update
```

ESP32 should send:

```json
{
  "slot1": {
    "vehicleDetected": true
  },
  "slot2": {
    "vehicleDetected": false
  }
}
```

The backend must update the database and calculate:

```text
Total Slots
Available Slots
Reserved Slots
Occupied Slots
```

---

# Server → ESP32

Create API:

```text
GET /api/parking/status
```

The ESP32 should periodically request the latest parking and reservation status.

Example response:

```json
{
  "totalSlots": 2,
  "availableSlots": 1,
  "reservedSlots": 1,
  "occupiedSlots": 0,
  "slots": {
    "slot1": {
      "status": "reserved",
      "reserved": true,
      "vehicleDetected": false
    },
    "slot2": {
      "status": "available",
      "reserved": false,
      "vehicleDetected": false
    }
  }
}
```

---

# Reservation API

Create:

```text
POST /api/parking/reserve
```

Example request:

```json
{
  "slot": 1
}
```

The backend must check whether the slot is available before reserving it.

If available:

```text
Reservation Successful
```

If already occupied:

```text
Slot Occupied
```

If already reserved:

```text
Slot Already Reserved
```

---

# Cancel Reservation API

Create:

```text
POST /api/parking/cancel
```

Example:

```json
{
  "slot": 1
}
```

After cancellation, update the database and ESP32.

---

# LCD Hardware Output

## LCD 16x2 I2C

Use the LCD to show the real-time parking information.

### Startup

```text
SMART PARKING
SYSTEM
```

Delay 3 seconds.

### WiFi Connection

```text
CONNECTING TO
WiFi........
```

### After Connection

```text
WiFi
CONNECTED
```

### Main Parking Display

Display:

```text
S1: AVAILABLE
S2: OCCUPIED
```

Then:

```text
TOTAL: 2
AVAIL: 1
```

Then:

```text
RES: 0
OCC: 1
```

Then continue cycling through the information.

---

# LCD Reservation Display

If Slot 1 is reserved:

```text
S1: RESERVED
S2: AVAILABLE
```

If Slot 1 becomes occupied:

```text
S1: OCCUPIED
S2: AVAILABLE
```

The LCD must always show the latest information received from the server.

---

# LED Hardware Logic

### Slot 1

```text
LED 1 → GPIO 25
```

### Slot 2

```text
LED 2 → GPIO 26
```

For the basic hardware version:

```text
LED ON  → Slot is occupied/reserved
LED OFF → Slot is available
```

If multiple LEDs are available, support:

```text
GREEN → AVAILABLE
YELLOW → RESERVED
RED → OCCUPIED
```

The LED status must be controlled according to the latest status received from the server.

---

# ESP32 Main Loop

The ESP32 must continuously perform these tasks:

### 1. Read IR sensors

```text
Read Sensor 1
Read Sensor 2
```

### 2. Determine vehicle status

```text
Slot 1 → Vehicle Detected / Not Detected
Slot 2 → Vehicle Detected / Not Detected
```

### 3. Send sensor data to server

```text
POST /api/parking/update
```

### 4. Fetch reservation information

```text
GET /api/parking/status
```

### 5. Update LEDs

According to:

```text
Available
Reserved
Occupied
```

### 6. Update LCD

Show the latest parking information.

Repeat continuously.

---

# WiFi Credentials

Use variables in ESP32 code:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
```

Do not hardcode real credentials in publicly uploaded GitHub code.

---

# Render URL

Keep this variable configurable:

```cpp
const char* SERVER_URL = "YOUR_RENDER_URL";
```

After deployment, the user can enter the Render URL.

Example:

```text
https://smart-parking-system.onrender.com
```

Do not hardcode a fake Render URL.

---

# Render Deployment Requirements

The Node.js application must be compatible with Render.

Use:

```javascript
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
```

Create:

```text
package.json
```

with the required dependencies.

The application must provide a proper start command:

```text
npm start
```

The Render deployment must serve both:

```text
Frontend
+
Backend APIs
```

from the same deployed application.

---

# Project Folder Structure

Use a clean structure similar to:

```text
Smart-Parking-System/
│
├── server.js
├── package.json
├── parking.db
│
├── public/
│   ├── index.html
│   ├── dashboard.html
│   ├── style.css
│   └── script.js
│
└── esp32/
    └── smart_parking.ino
```

Do not expose sensitive credentials.

---

# Web App Header

Header should display:

```text
🚗 SMART PARKING SYSTEM

Welcome, User
```

Also display:

```text
ESP32 STATUS: ONLINE
```

or:

```text
ESP32 STATUS: OFFLINE
```

The ESP32 online/offline status should be determined from its latest communication with the server.

---

# ESP32 Online / Offline

If ESP32 has not communicated with the server for a specified period, show:

```text
ESP32: OFFLINE
```

When ESP32 sends data again:

```text
ESP32: ONLINE
```

Display this status on the website dashboard.

---

# Web App Theme

Use a modern smart-city / parking theme.

Use:

- Gradient colors
- Modern cards
- Rounded corners
- Icons
- Responsive layout
- Clean dashboard
- Parking/vehicle related UI

Add:

**Light/Dark Mode Toggle**

The website must work properly on:

- Desktop
- Laptop
- Tablet
- Mobile

---

# Dashboard Design

Use visually attractive cards:

```text
┌──────────────┐
│ TOTAL SLOTS  │
│      2       │
└──────────────┘

┌──────────────┐
│  AVAILABLE   │
│      1       │
└──────────────┘

┌──────────────┐
│   RESERVED   │
│      1       │
└──────────────┘

┌──────────────┐
│   OCCUPIED   │
│      0       │
└──────────────┘
```

Use status colors:

```text
Available → Green
Reserved → Yellow
Occupied → Red
```

---

# Parking Visualization

Create a visual parking area on the dashboard.

Example:

```text
          PARKING AREA

┌──────────────────┐
│     SLOT 1       │
│                  │
│    🟢 FREE       │
│                  │
└──────────────────┘

┌──────────────────┐
│     SLOT 2       │
│                  │
│    🔴 OCCUPIED   │
│                  │
└──────────────────┘
```

The visualization must update automatically according to the ESP32 sensor data.

---

# Timezone

Use:

```text
Asia/Kolkata
UTC +5:30
```

Display reservation date and time according to Indian Standard Time.

---

# Database

Create a SQLite database with appropriate tables.

### Slots Table

```text
id
slot_number
status
vehicle_detected
reserved
updated_at
```

### Users Table

```text
id
name
email
password
```

### Reservations Table

```text
id
slot_number
user_id
status
reserved_at
cancelled_at
```

---

# Important Functional Requirements

The system must satisfy all of the following:

1. ESP32 connects to WiFi.
2. ESP32 reads both IR sensors.
3. IR Sensor 1 controls Slot 1 detection.
4. IR Sensor 2 controls Slot 2 detection.
5. ESP32 sends sensor information to the Node.js server.
6. Server stores the latest status.
7. Website displays real-time parking status.
8. Website displays Total Slots.
9. Website displays Available Slots.
10. Website displays Reserved Slots.
11. Website displays Occupied Slots.
12. User can reserve an available slot.
13. User cannot reserve an occupied slot.
14. User cannot reserve an already reserved slot.
15. Reservation status is sent to ESP32.
16. ESP32 updates the appropriate LED.
17. ESP32 updates the LCD.
18. Vehicle detection changes the website status automatically.
19. Vehicle detection changes LCD status.
20. ESP32 online/offline status is shown on the website.
21. Website is responsive.
22. Light/Dark mode is available.
23. Application must be deployable on Render.
24. Backend must use `process.env.PORT`.
25. Do not hardcode production credentials.
26. Use Indian timezone `Asia/Kolkata`.

---

# Hardware Output Summary

### ESP32

```text
GPIO 18 → IR Sensor 1
GPIO 19 → IR Sensor 2

GPIO 21 → LCD SDA
GPIO 22 → LCD SCL

GPIO 25 → LED 1
GPIO 26 → LED 2
```

### LCD

```text
16 × 2 I2C LCD
Address: 0x27
```

### Parking Slots

```text
Slot 1 → IR Sensor 1 → LED 1
Slot 2 → IR Sensor 2 → LED 2
```

---

# Final System Architecture

```text
                    ┌──────────────────────┐
                    │      WEBSITE         │
                    │ HTML/CSS/JS          │
                    │ Parking Dashboard    │
                    │ Reservation System   │
                    └──────────┬───────────┘
                               │
                               │ REST API
                               ▼
                    ┌──────────────────────┐
                    │    RENDER SERVER     │
                    │ Node.js + Express    │
                    │ SQLite Database      │
                    └──────────┬───────────┘
                               │
                               │ Internet
                               ▼
                    ┌──────────────────────┐
                    │        ESP32         │
                    │      WiFi IoT         │
                    └───────┬───────┬──────┘
                            │       │
                   ┌────────┘       └────────┐
                   ▼                         ▼
             IR SENSOR 1               IR SENSOR 2
               SLOT 1                    SLOT 2
                   │                         │
                   └──────────┬──────────────┘
                              │
                           ESP32
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
                 LCD 16×2             LEDs
                  I2C              Slot Status
```

---

# MOST IMPORTANT

Generate the **complete working source code** for:

1. Node.js + Express backend
2. SQLite database
3. HTML
4. CSS
5. JavaScript
6. ESP32 Arduino code
7. REST APIs
8. Login/Register
9. Parking dashboard
10. Slot reservation
11. Reservation cancellation
12. Real-time parking updates
13. ESP32 online/offline status
14. LCD display handling
15. LED control
16. Render deployment configuration
17. `package.json`
18. Complete project folder structure
19. README with setup instructions

The final project must be beginner-friendly and easy to run in VS Code.

**Do not use fake sensor data.**

The website must receive actual parking information from the ESP32.

**Do not create automated testing. I will perform manual testing.**

First provide the complete project structure, then provide all required code files, then provide the ESP32 wiring instructions, then provide the Render deployment steps.