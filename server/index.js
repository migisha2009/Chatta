const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('./models/User');
const userStore = require('./auth/userStore');
const { authenticateToken, authenticateSocket, generateToken } = require('./middleware/auth');
const ChattaBot = require('./services/chattaBot');
const {
  securityMiddleware,
  createLogger,
  requestLogger,
  errorHandler,
  securityHeaders,
  validateInput,
  corsOptions
} = require('./middleware/security');
const {
  initializeDatabase,
  createUser,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  createRoom,
  getRooms,
  getRoomByName,
  getRoomById,
  saveMessage,
  getMessages,
  getLatestMessages,
  addMember,
  removeMember,
  getRoomMembers,
  isMemberOfRoom,
  getActiveRoomsWithUserCounts,
  getRoomUsersForAPI,
  ensureRoomExists,
  searchMessages,
  getSearchSuggestions
} = require('./database');

const app = express();
const server = http.createServer(app);
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

// Initialize logger
const logger = createLogger();

// Create logs directory if it doesn't exist
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// Apply security middleware
securityMiddleware(app);
app.use(securityHeaders);
app.use(validateInput);
app.use(requestLogger(logger));

const io = socketIo(server, {
  cors: {
    origin: clientUrl,
    methods: ["GET", "POST"]
  }
});

app.use(cors(corsOptions));
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads', 'avatars');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || req.body.userId || 'unknown';
    cb(null, `${userId}.jpg`);
  }
});

const fileFilter = (req, file, cb) => {
  // Only allow image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  }
});

// Serve static files from client/dist in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('../client/dist'));
}

const PORT = process.env.PORT || 5000;

// In-memory array of online users
const users = [];

// User profiles storage (in production, use a database)
const userProfiles = new Map();

// Track typing users per room
const typingUsers = {};

// Message buffer for last 50 messages per room
const messageHistory = {};

// Thread storage - organize messages by thread
const threadMessages = {};

// Message reactions storage
const messageReactions = {};

// Rate limiting: track messages per socket
const rateLimitMap = new Map(); // socketId -> { count: number, resetTime: number }

// Initialize ChattaBot
const chattaBot = new ChattaBot();

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
const getUser = (id) => {
  const onlineUser = users.find(user => user.id === id);
  if (onlineUser) {
    // Get full user data from database
    const dbUser = findUserByUsername(onlineUser.username);
    if (dbUser) {
      return { ...onlineUser, userId: dbUser.id, avatar: dbUser.avatar };
    }
  }
  return onlineUser;
};

const userJoin = async (id, username, room) => {
  // Find or create room
  let roomData = getRoomByName(room);
  if (!roomData) {
    // Create system user for room creation if needed
    let systemUser = findUserByUsername('System');
    if (!systemUser) {
      systemUser = createUser({ username: 'System' });
    }
    
    roomData = createRoom({
      name: room,
      description: `Chat room for ${room}`,
      created_by: systemUser.id
    });
  }
  
  // Find or create user
  let userData = findUserByUsername(username);
  if (!userData) {
    userData = createUser({ username });
  }
  
  // Add user to room members
  addMember(roomData.id, userData.id);
  
  const user = { id, username, room, userId: userData.id, roomId: roomData.id };
  users.push(user);
  
  // Initialize user profile if not exists
  if (!userProfiles.has(id)) {
    userProfiles.set(id, {
      username: username,
      avatar: userData.avatar,
      joinedAt: new Date().toISOString(),
      messageCount: 0
    });
  }
  
  return user;
};

const userLeave = (id) => {
  const index = users.findIndex(user => user.id === id);
  if (index !== -1) {
    const user = users.splice(index, 1)[0];
    
    // Remove from room members if user has userId
    if (user.userId && user.roomId) {
      removeMember(user.roomId, user.userId);
    }
    
    return user;
  }
  return null;
};

const getRoomUsers = async (room) => {
  const roomData = getRoomByName(room);
  if (!roomData) return [];
  
  const members = getRoomMembers(roomData.id);
  const onlineInRoom = users.filter(user => user.room === room);
  
  return onlineInRoom.map(user => {
    const memberData = members.find(m => m.id === user.userId);
    return {
      id: user.id,
      username: user.username,
      userId: user.userId,
      roomId: user.roomId,
      avatar: memberData?.avatar || null
    };
  });
};

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

