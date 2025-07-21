require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

app.use((req, res, next) => {
  req.io = io;
  next();
});

io.on('connection', (socket) => {
  console.log('✅ Socket.IO: User connected', socket.id);

  const token = socket.handshake.auth.token;
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      // Join user-specific room
      socket.join(decoded.id);
      // Check if user is admin and join admin room
      User.findById(decoded.id)
        .then(user => {
          if (user?.isAdmin) {
            socket.join('admin');
            console.log(`✅ Socket.IO: Admin ${decoded.id} joined admin room`);
          }
        })
        .catch(err => {
          console.error('❌ Socket.IO: Error checking admin status', err.message);
        });
    } catch (err) {
      console.error('❌ Socket.IO: Invalid token', err.message);
      socket.disconnect();
    }
  }

  socket.on('disconnect', () => {
    console.log('❌ Socket.IO: User disconnected', socket.id);
  });
});

require('./cron');
app.use('/api/auth', require('./routes/auth'));
app.use('/api/email', require('./routes/emailRoutes'));
app.use('/api/products', require('./routes/productRoutes'));

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/myapp';

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ DB Connection Error:', err.message);
  });