const jwt = require('jsonwebtoken');
const userStore = require('../auth/userStore');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Express middleware for JWT authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Find user and attach to request
    const user = userStore.findById(decoded.userId);
    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    req.user = user.toJSON(); // Send safe user data without password hash
    next();
  });
};

// Socket.IO authentication middleware
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication token required'));
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Invalid or expired token'));
    }

    // Find user and attach to socket
    const user = userStore.findById(decoded.userId);
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user.toJSON(); // Send safe user data without password hash
    next();
  });
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

module.exports = {
  authenticateToken,
  authenticateSocket,
  generateToken
};
