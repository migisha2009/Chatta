const User = require('../models/User');

class UserStore {
  constructor() {
    this.usersByEmail = new Map();
    this.usersById = new Map();
  }

  // Add a user to the store
  addUser(user) {
    this.usersByEmail.set(user.email.toLowerCase(), user);
    this.usersById.set(user.id, user);
    return user;
  }

  // Find user by email
  findByEmail(email) {
    return this.usersByEmail.get(email.toLowerCase());
  }

  // Find user by ID
  findById(id) {
    return this.usersById.get(id);
  }

  // Check if email exists
  emailExists(email) {
    return this.usersByEmail.has(email.toLowerCase());
  }

  // Get all users (for debugging/admin purposes)
  getAllUsers() {
    return Array.from(this.usersById.values());
  }

  // Remove user (for testing/cleanup)
  removeUser(id) {
    const user = this.usersById.get(id);
    if (user) {
      this.usersById.delete(id);
      this.usersByEmail.delete(user.email.toLowerCase());
      return true;
    }
    return false;
  }

  // Clear all users (for testing)
  clear() {
    this.usersByEmail.clear();
    this.usersById.clear();
  }
}

// Create singleton instance
const userStore = new UserStore();

module.exports = userStore;
