const db = require('./database');
const { v4: uuidv4 } = require('uuid');

// User queries
const createUser = (userData) => {
  const stmt = db.prepare(`
    INSERT INTO users (id, username, email, password_hash, avatar)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const user = {
    id: userData.id || uuidv4(),
    username: userData.username,
    email: userData.email || null,
    password_hash: userData.password_hash || null,
    avatar: userData.avatar || null
  };
  
  stmt.run(user.id, user.username, user.email, user.password_hash, user.avatar);
  return user;
};

const findUserByEmail = (email) => {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email);
};

const findUserById = (id) => {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id);
};

const findUserByUsername = (username) => {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username);
};

// Room queries
const createRoom = (roomData) => {
  const stmt = db.prepare(`
    INSERT INTO rooms (id, name, description, created_by)
    VALUES (?, ?, ?, ?)
  `);
  
  const room = {
    id: roomData.id || uuidv4(),
    name: roomData.name,
    description: roomData.description || null,
    created_by: roomData.created_by
  };
  
  stmt.run(room.id, room.name, room.description, room.created_by);
  return room;
};

const getRooms = () => {
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
};

const getRoomByName = (name) => {
  const stmt = db.prepare('SELECT * FROM rooms WHERE name = ?');
  return stmt.get(name);
};

const getRoomById = (id) => {
  const stmt = db.prepare('SELECT * FROM rooms WHERE id = ?');
  return stmt.get(id);
};

// Message queries
const saveMessage = (messageData) => {
  const stmt = db.prepare(`
    INSERT INTO messages (id, room_id, user_id, text, type)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const message = {
    id: messageData.id || uuidv4(),
    room_id: messageData.room_id,
    user_id: messageData.user_id,
    text: messageData.text,
    type: messageData.type || 'chat'
  };
  
  stmt.run(message.id, message.room_id, message.user_id, message.text, message.type);
  return message;
};

const getMessages = (roomId, limit = 50, before = null) => {
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
  
  // Return in chronological order (oldest first)
  return messages.reverse();
};

const getLatestMessages = (roomId, limit = 50) => {
  const stmt = db.prepare(`
    SELECT m.*, u.username, u.avatar
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.room_id = ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `);
  
  const messages = stmt.all(roomId, limit);
  return messages.reverse(); // Return in chronological order
};

// Room member queries
const addMember = (roomId, userId) => {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO room_members (room_id, user_id)
    VALUES (?, ?)
  `);
  
  return stmt.run(roomId, userId);
};

const removeMember = (roomId, userId) => {
  const stmt = db.prepare(`
    DELETE FROM room_members
    WHERE room_id = ? AND user_id = ?
  `);
  
  return stmt.run(roomId, userId);
};

const getRoomMembers = (roomId) => {
  const stmt = db.prepare(`
    SELECT u.id, u.username, u.avatar, rm.joined_at
    FROM room_members rm
    JOIN users u ON rm.user_id = u.id
    WHERE rm.room_id = ?
    ORDER BY rm.joined_at ASC
  `);
  return stmt.all(roomId);
};

const getUserRooms = (userId) => {
  const stmt = db.prepare(`
    SELECT r.*, rm.joined_at
    FROM room_members rm
    JOIN rooms r ON rm.room_id = r.id
    WHERE rm.user_id = ?
    ORDER BY rm.joined_at DESC
  `);
  return stmt.all(userId);
};

const isMemberOfRoom = (roomId, userId) => {
  const stmt = db.prepare(`
    SELECT 1 FROM room_members
    WHERE room_id = ? AND user_id = ?
    LIMIT 1
  `);
  return stmt.get(roomId, userId) !== undefined;
};

// Utility queries
const getActiveRoomsWithUserCounts = () => {
  const stmt = db.prepare(`
    SELECT r.name, COUNT(rm.user_id) as user_count
    FROM rooms r
    LEFT JOIN room_members rm ON r.id = rm.room_id
    GROUP BY r.id, r.name
    HAVING user_count > 0
    ORDER BY user_count DESC, r.name ASC
  `);
  return stmt.all();
};

const getRoomUsersForAPI = (roomName) => {
  const stmt = db.prepare(`
    SELECT u.id, u.username
    FROM room_members rm
    JOIN rooms r ON rm.room_id = r.id
    JOIN users u ON rm.user_id = u.id
    WHERE r.name = ?
    ORDER BY u.username ASC
  `);
  return stmt.all(roomName);
};

module.exports = {
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
  getUserRooms,
  isMemberOfRoom,
  
  // Utility operations
  getActiveRoomsWithUserCounts,
  getRoomUsersForAPI
};
