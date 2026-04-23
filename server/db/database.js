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

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_room_created_at ON messages(room_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
  `);

  console.log('Database migrations completed successfully!');
};

// Run migrations on startup
migrate();

// Export database instance
module.exports = db;
