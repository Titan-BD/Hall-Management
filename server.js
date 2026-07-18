const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*" }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ESP32 এই লিংকে প্রতি ১ সেকেন্ডে ডেটা পাঠাবে (POST Request)
app.post('/api/data', (req, res) => {
    const powerData = req.body;
    
    // সাথে সাথে কানেক্টেড সব ব্রাউজারে ডেটা পাঠিয়ে দাও
    io.emit('powerUpdate', powerData);
    
    res.status(200).send({ message: "Data received successfully" });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
