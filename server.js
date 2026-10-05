const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'smart_parking_jwt_secret_key_2026';
const ESP32_TIMEOUT_MS = 15000; // 15 seconds without communication = OFFLINE

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const dbPath = path.join(__dirname, 'parking.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to SQLite database:', err.message);
  } else {
    console.log(' Connected to SQLite database: parking.db');
  }
});

// Helper for Indian Standard Time (Asia/Kolkata, UTC+5:30)
function getISTDate() {
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  return istFormatter.format(now);
}

function getISTDateParts() {
  const now = new Date();
  const dateFormatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(now);

  const timeFormatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(now);

  return { date: dateFormatted, time: timeFormatted };
}

// Track ESP32 heartbeat
let lastEsp32Ping = null;

// Status calculation logic based on requirement:
// Vehicle | Reserved | Final Status
// No      | No       | AVAILABLE
// No      | Yes      | RESERVED
// Yes     | No       | OCCUPIED
// Yes     | Yes      | OCCUPIED (retains reservation info)
function computeSlotStatus(vehicleDetected, reserved) {
  if (vehicleDetected) return 'OCCUPIED';
  if (reserved) return 'RESERVED';
  return 'AVAILABLE';
}

// Initialize SQLite Tables
db.serialize(() => {
  // Users Table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // Slots Table
  db.run(`
    CREATE TABLE IF NOT EXISTS slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_number INTEGER UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      vehicle_detected INTEGER NOT NULL DEFAULT 0,
      reserved INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `);

  // Reservations Table
  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_number INTEGER NOT NULL,
      user_id INTEGER,
      user_name TEXT,
      user_email TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      reserved_at TEXT NOT NULL,
      cancelled_at TEXT
    )
  `);

  // Seed default slots if not already present
  const now = getISTDate();
  db.get('SELECT COUNT(*) AS count FROM slots', (err, row) => {
    if (!err && row && row.count === 0) {
      const stmt = db.prepare(`
        INSERT INTO slots (slot_number, status, vehicle_detected, reserved, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(1, 'AVAILABLE', 0, 0, now);
      stmt.run(2, 'AVAILABLE', 0, 0, now);
      stmt.finalize(() => {
        console.log('✅ Seeded default slots: Slot 1 & Slot 2');
      });
    }
  });
});

// Helper for Database queries using Promises
const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

// Optional JWT Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      req.user = null;
    } else {
      req.user = user;
    }
    next();
  });
}

// ----------------------------------------------------
// AUTHENTICATION APIS
// ----------------------------------------------------

// Register API
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields (name, email, password) are required.' });
    }

    if (password.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = getISTDate();

    const result = await dbRun(
      'INSERT INTO users (name, email, password, created_at) VALUES (?, ?, ?, ?)',
      [name.trim(), cleanEmail, hashedPassword, now]
    );

    const user = { id: result.lastID, name: name.trim(), email: cleanEmail };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to Smart Parking.',
      token,
      user
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// Login API
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [cleanEmail]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const userData = { id: user.id, name: user.name, email: user.email };
    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: userData
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Me API (Verify current token)
app.get('/api/auth/me', authenticateToken, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }
  res.json({ success: true, user: req.user });
});

// ----------------------------------------------------
// ESP32 & PARKING STATUS APIS
// ----------------------------------------------------

