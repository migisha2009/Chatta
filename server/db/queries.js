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

// Search functions
const searchMessages = (query, roomId = null, limit = 50, offset = 0) => {
  let whereClause = 'messages_fts MATCH ?';
  let params = [query];
  
  if (roomId) {
    whereClause += ' AND room_id = ?';
    params.push(roomId);
  }
  
  const stmt = db.prepare(`
    SELECT 
      messages_fts.message_id as id,
      messages_fts.room_id,
      messages_fts.username,
      messages_fts.text,
      messages_fts.created_at,
      snippet(messages_fts, 2, '<mark>', '</mark>', '...', 32) as highlighted_text,
      rank
    FROM messages_fts
    WHERE ${whereClause}
    ORDER BY rank
    LIMIT ? OFFSET ?
  `);
  
  return stmt.all(...params, limit, offset);
};

const getSearchSuggestions = (query, limit = 10) => {
  const stmt = db.prepare(`
    SELECT DISTINCT 
      substr(text, 1, 50) as suggestion,
      count(*) as frequency
    FROM messages_fts
    WHERE messages_fts MATCH ? || '*'
    GROUP BY substr(text, 1, 50)
    ORDER BY frequency DESC
    LIMIT ?
  `);
  
  return stmt.all(query, limit);
};

// Role management functions
const setUserRole = (roomId, userId, role, grantedBy) => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO room_roles (id, room_id, user_id, role, granted_by, granted_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(uuidv4(), roomId, userId, role, grantedBy, Date.now());
};

const getUserRole = (roomId, userId) => {
  const stmt = db.prepare('SELECT * FROM room_roles WHERE room_id = ? AND user_id = ?');
  return stmt.get(roomId, userId);
};

const getRoomRoles = (roomId) => {
  const stmt = db.prepare(`
    SELECT rr.*, u.username 
    FROM room_roles rr
    JOIN users u ON rr.user_id = u.id
    WHERE rr.room_id = ?
    ORDER BY 
      CASE rr.role 
        WHEN 'owner' THEN 1 
        WHEN 'admin' THEN 2 
        WHEN 'member' THEN 3 
      END,
      rr.granted_at ASC
  `);
  return stmt.all(roomId);
};

const removeUserRole = (roomId, userId) => {
  const stmt = db.prepare('DELETE FROM room_roles WHERE room_id = ? AND user_id = ?');
  return stmt.run(roomId, userId);
};

// Moderation functions
const banUser = (roomId, userId, bannedBy, reason, expiresAt = null) => {
  const stmt = db.prepare(`
    INSERT INTO banned_users (id, room_id, user_id, banned_by, reason, banned_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(uuidv4(), roomId, userId, bannedBy, reason, Date.now(), expiresAt);
};

const unbanUser = (roomId, userId) => {
  const stmt = db.prepare('DELETE FROM banned_users WHERE room_id = ? AND user_id = ?');
  return stmt.run(roomId, userId);
};

const isUserBanned = (roomId, userId) => {
  const stmt = db.prepare(`
    SELECT * FROM banned_users 
    WHERE room_id = ? AND user_id = ? 
    AND (expires_at IS NULL OR expires_at > ?)
  `);
  return stmt.get(roomId, userId, Date.now());
};

const editMessage = (messageId, newText, editedBy) => {
  const db = require('./database');
  
  // Get original message
  const original = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
  if (!original) return null;
  
  // Record edit history
  const historyStmt = db.prepare(`
    INSERT INTO message_edits (id, message_id, original_text, edited_by, edited_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  historyStmt.run(uuidv4(), messageId, original.text, editedBy, Date.now());
  
  // Update message
  const updateStmt = db.prepare('UPDATE messages SET text = ? WHERE id = ?');
  return updateStmt.run(newText, messageId);
};

const deleteMessage = (messageId, deletedBy) => {
  const db = require('./database');
  
  // Soft delete by marking as deleted
  const stmt = db.prepare('UPDATE messages SET text = "[Message deleted]", type = "deleted" WHERE id = ?');
  return stmt.run(messageId);
};

const reportMessage = (messageId, reporterId, reason) => {
  const stmt = db.prepare(`
    INSERT INTO message_reports (id, message_id, reporter_id, reason, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  return stmt.run(uuidv4(), messageId, reporterId, reason, Date.now());
};

const getMessageReports = (roomId = null, status = null) => {
  let query = `
    SELECT mr.*, m.text as message_text, m.room_id, 
           reporter.username as reporter_name,
           reported.username as reported_name
    FROM message_reports mr
    JOIN messages m ON mr.message_id = m.id
    JOIN users reporter ON mr.reporter_id = reporter.id
    JOIN users reported ON m.user_id = reported.id
  `;
  
  let params = [];
  
  if (roomId) {
    query += ' WHERE m.room_id = ?';
    params.push(roomId);
  }
  
  if (status) {
    query += roomId ? ' AND mr.status = ?' : ' WHERE mr.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY mr.created_at DESC';
  
  const stmt = db.prepare(query);
  return stmt.all(...params);
};

const updateReportStatus = (reportId, status, reviewedBy) => {
  const stmt = db.prepare(`
    UPDATE message_reports 
    SET status = ?, reviewed_by = ?, reviewed_at = ?
    WHERE id = ?
  `);
  
  return stmt.run(status, reviewedBy, Date.now(), reportId);
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
  
  // Search operations
  searchMessages,
  getSearchSuggestions,
  
  // Role operations
  setUserRole,
  getUserRole,
  getRoomRoles,
  removeUserRole,
  
  // Moderation operations
  banUser,
  unbanUser,
  isUserBanned,
  editMessage,
  deleteMessage,
  reportMessage,
  getMessageReports,
  updateReportStatus,
  
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
