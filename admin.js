const API_BASE = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();

    document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
    document.getElementById('blockDateForm').addEventListener('submit', handleBlockDateSubmit);
});

function checkAdminAuth() {
    const token = localStorage.getItem('admin_token');
    if (token) {
        document.getElementById('adminLoginGate').classList.add('hidden');
        document.getElementById('adminDashboard').classList.remove('hidden');
        fetchAppointments();
        fetchBlockedDates();
        fetchVideoSlots();
        fetchVideoAppointments();
    }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;

    try {
        const res = await fetch(`${API_BASE}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('admin_token', data.token);
            checkAdminAuth();
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (err) {
        console.error(err);
        alert('Server error');
    }
}

function adminLogout() {
    localStorage.removeItem('admin_token');
    document.getElementById('adminLoginGate').classList.remove('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabId).classList.remove('hidden');
    event.currentTarget.classList.add('active');
}

// --- APPOINTMENTS MANAGEMENT ---

async function fetchAppointments() {
    const token = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`${API_BASE}/admin/appointments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const appointments = await res.json();
        
        const tbody = document.getElementById('appointmentsTableBody');
        tbody.innerHTML = '';

        appointments.forEach(apt => {
            const tr = document.createElement('tr');
            
            let actionsHtml = '';
            if (apt.status === 'pending') {
                actionsHtml = `
                    <button class="action-btn btn-accept" onclick="updateAppointmentStatus('${apt.token}', 'accepted')"><i class="fa-solid fa-check"></i></button>
                    <button class="action-btn btn-reject" onclick="updateAppointmentStatus('${apt.token}', 'rejected')"><i class="fa-solid fa-xmark"></i></button>
                `;
            }

            tr.innerHTML = `
                <td><strong>${apt.token}</strong></td>
                <td>${apt.patient_name}<br><small>${apt.phone}</small></td>
                <td>${apt.doctor}</td>
                <td>${apt.date} @ ${apt.time}</td>
                <td><span class="status-badge status-${apt.status}">${apt.status.toUpperCase()}</span></td>
                <td>${actionsHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

async function updateAppointmentStatus(token, status) {
    if (!confirm(`Are you sure you want to ${status} this appointment?`)) return;

    const authToken = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`${API_BASE}/admin/appointments/${token}/status`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        
        if (data.previewUrl) {
            console.log("Email Preview URL: ", data.previewUrl);
        }
        
        fetchAppointments();
    } catch (err) {
        console.error(err);
    }
}

// --- BLOCKED DATES MANAGEMENT ---

async function handleBlockDateSubmit(e) {
    e.preventDefault();
    const doctor = document.getElementById('blockDoctor').value;
    const start_date = document.getElementById('blockStartDate').value;
    const end_date = document.getElementById('blockEndDate').value;

    const token = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`${API_BASE}/admin/blocked-dates`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ doctor, start_date, end_date })
        });

        if (res.ok) {
            alert('Dates successfully blocked');
            document.getElementById('blockDateForm').reset();
            fetchBlockedDates();
        } else {
            alert('Error blocking dates');
        }
    } catch (err) {
        console.error(err);
    }
}

async function fetchBlockedDates() {
    try {
        const res = await fetch(`${API_BASE}/blocked-dates`);
        const dates = await res.json();
        
        const tbody = document.getElementById('blockedDatesTableBody');
        tbody.innerHTML = '';

        dates.forEach(bd => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${bd.doctor}</td>
                <td>${bd.start_date}</td>
                <td>${bd.end_date}</td>
                <td>
                    <button class="action-btn btn-reject" onclick="deleteBlockedDate(${bd.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

async function deleteBlockedDate(id) {
    if (!confirm('Remove this blocked date period?')) return;

    const token = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`${API_BASE}/admin/blocked-dates/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            fetchBlockedDates();
        }
    } catch (err) {
        console.error(err);
    }
}


// ============================================================
//  VIDEO SLOTS MANAGEMENT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const videoSlotForm = document.getElementById('videoSlotForm');
    if (videoSlotForm) {
        videoSlotForm.addEventListener('submit', handleAddVideoSlot);
    }
});

