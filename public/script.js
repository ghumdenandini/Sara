/**
 * Smart Parking System - Frontend Controller
 * Real-time polling, state management, tabs, and REST API integration
 */

// ---------------------------------------------------------------------
// 1. AUTHENTICATION & USER SESSION
// ---------------------------------------------------------------------
const token = localStorage.getItem('sps_token');
const userStr = localStorage.getItem('sps_user');
let currentUser = null;

try {
  currentUser = userStr ? JSON.parse(userStr) : null;
} catch (e) {
  currentUser = null;
}

// If no user session, initialize a default guest session or redirect
if (!currentUser) {
  currentUser = { id: 1, name: 'Guest Explorer', email: 'guest@smartparking.local' };
  localStorage.setItem('sps_user', JSON.stringify(currentUser));
}

document.getElementById('userNameDisplay').textContent = currentUser.name || 'Nandini';

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('sps_token');
  localStorage.removeItem('sps_user');
  window.location.href = 'index.html';
});

// ---------------------------------------------------------------------
// 2. THEME TOGGLE (LIGHT / DARK)
// ---------------------------------------------------------------------
const htmlElem = document.documentElement;
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');

function applyTheme(isDark) {
  if (isDark) {
    htmlElem.classList.add('dark');
    themeIcon.classList.remove('fa-moon');
    themeIcon.classList.add('fa-sun');
  } else {
    htmlElem.classList.remove('dark');
    themeIcon.classList.remove('fa-sun');
    themeIcon.classList.add('fa-moon');
  }
}

const savedTheme = localStorage.getItem('sps_theme');
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
applyTheme(savedTheme === 'dark' || (!savedTheme && prefersDark));

themeToggleBtn.addEventListener('click', () => {
  const isDark = htmlElem.classList.toggle('dark');
  localStorage.setItem('sps_theme', isDark ? 'dark' : 'light');
  applyTheme(isDark);
});

// ---------------------------------------------------------------------
// 3. INDIAN STANDARD TIME (IST UTC+5:30) LIVE CLOCK
// ---------------------------------------------------------------------
function updateISTClock() {
  const now = new Date();
  const istString = now.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const istClock = document.getElementById('istClock');
  if (istClock) {
    istClock.textContent = `IST ${istString}`;
  }
}
setInterval(updateISTClock, 1000);
updateISTClock();

// ---------------------------------------------------------------------
// 4. TAB NAVIGATION
// ---------------------------------------------------------------------
const navTab1 = document.getElementById('navTab1');
const navTab2 = document.getElementById('navTab2');
const navTab3 = document.getElementById('navTab3');

const sectionTab1 = document.getElementById('sectionTab1');
const sectionTab2 = document.getElementById('sectionTab2');
const sectionTab3 = document.getElementById('sectionTab3');

function switchTab(activeTab) {
  const tabs = [navTab1, navTab2, navTab3];
  const sections = [sectionTab1, sectionTab2, sectionTab3];

  tabs.forEach((tab, idx) => {
    if (idx === activeTab) {
      tab.className = 'nav-tab active py-3.5 border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 flex items-center gap-2 whitespace-nowrap transition';
      sections[idx].classList.remove('hidden');
    } else {
      tab.className = 'nav-tab py-3.5 border-b-2 border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 whitespace-nowrap transition';
      sections[idx].classList.add('hidden');
    }
  });

  if (activeTab === 2) {
    fetchReservations();
  }
}

navTab1.addEventListener('click', () => switchTab(0));
navTab2.addEventListener('click', () => switchTab(1));
navTab3.addEventListener('click', () => switchTab(2));

