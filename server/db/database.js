const Database = require('better-sqlite3');
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, 'chatta.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Migration function
const migrate = () => {
  console.log('Running database migrations...');
  
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT,
      avatar TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Create rooms table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      type TEXT DEFAULT 'chat',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create room_members table
  db.exec(`
    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY(room_id, user_id),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create FTS5 virtual table for message search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      message_id,
      room_id,
      username,
      text,
      created_at,
      content='messages',
      content_rowid='id'
    )
  `);

  // Create triggers to keep FTS table in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(message_id, room_id, username, text, created_at)
      VALUES (new.id, new.room_id, (SELECT username FROM users WHERE id = new.user_id), new.text, new.created_at);
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, message_id, room_id, username, text, created_at)
      VALUES ('delete', old.id, old.room_id, (SELECT username FROM users WHERE id = old.user_id), old.text, old.created_at);
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, message_id, room_id, username, text, created_at)
      VALUES ('delete', old.id, old.room_id, (SELECT username FROM users WHERE id = old.user_id), old.text, old.created_at);
      INSERT INTO messages_fts(message_id, room_id, username, text, created_at)
      VALUES (new.id, new.room_id, (SELECT username FROM users WHERE id = new.user_id), new.text, new.created_at);
    END
  `);

  // Update rooms table to support types and settings
  db.exec(`
    ALTER TABLE rooms ADD COLUMN type TEXT DEFAULT 'public' CHECK (type IN ('public', 'private', 'protected'));
    ALTER TABLE rooms ADD COLUMN settings TEXT DEFAULT '{}';
  `);

  // Create room_roles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS room_roles (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
      granted_by TEXT,
      granted_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(room_id, user_id)
    )
  `);

  // Create banned_users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS banned_users (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      banned_by TEXT NOT NULL,
      reason TEXT,
      banned_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      expires_at INTEGER,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create message_edits table for edit history
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_edits (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      original_text TEXT NOT NULL,
      edited_by TEXT NOT NULL,
      edited_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create message_reports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_reports (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      reporter_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
      reviewed_by TEXT,
      reviewed_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Create message_reads table for read receipts
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_reads (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      read_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(message_id, user_id)
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_room_created_at ON messages(room_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_room_roles_room_user ON room_roles(room_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_banned_users_room ON banned_users(room_id);
    CREATE INDEX IF NOT EXISTS idx_message_edits_message ON message_edits(message_id);
    CREATE INDEX IF NOT EXISTS idx_message_reports_status ON message_reports(status);
    CREATE INDEX IF NOT EXISTS idx_message_reads_message_user ON message_reads(message_id, user_id);
  `);

  console.log('Database migrations completed successfully!');
};

// Run migrations on startup
migrate();

// Export database instance
module.exports = db;
