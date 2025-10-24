# 🤖 Discord Bot Update Prompt - Rest Days & Flexible Scheduling

## 🎯 **Overview**
The WaddleTracker backend has been significantly enhanced with automatic rest day handling and flexible scheduling. This prompt will help you update the Discord bot to take advantage of these new features.

---

## 🔄 **Key Changes Made to Backend**

### **1. Automatic Rest Day System**
- **Scheduled rest days are now automatic** - users don't need to manually log them
- **Streaks continue automatically** on scheduled rest days
- **Virtual rest days** are created in streak calculation when scheduled
- **No penalty for planned recovery** - rest is part of the fitness journey!

### **2. Flexible Schedule Support**
- **Rotation patterns** like `"upper,lower,rest,upper,lower,rest,rest"`
- **Weekly schedules** with specific workout days
- **Custom schedules** for unique patterns
- **Automatic day type detection** based on user's schedule

### **3. New Database Schema Fields**
```typescript
// Schedule model now includes:
schedule_type: "weekly" | "rotating" | "custom"
rotation_pattern: "upper,lower,rest,upper,lower,rest,rest"
current_rotation_day: 0  // Tracks position in rotation
rest_days_allowed: true  // Whether rest days count for streaks
```

### **4. New CheckInStatus**
```typescript
enum CheckInStatus {
  went
  missed
  rest  // NEW: For rest day check-ins
}
```

---

## 🔑 **Bot Authentication Setup**

### **Environment Variables Required**
Set these in your Discord bot deployment:

```bash
# Required: Bot authentication token
BOT_AUTH_TOKEN=your_secure_bot_token_here

# Required: Backend API URL
API_BASE_URL=https://waddletracker-backend.vercel.app
```

### **Generate Bot Token**
```bash
# Generate a secure 32-character token
openssl rand -hex 32
# Or use any secure random string generator
```

### **Discord-Specific Endpoints**
The backend now provides **Discord-specific endpoints** that use bot authentication instead of user JWT tokens:

- **`POST /api/discord/schedule`** - Schedule management (create, get, update, delete)
- **`POST /api/discord/checkin`** - Check-in logging
- **`POST /api/discord/rest-day`** - Rest day logging
- **`GET /api/discord/profile-embed`** - Profile information
- **`GET /api/discord/user/:discordId`** - User data by Discord ID

**Authentication Header:**
```http
X-Bot-Token: your_secure_bot_token_here
```

---

## 🆕 **New API Endpoints**

### **1. Flexible Schedule Creation**
```http
POST /api/schedules/flexible
Authorization: Bearer <token>
Content-Type: application/json

{
  "schedule_type": "rotating",
  "rotation_pattern": "upper,lower,rest,upper,lower,rest,rest",
  "timezone": "UTC",
  "reminder_time": "09:00",
  "rest_days_allowed": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "schedule": { /* schedule details */ },
    "today_scheduled_type": "rest",  // "workout" | "rest" | null
    "message": "Rotation schedule created! Pattern: upper,lower,rest,upper,lower,rest,rest. Today is: rest"
  }
}
```

### **2. Rest Day Check-in (Specialized)**
```http
POST /api/discord/rest-day
Content-Type: application/json

{
  "discord_id": "123456789",
  "username": "username",
  "avatar_url": "https://...",
  "notes": "Recovery day notes (optional)",
  "date": "2025-10-24T18:00:00.000Z"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "embed": {
      "title": "😴 Rest Day Logged!",
      "description": "**username** has logged a rest day - recovery is important! 💪",
      "color": 16753920,  // Orange color
      "fields": [
        {
          "name": "😴 Rest Day",
          "value": "Recovery & Rest",
          "inline": true
        },
        {
          "name": "🔥 Current Streak",
          "value": "5 days",
          "inline": true
        }
      ],
      "footer": {
        "text": "WaddleFit - Rest is part of the journey! 💤"
      }
    }
  }
}
```

