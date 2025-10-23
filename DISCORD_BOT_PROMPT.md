# Discord Bot Development Prompt for Cursor AI

## 🎯 **Project Overview**
Build a Discord bot for WaddleTracker - a gym accountability app that syncs with a backend API. The bot should handle check-ins, streaks, cheers, and user profiles with rich Discord embeds.

## 📋 **Backend API Documentation**

### **Base URL**: `http://localhost:3000/api` (development) or `https://waddletracker-backend.vercel.app/api` (production)

### **Authentication**
- **Discord OAuth2** integration
- **JWT tokens** for API authentication
- **Client ID**: `1430804770427375677` (from environment)

---

## 🔐 **Authentication Endpoints**

### `GET /api/auth/discord`
- **Purpose**: Redirect to Discord OAuth
- **Response**: 302 redirect to Discord OAuth URL
- **Usage**: Bot can provide this link for user login

### `GET /api/auth/callback`
- **Purpose**: Handle Discord OAuth callback
- **Parameters**: `code` (Discord authorization code)
- **Response**: Redirects to frontend with JWT token
- **Usage**: Handled by frontend, not bot

### `GET /api/auth/me`
- **Purpose**: Get current user info
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Response**: User profile data
- **Usage**: Bot can verify user authentication

---

## 👤 **User Management Endpoints**

### `GET /api/users/:id`
- **Purpose**: Get user profile with stats
- **Parameters**: `id` (user ID)
- **Response**: User data including streaks, check-ins, photos
- **Usage**: Bot profile commands

### `PATCH /api/users/:id`
- **Purpose**: Update user profile
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Body**: `{ "bio": "string", "avatar_url": "string" }`
- **Usage**: Bot profile update commands

### `GET /api/users/:id/photos`
- **Purpose**: Get user's check-in photos
- **Parameters**: `id` (user ID)
- **Response**: Array of photos with metadata
- **Usage**: Bot gallery commands

---

## 🏋️ **Check-in System Endpoints**

### `POST /api/checkins`
- **Purpose**: Create a new check-in
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Body**: 
  ```json
  {
    "date": "2024-01-15T00:00:00.000Z",
    "status": "went" | "missed",
    "photo_url": "https://cdn.discordapp.com/attachments/...",
    "discord_message_id": "123456789"
  }
  ```
- **Response**: Check-in data + updated streak info
- **Usage**: Bot check-in commands

### `GET /api/checkins/:userId`
- **Purpose**: Get all user check-ins
- **Parameters**: `userId` (user ID)
- **Response**: Array of check-ins
- **Usage**: Bot history commands

### `GET /api/checkins/:userId/recent`
- **Purpose**: Get last 5 check-ins
- **Parameters**: `userId` (user ID)
- **Response**: Recent check-ins array
- **Usage**: Bot recent activity commands

### `GET /api/checkins/:userId/photos`
- **Purpose**: Get check-ins with photos
- **Parameters**: `userId` (user ID)
- **Response**: Check-ins with photo URLs
- **Usage**: Bot photo gallery commands

---

## 🔥 **Streak System Endpoints**

### `GET /api/streak/:userId`
- **Purpose**: Get user streak data
- **Parameters**: `userId` (user ID)
- **Response**: 
  ```json
  {
    "current_streak": 5,
    "longest_streak": 10,
    "total_checkins": 25
  }
  ```
- **Usage**: Bot streak commands

---

## 📅 **Schedule Management Endpoints**

### `POST /api/schedules`
- **Purpose**: Create/update user schedule
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Body**: 
  ```json
  {
    "days_of_week": ["Monday", "Wednesday", "Friday"],
    "time": "18:00"
  }
  ```
- **Response**: Schedule data
- **Usage**: Bot schedule commands

### `GET /api/schedules/:userId`
- **Purpose**: Get user's schedule
- **Parameters**: `userId` (user ID)
- **Response**: Schedule data
- **Usage**: Bot schedule display commands

---

## 💬 **Cheer System Endpoints**

### `POST /api/cheers`
- **Purpose**: Send cheer to another user
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Body**: 
  ```json
  {
    "to_user_id": "user_id",
    "message": "Great job! 💪"
  }
  ```
- **Response**: Cheer data with user info
- **Usage**: Bot cheer commands

### `GET /api/cheers/:userId`
- **Purpose**: Get cheers received by user
- **Parameters**: `userId` (user ID)
- **Response**: Array of cheers with sender info
- **Usage**: Bot cheer history commands

---

## 🤖 **Discord Bot Integration Endpoints**

