const Database = require('better-sqlite3');
const path = require('path');

// Create database file in the server directory
const dbPath = path.join(__dirname, 'chatta.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database tables
function initializeDatabase() {
  console.log('Running database migrations...');
  
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create rooms table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users (id)
    )
  `);

  // Create room_members table
  db.exec(`
    CREATE TABLE IF NOT EXISTS room_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms (id),
      FOREIGN KEY (user_id) REFERENCES users (id),
      UNIQUE(room_id, user_id)
    )
  `);

  // Create messages table with proper indexing for pagination
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      type TEXT DEFAULT 'chat',
      parent_id TEXT,
      reactions TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms (id),
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (parent_id) REFERENCES messages (id)
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_room_created_at ON messages(room_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages(parent_id);
  `);

  console.log('Database initialized successfully');
}

// User functions
function createUser(userData) {
  const stmt = db.prepare(`
    INSERT INTO users (username, email, password_hash, avatar)
    VALUES (?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    userData.username,
    userData.email || `${userData.username}@example.com`,
    userData.password_hash || 'placeholder',
    userData.avatar || null
  );
  
  return { 
    id: result.lastInsertRowid, 
    username: userData.username,
    email: userData.email || `${userData.username}@example.com`,
    avatar: userData.avatar || null
  };
}

function findUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email);
}

function findUserById(id) {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id);
}

function findUserByUsername(username) {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username);
}

// Room functions
function createRoom(roomData) {
  const stmt = db.prepare(`
    INSERT INTO rooms (name, description, created_by)
    VALUES (?, ?, ?)
  `);
  
  const result = stmt.run(
    roomData.name,
    roomData.description || null,
    roomData.created_by
  );
  
  return { 
    id: result.lastInsertRowid, 
    name: roomData.name,
    description: roomData.description || null,
    created_by: roomData.created_by
  };
}

function getRooms() {
  const stmt = db.prepare(`
    SELECT r.*, 
           COUNT(rm.user_id) as member_count,
           u.username as creator_username
    FROM rooms r
    LEFT JOIN room_members rm ON r.id = rm.room_id
    LEFT JOIN users u ON r.created_by = u.id
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `);
  return stmt.all();
}

function getRoomByName(name) {
  const stmt = db.prepare('SELECT * FROM rooms WHERE name = ?');
  return stmt.get(name);
}

function getRoomById(id) {
  const stmt = db.prepare('SELECT * FROM rooms WHERE id = ?');
  return stmt.get(id);
}

// Message functions
function saveMessage(message) {
  const stmt = db.prepare(`
    INSERT INTO messages (id, room_id, user_id, text, type, parent_id, reactions)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const messageData = {
    id: message.id || require('uuid').v4(),
    room_id: message.room_id,
    user_id: message.user_id,
    text: message.text,
    type: message.type || 'chat',
    parent_id: message.parentId || null,
    reactions: JSON.stringify(message.reactions || [])
  };
  
  stmt.run(messageData.id, messageData.room_id, messageData.user_id, messageData.text, messageData.type, messageData.parent_id, messageData.reactions);
  return messageData;
}

function getMessages(roomId, limit = 50, before = null) {
  let query = `
    SELECT m.*, u.username, u.avatar
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.room_id = ?
  `;
  
  const params = [roomId];
  
  if (before) {
    query += ' AND m.created_at < ?';
    params.push(before);
  }
  
  query += ' ORDER BY m.created_at DESC LIMIT ?';
  params.push(limit);
  
  const stmt = db.prepare(query);
  const messages = stmt.all(...params);
  
  // Parse reactions and format messages
  return messages.reverse().map(msg => ({
    ...msg,
    reactions: JSON.parse(msg.reactions || '[]'),
    parentId: msg.parent_id
  }));
}

function getLatestMessages(roomId, limit = 50) {
  const stmt = db.prepare(`
    SELECT m.*, u.username, u.avatar
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.room_id = ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `);
  
  const messages = stmt.all(roomId, limit);
  
  // Parse reactions and format messages
  return messages.reverse().map(msg => ({
    ...msg,
    reactions: JSON.parse(msg.reactions || '[]'),
    parentId: msg.parent_id
  }));
}

// Room member functions
function addMember(roomId, userId) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO room_members (room_id, user_id)
    VALUES (?, ?)
  `);
  
  return stmt.run(roomId, userId);
}

function removeMember(roomId, userId) {
  const stmt = db.prepare(`
    DELETE FROM room_members
    WHERE room_id = ? AND user_id = ?
  `);
  
  return stmt.run(roomId, userId);
}

function getRoomMembers(roomId) {
  const stmt = db.prepare(`
    SELECT u.id, u.username, u.avatar, rm.joined_at
    FROM room_members rm
    JOIN users u ON rm.user_id = u.id
    WHERE rm.room_id = ?
    ORDER BY rm.joined_at ASC
  `);
  return stmt.all(roomId);
}

function isMemberOfRoom(roomId, userId) {
  const stmt = db.prepare(`
    SELECT 1 FROM room_members
    WHERE room_id = ? AND user_id = ?
    LIMIT 1
  `);
  return stmt.get(roomId, userId) !== undefined;
}

// Utility functions
function getActiveRoomsWithUserCounts() {
  const stmt = db.prepare(`
    SELECT r.name, COUNT(rm.user_id) as user_count
    FROM rooms r
    LEFT JOIN room_members rm ON r.id = rm.room_id
    GROUP BY r.id, r.name
    HAVING user_count > 0
    ORDER BY user_count DESC, r.name ASC
  `);
  return stmt.all();
}

function getRoomUsersForAPI(roomName) {
  const stmt = db.prepare(`
    SELECT u.id, u.username
    FROM room_members rm
    JOIN rooms r ON rm.room_id = r.id
    JOIN users u ON rm.user_id = u.id
    WHERE r.name = ?
    ORDER BY u.username ASC
  `);
  return stmt.all(roomName);
}

function getRoomExists(roomName) {
  const stmt = db.prepare('SELECT 1 FROM rooms WHERE name = ?');
  return stmt.get(roomName) !== undefined;
}

// Thread functions
function getThreadReplies(parentId, limit = 50) {
  const stmt = db.prepare(`
    SELECT m.*, u.username, u.avatar
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.parent_id = ?
    ORDER BY m.created_at ASC
    LIMIT ?
  `);
  
  const messages = stmt.all(parentId, limit);
  
  // Parse reactions and format messages
  return messages.map(msg => ({
    ...msg,
    reactions: JSON.parse(msg.reactions || '[]'),
    parentId: msg.parent_id
  }));
}

// Reaction functions
function updateMessageReactions(messageId, reactions) {
  const stmt = db.prepare(`
    UPDATE messages 
    SET reactions = ?
    WHERE id = ?
  `);
  
  return stmt.run(JSON.stringify(reactions), messageId);
}

function getMessageReactions(messageId) {
  const stmt = db.prepare('SELECT reactions FROM messages WHERE id = ?');
  const result = stmt.get(messageId);
  return result ? JSON.parse(result.reactions || '[]') : [];
}

function ensureRoomExists(roomName) {
  if (!getRoomExists(roomName)) {
    // Create a system user for room creation if needed
    let systemUser = findUserByUsername('System');
    if (!systemUser) {
      systemUser = createUser({ username: 'System' });
    }
    
    const room = createRoom({
      name: roomName,
      description: `Chat room for ${roomName}`,
      created_by: systemUser.id
    });
    return room;
  }
  return getRoomByName(roomName);
}

// Close database connection
function closeDatabase() {
  db.close();
}

module.exports = {
  initializeDatabase,
  // User operations
  createUser,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  // Room operations
  createRoom,
  getRooms,
  getRoomByName,
  getRoomById,
  // Message operations
  saveMessage,
  getMessages,
  getLatestMessages,
  // Room member operations
  addMember,
  removeMember,
  getRoomMembers,
  isMemberOfRoom,
  // Thread operations
  getThreadReplies,
  // Reaction operations
  updateMessageReactions,
  getMessageReactions,
  // Utility functions
  getLatestMessages,
  getActiveRoomsWithUserCounts,
  getRoomUsersForAPI,
  getRoomExists,
  ensureRoomExists
};
