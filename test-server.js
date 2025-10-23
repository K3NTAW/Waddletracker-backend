const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Test endpoints
app.get('/api', (req, res) => {
  res.json({
    message: 'WaddleTracker API',
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/api/auth/discord', (req, res) => {
  const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
  discordAuthUrl.searchParams.set('client_id', process.env.DISCORD_CLIENT_ID || 'test');
  discordAuthUrl.searchParams.set('redirect_uri', process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/auth/callback');
  discordAuthUrl.searchParams.set('response_type', 'code');
  discordAuthUrl.searchParams.set('scope', 'identify');

  res.redirect(discordAuthUrl.toString());
});

app.get('/api/auth/me', (req, res) => {
  res.json({
    success: true,
    message: 'Auth endpoint working',
    note: 'This is a test endpoint - implement JWT verification'
  });
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    await prisma.$connect();
    res.json({
      success: true,
      message: 'Database connection successful'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Test server running on http://localhost:${PORT}`);
  console.log('📋 Available endpoints:');
  console.log('  GET /api - Main API info');
  console.log('  GET /api/auth/discord - Discord OAuth redirect');
  console.log('  GET /api/auth/me - Auth test endpoint');
  console.log('  GET /api/test-db - Database connection test');
});
