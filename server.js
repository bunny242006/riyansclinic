require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database');
const dns = require('dns');

if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_riyans_clinic';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Configure Gmail SMTP for sending real emails, forcing IPv4 to prevent ENETUNREACH errors on Render
let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS on port 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    family: 4 // Force IPv4
});

// Helper function to send email
async function sendMail(to, subject, html) {
    if (!transporter) {
        console.error('Transporter not ready yet.');
        return null;
    }
    try {
        const info = await transporter.sendMail({
            from: '"Riyan\'s Clinic" <noreply@riyansclinic.com>',
            to: to,
            subject: subject,
            html: html
        });
        console.log('Message sent: %s', info.messageId);
        return info.messageId;
    } catch (error) {
        console.error('Error sending email:', error.message);
        return null;
    }
}

// --- USER AUTHENTICATION (OTP) ---

app.post('/api/request-otp', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Set expiry to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();

    db.run("INSERT INTO otps (email, otp, expires_at) VALUES (?, ?, ?)", [email, otp, expiresAt], async function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });

        console.log(`[OTP DEBUG] Generated OTP for ${email}: ${otp}`);

        const html = `<h2>Your Login OTP</h2>
                      <p>Your One-Time Password for Riyan's Clinic is: <strong>${otp}</strong></p>
                      <p>This code will expire in 10 minutes.</p>`;
        
        sendMail(email, 'Riyan\'s Clinic - Login OTP', html);
        
        res.json({ message: 'OTP sent to email' });
    });
});

app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    
    db.get("SELECT * FROM otps WHERE email = ? AND otp = ? ORDER BY id DESC LIMIT 1", [email, otp], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(401).json({ error: 'Invalid OTP' });

        const now = new Date();
        const expiresAt = new Date(row.expires_at);

        if (now > expiresAt) {
            return res.status(401).json({ error: 'OTP expired' });
        }

        // Delete the used OTP
        db.run("DELETE FROM otps WHERE id = ?", [row.id]);

        // Create or get user
        db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
            if (!user) {
                db.run("INSERT INTO users (email) VALUES (?)", [email], function(err) {
                    res.json({ message: 'Login successful', email: email });
                });
            } else {
                res.json({ message: 'Login successful', email: email });
            }
        });
    });
});


// --- USER APPOINTMENT BOOKING ---