### **3. Discord Schedule Management**
```http
POST /api/discord/schedule
X-Bot-Token: your_secure_bot_token_here
Content-Type: application/json

{
  "action": "create",  // "create", "update", "get", "delete"
  "discord_id": "123456789",
  "schedule_type": "rotating",
  "rotation_pattern": "upper,lower,rest,upper,lower,rest,rest",
  "timezone": "UTC",
  "reminder_time": "09:00",
  "rest_days_allowed": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "schedule": { /* schedule details */ },
    "today_scheduled_type": "rest",  // "workout" | "rest" | null
    "message": "Rotation schedule created! Pattern: upper,lower,rest,upper,lower,rest,rest. Today is: rest"
  }
}
```

### **4. Updated Check-in Endpoint**
The existing `/api/discord/checkin` now supports:
```json
{
  "discord_id": "123456789",
  "username": "username",
  "status": "rest",  // NEW: Can be "went", "missed", or "rest"
  "workout_type": "Rest Day",
  "notes": "Planned rest day for recovery"
}
```

---

## 🎨 **Updated Discord Bot Features**

### **1. Schedule Management Commands**

#### **Create Rotation Schedule**
```bash
/schedule rotation "upper,lower,rest,upper,lower,rest,rest"
```
- Creates a 7-day rotation pattern
- Automatically determines workout vs rest days
- Shows today's scheduled activity

#### **Create Weekly Schedule**
```bash
/schedule weekly monday wednesday friday
```
- Sets specific days as workout days
- Other days become automatic rest days
- Traditional weekly schedule

#### **View Current Schedule**
```bash
/schedule view
```
- Shows current schedule type and pattern
- Displays today's scheduled activity
- Shows next few days in rotation

### **2. Enhanced Check-in Commands**

#### **Smart Check-in**
```bash
/checkin
```
- **If today is scheduled workout:** Prompts for workout details
- **If today is scheduled rest:** Shows "Rest day scheduled - no check-in needed!"
- **If no schedule:** Prompts for workout or rest day

#### **Manual Rest Day**
```bash
/rest-day [notes]
```
- Logs a rest day manually
- Orange embed with rest day messaging
- Counts towards streak

#### **Workout Check-in**
```bash
/workout [type] [notes]
```
- Logs a workout
- Green embed with workout details
- Counts towards streak

### **3. Enhanced Profile Display**

#### **Profile Command Updates**
```bash
/profile
```
- Shows current streak (including automatic rest days)
- Displays today's scheduled activity
- Shows schedule type and pattern
- Indicates if rest days are automatic

**Example Profile Embed:**
```json
{
  "title": "🏋️ Your Profile",
  "fields": [
    {
      "name": "🔥 Current Streak",
      "value": "7 days (includes 2 rest days)",
      "inline": true
    },
    {
      "name": "📅 Today's Schedule",
      "value": "Rest Day (automatic)",
      "inline": true
    },
    {
      "name": "🔄 Schedule Pattern",
      "value": "Upper/Lower/Rest rotation",
      "inline": true
    }
  ]
}
```

### **4. Smart Notifications**

#### **Schedule Reminders**
- **Workout days:** "Time for your Upper Body workout! 💪"
- **Rest days:** "Rest day scheduled - enjoy your recovery! 😴"
- **No schedule:** "Don't forget to check in today!"

#### **Streak Notifications**
- **Rest day included:** "Your streak continues with today's rest day! 🔥"
- **Workout logged:** "Great workout! Your streak is now X days! 💪"

---

## 🔧 **Implementation Guidelines**

### **1. API Client Setup**
```javascript
// API client with bot authentication
class WaddleTrackerAPI {
  constructor() {
    this.baseURL = process.env.API_BASE_URL;
    this.botToken = process.env.BOT_AUTH_TOKEN;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'X-Bot-Token': this.botToken,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }
    
    return response.json();
  }

  // Discord-specific endpoints
  async getSchedule(discordId) {
    return this.request('/api/discord/schedule', {
      method: 'POST',
      body: JSON.stringify({ action: 'get', discord_id: discordId })
    });
  }

  async createSchedule(discordId, scheduleData) {
    return this.request('/api/discord/schedule', {
      method: 'POST',
      body: JSON.stringify({ action: 'create', discord_id: discordId, ...scheduleData })
    });
  }

  async logCheckin(discordId, checkinData) {
    return this.request('/api/discord/checkin', {
      method: 'POST',
      body: JSON.stringify({ discord_id: discordId, ...checkinData })
    });
  }

  async logRestDay(discordId, restData) {
    return this.request('/api/discord/rest-day', {
      method: 'POST',
      body: JSON.stringify({ discord_id: discordId, ...restData })
    });
  }
}
```