// Socket.io connection handling with JWT authentication
io.use(authenticateSocket);

io.on('connection', (socket) => {
  console.log(`Authenticated connection: ${socket.id}, User: ${socket.user?.username}`);

  // Handle joinRoom event
  socket.on('joinRoom', async ({ room }) => {
    try {
      // Input validation
      if (!validateRoom(room)) {
        socket.emit('error', { message: 'Invalid room name. Must be non-empty and max 30 characters.' });
        return;
      }

      const user = await userJoin(socket.id, socket.user.username, room.trim());
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
      const roomUsers = await getRoomUsers(user.room);
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: roomUsers
      });
      
      // Send message history to the joining user
      const history = getLatestMessages(user.roomId, 50);
      socket.emit('messageHistory', {
        room: user.room,
        messages: history.map(msg => ({
          id: msg.id,
          username: msg.username,
          text: msg.text,
          time: new Date(msg.created_at * 1000).toLocaleTimeString(),
          avatar: msg.avatar
        }))
      });
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle chatMessage event
  socket.on('chatMessage', async (data) => {
    try {
      const user = getUser(socket.id);
      if (!user) {
        socket.emit('error', { message: 'You must join a room to send messages' });
        return;
      }

      // Support different message types
      const messageType = data.type || 'chat';
      let text = typeof data === 'string' ? data : data.text;
      const attachments = typeof data === 'object' && data.attachments ? data.attachments : [];
      let audioData = null;
      
      // Handle voice messages
      if (messageType === 'voice' && data.audio) {
        audioData = data.audio;
        text = `[Voice message - ${data.duration}s]`;
      }

      // Check rate limiting
      if (!checkRateLimit(socket.id)) {
        socket.emit('rateLimited', { 
          message: 'Rate limit exceeded. Please wait before sending more messages.',
          resetTime: rateLimitMap.get(socket.id)?.resetTime
        });
        return;
      }

      // Sanitize message text (allow empty text if there are attachments)
      const sanitizedText = sanitizeMessage(text);
      if (!sanitizedText && attachments.length === 0) {
        socket.emit('error', { message: 'Message cannot be empty or contain only invalid characters' });
        return;
      }

      // Save message to database
      const savedMessage = saveMessage({
        room_id: user.roomId,
        user_id: user.userId,
        text: sanitizedText,
        type: messageType,
        audio: audioData
      });

      const message = {
        id: savedMessage.id,
        username: user.username,
        text: sanitizedText,
        time: new Date(savedMessage.created_at * 1000).toLocaleTimeString(),
        avatar: user.avatar,
        attachments: attachments,
        type: messageType,
        audio: audioData,
        duration: data.duration || null
      };
      
      // Increment user message count
      const profile = userProfiles.get(user.id);
      if (profile) {
        profile.messageCount++;
      }
      
      // Broadcast to room
      io.to(user.room).emit('message', message);
      
      // Check for @ChattaBot mention and generate AI response
      if (sanitizedText.includes('@ChattaBot')) {
        // Get room context for AI
        const roomMessages = getLatestMessages(user.roomId, 10);
        const botResponse = await chattaBot.processMessage(sanitizedText, roomMessages, user);
        
        if (botResponse) {
          // Save bot message to database
          const savedBotMessage = saveMessage({
            room_id: user.roomId,
            user_id: null, // Bot messages don't have a user_id
            text: botResponse.text,
            type: 'bot',
            username: botResponse.username
          });
          
          // Broadcast bot response
          setTimeout(() => {
            io.to(user.room).emit('message', {
              id: savedBotMessage.id,
              username: botResponse.username,
              text: botResponse.text,
              time: botResponse.time,
              isAI: true,
              avatar: botResponse.avatar
            });
          }, 1000); // 1 second delay for natural conversation flow
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
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

  // Handle reaction event
  socket.on('react', ({ messageId, emoji }) => {
    const user = getUser(socket.id);
    if (!user) {
      socket.emit('error', { message: 'You must be in a room to react to messages' });
      return;
    }

    // Initialize reactions for this message if not exists
    if (!messageReactions[messageId]) {
      messageReactions[messageId] = [];
    }

    const reactions = messageReactions[messageId];
    const existingReaction = reactions.find(r => r.emoji === emoji);

    if (existingReaction) {
      // Toggle user's reaction
      const userIndex = existingReaction.users.indexOf(user.id);
      if (userIndex > -1) {
        existingReaction.users.splice(userIndex, 1);
        // Remove reaction if no users left
        if (existingReaction.users.length === 0) {
          const reactionIndex = reactions.indexOf(existingReaction);
          reactions.splice(reactionIndex, 1);
        }
      } else {
        existingReaction.users.push(user.id);
      }
    } else {
      // Add new reaction
      reactions.push({
        emoji: emoji,
        users: [user.id]
      });
    }

    // Broadcast reaction update to room
    io.to(user.room).emit('reactionUpdated', {
      messageId: messageId,
      reactions: reactions
    });
  });

  // Handle thread reply event
  socket.on('threadReply', ({ parentId, text }) => {
    const user = getUser(socket.id);
    if (!user) {
      socket.emit('error', { message: 'You must be in a room to reply to threads' });
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

    const replyMessage = {
      id: uuidv4(),
      username: user.username,
      text: sanitizedText,
      time: new Date().toLocaleTimeString(),
      userId: user.id,
      reactions: [],
      parentId: parentId
    };

    // Store in thread messages
    if (!threadMessages[parentId]) {
      threadMessages[parentId] = [];
    }
    threadMessages[parentId].push(replyMessage);

    // Keep only last 50 replies per thread
    if (threadMessages[parentId].length > 50) {
      threadMessages[parentId] = threadMessages[parentId].slice(-50);
    }

    // Increment user message count
    const profile = userProfiles.get(user.id);
    if (profile) {
      profile.messageCount++;
    }

    // Join thread room and broadcast to thread participants
    const threadRoom = `thread:${parentId}`;
    socket.join(threadRoom);
    io.to(threadRoom).emit('threadMessage', replyMessage);
    
    // Also broadcast to main room as a regular message
    io.to(user.room).emit('message', replyMessage);
    addMessageToHistory(user.room, replyMessage);
  });

  // Handle joining thread room
  socket.on('joinThread', ({ messageId }) => {
    const user = getUser(socket.id);
    if (!user) return;

    const threadRoom = `thread:${messageId}`;
    socket.join(threadRoom);

    // Send existing thread messages
    const replies = threadMessages[messageId] || [];
    socket.emit('threadHistory', {
      messageId: messageId,
      messages: replies
    });
  });

  // Handle leaving thread room
  socket.on('leaveThread', ({ messageId }) => {
    const threadRoom = `thread:${messageId}`;
    socket.leave(threadRoom);
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

// Authentication Routes

// POST /api/auth/register - Register a new user
app.post('/api/auth/register', [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    // Check if user already exists
    if (userStore.emailExists(email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = User.createFromRegistration({ username, email, passwordHash });
    userStore.addUser(user);

    // Generate JWT
    const token = generateToken(user.id);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login - Login user
app.post('/api/auth/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = userStore.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = generateToken(user.id);

    res.json({
      message: 'Login successful',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me - Get current user info (protected route)
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// REST API Endpoints

// POST /api/profile/avatar - upload and resize avatar
app.post('/api/profile/avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const inputPath = req.file.path;
    const outputPath = path.join(__dirname, 'uploads', 'avatars', `${userId}.jpg`);

    // Resize image to 200x200 using sharp
    await sharp(inputPath)
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toFile(outputPath);

    // Clean up temporary file
    fs.unlinkSync(inputPath);

    // Update user profile with avatar URL
    const profile = userProfiles.get(userId);
    if (profile) {
      profile.avatar = `/uploads/avatars/${userId}.jpg`;
    }

    // Broadcast profile update to all connected clients
    io.emit('profileUpdate', {
      userId: userId,
      profile: userProfiles.get(userId)
    });

    res.json({
      message: 'Avatar uploaded successfully',
      avatarUrl: `/uploads/avatars/${userId}.jpg`
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// GET /api/profile/:userId - get public profile
app.get('/api/profile/:userId', (req, res) => {
  const userId = req.params.userId;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const profile = userProfiles.get(userId);
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  // Return public profile information
  res.json({
    username: profile.username,
    avatar: profile.avatar,
    joinedAt: profile.joinedAt,
    messageCount: profile.messageCount
  });
});

// PUT /api/profile - update profile (username and/or avatar URL)
app.put('/api/profile', (req, res) => {
  const { userId, username, avatarUrl } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const profile = userProfiles.get(userId);
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  // Update username if provided and valid
  if (username) {
    if (!validateUsername(username)) {
      return res.status(400).json({ error: 'Invalid username' });
    }
    
    // Check for username uniqueness (simplified - in production use proper database query)
    const isUnique = !Array.from(userProfiles.values()).some(p => 
      p.username === username.trim() && userProfiles.get(userId) !== p
    );
    
    if (!isUnique) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    
    profile.username = username.trim();
    
    // Update user in online users list
    const user = getUser(userId);
    if (user) {
      user.username = username.trim();
    }
  }

  // Update avatar URL if provided
  if (avatarUrl) {
    profile.avatar = avatarUrl;
  }

  // Broadcast profile update to all connected clients
  io.emit('profileUpdate', {
    userId: userId,
    profile: profile
  });

  res.json({
    message: 'Profile updated successfully',
    profile: {
      username: profile.username,
      avatar: profile.avatar,
      joinedAt: profile.joinedAt,
      messageCount: profile.messageCount
    }
  });
});

// GET /api/rooms - returns list of active rooms with user counts
app.get('/api/rooms', (req, res) => {
  try {
    const rooms = getActiveRoomsWithUserCounts();
    res.json(rooms);
  } catch (error) {
    console.error('Error getting rooms:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

// GET /api/messages/:roomId - get paginated message history
app.get('/api/messages/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  const limit = parseInt(req.query.limit) || 30;
  const before = req.query.before || null;
  
  if (!roomId || roomId.trim().length === 0) {
    return res.status(400).json({ error: 'Room ID is required' });
  }
  
  if (limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'Limit must be between 1 and 100' });
  }
  
  try {
    const result = getMessages(roomId.trim(), limit, before);
    res.json(result);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// GET /api/users/:room - returns users currently in that room
app.get('/api/users/:room', (req, res) => {
  try {
    const room = req.params.room;
    
    if (!room || room.trim().length === 0) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const roomUsers = getRoomUsersForAPI(room.trim());

    res.json({
      room: room.trim(),
      users: roomUsers,
      userCount: roomUsers.length
    });
  } catch (error) {
    console.error('Error getting room users:', error);
    res.status(500).json({ error: 'Failed to get room users' });
  }
});

// Configure multer for file uploads
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const today = new Date();
    const dateFolder = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const uploadPath = path.join(__dirname, 'uploads', 'files', dateFolder);
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    cb(null, `${uniqueId}-${baseName}${extension}`);
  }
});

const documentFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'text/markdown', 'application/zip',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

const fileUpload = multer({
  storage: fileStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5 // Maximum 5 files
  }
});

// GET /api/search - search messages across all rooms
app.get('/api/search', (req, res) => {
  try {
    const { q: query, roomId, limit = 20, offset = 0 } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const results = searchMessages(query.trim(), roomId, parseInt(limit), parseInt(offset));
    
    res.json({
      query: query.trim(),
      results: results.map(msg => ({
        id: msg.id,
        roomId: msg.room_id,
        username: msg.username,
        text: msg.text,
        highlightedText: msg.highlighted_text,
        time: new Date(msg.created_at * 1000).toLocaleString(),
        rank: msg.rank
      })),
      hasMore: results.length === parseInt(limit),
      total: results.length
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/search/suggestions - get search suggestions
app.get('/api/search/suggestions', (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.json({ suggestions: [] });
    }
    
    const suggestions = getSearchSuggestions(query.trim(), parseInt(limit));
    
    res.json({
      suggestions: suggestions.map(s => s.suggestion)
    });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

// Admin Dashboard Endpoints

// GET /api/admin/stats - get dashboard statistics
app.get('/api/admin/stats', (req, res) => {
  try {
    const stats = {
      totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
      totalRooms: db.prepare('SELECT COUNT(*) as count FROM rooms').get().count,
      totalMessages: db.prepare('SELECT COUNT(*) as count FROM messages').get().count,
      activeUsers: new Set(onlineUsers.values()).size,
      onlineUsers: Object.keys(onlineUsers).length,
      bannedUsers: db.prepare('SELECT COUNT(*) as count FROM banned_users WHERE expires_at IS NULL OR expires_at > ?').get(Date.now()).count,
      reports: db.prepare('SELECT COUNT(*) as count FROM message_reports WHERE status = "pending"').get().count,
      moderatedMessages: db.prepare('SELECT COUNT(*) as count FROM messages WHERE type = "deleted"').get().count
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/admin/charts - get chart data
app.get('/api/admin/charts', (req, res) => {
  try {
    const { range = '7d' } = req.query;
    
    // User growth data
    const userGrowth = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const count = db.prepare('SELECT COUNT(*) as count FROM users WHERE DATE(created_at / 86400, "unixepoch") = ?').get(dateStr).count;
      userGrowth.push({ date: dateStr, users: count });
    }

    // Message activity by hour
    const messageActivity = [];
    for (let hour = 0; hour < 24; hour++) {
      const count = db.prepare('SELECT COUNT(*) as count FROM messages WHERE strftime("%H", created_at, "unixepoch") = ?').get(hour.toString()).count;
      messageActivity.push({ hour: `${hour}:00`, messages: count });
    }

    // Room distribution
    const roomDistribution = [
      { name: 'Public', value: db.prepare('SELECT COUNT(*) as count FROM rooms WHERE type = "public"').get().count },
      { name: 'Private', value: db.prepare('SELECT COUNT(*) as count FROM rooms WHERE type = "private"').get().count },
      { name: 'Protected', value: db.prepare('SELECT COUNT(*) as count FROM rooms WHERE type = "protected"').get().count }
    ];

    // Top users
    const topUsers = db.prepare(`
      SELECT u.id, u.username, COUNT(m.id) as messages, 
             strftime("%Y-%m-%d", u.created_at, "unixepoch") as joined
      FROM users u
      LEFT JOIN messages m ON u.id = m.user_id
      GROUP BY u.id
      ORDER BY messages DESC
      LIMIT 10
    `).all();

    res.json({
      userGrowth,
      messageActivity,
      roomDistribution,
      topUsers
    });
  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

// GET /api/admin/reports - get moderation reports
app.get('/api/admin/reports', (req, res) => {
  try {
    const reports = getMessageReports();
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// POST /api/admin/reports/:id/review - review a report
app.post('/api/admin/reports/:id/review', (req, res) => {
  try {
    const { status } = req.body;
    const reportId = req.params.id;
    
    updateReportStatus(reportId, status, 'admin');
    res.json({ success: true });
  } catch (error) {
    console.error('Error reviewing report:', error);
    res.status(500).json({ error: 'Failed to review report' });
  }
});

// POST /api/rooms/:roomId/summarize - get AI summary of room
app.post('/api/rooms/:roomId/summarize', async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const { limit = 50 } = req.body;
    
    if (!roomId || roomId.trim().length === 0) {
      return res.status(400).json({ error: 'Room ID is required' });
    }
    
    // Get recent messages for summarization
    const messages = getLatestMessages(roomId, limit);
    
    if (messages.length === 0) {
      return res.json({ summary: "No messages to summarize yet. Start the conversation! 📝" });
    }
    
    const summary = await chattaBot.summarizeRoom(messages);
    
    res.json({ 
      summary,
      messageCount: messages.length,
      timeRange: {
        oldest: new Date(messages[0].created_at * 1000).toLocaleString(),
        newest: new Date(messages[messages.length - 1].created_at * 1000).toLocaleString()
      }
    });
  } catch (error) {
    console.error('Error summarizing room:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// POST /api/upload - upload files
app.post('/api/upload', fileUpload.array('files', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = req.files.map(file => {
      const today = new Date();
      const dateFolder = today.toISOString().split('T')[0];
      const relativePath = path.join('files', dateFolder, file.filename);
      
      return {
        url: `/uploads/${relativePath.replace(/\\/g, '/')}`,
        filename: file.originalname,
        size: file.size,
        type: file.mimetype
      };
    });

    res.json({
      message: 'Files uploaded successfully',
      files: uploadedFiles
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Initialize database
initializeDatabase();

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler middleware
app.use(errorHandler(logger));

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
});
