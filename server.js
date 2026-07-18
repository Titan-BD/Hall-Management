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

// Render Environment Variable থেকে কানেকশন নেওয়া
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI)
  .then(() => console.log("MongoDB Connected Successfully!"))
  .catch(err => console.error("MongoDB Connection Error:", err));

// ডেটাবেস স্কিমা (Schema) তৈরি
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

// ESP32 থেকে ডেটা রিসিভ ও সেভ করা
app.post('/api/data', async (req, res) => {
    try {
        const newData = new PowerData(req.body);
        await newData.save(); // ডেটাবেসে সেভ হচ্ছে
        
        io.emit('powerUpdate', req.body); // রিয়েল-টাইম ব্রাউজারে পাঠানো হচ্ছে
        res.status(200).send({ message: "Saved and Broadcasted!" });
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

// ওয়েবসাইট লোড হলে শেষ ৩০টি ডেটার ইতিহাস গ্রাফের জন্য পাঠানো
app.get('/api/history', async (req, res) => {
    try {
        const history = await PowerData.find().sort({ timestamp: -1 }).limit(30);
        res.json(history.reverse());
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