// ESP32 -> Server: POST /api/parking/update
// Receives sensor updates from ESP32
app.post('/api/parking/update', async (req, res) => {
  try {
    // Record heartbeat ping
    lastEsp32Ping = Date.now();

    const data = req.body;

    // Support both formats:
    // 1) { slot1: { vehicleDetected: true }, slot2: { vehicleDetected: false } }
    // 2) { slot1: true, slot2: false }
    let s1Detected = false;
    let s2Detected = false;

    if (data.slot1 !== undefined) {
      s1Detected = typeof data.slot1 === 'object' ? Boolean(data.slot1.vehicleDetected) : Boolean(data.slot1);
    }
    if (data.slot2 !== undefined) {
      s2Detected = typeof data.slot2 === 'object' ? Boolean(data.slot2.vehicleDetected) : Boolean(data.slot2);
    }

    const now = getISTDate();

    // Update Slot 1
    const slot1 = await dbGet('SELECT * FROM slots WHERE slot_number = 1');
    if (slot1) {
      const isReserved = slot1.reserved === 1;
      const newStatus = computeSlotStatus(s1Detected, isReserved);
      await dbRun(
        'UPDATE slots SET vehicle_detected = ?, status = ?, updated_at = ? WHERE slot_number = 1',
        [s1Detected ? 1 : 0, newStatus, now]
      );
    }

    // Update Slot 2
    const slot2 = await dbGet('SELECT * FROM slots WHERE slot_number = 2');
    if (slot2) {
      const isReserved = slot2.reserved === 1;
      const newStatus = computeSlotStatus(s2Detected, isReserved);
      await dbRun(
        'UPDATE slots SET vehicle_detected = ?, status = ?, updated_at = ? WHERE slot_number = 2',
        [s2Detected ? 1 : 0, newStatus, now]
      );
    }

    // Build the latest status response for ESP32
    const updatedSlots = await dbAll('SELECT * FROM slots ORDER BY slot_number ASC');
    let totalSlots = 2;
    let availableSlots = 0;
    let reservedSlots = 0;
    let occupiedSlots = 0;

    const slotsResponse = {};
    for (const slot of updatedSlots) {
      if (slot.status === 'AVAILABLE') availableSlots++;
      else if (slot.status === 'RESERVED') reservedSlots++;
      else if (slot.status === 'OCCUPIED') occupiedSlots++;

      slotsResponse[`slot${slot.slot_number}`] = {
        slotNumber: slot.slot_number,
        status: slot.status.toLowerCase(),
        reserved: slot.reserved === 1,
        vehicleDetected: slot.vehicle_detected === 1,
        ledStatus: slot.status === 'AVAILABLE' ? 'OFF' : 'ON'
      };
    }

    res.json({
      success: true,
      message: 'Parking sensor data updated successfully',
      totalSlots,
      availableSlots,
      reservedSlots,
      occupiedSlots,
      slots: slotsResponse
    });
  } catch (err) {
    console.error('Error in /api/parking/update:', err);
    res.status(500).json({ success: false, message: 'Failed to update parking data' });
  }
});

// Server -> ESP32 & Web Dashboard: GET /api/parking/status
// Returns the full status of parking slots and ESP32 connectivity
app.get('/api/parking/status', async (req, res) => {
  try {
    const slots = await dbAll('SELECT * FROM slots ORDER BY slot_number ASC');

    let totalSlots = 2;
    let availableSlots = 0;
    let reservedSlots = 0;
    let occupiedSlots = 0;

    const slotsMap = {};

    for (const slot of slots) {
      // Re-evaluate status dynamically according to matrix
      const status = computeSlotStatus(slot.vehicle_detected === 1, slot.reserved === 1);
      if (status === 'AVAILABLE') availableSlots++;
      else if (status === 'RESERVED') reservedSlots++;
      else if (status === 'OCCUPIED') occupiedSlots++;

      slotsMap[`slot${slot.slot_number}`] = {
        slotNumber: slot.slot_number,
        status: status.toLowerCase(),
        displayStatus: status,
        reserved: slot.reserved === 1,
        vehicleDetected: slot.vehicle_detected === 1,
        ledStatus: status === 'AVAILABLE' ? 'OFF' : 'ON',
        updatedAt: slot.updated_at
      };
    }

    // Determine ESP32 online/offline state
    const nowMs = Date.now();
    const isOnline = lastEsp32Ping !== null && (nowMs - lastEsp32Ping) < ESP32_TIMEOUT_MS;
    const secondsSincePing = lastEsp32Ping ? Math.round((nowMs - lastEsp32Ping) / 1000) : null;

    res.json({
      success: true,
      totalSlots,
      availableSlots,
      reservedSlots,
      occupiedSlots,
      esp32: {
        online: isOnline,
        lastSeenSeconds: secondsSincePing,
        lastSeenTime: lastEsp32Ping ? new Date(lastEsp32Ping).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Never'
      },
      slots: slotsMap
    });
  } catch (err) {
    console.error('Error in /api/parking/status:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch parking status' });
  }
});

// ----------------------------------------------------
// RESERVATION APIS
// ----------------------------------------------------