### **2. Schedule Detection Logic**
```javascript
// Check if user has a schedule and today's type
const api = new WaddleTrackerAPI();
const scheduleResponse = await api.getSchedule(discordId);
const todayType = scheduleResponse.data.today_scheduled_type;

if (todayType === 'rest') {
  // Show "Rest day scheduled - no check-in needed!"
  // Streak continues automatically
} else if (todayType === 'workout') {
  // Prompt for workout details
} else {
  // No schedule - prompt for workout or rest
}
```

### **2. Streak Calculation**
```javascript
// Streaks now include scheduled rest days automatically
const streak = await api.get(`/api/streak/${userId}`);
// streak.current_streak includes both logged workouts and scheduled rest days
```

### **3. Embed Color Coding**
```javascript
const embedColors = {
  workout: 0x00ff00,  // Green
  rest: 0xffa500,     // Orange
  missed: 0xff0000,   // Red
  info: 0x0099ff      // Blue
};
```

### **4. Button Interactions**

#### **Check-in Buttons**
```javascript
// Smart check-in button
if (todayType === 'rest') {
  // Show "Rest Day Scheduled" (disabled)
  // Or "Log Rest Day" (optional manual logging)
} else {
  // Show "Log Workout" button
}
```

#### **Schedule Buttons**
```javascript
// Schedule management buttons
const scheduleButtons = [
  { label: "Set Rotation", customId: "schedule_rotation" },
  { label: "Set Weekly", customId: "schedule_weekly" },
  { label: "View Schedule", customId: "schedule_view" }
];
```

---

## 📊 **User Experience Improvements**

### **1. Onboarding Flow**
1. **Welcome message** with schedule options
2. **Quick setup** for common patterns (Upper/Lower/Rest)
3. **Explanation** of automatic rest days
4. **Demo** of how streaks work with rest days

### **2. Daily Interactions**
1. **Morning reminder** based on schedule
2. **Smart check-in prompts** based on day type
3. **Streak updates** that include rest days
4. **Weekly schedule preview**

### **3. Motivation & Education**
1. **Rest day messaging** that emphasizes recovery importance
2. **Streak explanations** that include rest days
3. **Schedule flexibility** for different fitness goals
4. **Recovery tips** on rest days

---

## 🚀 **Migration Strategy**

### **Phase 1: Basic Support**
- Add rest day check-in command
- Update profile to show schedule info
- Add basic schedule creation

### **Phase 2: Smart Features**
- Implement automatic rest day detection
- Add rotation pattern support
- Update all streak displays

### **Phase 3: Advanced Features**
- Smart notifications based on schedule
- Schedule management commands
- Advanced pattern support

---

## 🎯 **Key Benefits for Users**

1. **No more manual rest day logging** - it's automatic!
2. **Complex schedules work perfectly** - Upper/Lower/Rest patterns
3. **Streaks never break** on planned rest days
4. **Flexible patterns** that shift weekly
5. **Real-world fitness routines** are fully supported
6. **Recovery is celebrated** as part of the journey

---

## 📝 **Example Bot Responses**

### **Rest Day Scheduled**
```
😴 **Rest Day Scheduled**
Today is a scheduled rest day - no check-in needed!
Your streak continues automatically. Enjoy your recovery! 💤

**Current Streak:** 5 days (includes 2 rest days)
**Next Workout:** Tomorrow - Upper Body
```

### **Workout Day**
```
💪 **Time for Your Workout!**
Today is scheduled for: **Upper Body**
Ready to log your workout?

[Log Workout] [Log Rest Day] [View Schedule]
```

### **Schedule Created**
```
✅ **Rotation Schedule Created!**
Pattern: Upper → Lower → Rest → Upper → Lower → Rest → Rest

**Today:** Upper Body (Day 1 of rotation)
**Tomorrow:** Lower Body
**Day After:** Rest Day (automatic)

Your rest days will now count towards your streak automatically! 🔥
```

---

This update transforms the Discord bot from a simple check-in tracker into an intelligent fitness companion that understands real-world workout routines and celebrates rest as part of the journey! 🚀
