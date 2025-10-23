# WaddleTracker API Usage Examples

This document provides practical examples of how to use the WaddleTracker API endpoints.

## Authentication Flow

### 1. Redirect to Discord OAuth
```bash
GET /api/auth/discord
```
Redirects user to Discord for authentication.

### 2. Handle OAuth Callback
```bash
GET /api/auth/callback?code=AUTHORIZATION_CODE
```
Returns a redirect to frontend with JWT token.

### 3. Get Current User
```bash
GET /api/auth/me
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "discord_id": "discord_456",
    "username": "gymuser",
    "avatar_url": "https://cdn.discordapp.com/avatars/...",
    "bio": "Fitness enthusiast",
    "joined_at": "2024-01-01T00:00:00.000Z",
    "streak_count": 5,
    "longest_streak": 10,
    "total_checkins": 25
  }
}
```

## User Management

### Get User Profile
```bash
GET /api/users/user_123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "discord_id": "discord_456",
    "username": "gymuser",
    "avatar_url": "https://cdn.discordapp.com/avatars/...",
    "bio": "Fitness enthusiast",
    "joined_at": "2024-01-01T00:00:00.000Z",
    "streak_count": 5,
    "longest_streak": 10,
    "total_checkins": 25,
    "checkins": [
      {
        "photo_url": "https://cdn.discordapp.com/attachments/...",
        "date": "2024-01-15T00:00:00.000Z"
      }
    ]
  }
}
```

### Update User Profile
```bash
PATCH /api/users/user_123
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "bio": "Updated bio text",
  "avatar_url": "https://cdn.discordapp.com/avatars/..."
}
```

### Get User Photos
```bash
GET /api/users/user_123/photos
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "checkin_123",
      "photo_url": "https://cdn.discordapp.com/attachments/...",
      "date": "2024-01-15T00:00:00.000Z",
      "status": "went",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

## Check-ins

### Create Check-in
```bash
POST /api/checkins
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "date": "2024-01-15T00:00:00.000Z",
  "status": "went",
  "photo_url": "https://cdn.discordapp.com/attachments/...",
  "discord_message_id": "123456789"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "checkIn": {
      "id": "checkin_123",
      "user_id": "user_123",
      "date": "2024-01-15T00:00:00.000Z",
      "status": "went",
      "photo_url": "https://cdn.discordapp.com/attachments/...",
      "discord_message_id": "123456789",
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    "streak": {
      "streak_count": 6,
      "longest_streak": 10,
      "total_checkins": 26
    }
  },
  "message": "Check-in created successfully"
}
```

### Get User Check-ins
```bash
GET /api/checkins/user_123
```

### Get Recent Check-ins
```bash
GET /api/checkins/user_123/recent
```

### Get Check-ins with Photos
```bash
GET /api/checkins/user_123/photos
```

## Schedules

### Create/Update Schedule
```bash
POST /api/schedules
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "days_of_week": ["Monday", "Wednesday", "Friday"],
  "time": "18:00"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "schedule_123",
    "user_id": "user_123",
    "days_of_week": ["Monday", "Wednesday", "Friday"],
    "time": "18:00",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "Schedule updated successfully"
}
```

### Get User Schedule
```bash
GET /api/schedules/user_123
```

## Streaks

### Get Streak Data
```bash
GET /api/streak/user_123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "current_streak": 5,
    "longest_streak": 10,
    "total_checkins": 25
  }
}
```

## Cheers

### Send Cheer
```bash
POST /api/cheers
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "to_user_id": "user_456",
  "message": "Great job on your workout today! 💪"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cheer_123",
    "from_user_id": "user_123",
    "to_user_id": "user_456",
    "message": "Great job on your workout today! 💪",
    "created_at": "2024-01-15T10:30:00.000Z",
    "from_user": {
      "id": "user_123",
      "username": "gymuser",
      "avatar_url": "https://cdn.discordapp.com/avatars/..."
    },
    "to_user": {
      "id": "user_456",
      "username": "fitnessbuddy",
      "avatar_url": "https://cdn.discordapp.com/avatars/..."
    }
  },
  "message": "Cheer sent successfully"
}
```

### Get User Cheers
```bash
GET /api/cheers/user_123
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cheer_123",
      "from_user_id": "user_456",
      "to_user_id": "user_123",
      "message": "Keep up the great work! 🔥",
      "created_at": "2024-01-15T10:30:00.000Z",
      "from_user": {
        "id": "user_456",
        "username": "fitnessbuddy",
        "avatar_url": "https://cdn.discordapp.com/avatars/..."
      }
    }
  ]
}
```

## Error Responses

All endpoints return structured error responses:

```json
{
  "error": "Error message",
  "statusCode": 400,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Common Error Codes
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

## Discord Bot Integration

### Storing Discord Message Data
When a Discord bot posts a check-in message, include the message ID:

```json
{
  "status": "went",
  "photo_url": "https://cdn.discordapp.com/attachments/...",
  "discord_message_id": "123456789012345678"
}
```

### Photo URLs
All photo URLs should be Discord-hosted URLs in the format:
```
https://cdn.discordapp.com/attachments/CHANNEL_ID/MESSAGE_ID/FILENAME.EXT
```

## Rate Limiting

The API is deployed on Vercel with built-in rate limiting. For production use, consider implementing additional rate limiting based on your needs.

## CORS

The API is configured to accept requests from any origin. For production, consider restricting CORS to your specific domains.
