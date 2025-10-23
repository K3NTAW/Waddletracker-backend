# WaddleTracker Backend API

A comprehensive backend API for a gym accountability app that syncs with Discord and supports web/mobile applications. Built with Node.js, TypeScript, Prisma ORM, and deployed on Vercel serverless functions.

## Features

- 🔐 **Discord OAuth2 Authentication** - Secure user authentication via Discord
- 📊 **Check-in Tracking** - Log gym visits with photos and status
- 🔥 **Streak Management** - Automatic streak calculation and tracking
- 📅 **Schedule Management** - Set preferred workout days and times
- 💬 **Cheer System** - Send encouragement and comments to other users
- 📸 **Photo Support** - Discord-hosted image URLs for check-in photos
- 🚀 **Serverless Architecture** - Deployed on Vercel for scalability

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Discord OAuth2 + JWT
- **Deployment**: Vercel Serverless Functions
- **Validation**: Zod
- **HTTP Client**: Axios

## Database Schema

### User
- `id`: UUID (primary key)
- `discord_id`: string (unique)
- `username`: string
- `avatar_url`: string (optional)
- `bio`: string (optional)
- `joined_at`: datetime
- `streak_count`: int (current streak)
- `longest_streak`: int
- `total_checkins`: int

### CheckIn
- `id`: UUID
- `user_id`: UUID (relation to User)
- `date`: date
- `status`: enum("went", "missed")
- `photo_url`: string (Discord-hosted image URL, optional)
- `discord_message_id`: string (for bot-posted message)
- `created_at`: datetime

### Schedule
- `id`: UUID
- `user_id`: UUID
- `days_of_week`: string[] (e.g., ["Monday", "Wednesday"])
- `time`: string (optional preferred time)

### Cheer
- `id`: UUID
- `from_user_id`: UUID
- `to_user_id`: UUID
- `message`: string (optional comment)
- `created_at`: datetime

## API Endpoints

### Authentication
- `GET /api/auth/discord` - Redirect to Discord OAuth
- `GET /api/auth/callback` - Handle Discord OAuth callback
- `GET /api/auth/me` - Get current user info (requires JWT)

### Users
- `GET /api/users/:id` - Get user profile with streak info
- `PATCH /api/users/:id` - Update user bio/preferences
- `GET /api/users/:id/photos` - Get all user check-in photos

### Check-ins
- `POST /api/checkins` - Log a check-in
- `GET /api/checkins/:userId` - Get all user check-ins
- `GET /api/checkins/:userId/recent` - Get last 5 check-ins
- `GET /api/checkins/:userId/photos` - Get check-ins with photos

### Schedules
- `POST /api/schedules` - Create/update user schedule
- `GET /api/schedules/:userId` - Get user's schedule

### Streaks
- `GET /api/streak/:userId` - Get current streak data

### Cheers
- `POST /api/cheers` - Send cheer to another user
- `GET /api/cheers/:userId` - Get cheers received by user

## Setup Instructions

### 1. Prerequisites
- Node.js 18+
- PostgreSQL database
- Discord application (for OAuth)

### 2. Environment Variables
Copy `env.example` to `.env` and fill in the values:

```bash
cp env.example .env
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `DISCORD_CLIENT_ID` - Discord application client ID
- `DISCORD_CLIENT_SECRET` - Discord application client secret
- `DISCORD_REDIRECT_URI` - Discord OAuth redirect URI
- `JWT_SECRET` - Secret key for JWT tokens
- `FRONTEND_URL` - Frontend application URL

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Or run migrations
npm run db:migrate
```

### 5. Development
```bash
# Start development server
npm run dev
```

### 6. Production Deployment

#### Vercel Deployment
1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

#### Environment Variables for Vercel
Set these in your Vercel project settings:
- `DATABASE_URL`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `JWT_SECRET`
- `FRONTEND_URL`

## Discord Bot Integration

The API is designed to work seamlessly with Discord bots:

1. **Check-in Photos**: Store Discord-hosted image URLs from bot messages
2. **Message Tracking**: Use `discord_message_id` to link check-ins to Discord messages
3. **User Sync**: Automatically sync user data from Discord OAuth

## Business Logic

### Streak Calculation
- Increments streak if last "went" check-in was yesterday
- Resets streak to 1 if there's a gap or missed day
- Updates `longest_streak` when current streak exceeds it
- Increments `total_checkins` on each check-in

### Check-in Validation
- One check-in per user per date
- Prevents duplicate check-ins
- Validates date format and status enum

## Error Handling

All endpoints return structured error responses:
```json
{
  "error": "Error message",
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## CORS Configuration

CORS is configured to allow requests from:
- All origins (configurable)
- Common HTTP methods
- Authorization headers

## Security Features

- JWT token authentication
- Input validation with Zod
- SQL injection prevention via Prisma
- CORS protection
- Rate limiting (via Vercel)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
# Waddletracker-backend
