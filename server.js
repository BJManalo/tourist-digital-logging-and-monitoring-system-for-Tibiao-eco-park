const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 5000;
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

// ============================================================
// IN-MEMORY DATABASE (used on Vercel / serverless environments)
// For local development with a real SQLite DB, run: node server.local.js
// ============================================================
let visitors = [];
let users = [
    { id: 1, username: 'admin', password: 'password123', role: 'Administrator', level: 'admin', created_at: new Date().toISOString() }
];
let attendance = [];
let nextUserId = 2;
let nextAttendanceId = 1;

// Routes
// 1. Get all visitors
app.get('/api/visitors', (req, res) => {
    res.json([...visitors].reverse());
});

// 2. Register new visitor
app.post('/api/register', (req, res) => {
    console.log('Registration attempt:', req.body);
    const { id, name, address, age, gender, resort, visitorType, duration, members, total } = req.body;
    const membersStr = members ? JSON.stringify(members) : '[]';

    const visitor = {
        id, name, address, age, gender, resort,
        visitor_type: visitorType,
        duration,
        members: membersStr,
        total,
        status: 'Active',
        created_at: new Date().toISOString()
    };

    visitors.push(visitor);
    console.log(`Successfully registered visitor: ${id}`);
    res.json({ message: 'Visitor registered successfully', id });
});

// 3. Checkout visitor
app.post('/api/checkout', (req, res) => {
    const { id } = req.body;
    const visitor = visitors.find(v => v.id === id && v.status === 'Active');
    if (!visitor) return res.status(404).json({ message: 'Visitor not found or already checked out' });
    visitor.status = 'Checked Out';
    res.json({ message: 'Checked out successfully' });
});

// 4. Update visitor status
app.post('/api/visitors/status', (req, res) => {
    const { id, status } = req.body;
    const visitor = visitors.find(v => v.id === id);
    if (!visitor) return res.status(404).json({ message: 'Visitor not found' });
    visitor.status = status;
    res.json({ message: 'Status updated successfully' });
});

// 5. User Account Management
app.get('/api/users', (req, res) => {
    res.json(users.map(u => ({ id: u.id, username: u.username, role: u.role, level: u.level, created_at: u.created_at })));
});

app.post('/api/users', (req, res) => {
    const { username, password, role, level } = req.body;
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(500).json({ error: 'Username already exists' });
    }
    const newUser = { id: nextUserId++, username, password, role, level, created_at: new Date().toISOString() };
    users.push(newUser);
    res.json({ message: 'User account created', id: newUser.id });
});

app.put('/api/users/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { username, password, role, level } = req.body;
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.username = username;
    user.role = role;
    user.level = level;
    if (password) user.password = password;
    res.json({ message: 'User account updated successfully' });
});

app.delete('/api/users/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    users.splice(idx, 1);
    res.json({ message: 'User account deleted successfully' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    const user = users.find(u => u.username.toLowerCase() === cleanUsername && u.password === cleanPassword);
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    res.json({ id: user.id, username: user.username, role: user.role, level: user.level });
});

// 6. Attendance Routes
app.post('/api/attendance/timein', (req, res) => {
    const { userId, username, remarks } = req.body;
    const active = attendance.find(a => a.user_id === userId && a.status !== 'OUT');
    if (active) return res.status(400).json({ error: 'You have an active shift/break. End it first.' });

    const log = {
        id: nextAttendanceId++,
        user_id: userId,
        username,
        time_in: new Date().toISOString(),
        time_out: null,
        status: 'IN',
        date: new Date().toISOString().split('T')[0],
        remarks: remarks || null,
        break_start: null,
        total_break_time: 0,
        approval_status: 'Pending'
    };
    attendance.push(log);
    res.json({ message: 'Timed in successfully', id: log.id });
});

app.post('/api/attendance/timeout', (req, res) => {
    const { userId, remarks } = req.body;
    const log = attendance.filter(a => a.user_id === userId && a.status !== 'OUT').pop();
    if (!log) return res.status(400).json({ error: 'No active time-in found.' });

    if (log.status === 'BREAK' && log.break_start) {
        const breakDuration = Math.floor((new Date() - new Date(log.break_start)) / 1000);
        log.total_break_time += breakDuration;
        log.break_start = null;
    }

    log.time_out = new Date().toISOString();
    log.status = 'OUT';
    if (remarks) log.remarks = remarks;
    res.json({ message: 'Timed out successfully' });
});

app.post('/api/attendance/break', (req, res) => {
    const { userId } = req.body;
    const log = attendance.filter(a => a.user_id === userId && a.status !== 'OUT').pop();
    if (!log) return res.status(400).json({ error: 'No active shift found.' });

    if (log.status === 'IN') {
        log.status = 'BREAK';
        log.break_start = new Date().toISOString();
        res.json({ message: 'Break started', status: 'BREAK' });
    } else if (log.status === 'BREAK') {
        const breakDuration = Math.floor((new Date() - new Date(log.break_start)) / 1000);
        log.total_break_time += breakDuration;
        log.break_start = null;
        log.status = 'IN';
        res.json({ message: 'Break ended', status: 'IN' });
    }
});

app.post('/api/attendance/approve', (req, res) => {
    const { id, status } = req.body;
    const log = attendance.find(a => a.id === id);
    if (!log) return res.status(404).json({ error: 'Attendance log not found' });
    log.approval_status = status;
    res.json({ message: `Attendance ${status.toLowerCase()} successfully` });
});

app.get('/api/attendance/status/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const logs = attendance.filter(a => a.user_id === userId);
    const latest = logs[logs.length - 1];
    res.json(latest || { status: 'OUT' });
});

app.get('/api/attendance/logs', (req, res) => {
    const { userId } = req.query;
    let result = [...attendance].reverse();
    if (userId) result = result.filter(a => a.user_id === parseInt(userId));
    res.json(result);
});

// Serve frontend pages
app.get('/', (req, res) => res.sendFile(path.join(PAGES_DIR, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(PAGES_DIR, 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(PAGES_DIR, 'login.html')));
app.get('/staff.html', (req, res) => res.sendFile(path.join(PAGES_DIR, 'staff.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(PAGES_DIR, 'admin.html')));

// Export for Vercel (serverless)
module.exports = app;

// Start server locally only when NOT on Vercel
if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server running at http://localhost:${PORT}`);
        console.log(`📱 Access from phone on same Wi-Fi: http://<your-local-IP>:${PORT}`);
    });
}