app.post('/api/book', (req, res) => {
    const { user_email, patient_name, phone, age, doctor, date, time, symptoms } = req.body;
    const token = "RC-" + Math.floor(1000 + Math.random() * 9000);

    db.run(`INSERT INTO appointments 
            (token, user_email, patient_name, phone, age, doctor, date, time, symptoms) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [token, user_email, patient_name, phone, age, doctor, date, time, symptoms],
        function(err) {
            if (err) return res.status(500).json({ error: 'Error booking appointment' });
            res.json({ message: 'Appointment successfully booked', token: token });
        });
});

app.get('/api/my-appointments', (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Email required' });

    db.all("SELECT * FROM appointments WHERE user_email = ? ORDER BY created_at DESC", [email], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.post('/api/cancel-appointment', (req, res) => {
    const { token, email } = req.body;
    db.run("UPDATE appointments SET status = 'cancelled' WHERE token = ? AND user_email = ?", [token, email], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Appointment cancelled' });
    });
});


// --- BLOCKED DATES API (Public & Admin) ---

app.get('/api/blocked-dates', (req, res) => {
    const { doctor } = req.query;
    let query = "SELECT * FROM blocked_dates";
    let params = [];

    if (doctor) {
        query += " WHERE doctor = ?";
        params.push(doctor);
    }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// --- ADMIN AUTH & DASHBOARD API ---

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM admins WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ adminId: row.id, username: row.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ message: 'Admin login successful', token });
    });
});

// Middleware to verify admin token
function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.admin = user;
        next();
    });
}

app.get('/api/admin/appointments', authenticateAdmin, (req, res) => {
    db.all("SELECT * FROM appointments ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.post('/api/admin/appointments/:token/status', authenticateAdmin, (req, res) => {
    const token = req.params.token;
    const { status } = req.body; // 'accepted' or 'rejected'

    if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    db.run("UPDATE appointments SET status = ? WHERE token = ?", [status, token], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        // Fetch appointment details to send email
        db.get("SELECT * FROM appointments WHERE token = ?", [token], async (err, appointment) => {
            if (err || !appointment) return res.json({ message: 'Status updated, but email sending failed' });

            let subject = '';
            let html = '';

            if (status === 'accepted') {
                subject = 'Riyan\'s Clinic - Appointment Accepted';
                html = `<h2>Appointment Confirmed</h2>
                        <p>Dear ${appointment.patient_name},</p>
                        <p>Your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} has been accepted.</p>
                        <p>Token: <strong>${token}</strong></p>`;
            } else if (status === 'rejected') {
                subject = 'Riyan\'s Clinic - Appointment Cancelled';
                html = `<h2>Appointment Rejected</h2>
                        <p>Dear ${appointment.patient_name},</p>
                        <p>We are sorry, but your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} has been cancelled by the clinic.</p>
                        <p>Please contact us for more information.</p>`;
            }

            sendMail(appointment.user_email, subject, html);
            res.json({ message: `Appointment ${status}` });
        });
    });
});

app.delete('/api/admin/appointments/:token', authenticateAdmin, (req, res) => {
    const token = req.params.token;
    db.run("DELETE FROM appointments WHERE token = ?", [token], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Appointment deleted successfully' });
    });
});

app.post('/api/admin/blocked-dates', authenticateAdmin, (req, res) => {
    const { doctor, start_date, end_date } = req.body;
    db.run("INSERT INTO blocked_dates (doctor, start_date, end_date) VALUES (?, ?, ?)", [doctor, start_date, end_date], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Dates blocked successfully' });
    });
});

app.delete('/api/admin/blocked-dates/:id', authenticateAdmin, (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM blocked_dates WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Blocked dates removed' });
    });
});


// ============================================================
//  VIDEO CONSULTATION ROUTES
// ============================================================

// --- PUBLIC: Get available video slots (upcoming, not fully booked) ---
app.get('/api/video-slots', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    db.all(`
        SELECT vs.*, 
               COUNT(va.id) AS booked_count
        FROM video_slots vs
        LEFT JOIN video_appointments va 
            ON va.slot_id = vs.id AND va.status != 'rejected'
        WHERE vs.date >= ?
        GROUP BY vs.id
        HAVING booked_count < vs.max_bookings
        ORDER BY vs.date ASC, vs.time ASC
    `, [today], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// --- PUBLIC: Patient books a video slot ---
app.post('/api/book-video', (req, res) => {
    const { user_email, patient_name, phone, age, slot_id, symptoms } = req.body;
    if (!user_email || !patient_name || !phone || !age || !slot_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get slot details
    db.get("SELECT * FROM video_slots WHERE id = ?", [slot_id], (err, slot) => {
        if (err || !slot) return res.status(404).json({ error: 'Slot not found' });

        // Check if slot still has capacity
        db.get(`
            SELECT COUNT(*) AS cnt FROM video_appointments 
            WHERE slot_id = ? AND status != 'rejected'
        `, [slot_id], (err, row) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (row.cnt >= slot.max_bookings) {
                return res.status(409).json({ error: 'This slot is already fully booked. Please choose another.' });
            }

            const token = "VC-" + Math.floor(1000 + Math.random() * 9000);
            db.run(`
                INSERT INTO video_appointments 
                (token, user_email, patient_name, phone, age, slot_id, date, time, symptoms)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [token, user_email, patient_name, phone, age, slot_id, slot.date, slot.time, symptoms || ''],
            function(err) {
                if (err) return res.status(500).json({ error: 'Booking error' });
                res.json({ message: 'Video consultation booked successfully', token });
            });
        });
    });
});

