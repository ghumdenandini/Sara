# 🚗 Smart Parking System (IoT + Cloud Web Application)

A complete end-to-end IoT Smart Parking solution featuring an **ESP32 microcontroller**, **IR Obstacle Sensors**, **16x2 I2C LCD Display**, **Status LEDs**, a **Node.js/Express REST API backend with SQLite**, and a **modern Tailwind CSS real-time Dashboard**.

Fully configured and ready for 1-click deployment on **Render**.

---

## 📁 Complete Project Structure

```text
Smart-Parking-System/
│
├── server.js               # Node.js + Express backend & SQLite REST APIs
├── package.json            # Node.js dependencies and start scripts
├── .gitignore              # Git ignore rules (node_modules, logs)
├── .env.example            # Environment variable template
├── parking.db              # SQLite Database (auto-generated on startup)
│
├── public/                 # Web Application Frontend (served by Express)
│   ├── index.html          # Page 1: Modern Login & Registration Page
│   ├── dashboard.html      # Page 2: Real-time Telemetry Dashboard (Tabs 1, 2, 3)
│   ├── style.css           # Custom theme, glassmorphism, LED pulses & animations
│   └── script.js           # Client controller: polling, reservation & telemetry
│
├── esp32/
│   └── smart_parking.ino   # Complete ESP32 Arduino firmware
│
└── README.md               # Hardware wiring, local setup & Render deploy guide
```

---

## 🔌 Hardware Circuit & Pinout Table

### Microcontroller: ESP32 Dev Module

| Component | Pin on Component | ESP32 GPIO Pin | Details |
|---|---|---|---|
| **IR Sensor 1** (Slot 1) | OUT / Signal | **GPIO 18** | Digital input with internal pull-up |
| **IR Sensor 1** (Slot 1) | VCC & GND | **3.3V / VIN & GND** | Standard 3.3V / 5V power |
| **IR Sensor 2** (Slot 2) | OUT / Signal | **GPIO 19** | Digital input with internal pull-up |
| **IR Sensor 2** (Slot 2) | VCC & GND | **3.3V / VIN & GND** | Standard 3.3V / 5V power |
| **16x2 I2C LCD** | SDA | **GPIO 21** | ESP32 default I2C Data |
| **16x2 I2C LCD** | SCL | **GPIO 22** | ESP32 default I2C Clock |
| **16x2 I2C LCD** | VCC & GND | **VIN (5V) & GND** | I2C LCD address: `0x27` |
| **LED 1** (Slot 1) | Anode (+) | **GPIO 25** | Connect via 220Ω–330Ω resistor |
| **LED 1** (Slot 1) | Cathode (-) | **GND** | Ground rail |
| **LED 2** (Slot 2) | Anode (+) | **GPIO 26** | Connect via 220Ω–330Ω resistor |
| **LED 2** (Slot 2) | Cathode (-) | **GND** | Ground rail |

> **Wiring Note**: Make sure all ground (GND) lines of the ESP32, Sensors, LCD, and LEDs are tied together to a common ground rail on your breadboard.

---

## ⚡ Status Logic Matrix

The system continuously distinguishes physical vehicle presence from website reservations:

| Physical Vehicle Detected (IR) | Website Reserved | Displayed Status | LED State | LCD Output |
|:---:|:---:|:---:|:---:|:---:|
| **No** | **No** | 🟢 **AVAILABLE** | **OFF** | `S1: AVAILABLE` |
| **No** | **Yes** | 🟡 **RESERVED** | **ON** | `S1: RESERVED` |
| **Yes** | **No** | 🔴 **OCCUPIED** | **ON** | `S1: OCCUPIED` |
| **Yes** | **Yes** | 🔴 **OCCUPIED** | **ON** | `S1: OCCUPIED` |

*If a reserved slot receives a vehicle, it displays `OCCUPIED` while retaining the reservation in the SQLite database.*

---

## 🖥️ Running Locally in VS Code

### Step 1: Install Node.js Dependencies
Open your VS Code terminal in the project directory:
```bash
npm install
```

### Step 2: Start the Server
```bash
npm start
```
You should see:
```text
Connected to SQLite database: parking.db
✅ Seeded default slots: Slot 1 & Slot 2
🚗 Smart Parking System server running at http://0.0.0.0:3000
📡 Ready to receive ESP32 hardware telemetry and web dashboard requests.
```