// ---------------------------------------------------------------------
// 5. TOAST NOTIFICATION SYSTEM
// ---------------------------------------------------------------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  
  let bgClasses = 'bg-slate-900 text-white border-slate-700';
  let icon = '<i class="fa-solid fa-circle-info text-blue-400"></i>';

  if (type === 'success') {
    bgClasses = 'bg-emerald-900 text-white border-emerald-700';
    icon = '<i class="fa-solid fa-circle-check text-emerald-300"></i>';
  } else if (type === 'error') {
    bgClasses = 'bg-rose-900 text-white border-rose-700';
    icon = '<i class="fa-solid fa-circle-exclamation text-rose-300"></i>';
  } else if (type === 'warning') {
    bgClasses = 'bg-amber-900 text-white border-amber-700';
    icon = '<i class="fa-solid fa-triangle-exclamation text-amber-300"></i>';
  }

  toast.className = `p-4 rounded-xl shadow-2xl border text-sm font-medium flex items-center gap-3 animate-fade-in pointer-events-auto ${bgClasses}`;
  toast.innerHTML = `<div>${icon}</div><div class="flex-grow">${message}</div>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ---------------------------------------------------------------------
// 6. REAL-TIME PARKING STATUS POLLING & TELEMETRY
// ---------------------------------------------------------------------
let latestParkingData = null;

async function fetchParkingStatus() {
  try {
    const res = await fetch('/api/parking/status');
    if (!res.ok) throw new Error('Network response not ok');
    const data = await res.json();
    latestParkingData = data;
    renderDashboard(data);
    renderSlotsTable(data);
  } catch (err) {
    console.warn('Telemetry sync error:', err.message);
    updateEsp32Badge(false, null);
  }
}

// Update ESP32 Connection Badge
function updateEsp32Badge(isOnline, secondsSincePing) {
  const badge = document.getElementById('esp32StatusBadge');
  const pulse = document.getElementById('esp32Pulse');
  const text = document.getElementById('esp32StatusText');

  if (isOnline) {
    badge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 shadow-sm';
    pulse.className = 'pulse-dot pulse-online';
    text.textContent = 'ESP32 STATUS: ONLINE';
  } else {
    badge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800/80 shadow-sm';
    pulse.className = 'pulse-dot pulse-offline';
    text.textContent = 'ESP32 STATUS: OFFLINE';
  }
}

// Render Dashboard Tab (KPIs, Visual Parking Lot, and Slot Cards)
function renderDashboard(data) {
  if (!data || !data.slots) return;

  // 1. ESP32 Online / Offline
  const isOnline = Boolean(data.esp32 && data.esp32.online);
  const secondsAgo = data.esp32 ? data.esp32.lastSeenSeconds : null;
  updateEsp32Badge(isOnline, secondsAgo);

  // 2. KPI Cards
  document.getElementById('kpiTotalSlots').textContent = data.totalSlots || 2;
  document.getElementById('kpiAvailSlots').textContent = data.availableSlots !== undefined ? data.availableSlots : 0;
  document.getElementById('kpiReservedSlots').textContent = data.reservedSlots !== undefined ? data.reservedSlots : 0;
  document.getElementById('kpiOccupiedSlots').textContent = data.occupiedSlots !== undefined ? data.occupiedSlots : 0;

  // 3. Render Slot 1 & Slot 2
  const s1 = data.slots.slot1;
  const s2 = data.slots.slot2;

  if (s1) {
    renderSlotCard(1, s1);
    renderVisualBay(1, s1);
  }
  if (s2) {
    renderSlotCard(2, s2);
    renderVisualBay(2, s2);
  }
}

// Render individual slot controls
function renderSlotCard(slotNum, slot) {
  const statusBadge = document.getElementById(`slot${slotNum}StatusBadge`);
  const vehicleDetected = document.getElementById(`slot${slotNum}VehicleDetected`);
  const reservedStatus = document.getElementById(`slot${slotNum}ReservedStatus`);
  const ledIndicator = document.getElementById(`slot${slotNum}LedIndicator`);
  const ledText = document.getElementById(`slot${slotNum}LedText`);
  const updatedAt = document.getElementById(`slot${slotNum}UpdatedAt`);
  const actionBtn = document.getElementById(`slot${slotNum}ActionBtn`);

  // Status mapping
  const status = (slot.displayStatus || slot.status || '').toUpperCase();
  const isOccupied = status === 'OCCUPIED';
  const isReserved = status === 'RESERVED';
  const isAvailable = status === 'AVAILABLE';

  // Badge Styling
  if (isAvailable) {
    statusBadge.className = 'px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
    statusBadge.innerHTML = '🟢 AVAILABLE';
  } else if (isReserved) {
    statusBadge.className = 'px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800';
    statusBadge.innerHTML = '🟡 RESERVED';
  } else {
    statusBadge.className = 'px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800';
    statusBadge.innerHTML = '🔴 OCCUPIED';
  }

  // Telemetry details
  if (slot.vehicleDetected) {
    vehicleDetected.innerHTML = '<i class="fa-solid fa-circle text-[9px] text-rose-500"></i> <span class="text-rose-600 dark:text-rose-400">Yes (Vehicle Present)</span>';
  } else {
    vehicleDetected.innerHTML = '<i class="fa-solid fa-circle text-[9px] text-slate-400"></i> <span class="text-slate-500 dark:text-slate-400">No (Clear)</span>';
  }

  reservedStatus.innerHTML = slot.reserved
    ? '<span class="text-amber-600 dark:text-amber-400 font-bold">Yes (Web Reserved)</span>'
    : '<span class="text-slate-500 dark:text-slate-400 font-medium">No</span>';

  // LED Indicator
  if (slot.ledStatus === 'ON') {
    ledIndicator.className = 'led-indicator led-on';
    ledText.className = 'font-mono text-xs text-rose-600 dark:text-rose-400 font-bold';
    ledText.textContent = 'ON';
  } else {
    ledIndicator.className = 'led-indicator led-off';
    ledText.className = 'font-mono text-xs text-slate-400 font-medium';
    ledText.textContent = 'OFF';
  }

  updatedAt.textContent = slot.updatedAt || 'Recent';

  // Action Button
  if (isAvailable) {
    actionBtn.disabled = false;
    actionBtn.className = 'w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer';
    actionBtn.innerHTML = `<i class="fa-solid fa-bolt"></i><span>RESERVE SLOT ${slotNum}</span>`;
    actionBtn.onclick = () => handleReserve(slotNum);
  } else if (isReserved) {
    actionBtn.disabled = false;
    actionBtn.className = 'w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 transition shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 cursor-pointer';
    actionBtn.innerHTML = `<i class="fa-solid fa-ban"></i><span>CANCEL RESERVATION</span>`;
    actionBtn.onclick = () => handleCancel(slotNum);
  } else {
    actionBtn.disabled = true;
    actionBtn.className = 'w-full py-3 px-4 rounded-xl font-bold text-sm text-slate-400 bg-slate-200 dark:bg-slate-800 cursor-not-allowed transition flex items-center justify-center gap-2';
    actionBtn.innerHTML = `<i class="fa-solid fa-lock"></i><span>OCCUPIED / NOT AVAILABLE</span>`;
    actionBtn.onclick = null;
  }
}

// Render visual twin representation of parking lot bays
function renderVisualBay(slotNum, slot) {
  const bay = document.getElementById(`visualBay${slotNum}`);
  const statusText = document.getElementById(`visualStatusText${slotNum}`);
  const carGraphic = document.getElementById(`visualCarGraphic${slotNum}`);

  const status = (slot.displayStatus || slot.status || '').toUpperCase();

  if (status === 'AVAILABLE') {
    bay.className = 'parking-bay-box state-available p-6 flex flex-col items-center justify-center text-center min-h-[220px]';
    statusText.className = 'font-mono text-emerald-600 dark:text-emerald-400 font-bold';
    statusText.innerHTML = '🟢 FREE';
    carGraphic.innerHTML = `
      <div class="flex flex-col items-center justify-center py-4">
        <i class="fa-solid fa-square-parking text-5xl text-emerald-500 opacity-60 mb-2"></i>
        <span class="text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">Open Bay</span>
      </div>
    `;
  } else if (status === 'RESERVED') {
    bay.className = 'parking-bay-box state-reserved p-6 flex flex-col items-center justify-center text-center min-h-[220px]';
    statusText.className = 'font-mono text-amber-600 dark:text-amber-400 font-bold';
    statusText.innerHTML = '🟡 RESERVED';
    carGraphic.innerHTML = `
      <div class="flex flex-col items-center justify-center py-4">
        <i class="fa-solid fa-shield-halved text-5xl text-amber-500 animate-pulse mb-2"></i>
        <span class="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 font-bold">Awaiting Vehicle</span>
      </div>
    `;
  } else {
    bay.className = 'parking-bay-box state-occupied p-6 flex flex-col items-center justify-center text-center min-h-[220px]';
    statusText.className = 'font-mono text-rose-600 dark:text-rose-400 font-bold';
    statusText.innerHTML = '🔴 OCCUPIED';
    carGraphic.innerHTML = `
      <div class="flex flex-col items-center justify-center py-4">
        <i class="fa-solid fa-car-side text-6xl text-rose-500 drop-shadow-md mb-2"></i>
        <span class="text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400 font-bold">Vehicle Parked</span>
      </div>
    `;
  }
}

// ---------------------------------------------------------------------
// 7. TAB 2: SLOT MANAGEMENT TABLE
// ---------------------------------------------------------------------
function renderSlotsTable(data) {
  const tbody = document.getElementById('slotsTableBody');
  if (!tbody || !data || !data.slots) return;

  const slotItems = [
    { num: 1, name: 'S1', data: data.slots.slot1 },
    { num: 2, name: 'S2', data: data.slots.slot2 }
  ];

  tbody.innerHTML = slotItems.map(item => {
    const s = item.data;
    if (!s) return '';
    const status = (s.displayStatus || s.status || '').toUpperCase();
    
    let statusBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Available</span>';
    if (status === 'RESERVED') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Reserved</span>';
    } else if (status === 'OCCUPIED') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">Occupied</span>';
    }

    const reservedBadge = s.reserved ? '<span class="text-amber-600 font-bold">Yes</span>' : '<span class="text-slate-400">No</span>';
    const vehicleBadge = s.vehicleDetected ? '<span class="text-rose-600 font-bold">Yes</span>' : '<span class="text-slate-400">No</span>';
    const ledBadge = s.ledStatus === 'ON'
      ? '<span class="inline-flex items-center gap-1.5 text-rose-600 font-bold"><span class="led-indicator led-on"></span> ON</span>'
      : '<span class="inline-flex items-center gap-1.5 text-slate-400"><span class="led-indicator led-off"></span> OFF</span>';

    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
        <td class="py-3 px-4 font-mono">${item.num}</td>
        <td class="py-3 px-4 font-bold">${item.name}</td>
        <td class="py-3 px-4">${statusBadge}</td>
        <td class="py-3 px-4">${reservedBadge}</td>
        <td class="py-3 px-4">${vehicleBadge}</td>
        <td class="py-3 px-4">${ledBadge}</td>
        <td class="py-3 px-4 text-xs font-mono text-slate-500 dark:text-slate-400">${s.updatedAt || 'N/A'}</td>
      </tr>
    `;
  }).join('');
}

