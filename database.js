const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'clinic.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Users Table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Admins Table
        db.run(`
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        `);

        // Appointments Table
        db.run(`
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token TEXT UNIQUE NOT NULL,
                user_email TEXT NOT NULL,
                patient_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                age INTEGER NOT NULL,
                doctor TEXT NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                symptoms TEXT,
                status TEXT DEFAULT 'pending', 
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Blocked Dates Table
        db.run(`
            CREATE TABLE IF NOT EXISTS blocked_dates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doctor TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL
            )
        `);

        // Video Call Slots Table (admin-defined availability)
        db.run(`
            CREATE TABLE IF NOT EXISTS video_slots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                max_bookings INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Video Appointments Table (patient bookings)
        db.run(`
            CREATE TABLE IF NOT EXISTS video_appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token TEXT UNIQUE NOT NULL,
                user_email TEXT NOT NULL,
                patient_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                age INTEGER NOT NULL,
                slot_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                symptoms TEXT,
                status TEXT DEFAULT 'pending',
                meet_link TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (slot_id) REFERENCES video_slots(id)
            )
        `);

        // OTPs Table
        db.run(`
            CREATE TABLE IF NOT EXISTS otps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                otp TEXT NOT NULL,
                expires_at DATETIME NOT NULL
            )
        `);

        // Insert default admin if none exists
        db.get("SELECT * FROM admins WHERE username = ?", ['admin'], (err, row) => {
            if (!row) {
                // Using simple clear text for simplicity as requested, in production use bcrypt
                db.run("INSERT INTO admins (username, password) VALUES (?, ?)", ['admin', 'admin123']);
            }
        });
    });
}

module.exports = db;