### Step 3: Open in Browser
Open your browser and navigate to:
```text
http://localhost:3000
```
- Sign up with your name, email, and password (or click **Enter Demo Mode**).
- You will be redirected to the live Smart Parking Dashboard.

---

## 🚀 Deploying to Render (Free Cloud Hosting)

The backend and frontend are packaged together to run directly on Render with zero configuration changes.

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Smart Parking System"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/smart-parking-system.git
   git push -u origin main
   ```

2. **Create a Web Service on Render**:
   - Go to [dashboard.render.com](https://dashboard.render.com/) and click **New +** > **Web Service**.
   - Connect your GitHub repository.
   - Configure the service settings:
     - **Name**: `smart-parking-system` (or any custom name)
     - **Region**: Singapore, Oregon, or Frankfurt
     - **Branch**: `main`
     - **Runtime**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: `Free`

3. **Verify Environment Variables**:
   Render automatically assigns and binds `process.env.PORT`. You can optionally add:
   - `JWT_SECRET`: `your_random_secret_string`

4. **Deploy**:
   - Click **Create Web Service**.
   - Render will build and deploy your application.
   - Once finished, you will receive your public URL:
     ```text
     https://smart-parking-system.onrender.com
     ```
   - Open that URL in your phone or PC browser to access your live dashboard from anywhere in the world!

---

## 📡 Flashing ESP32 with Arduino IDE

### Step 1: Install Libraries in Arduino IDE
Open Arduino IDE and navigate to **Tools** > **Manage Libraries...**, then search and install:
1. **LiquidCrystal I2C** (by Frank de Brabander or Marco Schwartz)
2. **ArduinoJson** (by Benoit Blanchon, v6 or v7)

### Step 2: Configure ESP32 Firmware
Open `esp32/smart_parking.ino` in Arduino IDE. Update the configuration lines near the top:
```cpp
const char* WIFI_SSID     = "YOUR_HOME_WIFI_OR_HOTSPOT";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// If deployed on Render:
const char* SERVER_URL    = "https://smart-parking-system.onrender.com";

// If testing locally on the same Wi-Fi network:
// const char* SERVER_URL = "http://192.168.1.15:3000"; // Replace with your PC's IP
```

### Step 3: Upload Code to ESP32
1. Select **Board**: `ESP32 Dev Module` (via **Tools** > **Board** > **esp32**).
2. Select your ESP32's **COM Port** (via **Tools** > **Port**).
3. Click the **Upload** button (`→`).
4. Once uploaded, open **Serial Monitor** at **115200 baud** to see live boot and connection logs.

---

## 📟 16x2 LCD Display Behavior

1. **Boot Screen (3 seconds)**:
   ```text
   SMART PARKING
   SYSTEM
   ```
2. **WiFi Connection**:
   ```text
   CONNECTING TO
   WiFi........
   ```
3. **Connection Confirmed**:
   ```text
   WiFi
   CONNECTED
   ```
4. **Live Rotating Status (Cycles every 2.5 seconds)**:
   - **Screen 1**: Slot status (`S1: AVAILABLE / OCCUPIED / RESERVED` and `S2: ...`)
   - **Screen 2**: Capacity summary (`TOTAL: 2` and `AVAIL: X`)
   - **Screen 3**: Occupancy summary (`RES: X` and `OCC: X`)

---

## 📡 REST API Reference

| Endpoint | Method | Sender | Description |
|---|---|---|---|
| `/api/parking/update` | `POST` | ESP32 | Posts IR sensor vehicle detection states (`{ slot1: { vehicleDetected: bool }, slot2: { ... } }`) |
| `/api/parking/status` | `GET` | Web / ESP32 | Retrieves full system telemetry, counts, and ESP32 heartbeat status |
| `/api/parking/reserve` | `POST` | Web Client | Reserves an available slot (`{ "slot": 1 }`) |
| `/api/parking/cancel` | `POST` | Web Client | Cancels an active reservation (`{ "slot": 1 }`) |
| `/api/reservations` | `GET` | Web Client | Returns all reservation logs formatted in Indian Standard Time (IST) |
| `/api/auth/register` | `POST` | Web Client | Registers a new user (`name`, `email`, `password`) |
| `/api/auth/login` | `POST` | Web Client | Authenticates user and returns JWT token |
| `/api/health` | `GET` | Monitoring | Healthcheck endpoint reporting server uptime & ESP32 connection state |

---

## 🇮🇳 Timezone Support
All database timestamps and reservation records are formatted in **Indian Standard Time (IST, UTC+5:30)** (`Asia/Kolkata`).
