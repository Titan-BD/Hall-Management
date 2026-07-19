const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(cookieParser());

// MongoDB Atlas কানেকশন
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI)
  .then(() => console.log("MongoDB Connected Successfully!"))
  .catch(err => console.error("MongoDB Connection Error:", err));

// ডেটাবেস স্কিমা
const PowerDataSchema = new mongoose.Schema({
    voltage: Number,
    current: Number,
    power: Number,
    energy: Number,
    frequency: Number,
    pf: Number,
    timestamp: { type: Date, default: Date.now }
});
const PowerData = mongoose.model('PowerData', PowerDataSchema);

// সিকিউরিটি মিডলওয়্যার (লগইন চেক করার জন্য)
const checkAuth = (req, res, next) => {
    if (req.cookies.auth_token === 'irzalabs_secret_authenticated') {
        next();
    } else {
        res.redirect('/login');
    }
};

// পেজ রুটস (HTML Routes)
app.get('/', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/login', (req, res) => {
    if (req.cookies.auth_token === 'irzalabs_secret_authenticated') {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'login.html'));
});

// লগইন এপিআই
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

    if (password === ADMIN_PASSWORD) {
        // ১ দিনের জন্য সিকিউর কুকি সেট হবে
        res.cookie('auth_token', 'irzalabs_secret_authenticated', { httpOnly: true, maxAge: 86400000 });
        return res.json({ success: true });
    } else {
        return res.json({ success: false, message: "Incorrect Password!" });
    }
});

// লগআউট এপিআই
app.get('/api/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.redirect('/login');
});

// ESP32 ডেটা রিসিভার (ওপেন থাকবে যেন হার্ডওয়্যার ডেটা পাঠাতে পারে)
app.post('/api/data', async (req, res) => {
    try {
        const newData = new PowerData(req.body);
        await newData.save();
        io.emit('powerUpdate', req.body); 
        res.status(200).send({ message: "Saved and Broadcasted!" });
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

// সিকিউরড ডেটা এপিআই (লগইন ছাড়া কেউ এক্সেস পাবে না)
app.get('/api/history', checkAuth, async (req, res) => {
    try {
        const history = await PowerData.find().sort({ timestamp: -1 }).limit(10);
        res.json(history);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

app.get('/api/download', checkAuth, async (req, res) => {
    try {
        const data = await PowerData.find().sort({ timestamp: -1 });
        const UNIT_PRICE = 7.50; 
        let csv = 'Timestamp,Voltage(V),Current(A),Power(W),Frequency(Hz),Power Factor,Energy(kWh),Total Bill(BDT)\n';
        data.forEach(row => {
            const bill = (row.energy * UNIT_PRICE).toFixed(2);
            csv += `${row.timestamp.toISOString()},${row.voltage},${row.current},${row.power},${row.frequency || 0},${row.pf || 0},${row.energy},${bill}\n`;
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=irzalabs_billing_report.csv');
        res.status(200).send(csv);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