// --- PUBLIC: Get patient's own video appointments ---
app.get('/api/my-video-appointments', (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Email required' });

    db.all("SELECT * FROM video_appointments WHERE user_email = ? ORDER BY created_at DESC", [email], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// --- ADMIN: Get all video slots ---
app.get('/api/admin/video-slots', authenticateAdmin, (req, res) => {
    db.all(`
        SELECT vs.*, COUNT(va.id) AS booked_count
        FROM video_slots vs
        LEFT JOIN video_appointments va ON va.slot_id = vs.id AND va.status != 'rejected'
        GROUP BY vs.id
        ORDER BY vs.date DESC, vs.time DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// --- ADMIN: Add a new video slot ---
app.post('/api/admin/video-slots', authenticateAdmin, (req, res) => {
    const { date, time, max_bookings } = req.body;
    if (!date || !time) return res.status(400).json({ error: 'Date and time are required' });

    db.run("INSERT INTO video_slots (date, time, max_bookings) VALUES (?, ?, ?)",
        [date, time, max_bookings || 1],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ message: 'Video slot added', id: this.lastID });
        }
    );
});

// --- ADMIN: Delete a video slot ---
app.delete('/api/admin/video-slots/:id', authenticateAdmin, (req, res) => {
    db.run("DELETE FROM video_slots WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Slot removed' });
    });
});

// --- ADMIN: Get all video appointments ---
app.get('/api/admin/video-appointments', authenticateAdmin, (req, res) => {
    db.all("SELECT * FROM video_appointments ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// --- ADMIN: Accept / Reject a video appointment ---
app.post('/api/admin/video-appointments/:id/status', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    const { status, meet_link } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const meetLink = status === 'accepted' ? meet_link : null;

    db.run("UPDATE video_appointments SET status = ?, meet_link = ? WHERE id = ?",
        [status, meetLink, id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });

            db.get("SELECT * FROM video_appointments WHERE id = ?", [id], async (err, appt) => {
                if (err || !appt) return res.json({ message: 'Status updated' });

                let subject = '', html = '';

                if (status === 'accepted') {
                    subject = "Riyan's Clinic – Video Consultation Confirmed ✅";
                    html = `
                        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:12px;overflow:hidden;">
                          <div style="background:linear-gradient(135deg,#1e3c72,#2a69ac);padding:30px;text-align:center;">
                            <h1 style="color:#fff;margin:0;font-size:24px;">🎥 Video Consultation Confirmed</h1>
                          </div>
                          <div style="padding:30px;">
                            <p>Dear <strong>${appt.patient_name}</strong>,</p>
                            <p>Your online video consultation with <strong>Dr. Mahalakshmi Peruri</strong> has been <strong style="color:#27ae60;">confirmed</strong>.</p>
                            <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f8f9fa;border-radius:8px;">
                              <tr><td style="padding:12px 16px;font-weight:bold;color:#555;">📅 Date</td><td style="padding:12px 16px;">${appt.date}</td></tr>
                              <tr><td style="padding:12px 16px;font-weight:bold;color:#555;">⏰ Time</td><td style="padding:12px 16px;">${appt.time}</td></tr>
                              <tr><td style="padding:12px 16px;font-weight:bold;color:#555;">🔖 Token</td><td style="padding:12px 16px;">${appt.token}</td></tr>
                            </table>
                            <div style="text-align:center;margin:30px 0;">
                              <p style="font-size:16px;font-weight:bold;color:#1e3c72;">Your Google Meet Link:</p>
                              <a href="${meetLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#1e3c72,#00d2d3);color:#fff;text-decoration:none;border-radius:30px;font-size:16px;font-weight:bold;">
                                📹 Join Video Call
                              </a>
                              <p style="margin-top:10px;font-size:13px;color:#888;">${meetLink}</p>
                            </div>
                            <p style="font-size:13px;color:#888;">Please be ready 5 minutes before your scheduled time. Ensure your camera and microphone are enabled.</p>
                          </div>
                          <div style="background:#f0f4ff;padding:16px;text-align:center;font-size:12px;color:#888;">
                            Riyan's Clinic | Dwarka Nagar, Visakhapatnam | riyansclinic@gmail.com
                          </div>
                        </div>
                    `;
                } else {
                    subject = "Riyan's Clinic – Video Consultation Update";
                    html = `
                        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
                          <h2 style="color:#e74c3c;">Video Consultation Unavailable</h2>
                          <p>Dear <strong>${appt.patient_name}</strong>,</p>
                          <p>We're sorry, your video consultation request (Token: <strong>${appt.token}</strong>) scheduled on <strong>${appt.date} at ${appt.time}</strong> could not be confirmed at this time.</p>
                          <p>Please visit the website to book another available slot.</p>
                          <p>We apologize for the inconvenience.</p>
                          <p>– Riyan's Clinic Team</p>
                        </div>
                    `;
                }

                sendMail(appt.user_email, subject, html);
                res.json({ message: `Video appointment ${status}`, meetLink });
            });
        }
    );
});

// --- ADMIN: Postpone a video appointment ---
app.post('/api/admin/video-appointments/:id/postpone', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    const { new_slot_id } = req.body;

    if (!new_slot_id) return res.status(400).json({ error: 'New slot ID is required' });

    // Verify the new slot exists and has capacity
    db.get("SELECT * FROM video_slots WHERE id = ?", [new_slot_id], (err, newSlot) => {
        if (err || !newSlot) return res.status(404).json({ error: 'New slot not found' });

        db.get("SELECT COUNT(*) AS cnt FROM video_appointments WHERE slot_id = ? AND status != 'rejected'", [new_slot_id], (err, row) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            
            if (row.cnt >= newSlot.max_bookings) {
                return res.status(409).json({ error: 'Selected slot is fully booked' });
            }

            // Update the appointment
            db.run("UPDATE video_appointments SET slot_id = ?, date = ?, time = ? WHERE id = ?",
                [new_slot_id, newSlot.date, newSlot.time, id],
                function(err) {
                    if (err) return res.status(500).json({ error: 'Database error' });

                    // Fetch updated appointment to send email
                    db.get("SELECT * FROM video_appointments WHERE id = ?", [id], async (err, appt) => {
                        if (err || !appt) return res.json({ message: 'Appointment postponed successfully' });

                        const subject = "Riyan's Clinic – Video Consultation Rescheduled 🔄";
                        const html = `
                            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:12px;overflow:hidden;">
                              <div style="background:linear-gradient(135deg,#f39c12,#d35400);padding:30px;text-align:center;">
                                <h1 style="color:#fff;margin:0;font-size:24px;">🔄 Consultation Rescheduled</h1>
                              </div>
                              <div style="padding:30px;">
                                <p>Dear <strong>${appt.patient_name}</strong>,</p>
                                <p>Due to unforeseen circumstances, your video consultation with <strong>Dr. Mahalakshmi Peruri</strong> has been <strong style="color:#f39c12;">rescheduled</strong>.</p>
                                <p>Here are your new appointment details:</p>
                                <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f8f9fa;border-radius:8px;">
                                  <tr><td style="padding:12px 16px;font-weight:bold;color:#555;">📅 New Date</td><td style="padding:12px 16px;">${appt.date}</td></tr>
                                  <tr><td style="padding:12px 16px;font-weight:bold;color:#555;">⏰ New Time</td><td style="padding:12px 16px;">${appt.time}</td></tr>
                                  <tr><td style="padding:12px 16px;font-weight:bold;color:#555;">🔖 Token</td><td style="padding:12px 16px;">${appt.token}</td></tr>
                                </table>
                                <div style="text-align:center;margin:30px 0;">
                                  <p style="font-size:16px;font-weight:bold;color:#1e3c72;">Your Google Meet Link remains the same:</p>
                                  <a href="${appt.meet_link}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#1e3c72,#00d2d3);color:#fff;text-decoration:none;border-radius:30px;font-size:16px;font-weight:bold;">
                                    📹 Join Video Call
                                  </a>
                                  <p style="margin-top:10px;font-size:13px;color:#888;">${appt.meet_link}</p>
                                </div>
                                <p style="font-size:13px;color:#888;">We apologize for the inconvenience. Please be ready 5 minutes before your new scheduled time.</p>
                              </div>
                              <div style="background:#f0f4ff;padding:16px;text-align:center;font-size:12px;color:#888;">
                                Riyan's Clinic | Dwarka Nagar, Visakhapatnam | riyansclinic@gmail.com
                              </div>
                            </div>
                        `;

                        sendMail(appt.user_email, subject, html);
                        res.json({ message: 'Appointment postponed successfully' });
                    });
                }
            );
        });
    });
});


// --- ADMIN: Notify Patient & Join Now ---
app.post('/api/admin/video-appointments/:id/notify-join', authenticateAdmin, (req, res) => {
    const { id } = req.params;

    db.get("SELECT * FROM video_appointments WHERE id = ?", [id], async (err, appt) => {
        if (err || !appt || !appt.meet_link) {
            return res.status(404).json({ error: 'Appointment or Meet link not found' });
        }

        const subject = "Riyan's Clinic – 🚨 The Doctor is Ready to Join!";
        const html = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:2px solid #27ae60;border-radius:12px;overflow:hidden;">
              <div style="background:#27ae60;padding:20px;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:22px;">📹 Join Your Video Call Now</h1>
              </div>
              <div style="padding:30px; text-align:center;">
                <p style="font-size:18px;">Dear <strong>${appt.patient_name}</strong>,</p>
                <p style="font-size:16px;">Dr. Mahalakshmi Peruri is ready for your consultation and has just opened the meeting room.</p>
                
                <div style="margin:40px 0;">
                  <a href="${appt.meet_link}" style="display:inline-block;padding:16px 40px;background:#e74c3c;color:#fff;text-decoration:none;border-radius:30px;font-size:20px;font-weight:bold;box-shadow:0 4px 15px rgba(231,76,60,0.4);animation: pulse 2s infinite;">
                    🔴 JOIN GOOGLE MEET NOW
                  </a>
                  <p style="margin-top:15px;font-size:14px;color:#888;">${appt.meet_link}</p>
                </div>
                
                <p style="font-size:14px;color:#555;">Please click the button above to join immediately.</p>
              </div>
              <div style="background:#f0f4ff;padding:16px;text-align:center;font-size:12px;color:#888;">
                Riyan's Clinic | Tele-Consultation System
              </div>
            </div>
        `;

        sendMail(appt.user_email, subject, html).catch(error => console.error("Failed to send instant join email:", error));
        res.json({ message: 'Patient notified successfully', meetLink: appt.meet_link });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
