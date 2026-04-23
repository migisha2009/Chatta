const { v4: uuidv4 } = require('uuid');

class User {
  constructor({ username, email, passwordHash, avatar = null }) {
    this.id = uuidv4();
    this.username = username;
    this.email = email;
    this.passwordHash = passwordHash;
    this.createdAt = new Date();
    this.avatar = avatar;
  }

  // Return user data without sensitive information
  toJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      createdAt: this.createdAt,
      avatar: this.avatar
    };
  }

  // Static method to create user from registration data
  static createFromRegistration({ username, email, passwordHash }) {
    return new User({ username, email, passwordHash });
  }
}

module.exports = User;