### `POST /api/discord/checkin-embed`
- **Purpose**: Generate Discord embed for check-in
- **Body**: 
  ```json
  {
    "user_id": "user_id",
    "checkin_id": "checkin_id"
  }
  ```
- **Response**: Discord embed data
- **Usage**: Bot posts check-in embeds

### `GET /api/discord/profile-embed`
- **Purpose**: Generate Discord embed for user profile
- **Parameters**: `discord_id` (Discord user ID)
- **Response**: Discord embed data
- **Usage**: Bot profile commands

### `POST /api/discord/cheer-embed`
- **Purpose**: Generate Discord embed for cheer
- **Body**: 
  ```json
  {
    "from_discord_id": "discord_id",
    "to_discord_id": "discord_id",
    "message": "Great job! 💪"
  }
  ```
- **Response**: Discord embed data + cheer ID
- **Usage**: Bot cheer notifications

### `POST /api/discord/webhook`
- **Purpose**: Send data to Discord webhook
- **Body**: 
  ```json
  {
    "type": "checkin" | "cheer" | "reminder" | "achievement",
    "user_id": "user_id",
    "checkin_id": "checkin_id",
    "webhook_url": "https://discord.com/api/webhooks/...",
    "channel_id": "channel_id"
  }
  ```
- **Response**: Webhook sent confirmation
- **Usage**: Bot automated notifications

---

## 🏆 **Leaderboard Endpoints**

### `GET /api/leaderboard/streaks`
- **Purpose**: Get streak leaderboard
- **Parameters**: 
  - `limit` (1-50, default: 10)
  - `type` ("current" | "longest", default: "current")
- **Response**: Leaderboard data + Discord embed
- **Usage**: Bot leaderboard commands

### `GET /api/leaderboard/checkins`
- **Purpose**: Get check-in leaderboard
- **Parameters**: 
  - `limit` (1-50, default: 10)
  - `period` ("all" | "week" | "month" | "year", default: "all")
- **Response**: Leaderboard data + Discord embed
- **Usage**: Bot leaderboard commands

---

## 📸 **Photo Gallery Endpoints**

### `GET /api/gallery/:userId`
- **Purpose**: Get enhanced photo gallery
- **Parameters**: 
  - `userId` (user ID)
  - `page` (pagination, default: 1)
  - `limit` (1-100, default: 20)
  - `status` ("all" | "went" | "missed", default: "all")
  - `year` (filter by year, default: "all")
  - `month` (filter by month, default: "all")
- **Response**: Paginated photos with filters
- **Usage**: Bot gallery commands

---

## 🔔 **Notification Endpoints**

### `GET /api/notifications/:userId`
- **Purpose**: Get user notifications
- **Parameters**: 
  - `userId` (user ID)
  - `page` (pagination, default: 1)
  - `limit` (1-100, default: 20)
  - `type` ("all" | "cheer" | "reminder" | "achievement" | "system", default: "all")
  - `unread_only` (boolean, default: false)
- **Response**: Paginated notifications
- **Usage**: Bot notification commands

### `POST /api/notifications/:userId`
- **Purpose**: Mark notifications as read
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Body**: `{ "notification_ids": ["id1", "id2"] }`
- **Response**: Update confirmation
- **Usage**: Bot mark as read commands

### `PUT /api/notifications/:userId`
- **Purpose**: Mark all notifications as read
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Response**: Update confirmation
- **Usage**: Bot mark all as read commands

---

## 📊 **Analytics Endpoints**

### `GET /api/analytics/:userId`
- **Purpose**: Get user analytics and stats
- **Parameters**: 
  - `userId` (user ID)
  - `period` (1-365 days, default: 30)
- **Response**: Comprehensive analytics data
- **Usage**: Bot analytics commands

---

## 🎯 **Discord Bot Requirements**

### **Core Commands to Implement:**

1. **`/checkin [status] [photo]`**
   - Log gym check-in (went/missed)
   - Upload photo if provided
   - Post embed to #gym-pics channel
   - Update user streak

2. **`/profile [@user]`**
   - Show user profile with stats
   - Display recent activity
   - Show streak information

3. **`/cheer @user [message]`**
   - Send encouragement to another user
   - Post cheer embed
   - Send notification to recipient

4. **`/streak [@user]`**
   - Show current streak information
   - Display streak history

5. **`/leaderboard [type] [period]`**
   - Show streak or check-in leaderboard
   - Support different time periods

6. **`/schedule [days] [time]`**
   - Set user's gym schedule
   - Bot will send reminders

7. **`/gallery [@user] [filters]`**
   - Show user's photo gallery
   - Support filtering by status/date

