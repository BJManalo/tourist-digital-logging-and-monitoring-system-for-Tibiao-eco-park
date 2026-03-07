const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 5000;
const DB_PATH = path.join(__dirname, 'database', 'tibiao_tourism.db');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PAGES_DIR = path.join(PUBLIC_DIR, 'assets');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(PUBLIC_DIR));

// Request Logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Database Setup
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error connecting to SQLite:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        createTables();
    }
});

function createTables() {
    db.run(`CREATE TABLE IF NOT EXISTS visitors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        age INTEGER,
        gender TEXT,
        resort TEXT,
        visitor_type TEXT,
        duration TEXT,
        members TEXT,
        total TEXT,
        status TEXT DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        level TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (!err) {
            // Seed admin account if no users exist
            db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
                if (row && row.count === 0) {
                    db.run("INSERT INTO users (username, password, role, level) VALUES (?, ?, ?, ?)",
                        ['admin', 'password123', 'Administrator', 'admin']);
                }
            });
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        time_in DATETIME DEFAULT CURRENT_TIMESTAMP,
        time_out DATETIME,
        status TEXT DEFAULT 'IN',
        date DATE DEFAULT (DATE('now')),
        remarks TEXT,
        break_start DATETIME,
        total_break_time INTEGER DEFAULT 0,
        approval_status TEXT DEFAULT 'Pending',
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, () => {
        // Migration: Add missing columns if they don't exist
        const columns = [
            { name: 'remarks', type: 'TEXT' },
            { name: 'break_start', type: 'DATETIME' },
            { name: 'total_break_time', type: 'INTEGER DEFAULT 0' },
            { name: 'approval_status', type: "TEXT DEFAULT 'Pending'" }
        ];

        columns.forEach(col => {
            db.run(`ALTER TABLE attendance ADD COLUMN ${col.name} ${col.type}`, (err) => {
                if (err) {
                    if (err.message.includes('duplicate column name')) {
                        // Ignore if column already exists
                    } else {
                        console.error(`Error adding column ${col.name}:`, err.message);
                    }
                } else {
                    console.log(`Successfully added column: ${col.name}`);
                }
            });
        });
    });
}

// Routes
// 1. Get all visitors
app.get('/api/visitors', (req, res) => {
    db.all("SELECT * FROM visitors ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. Register new visitor
app.post('/api/register', (req, res) => {
    console.log('Registration attempt:', req.body);
    const { id, name, address, age, gender, resort, visitorType, duration, members, total } = req.body;

    // Ensure members is a string even if empty/undefined
    const membersStr = members ? JSON.stringify(members) : '[]';

    const sql = `INSERT OR IGNORE INTO visitors (id, name, address, age, gender, resort, visitor_type, duration, members, total, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`;

    db.run(sql, [id, name, address, age, gender, resort, visitorType, duration, membersStr, total], function (err) {
        if (err) {
            console.error('DATABASE INSERT ERROR:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            console.log(`Skipped duplicate visitor: ${id}`);
            return res.json({ message: 'Visitor already exists (skipped)', id: id, duplicate: true });
        }

        console.log(`Successfully registered visitor: ${id}`);
        res.json({ message: 'Visitor registered successfully', id: id });
    });
});

// 3. Checkout visitor
app.post('/api/checkout', (req, res) => {
    const { id } = req.body;
    db.run("UPDATE visitors SET status = 'Checked Out' WHERE id = ? AND status = 'Active'", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Visitor not found or already checked out' });
        res.json({ message: 'Checked out successfully' });
    });
});

// 4. Update visitor status (Manual override)
app.post('/api/visitors/status', (req, res) => {
    const { id, status } = req.body;
    console.log(`Manual status override: [${id}] to [${status}]`);

    db.run("UPDATE visitors SET status = ? WHERE id = ?", [status, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Visitor not found' });
        res.json({ message: 'Status updated successfully' });
    });
});

// 5. User Account Management
app.get('/api/users', (req, res) => {
    db.all("SELECT id, username, role, level, created_at FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/users', (req, res) => {
    const { username, password, role, level } = req.body;
    db.run("INSERT INTO users (username, password, role, level) VALUES (?, ?, ?, ?)",
        [username, password, role, level], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'User account created', id: this.lastID });
        });
});

app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { username, password, role, level } = req.body;

    let sql = "UPDATE users SET username = ?, role = ?, level = ?";
    let params = [username, role, level];

    if (password) {
        sql += ", password = ?";
        params.push(password);
    }

    sql += " WHERE id = ?";
    params.push(id);

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "User not found" });
        res.json({ message: 'User account updated successfully' });
    });
});

app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    // Don't allow deleting the last admin if we wanted to be safe, but for now simple delete
    db.run("DELETE FROM users WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "User not found" });
        res.json({ message: 'User account deleted successfully' });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        console.log('Login attempt with missing fields');
        return res.status(400).json({ error: 'Username and password required' });
    }

    console.log(`Login attempt for username: [${username}]`);

    // Case-insensitive username check and trimmed whitespace
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    db.get("SELECT * FROM users WHERE LOWER(username) = ? AND password = ?", [cleanUsername, cleanPassword], (err, row) => {
        if (err) {
            console.error('DATABASE LOGIN ERROR:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!row) {
            console.log(`LOGIN FAILED: No match found for user [${cleanUsername}] with that password.`);
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        console.log(`LOGIN SUCCESS: User [${row.username}] authenticated with level [${row.level}]`);
        res.json({ id: row.id, username: row.username, role: row.role, level: row.level });
    });
});

// 6. Attendance Routes
app.post('/api/attendance/timein', (req, res) => {
    const { userId, username, remarks } = req.body;
    // Check if already timed in today and not timed out
    db.get("SELECT * FROM attendance WHERE user_id = ? AND status != 'OUT' ORDER BY time_in DESC LIMIT 1", [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) return res.status(400).json({ error: 'You have an active shift/break. End it first.' });

        db.run("INSERT INTO attendance (user_id, username, status, remarks, approval_status) VALUES (?, ?, 'IN', ?, 'Pending')", [userId, username, remarks], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Timed in successfully', id: this.lastID });
        });
    });
});

app.post('/api/attendance/timeout', (req, res) => {
    const { userId, remarks } = req.body;
    db.get("SELECT * FROM attendance WHERE user_id = ? AND status != 'OUT' ORDER BY time_in DESC LIMIT 1", [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(400).json({ error: 'No active time-in found.' });

        // If currently on break, calculate and close break first
        let breakUpdate = "";
        let params = [remarks, row.id];
        if (row.status === 'BREAK') {
            db.run("UPDATE attendance SET time_out = CURRENT_TIMESTAMP, status = 'OUT', remarks = ?, total_break_time = total_break_time + (strftime('%s', CURRENT_TIMESTAMP) - strftime('%s', break_start)), break_start = NULL WHERE id = ?", params, function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Timed out successfully' });
            });
        } else {
            db.run("UPDATE attendance SET time_out = CURRENT_TIMESTAMP, status = 'OUT', remarks = ? WHERE id = ?", params, function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Timed out successfully' });
            });
        }
    });
});

app.post('/api/attendance/break', (req, res) => {
    const { userId } = req.body;
    db.get("SELECT * FROM attendance WHERE user_id = ? AND status != 'OUT' ORDER BY time_in DESC LIMIT 1", [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(400).json({ error: 'No active shift found.' });

        if (row.status === 'IN') {
            // Start Break
            db.run("UPDATE attendance SET status = 'BREAK', break_start = CURRENT_TIMESTAMP WHERE id = ?", [row.id], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Break started', status: 'BREAK' });
            });
        } else if (row.status === 'BREAK') {
            // End Break - add duration to total_break_time
            db.run("UPDATE attendance SET status = 'IN', total_break_time = total_break_time + (strftime('%s', CURRENT_TIMESTAMP) - strftime('%s', break_start)), break_start = NULL WHERE id = ?", [row.id], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Break ended', status: 'IN' });
            });
        }
    });
});

app.post('/api/attendance/approve', (req, res) => {
    const { id, status } = req.body; // status: Approved or Disapproved
    db.run("UPDATE attendance SET approval_status = ? WHERE id = ?", [status, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Attendance ${status.toLowerCase()} successfully` });
    });
});

app.get('/api/attendance/status/:userId', (req, res) => {
    const { userId } = req.params;
    db.get("SELECT * FROM attendance WHERE user_id = ? ORDER BY time_in DESC LIMIT 1", [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || { status: 'OUT' });
    });
});

app.get('/api/attendance/logs', (req, res) => {
    const { userId } = req.query;
    let sql = "SELECT * FROM attendance";
    let params = [];
    if (userId) {
        sql += " WHERE user_id = ?";
        params.push(userId);
    }
    sql += " ORDER BY time_in DESC";

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Serve frontend - explicit routes for all HTML pages
app.get('/', (req, res) => res.sendFile(path.join(PAGES_DIR, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(PAGES_DIR, 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(PAGES_DIR, 'login.html')));
app.get('/staff.html', (req, res) => res.sendFile(path.join(PAGES_DIR, 'staff.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(PAGES_DIR, 'admin.html')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📱 Access from phone on same Wi-Fi: http://<your-local-IP>:${PORT}`);
});
