const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

const io = socketIo(server, {
  cors: {
    origin: clientUrl,
    methods: ["GET", "POST"]
  }
});

app.use(cors({
  origin: clientUrl,
  credentials: true
}));
app.use(express.json());

// Serve static files from client/dist in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('../client/dist'));
  
  // Handle SPA routing - send all requests to index.html
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/dist/index.html'));
  });
}

const PORT = process.env.PORT || 5000;

// In-memory array of online users
const users = [];

// Track typing users per room
const typingUsers = {};

// Message buffer for last 50 messages per room
const messageHistory = {};

// Rate limiting: track messages per socket
const rateLimitMap = new Map(); // socketId -> { count: number, resetTime: number }

// Message sanitization function
const sanitizeMessage = (text) => {
  if (!text) return '';
  
  // Remove HTML tags
  return text.replace(/<[^>]*>/g, '')
            // Remove potentially dangerous characters
            .replace(/[<>]/g, '')
            // Trim whitespace
            .trim()
            // Limit length to prevent abuse
            .substring(0, 1000);
};

// Rate limiting check function
const checkRateLimit = (socketId) => {
  const now = Date.now();
  const windowStart = now - 5000; // 5 second window
  
  if (!rateLimitMap.has(socketId)) {
    rateLimitMap.set(socketId, { count: 1, resetTime: windowStart + 5000 });
    return true;
  }
  
  const limit = rateLimitMap.get(socketId);
  
  // Reset window if expired
  if (now > limit.resetTime) {
    limit.count = 1;
    limit.resetTime = now + 5000;
    return true;
  }
  
  // Check if over limit
  if (limit.count >= 10) {
    return false;
  }
  
  limit.count++;
  return true;
};

// Input validation
const validateUsername = (username) => {
  return username && username.trim().length > 0 && username.trim().length <= 30;
};

const validateRoom = (room) => {
  return room && room.trim().length > 0 && room.trim().length <= 30;
};

// Helper functions
const getUser = (id) => users.find(user => user.id === id);
const userJoin = (id, username, room) => {
  const user = { id, username, room };
  users.push(user);
  return user;
};
const userLeave = (id) => {
  const index = users.findIndex(user => user.id === id);
  if (index !== -1) {
    return users.splice(index, 1)[0];
  }
};
const getRoomUsers = (room) => users.filter(user => user.room === room);

// Message buffer helper functions
const addMessageToHistory = (room, message) => {
  if (!messageHistory[room]) {
    messageHistory[room] = [];
  }
  messageHistory[room].push(message);
  
  // Keep only last 50 messages
  if (messageHistory[room].length > 50) {
    messageHistory[room] = messageHistory[room].slice(-50);
  }
};

