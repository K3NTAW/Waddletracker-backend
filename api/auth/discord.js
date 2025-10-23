const { VercelRequest, VercelResponse } = require('@vercel/node');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
  discordAuthUrl.searchParams.set('client_id', process.env.DISCORD_CLIENT_ID);
  discordAuthUrl.searchParams.set('redirect_uri', process.env.DISCORD_REDIRECT_URI);
  discordAuthUrl.searchParams.set('response_type', 'code');
  discordAuthUrl.searchParams.set('scope', 'identify');

  res.redirect(discordAuthUrl.toString());
};
