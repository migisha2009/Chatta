const OpenAI = require('openai');

class ChattaBot {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async processMessage(message, roomContext, user) {
    try {
      // Check if message mentions @ChattaBot
      if (!message.includes('@ChattaBot')) {
        return null;
      }

      // Get recent room context (last 10 messages)
      const recentMessages = roomContext.slice(-10);
      
      // Create context for the AI
      const contextMessages = recentMessages.map(msg => ({
        role: msg.username === 'ChattaBot' ? 'assistant' : 'user',
        content: `${msg.username}: ${msg.text}`
      }));

      // System prompt for ChattaBot
      const systemPrompt = `You are ChattaBot, a friendly and helpful AI assistant in a chat room. 
      - Be conversational and friendly
      - Keep responses concise (under 100 words)
      - Use emojis occasionally
      - Be helpful but not overly formal
      - If someone asks for help, provide useful suggestions
      - Don't reveal you're an AI unless asked directly
      - Current room: ${roomContext[0]?.room || 'general'}`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...contextMessages,
          { role: "user", content: message.replace('@ChattaBot', '').trim() }
        ],
        max_tokens: 150,
        temperature: 0.7,
      });

      const botResponse = completion.choices[0]?.message?.content;
      
      if (botResponse) {
        return {
          username: 'ChattaBot',
          text: botResponse,
          time: new Date().toLocaleTimeString(),
          isAI: true,
          avatar: '/bot-avatar.png'
        };
      }

      return null;
    } catch (error) {
      console.error('ChattaBot error:', error);
      
      // Fallback responses
      const fallbackResponses = [
        "Hey there! 👋 I'm ChattaBot, your friendly AI assistant. How can I help you today?",
        "Hi! I'm here to chat and help. What's on your mind? 🤔",
        "Hello! Feel free to ask me anything or just chat! 💬",
        "Hey! I'm ChattaBot. Nice to meet you! 😊"
      ];
      
      return {
        username: 'ChattaBot',
        text: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
        time: new Date().toLocaleTimeString(),
        isAI: true,
        avatar: '/bot-avatar.png'
      };
    }
  }

  async summarizeRoom(messages) {
    try {
      if (messages.length < 5) {
        return "Not enough messages to summarize yet. Let's chat more! 📝";
      }

      const messageText = messages.map(msg => `${msg.username}: ${msg.text}`).join('\n');
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a chat summarizer. Create a concise, friendly summary of the conversation. Keep it under 100 words and use emojis where appropriate."
          },
          {
            role: "user",
            content: `Summarize this conversation:\n\n${messageText}`
          }
        ],
        max_tokens: 150,
        temperature: 0.3,
      });

      return completion.choices[0]?.message?.content || "Couldn't generate summary right now. Try again later! 🤖";
    } catch (error) {
      console.error('Summary error:', error);
      return "Summary temporarily unavailable. The chat is going well though! 🌟";
    }
  }
}

module.exports = ChattaBot;