8. **`/notifications`**
   - Show user's notifications
   - Mark as read functionality

9. **`/analytics [period]`**
   - Show user's analytics and stats
   - Display trends and insights

### **Bot Features to Implement:**

1. **Automatic Reminders**
   - Send scheduled workout reminders
   - Use user's schedule data

2. **Check-in Embeds**
   - Rich embeds for check-ins
   - Include photos, streaks, stats

3. **Achievement Notifications**
   - Celebrate milestones (7-day streak, 50 check-ins, etc.)
   - Send achievement embeds

4. **Photo Management**
   - Handle Discord image uploads
   - Store Discord-hosted URLs

5. **Real-time Updates**
   - Post check-ins to designated channels
   - Send cheer notifications

### **Technical Requirements:**

1. **Discord.js v14** for bot framework
2. **Axios** for API calls
3. **Environment variables** for configuration
4. **Error handling** for API failures
5. **Rate limiting** for API calls
6. **Database integration** via API
7. **Image handling** for Discord uploads
8. **Slash commands** for all interactions
9. **Button interactions** for confirmations
10. **Modal forms** for complex inputs

### **Environment Variables Needed:**

```env
DISCORD_TOKEN=your_bot_token
API_BASE_URL=https://waddletracker-backend.vercel.app/api
GUILD_ID=your_server_id
CHANNEL_GYM_PICS=channel_id_for_checkins
CHANNEL_GENERAL=general_channel_id
```

### **Bot Permissions Required:**

- Send Messages
- Embed Links
- Attach Files
- Use Slash Commands
- Read Message History
- Add Reactions

---

## 🚀 **Implementation Steps:**

1. **Setup Discord Bot**
   - Create bot application
   - Generate bot token
   - Set up slash commands

2. **API Integration**
   - Create API client class
   - Handle authentication
   - Implement error handling

3. **Command Implementation**
   - Start with basic commands (/checkin, /profile)
   - Add advanced features (leaderboards, analytics)
   - Implement interactive components

4. **Database Integration**
   - Map Discord users to API users
   - Handle user registration flow
   - Sync data between Discord and API

5. **Testing & Deployment**
   - Test all commands
   - Handle edge cases
   - Deploy to production

---

## 📝 **Example Bot Command Flow:**

### Check-in Command:
1. User runs `/checkin went` with photo
2. Bot uploads photo to Discord
3. Bot calls `POST /api/checkins` with photo URL
4. Bot gets embed data from `POST /api/discord/checkin-embed`
5. Bot posts embed to #gym-pics channel
6. Bot updates user's streak display

### Profile Command:
1. User runs `/profile @user`
2. Bot gets user's Discord ID
3. Bot calls `GET /api/discord/profile-embed?discord_id=...`
4. Bot posts embed with user's stats

## 📊 **API Response Format**

### **Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "timestamp": "2025-10-23T18:37:19.136Z"
}
```

### **Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 404,
  "timestamp": "2025-10-23T18:37:19.136Z"
}
```

### **Discord Embed Response:**
```json
{
  "success": true,
  "data": {
    "embed": {
      "title": "🔥 Current Streak Leaderboard",
      "description": "Top 10 users by current streak",
      "color": 16766720,
      "fields": [...],
      "footer": { "text": "Keep pushing yourself! 💪" },
      "timestamp": "2025-10-23T18:37:19.136Z"
    }
  }
}
```

## 🚀 **Live API Status**

### **✅ Production Ready**
- **Live URL**: `https://waddletracker-backend.vercel.app/api`
- **Status**: Fully deployed and functional
- **HTTPS**: Automatically enabled
- **Functions**: 24 endpoints consolidated into 1 serverless function
- **Database**: PostgreSQL with Prisma ORM
- **CORS**: Configured for all origins

### **✅ Tested Endpoints**
- **Main API**: `GET /api/` - Returns complete API documentation
- **Leaderboards**: `GET /api/leaderboard/streaks` - Working with Discord embeds
- **User Management**: `GET /api/users/:id` - Proper error handling
- **All 24 endpoints** are functional and ready for integration

### **🔧 Technical Architecture**
- **Single Function**: All endpoints handled by `api/index.ts`
- **Smart Routing**: URL path matching routes to appropriate handlers
- **Vercel Optimized**: Deployed on Vercel with Node.js 20.x
- **TypeScript**: Fully typed with proper error handling
- **Database**: Prisma ORM with PostgreSQL
- **Authentication**: Discord OAuth2 + JWT tokens

This backend API is fully functional and ready for Discord bot integration. All endpoints are tested and working with proper error handling, CORS support, and Discord embed generation.