document.getElementById('refreshSlotsBtn').addEventListener('click', () => {
  fetchParkingStatus();
  showToast('Refreshed slot telemetry', 'info');
});

// ---------------------------------------------------------------------
// 8. TAB 3: RESERVATION MANAGEMENT TABLE
// ---------------------------------------------------------------------
async function fetchReservations() {
  try {
    const res = await fetch('/api/reservations');
    const data = await res.json();
    const tbody = document.getElementById('reservationsTableBody');
    if (!tbody) return;

    if (!data.reservations || data.reservations.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-8 text-center text-slate-400">
            <i class="fa-regular fa-folder-open text-3xl mb-2 block"></i>
            No parking reservations recorded yet.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.reservations.map(r => {
      // Split IST date and time if available
      const parts = (r.reserved_at || '').split(',');
      const datePart = parts[0] ? parts[0].trim() : r.reserved_at;
      const timePart = parts[1] ? parts[1].trim() : '';

      const isActive = r.status === 'ACTIVE';
      const statusBadge = isActive
        ? '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">ACTIVE</span>'
        : '<span class="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">CANCELLED</span>';

      const actionBtn = isActive
        ? `<button onclick="handleCancel(${r.slot_number})" class="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-900 transition flex items-center gap-1 mx-auto">
             <i class="fa-solid fa-xmark"></i> Cancel
           </button>`
        : '<span class="text-xs text-slate-400 italic">Closed</span>';

      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
          <td class="py-3 px-4 font-mono">${r.id}</td>
          <td class="py-3 px-4 font-bold">Slot ${r.slot_number}</td>
          <td class="py-3 px-4">
            <div class="font-medium">${r.user_name || 'Guest'}</div>
            <div class="text-xs text-slate-400">${r.user_email || ''}</div>
          </td>
          <td class="py-3 px-4">${statusBadge}</td>
          <td class="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-300">${datePart}</td>
          <td class="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-300">${timePart}</td>
          <td class="py-3 px-4 text-center">${actionBtn}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to fetch reservations:', err);
  }
}

document.getElementById('refreshReservationsBtn').addEventListener('click', () => {
  fetchReservations();
  showToast('Refreshed reservations records', 'info');
});

// ---------------------------------------------------------------------
// 9. RESERVATION ACTIONS (RESERVE & CANCEL)
// ---------------------------------------------------------------------
async function handleReserve(slotNum) {
  try {
    const authHeaders = { 'Content-Type': 'application/json' };
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/parking/reserve', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        slot: slotNum,
        userId: currentUser ? currentUser.id : 1,
        userName: currentUser ? currentUser.name : 'Nandini',
        userEmail: currentUser ? currentUser.email : 'nandini@parking.local'
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showToast(`🎉 Slot ${slotNum} reserved successfully!`, 'success');
      fetchParkingStatus();
      fetchReservations();
    } else {
      showToast(data.message || `Could not reserve Slot ${slotNum}`, 'error');
    }
  } catch (err) {
    console.error('Reserve error:', err);
    showToast('Failed to connect to reservation service', 'error');
  }
}

async function handleCancel(slotNum) {
  if (!confirm(`Are you sure you want to cancel the reservation for Slot ${slotNum}?`)) {
    return;
  }

  try {
    const authHeaders = { 'Content-Type': 'application/json' };
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/parking/cancel', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ slot: slotNum })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showToast(`✅ Slot ${slotNum} reservation cancelled.`, 'info');
      fetchParkingStatus();
      fetchReservations();
    } else {
      showToast(data.message || `Could not cancel reservation for Slot ${slotNum}`, 'error');
    }
  } catch (err) {
    console.error('Cancel error:', err);
    showToast('Failed to connect to server', 'error');
  }
}

// ---------------------------------------------------------------------
// 10. REAL-TIME SYNCHRONIZATION LOOP (EVERY 1.5 SECONDS)
// ---------------------------------------------------------------------
fetchParkingStatus();
setInterval(fetchParkingStatus, 1500);
