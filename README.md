# Chatta - Real-Time Chat Application

A modern, feature-rich real-time chat application built with React, Node.js, and Socket.io. Deployed on Render.com with production-ready features including message persistence, typing indicators, private messaging, and more.

## Features

### Core Functionality
- **Real-time messaging** with Socket.io
- **Multiple chat rooms** with dynamic switching
- **Private messaging** between users
- **Message persistence** (localStorage + server-side buffering)
- **Typing indicators** with animated dots
- **Online user tracking** per room
- **Unread message badges** with browser notifications

### Production Features
- **Auto-reconnection** with exponential backoff
- **Rate limiting** (10 messages per 5 seconds)
- **Message sanitization** (HTML tag stripping)
- **Error boundaries** with graceful fallbacks
- **Loading & empty states** with smooth transitions
- **Dark/Light mode** toggle with localStorage persistence
- **Responsive design** for mobile and desktop

### Security & Performance
- **Input validation** for usernames and room names
- **XSS prevention** through message sanitization
- **CORS protection** with environment-based origins
- **Message deduplication** using UUIDs
- **Efficient buffering** (last 50 messages server-side, 100 client-side)

## Live Demo

**[Live Demo Link]** - *Deployed on Render.com*

## Tech Stack

### Frontend
- **React 18** with hooks
- **Vite** for build tooling
- **Socket.io-client** for real-time communication
- **Tailwind CSS** for styling
- **React Router** for navigation

### Backend
- **Node.js 18+** with Express
- **Socket.io** for WebSocket connections
- **In-memory storage** for messages and users
- **Rate limiting** and input validation

### Deployment
- **Render.com** for hosting
- **Static site** for React frontend
- **Web service** for Node.js backend

## Quick Start

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/chatta.git
   cd chatta
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install server dependencies
   cd server && npm install
   
   # Install client dependencies
   cd ../client && npm install
   ```

3. **Start the development servers**
   ```bash
   # From root directory - runs both servers concurrently
   npm run dev
   
   # Or run individually:
   # Server: cd server && npm run dev
   # Client: cd client && npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

## Environment Variables

### Server Environment Variables (.env)
```bash
PORT=5000
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

### Client Environment Variables (.env.production)
```bash
VITE_SOCKET_URL=https://chatta-server.onrender.com
```

## Project Structure

```
chatta/
|-- server/
|   |-- index.js              # Main server file
|   |-- package.json           # Server dependencies
|   |-- .env                   # Server environment variables
|
|-- client/
|   |-- src/
|   |   |-- ChatPage.jsx       # Main chat interface
|   |   |-- JoinPage.jsx       # Room joining interface
|   |   |-- components/
|   |   |   |-- MessageInput.jsx
|   |   |   |-- MessageList.jsx
|   |   |   |-- PrivateMessageModal.jsx
|   |   |   |-- ErrorBoundary.jsx
|   |   |   |-- DarkModeToggle.jsx
|   |-- public/
|   |   |-- _redirects         # SPA routing for Render
|   |-- .env.production        # Production client variables
|   |-- package.json           # Client dependencies
|   |-- tailwind.config.js     # Tailwind configuration
|
|-- render.yaml                # Render deployment configuration
|-- README.md                  # This file
```

## API Endpoints

### REST API
- `GET /api/rooms` - List all active rooms with user counts
- `GET /api/users/:room` - Get users in a specific room

### Socket.io Events
- **Client to Server:**
  - `joinRoom` - Join a chat room
  - `chatMessage` - Send a message to room
  - `privateMessage` - Send a private message
  - `typing` - Start typing indicator
  - `stopTyping` - Stop typing indicator

- **Server to Client:**
  - `message` - New room message
  - `privateMessage` - New private message
  - `messageHistory` - Historical messages on join
  - `roomUsers` - Updated user list
  - `userTyping` - User started typing
  - `userStoppedTyping` - User stopped typing
  - `rateLimited` - Rate limit warning
  - `error` - General error message

## Deployment

### Deploy to Render.com

1. **Prepare the application**
   ```bash
   # Build the client
   cd client
   npm run build
   
   # The build output will be in client/dist
   ```

2. **Environment Setup**
   - Set `CLIENT_URL` environment variable on server service
   - Set `VITE_SOCKET_URL` on client service
   - Configure render.yaml with your service names

3. **Deploy Services**
   - Backend: Node.js Web Service
   - Frontend: Static Site

4. **Verify Deployment**
   - Check health endpoint: `/api/rooms`
   - Test WebSocket connection
   - Verify CORS configuration

## Development Scripts

### Root Package Scripts
```json
{
  "scripts": {
    "dev": "concurrently \"npm run server\" \"npm run client\"",
    "server": "cd server && npm run dev",
    "client": "cd client && npm run dev",
    "install-all": "npm install && cd server && npm install && cd ../client && npm install"
  }
}
```

### Server Scripts
```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  }
}
```

### Client Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## Configuration

### Rate Limiting
- **Limit**: 10 messages per 5 seconds per user
- **Enforcement**: Server-side with sliding window
- **Client Feedback**: Visual warning and input disabling

### Message Persistence
- **Server Buffer**: Last 50 messages per room
- **Client Storage**: Last 100 messages per room in localStorage
- **Deduplication**: UUID-based to prevent duplicates

### Security
- **Input Validation**: Username (1-30 chars), Room name (1-30 chars)
- **Message Sanitization**: HTML tag removal, character filtering
- **CORS Protection**: Environment-based origin validation

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Verify `CLIENT_URL` environment variable
   - Check frontend and backend URLs match

2. **Socket Connection Issues**
   - Ensure `VITE_SOCKET_URL` is correctly set
   - Check server is running and accessible

3. **Build Errors**
   - Verify Node.js version is 18+
   - Clear node_modules and reinstall dependencies

4. **Deployment Issues**
   - Check render.yaml configuration
   - Verify environment variables in Render dashboard

### Debug Mode
Enable debug logging by setting `DEBUG=socket.io:*` environment variable.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the API documentation

---

**Built with React, Node.js, Socket.io, and deployed on Render.com**