const getMessageHistory = (room) => {
  return messageHistory[room] || [];
};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Handle joinRoom event
  socket.on('joinRoom', ({ username, room }) => {
    // Input validation
    if (!validateUsername(username) || !validateRoom(room)) {
      socket.emit('error', { message: 'Invalid username or room name. Must be non-empty and max 30 characters.' });
      return;
    }

    const user = userJoin(socket.id, username.trim(), room.trim());
    socket.join(user.room);

    // Welcome message to the user who joined
    socket.emit('message', {
      id: uuidv4(),
      username: 'ChatBot',
      text: `Welcome to ${user.room}, ${user.username}!`,
      time: new Date().toLocaleTimeString()
    });

    // Broadcast when a user connects to the room
    socket.broadcast.to(user.room).emit('message', {
      id: uuidv4(),
      username: 'ChatBot',
      text: `${user.username} has joined the room`,
      time: new Date().toLocaleTimeString()
    });

    // Send users and room info
    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room)
    });

    // Send message history to the joining user
    const history = getMessageHistory(user.room);
    socket.emit('messageHistory', {
      room: user.room,
      messages: history
    });
  });

  // Handle chatMessage event
  socket.on('chatMessage', (text) => {
    const user = getUser(socket.id);
    if (!user) {
      socket.emit('error', { message: 'You must join a room to send messages' });
      return;
    }

    // Check rate limiting
    if (!checkRateLimit(socket.id)) {
      socket.emit('rateLimited', { 
        message: 'Rate limit exceeded. Please wait before sending more messages.',
        resetTime: rateLimitMap.get(socket.id)?.resetTime
      });
      return;
    }

    // Sanitize message text
    const sanitizedText = sanitizeMessage(text);
    if (!sanitizedText) {
      socket.emit('error', { message: 'Message cannot be empty or contain only invalid characters' });
      return;
    }

    const message = {
      id: uuidv4(),
      username: user.username,
      text: sanitizedText,
      time: new Date().toLocaleTimeString()
    };
    
    // Store message in buffer
    addMessageToHistory(user.room, message);
    
    // Broadcast to room
    io.to(user.room).emit('message', message);
  });

  // Handle privateMessage event
  socket.on('privateMessage', ({ to, text }) => {
    const sender = getUser(socket.id);
    const recipient = getUser(to);
    
    if (!sender) {
      socket.emit('error', { message: 'You must be in a room to send private messages' });
      return;
    }
    
    if (!recipient) {
      socket.emit('error', { message: 'User not found' });
      return;
    }
    
    if (!text || text.trim().length === 0) {
      socket.emit('error', { message: 'Message cannot be empty' });
      return;
    }

    const privateMsg = {
      id: uuidv4(),
      from: sender.username,
      fromId: sender.id,
      to: recipient.username,
      toId: recipient.id,
      text: text.trim(),
      time: new Date().toLocaleTimeString()
    };

    // Send to recipient
    socket.to(to).emit('privateMessage', privateMsg);
    // Send copy to sender
    socket.emit('privateMessage', privateMsg);
  });

  // Handle typing event
  socket.on('typing', () => {
    const user = getUser(socket.id);
    if (user) {
      // Add user to typing list for their room
      if (!typingUsers[user.room]) {
        typingUsers[user.room] = new Set();
      }
      typingUsers[user.room].add(user.username);
      
      // Broadcast to room (excluding sender)
      socket.broadcast.to(user.room).emit('userTyping', {
        username: user.username,
        room: user.room
      });
    }
  });

  // Handle stop typing event
  socket.on('stopTyping', () => {
    const user = getUser(socket.id);
    if (user && typingUsers[user.room]) {
      typingUsers[user.room].delete(user.username);
      
      // Broadcast to room (excluding sender)
      socket.broadcast.to(user.room).emit('userStoppedTyping', {
        username: user.username,
        room: user.room
      });
    }
  });

  // Handle disconnect event
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    const user = userLeave(socket.id);
    
    // Clean up rate limiting data
    rateLimitMap.delete(socket.id);
    
    if (user) {
      // Clean up typing users
      if (typingUsers[user.room]) {
        typingUsers[user.room].delete(user.username);
        socket.broadcast.to(user.room).emit('userStoppedTyping', {
          username: user.username,
          room: user.room
        });
      }

      io.to(user.room).emit('message', {
        id: uuidv4(),
        username: 'ChatBot',
        text: `${user.username} has left the room`,
        time: new Date().toLocaleTimeString()
      });

      // Send updated users and room info
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room)
      });
    }
  });
});

// REST API Endpoints

// GET /api/rooms - returns list of active rooms with user counts
app.get('/api/rooms', (req, res) => {
  const roomCounts = {};
  
  users.forEach(user => {
    if (roomCounts[user.room]) {
      roomCounts[user.room]++;
    } else {
      roomCounts[user.room] = 1;
    }
  });

  const rooms = Object.keys(roomCounts).map(room => ({
    name: room,
    userCount: roomCounts[room]
  }));

  res.json(rooms);
});

// GET /api/users/:room - returns users currently in that room
app.get('/api/users/:room', (req, res) => {
  const room = req.params.room;
  
  if (!room || room.trim().length === 0) {
    return res.status(400).json({ error: 'Room name is required' });
  }

  const roomUsers = getRoomUsers(room.trim()).map(user => ({
    id: user.id,
    username: user.username
  }));

  res.json({
    room: room.trim(),
    users: roomUsers,
    userCount: roomUsers.length
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