async function fetchVideoSlots() {
    const token = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`${API_BASE}/admin/video-slots`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const slots = await res.json();
        const tbody = document.getElementById('videoSlotsTableBody');
        tbody.innerHTML = '';

        if (!slots.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">No video slots added yet.</td></tr>';
            return;
        }

        slots.forEach(slot => {
            const tr = document.createElement('tr');
            const isFull = slot.booked_count >= slot.max_bookings;
            tr.innerHTML = `
                <td><strong>${slot.date}</strong></td>
                <td>${slot.time}</td>
                <td>${slot.max_bookings}</td>
                <td>
                    <span class="status-badge ${isFull ? 'status-rejected' : 'status-accepted'}">
                        ${slot.booked_count} / ${slot.max_bookings}
                    </span>
                </td>
                <td>
                    <button class="action-btn btn-reject" onclick="deleteVideoSlot(${slot.id})" title="Delete Slot">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error fetching video slots:', err);
    }
}

async function handleAddVideoSlot(e) {
    e.preventDefault();
    const date = document.getElementById('slotDate').value;
    const time = document.getElementById('slotTime').value;
    const max_bookings = parseInt(document.getElementById('slotMaxBookings').value) || 1;

    const token = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`${API_BASE}/admin/video-slots`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ date, time, max_bookings })
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('videoSlotForm').reset();
            fetchVideoSlots();
            showAdminToast('✅ Video slot added successfully!');
        } else {
            alert(data.error || 'Failed to add slot');
        }
    } catch (err) {
        console.error(err);
        alert('Server error');
    }
}

async function deleteVideoSlot(id) {
    if (!confirm('Delete this video slot? All bookings for it will be orphaned.')) return;
    const token = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`${API_BASE}/admin/video-slots/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            fetchVideoSlots();
            showAdminToast('🗑️ Slot removed.');
        }
    } catch (err) {
        console.error(err);
    }
}


// ============================================================
//  VIDEO BOOKINGS MANAGEMENT
// ============================================================

async function fetchVideoAppointments() {
    const token = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`${API_BASE}/admin/video-appointments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const appts = await res.json();
        const tbody = document.getElementById('videoAppointmentsTableBody');
        tbody.innerHTML = '';

        if (!appts.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:20px;">No video consultation requests yet.</td></tr>';
            return;
        }

        appts.forEach(appt => {
            const tr = document.createElement('tr');
            let actionsHtml = '';
            if (appt.status === 'pending') {
                actionsHtml = `
                    <button class="action-btn btn-accept" title="Accept & Send Meet Link" onclick="updateVideoStatus(${appt.id}, 'accepted')">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="action-btn btn-reject" title="Reject" onclick="updateVideoStatus(${appt.id}, 'rejected')">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                `;
            } else if (appt.status === 'accepted') {
                actionsHtml = `
                    <button class="action-btn btn-secondary" title="Postpone" onclick="openPostponeModal(${appt.id})" style="background:#f39c12; color:#fff; border:none; padding:6px; border-radius:4px;">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </button>
                `;
            }

            const meetLinkHtml = appt.meet_link
                ? `<button onclick="notifyAndJoin(${appt.id}, '${appt.meet_link}')" class="btn-primary" style="padding:6px 12px; font-size:12px; border-radius:4px; display:flex; align-items:center; gap:5px; border:none; cursor:pointer;">
                    <i class="fa-solid fa-video"></i> Join & Notify
                   </button>`
                : '<span style="color:#aaa;font-size:12px;">–</span>';

            tr.innerHTML = `
                <td><strong>${appt.token}</strong></td>
                <td>${appt.patient_name}<br><small>${appt.user_email}</small><br><small>${appt.phone}</small></td>
                <td>${appt.date}<br><strong>${appt.time}</strong></td>
                <td style="max-width:150px;font-size:12px;">${appt.symptoms || '–'}</td>
                <td><span class="status-badge status-${appt.status}">${appt.status.toUpperCase()}</span></td>
                <td>${meetLinkHtml}</td>
                <td>${actionsHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error fetching video appointments:', err);
    }
}

