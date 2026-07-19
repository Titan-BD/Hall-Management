const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// ESP32 থেকে ডেটা রিসিভ ও সেভ
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

// শেষ ১০টি ডেটার টেবিল দেখানোর জন্য
app.get('/api/history', async (req, res) => {
    try {
        const history = await PowerData.find().sort({ timestamp: -1 }).limit(10);
        res.json(history);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

// সম্পূর্ণ ডেটা CSV আকারে ডাউনলোড করার জন্য
app.get('/api/download', async (req, res) => {
    try {
        const data = await PowerData.find().sort({ timestamp: -1 });
        let csv = 'Timestamp,Voltage(V),Current(A),Power(W),Energy(kWh)\n';
        data.forEach(row => {
            csv += `${row.timestamp.toISOString()},${row.voltage},${row.current},${row.power},${row.energy}\n`;
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=power_report.csv');
        res.status(200).send(csv);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