// POST /api/parking/reserve
// Reserves an available slot
app.post('/api/parking/reserve', authenticateToken, async (req, res) => {
  try {
    const slotNumber = parseInt(req.body.slot, 10);

    if (slotNumber !== 1 && slotNumber !== 2) {
      return res.status(400).json({ success: false, message: 'Invalid slot number. Valid slots are 1 and 2.' });
    }

    const slot = await dbGet('SELECT * FROM slots WHERE slot_number = ?', [slotNumber]);
    if (!slot) {
      return res.status(404).json({ success: false, message: `Slot ${slotNumber} not found.` });
    }

    // Check if slot is physically occupied
    if (slot.vehicle_detected === 1) {
      return res.status(400).json({
        success: false,
        message: `Slot ${slotNumber} is currently OCCUPIED by a vehicle. Reservation failed.`
      });
    }

    // Check if slot is already reserved
    if (slot.reserved === 1) {
      return res.status(400).json({
        success: false,
        message: `Slot ${slotNumber} is ALREADY RESERVED. Reservation failed.`
      });
    }

    const now = getISTDate();
    const userId = req.user ? req.user.id : (req.body.userId || 1);
    const userName = req.user ? req.user.name : (req.body.userName || 'Guest User');
    const userEmail = req.user ? req.user.email : (req.body.userEmail || 'guest@parking.local');

    // Update slot
    await dbRun(
      'UPDATE slots SET reserved = 1, status = ?, updated_at = ? WHERE slot_number = ?',
      ['RESERVED', now, slotNumber]
    );

    // Record reservation
    const reservationResult = await dbRun(
      `INSERT INTO reservations (slot_number, user_id, user_name, user_email, status, reserved_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
      [slotNumber, userId, userName, userEmail, now]
    );

    res.json({
      success: true,
      message: 'Reservation Successful',
      reservationId: reservationResult.lastID,
      slot: slotNumber,
      reservedAt: now
    });
  } catch (err) {
    console.error('Error reserving slot:', err);
    res.status(500).json({ success: false, message: 'Internal server error while reserving slot.' });
  }
});

// POST /api/parking/cancel
// Cancels a slot reservation
app.post('/api/parking/cancel', authenticateToken, async (req, res) => {
  try {
    const slotNumber = parseInt(req.body.slot, 10);

    if (slotNumber !== 1 && slotNumber !== 2) {
      return res.status(400).json({ success: false, message: 'Invalid slot number. Valid slots are 1 and 2.' });
    }

    const slot = await dbGet('SELECT * FROM slots WHERE slot_number = ?', [slotNumber]);
    if (!slot) {
      return res.status(404).json({ success: false, message: `Slot ${slotNumber} not found.` });
    }

    if (slot.reserved === 0) {
      return res.status(400).json({ success: false, message: `Slot ${slotNumber} has no active reservation.` });
    }

    const now = getISTDate();

    // Mark active reservation as CANCELLED
    await dbRun(
      `UPDATE reservations
       SET status = 'CANCELLED', cancelled_at = ?
       WHERE slot_number = ? AND status = 'ACTIVE'`,
      [now, slotNumber]
    );

    // Update slot reserved flag and recalculate status
    const newStatus = computeSlotStatus(slot.vehicle_detected === 1, false);
    await dbRun(
      'UPDATE slots SET reserved = 0, status = ?, updated_at = ? WHERE slot_number = ?',
      [newStatus, now, slotNumber]
    );

    res.json({
      success: true,
      message: `Reservation for Slot ${slotNumber} cancelled successfully.`,
      slot: slotNumber,
      newStatus
    });
  } catch (err) {
    console.error('Error cancelling reservation:', err);
    res.status(500).json({ success: false, message: 'Internal server error while cancelling reservation.' });
  }
});

// GET /api/reservations
// Returns all reservations formatted with Indian Standard Time
app.get('/api/reservations', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM reservations ORDER BY id DESC');
    res.json({ success: true, count: rows.length, reservations: rows });
  } catch (err) {
    console.error('Error fetching reservations:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve reservations.' });
  }
});

// GET /api/health
// Healthcheck endpoint for Render and ESP32
app.get('/api/health', (req, res) => {
  const isOnline = lastEsp32Ping !== null && (Date.now() - lastEsp32Ping) < ESP32_TIMEOUT_MS;
  res.json({
    status: 'ok',
    timestamp: getISTDate(),
    esp32Online: isOnline
  });
});

// Start Server on 0.0.0.0 for Render compatibility
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚗 Smart Parking System server running at http://0.0.0.0:${PORT}`);
  console.log(`📡 Ready to receive ESP32 hardware telemetry and web dashboard requests.`);
});