async function updateVideoStatus(id, status) {
    let meetLink = null;
    
    if (status === 'accepted') {
        meetLink = prompt('Please paste a valid Google Meet link for this consultation (e.g., https://meet.google.com/abc-defg-hij):');
        if (!meetLink) {
            alert('A Google Meet link is required to accept a video consultation.');
            return;
        }
    } else {
        if (!confirm('Are you sure you want to reject this request?')) return;
    }

    const authToken = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`${API_BASE}/admin/video-appointments/${id}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status, meet_link: meetLink })
        });
        const data = await res.json();
        if (res.ok) {
            const msg = status === 'accepted'
                ? `✅ Accepted! Meet link sent to patient's email.`
                : '❌ Request rejected. Patient notified.';
            showAdminToast(msg);
            fetchVideoAppointments();
        } else {
            alert(data.error || 'Error updating status');
        }
    } catch (err) {
        console.error(err);
    }
}

// --- Admin Toast Notification ---
function showAdminToast(message) {
    let toast = document.getElementById('adminToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'adminToast';
        toast.style.cssText = `
            position:fixed; bottom:30px; right:30px; z-index:9999;
            background:linear-gradient(135deg,#1e3c72,#2a69ac);
            color:#fff; padding:14px 24px; border-radius:12px;
            font-size:14px; font-weight:500; box-shadow:0 8px 32px rgba(0,0,0,0.25);
            transition: opacity 0.4s ease, transform 0.4s ease;
            opacity:0; transform:translateY(20px);
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
    }, 3500);
}

// --- POSTPONE MODAL LOGIC ---

async function openPostponeModal(apptId) {
    document.getElementById('postponeApptId').value = apptId;
    const select = document.getElementById('postponeNewSlot');
    select.innerHTML = '<option value="">Loading slots...</option>';
    document.getElementById('postponeModal').style.display = 'flex';

    // Fetch available slots
    try {
        const res = await fetch(`${API_BASE}/video-slots`);
        const slots = await res.json();
        
        select.innerHTML = '<option value="">-- Select a new slot --</option>';
        if (!slots.length) {
            select.innerHTML = '<option value="">No available slots</option>';
            return;
        }

        slots.forEach(slot => {
            const dateObj = new Date(slot.date + 'T00:00:00');
            const displayDate = dateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
            const [h, m] = slot.time.split(':');
            const hour = parseInt(h);
            const displayTime = `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
            
            const option = document.createElement('option');
            option.value = slot.id;
            option.textContent = `${displayDate} at ${displayTime} (${slot.max_bookings - slot.booked_count} left)`;
            select.appendChild(option);
        });
    } catch (err) {
        console.error(err);
        select.innerHTML = '<option value="">Error loading slots</option>';
    }
}

function closePostponeModal() {
    document.getElementById('postponeModal').style.display = 'none';
    document.getElementById('postponeForm').reset();
}

async function submitPostpone(e) {
    e.preventDefault();
    const apptId = document.getElementById('postponeApptId').value;
    const newSlotId = document.getElementById('postponeNewSlot').value;
    
    if (!newSlotId) return;
    
    const btn = document.getElementById('postponeSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Postponing...';

    const authToken = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`${API_BASE}/admin/video-appointments/${apptId}/postpone`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ new_slot_id: newSlotId })
        });
        const data = await res.json();
        
        if (res.ok) {
            showAdminToast('🔄 Appointment postponed and patient emailed!');
            closePostponeModal();
            fetchVideoAppointments();
            fetchVideoSlots(); // refresh slots counts too
        } else {
            alert(data.error || 'Error postponing appointment');
        }
    } catch (err) {
        console.error(err);
        alert('Server error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirm Postpone';
    }
}

// --- NOTIFY & JOIN LOGIC ---
async function notifyAndJoin(apptId, meetLink) {
    const authToken = localStorage.getItem('admin_token');
    
    // Show temporary toast so admin knows something is happening
    showAdminToast('🔔 Notifying patient to join now...');
    
    try {
        const res = await fetch(`${API_BASE}/admin/video-appointments/${apptId}/notify-join`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        
        // Open the meet link for the admin in a new tab immediately after API call succeeds
        window.open(meetLink, '_blank');
        
    } catch (err) {
        console.error('Error notifying patient:', err);
        // Even if error, still let admin join
        window.open(meetLink, '_blank');
    }
}

// Load video data when admin logs in
const _origCheckAuth = window.checkAdminAuth;

