process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;
const PUBLIC_DIR = path.join(__dirname, '../public');
const PAGES_DIR = path.join(PUBLIC_DIR, 'assets');




const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});


app.use(cors());
app.use(bodyParser.json());
app.use(express.static(PUBLIC_DIR));


app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});




app.get('/api/init-db', async (req, res) => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                level TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS visitors (
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
                payment_status TEXT DEFAULT 'Paid',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                username TEXT NOT NULL,
                time_in TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                time_out TIMESTAMP,
                status TEXT DEFAULT 'IN',
                date DATE DEFAULT CURRENT_DATE,
                remarks TEXT,
                break_start TIMESTAMP,
                total_break_time INTEGER DEFAULT 0
            );
        `);


        const adminCheck = await pool.query("SELECT COUNT(*) FROM users");
        if (parseInt(adminCheck.rows[0].count) === 0) {
            await pool.query("INSERT INTO users (username, password, role, level) VALUES ($1, $2, $3, $4)",
                ['admin', 'password123', 'Administrator', 'admin']);
        }

        res.json({ message: "PostgreSQL Database tables created and initialized successfully!" });
    } catch (err) {
        console.error("DB Initialization Error:", err);
        res.status(500).json({ error: "Failed to initialize database: " + err.message });
    }
});



app.get('/api/visitors', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM visitors ORDER BY created_at DESC");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


app.post('/api/register', async (req, res) => {
    try {
        const { id, name, address, age, gender, resort, visitorType, duration, members, total, paymentStatus } = req.body;
        const membersStr = members ? JSON.stringify(members) : '[]';
        const payStatus = paymentStatus || 'Paid';

        await pool.query(
            "INSERT INTO visitors (id, name, address, age, gender, resort, visitor_type, duration, members, total, status, payment_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Active', $11)",
            [id, name, address, age, gender, resort, visitorType, duration, membersStr, total, payStatus]
        );
        res.json({ message: 'Visitor registered successfully', id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


app.post('/api/checkout', async (req, res) => {
    try {
        const { id } = req.body;
        const result = await pool.query("UPDATE visitors SET status = 'Checked Out' WHERE id = $1 AND status = 'Active'", [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Visitor not found or already checked out' });
        res.json({ message: 'Checked out successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


app.post('/api/visitors/payment-status', async (req, res) => {
    try {
        const { id, paymentStatus } = req.body;
        const result = await pool.query("UPDATE visitors SET payment_status = $1 WHERE id = $2", [paymentStatus, id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Visitor not found' });
        res.json({ message: 'Payment status updated successfully', status: paymentStatus });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


app.post('/api/visitors/status', async (req, res) => {
    try {
        const { id, status } = req.body;
        const result = await pool.query("UPDATE visitors SET status = $1 WHERE id = $2", [status, id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Visitor not found' });
        res.json({ message: 'Status updated successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


app.get('/api/users', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT id, username, role, level, created_at FROM users");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', async (req, res) => {
    try {
        const { username, password, role, level } = req.body;
        const check = await pool.query("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [username]);
        if (check.rows.length > 0) return res.status(500).json({ error: 'Username already exists' });

        const result = await pool.query("INSERT INTO users (username, password, role, level) VALUES ($1, $2, $3, $4) RETURNING id", [username, password, role, level]);
        res.json({ message: 'User account created', id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { username, password, role, level } = req.body;
        if (password) {
            await pool.query("UPDATE users SET username=$1, password=$2, role=$3, level=$4 WHERE id=$5", [username, password, role, level, id]);
        } else {
            await pool.query("UPDATE users SET username=$1, role=$2, level=$3 WHERE id=$4", [username, role, level, id]);
        }
        res.json({ message: 'User account updated successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const result = await pool.query("DELETE FROM users WHERE id=$1", [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User account deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

        const cleanUsername = username.trim();
        const cleanPassword = password.trim();

        const { rows } = await pool.query("SELECT * FROM users WHERE LOWER(username) = LOWER($1) AND password = $2", [cleanUsername, cleanPassword]);
        if (rows.length === 0) return res.status(401).json({ error: 'Invalid username or password' });

        res.json({ id: rows[0].id, username: rows[0].username, role: rows[0].role, level: rows[0].level });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


app.post('/api/attendance/timein', async (req, res) => {
    try {
        const { userId, username, remarks } = req.body;
        const active = await pool.query("SELECT id FROM attendance WHERE user_id = $1 AND status != 'OUT' ORDER BY time_in DESC LIMIT 1", [userId]);
        if (active.rows.length > 0) return res.status(400).json({ error: 'You have an active shift/break. End it first.' });

        const result = await pool.query("INSERT INTO attendance (user_id, username, status, remarks) VALUES ($1, $2, 'IN', $3) RETURNING id", [userId, username, remarks]);
        res.json({ message: 'Timed in successfully', id: result.rows[0].id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/attendance/timeout', async (req, res) => {
    try {
        const { userId, remarks } = req.body;
        const active = await pool.query("SELECT * FROM attendance WHERE user_id = $1 AND status != 'OUT' ORDER BY time_in DESC LIMIT 1", [userId]);
        if (active.rows.length === 0) return res.status(400).json({ error: 'No active time-in found.' });

        const row = active.rows[0];
        if (row.status === 'BREAK') {
            await pool.query("UPDATE attendance SET time_out = CURRENT_TIMESTAMP, status = 'OUT', remarks = $1, total_break_time = total_break_time + CAST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - break_start)) AS INTEGER), break_start = NULL WHERE id = $2", [remarks, row.id]);
        } else {
            await pool.query("UPDATE attendance SET time_out = CURRENT_TIMESTAMP, status = 'OUT', remarks = $1 WHERE id = $2", [remarks, row.id]);
        }
        res.json({ message: 'Timed out successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/attendance/break', async (req, res) => {
    try {
        const { userId } = req.body;
        const active = await pool.query("SELECT * FROM attendance WHERE user_id = $1 AND status != 'OUT' ORDER BY time_in DESC LIMIT 1", [userId]);
        if (active.rows.length === 0) return res.status(400).json({ error: 'No active shift found.' });

        const row = active.rows[0];
        if (row.status === 'IN') {
            await pool.query("UPDATE attendance SET status = 'BREAK', break_start = CURRENT_TIMESTAMP WHERE id = $1", [row.id]);
            res.json({ message: 'Break started', status: 'BREAK' });
        } else if (row.status === 'BREAK') {
            await pool.query("UPDATE attendance SET status = 'IN', total_break_time = total_break_time + CAST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - break_start)) AS INTEGER), break_start = NULL WHERE id = $1", [row.id]);
            res.json({ message: 'Break ended', status: 'IN' });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});


app.get('/api/attendance/status/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const { rows } = await pool.query("SELECT * FROM attendance WHERE user_id = $1 ORDER BY time_in DESC LIMIT 1", [userId]);
        res.json(rows[0] || { status: 'OUT' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/attendance/logs', async (req, res) => {
    try {
        const { userId } = req.query;
        let query = "SELECT * FROM attendance ORDER BY time_in DESC";
        let params = [];
        if (userId) {
            query = "SELECT * FROM attendance WHERE user_id = $1 ORDER BY time_in DESC";
            params.push(parseInt(userId));
        }
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


app.get('/', (req, res) => res.sendFile(path.join(PAGES_DIR, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(PAGES_DIR, 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(PAGES_DIR, 'login.html')));
app.get('/staff.html', (req, res) => res.sendFile(path.join(PAGES_DIR, 'staff.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(PAGES_DIR, 'admin.html')));


module.exports = app;


if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server running at http://localhost:${PORT}`);
    });
}
