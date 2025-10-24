# Discord Registration Integration Guide

## Overview
This guide shows how to integrate the new Discord-based registration system into your Discord bot, eliminating the need for external websites.

## New API Endpoints

### 1. Check Discord User Profile
**Endpoint:** `GET /api/discord/user/:discordId`

**Purpose:** Check if a Discord user is registered and get their profile data.

**Example Request:**
```
GET /api/discord/user/123456789012345678
```

**Response (User Found):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx1234567890",
      "discord_id": "123456789012345678",
      "username": "Kenta",
      "avatar_url": "https://cdn.discordapp.com/avatars/123456789012345678/abc123.png",
      "bio": "Fitness enthusiast",
      "timezone": "UTC",
      "is_active": true,
      "current_streak": 5,
      "longest_streak": 12,
      "total_checkins": 25,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-15T00:00:00.000Z"
    },
    "stats": {
      "current_streak": 5,
      "longest_streak": 12,
      "total_checkins": 25,
      "cheers_received": 8,
      "cheers_sent": 12,
      "days_since_joining": 15
    },
    "recent_checkins": [
      {
        "id": "checkin123",
        "workout_type": "Weight Training",
        "date": "2024-01-15T00:00:00.000Z",
        "notes": "Great session!",
        "photo_url": "https://example.com/photo.jpg"
      }
    ]
  }
}
```

**Response (User Not Found):**
```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found - not registered"
  }
}
```

### 2. Generate Registration Embed
**Endpoint:** `POST /api/discord/register-embed`

**Purpose:** Creates a Discord embed with registration buttons for unregistered users.

**Request Body:**
```json
{
  "discord_id": "123456789012345678",
  "username": "Kenta",
  "avatar_url": "https://cdn.discordapp.com/avatars/123456789012345678/abc123.png"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "embed": {
      "title": "👤 User Not Found",
      "description": "**User:** @Kenta\n\nThis user hasn't registered with WaddleTracker yet.\nThey need to register to start tracking their fitness journey!",
      "color": 16711659,
      "thumbnail": {
        "url": "https://cdn.discordapp.com/avatars/123456789012345678/abc123.png"
      },
      "fields": [
        {
          "name": "🔗 How to Register",
          "value": "Click the button below to register instantly!",
          "inline": false
        },
        {
          "name": "✨ What You Get",
          "value": "• Track your workouts\n• Build streaks\n• Get cheered on\n• Join the community!",
          "inline": false
        }
      ],
      "footer": {
        "text": "WaddleFit - Your fitness journey starts here!"
      },
      "timestamp": "2024-01-01T00:00:00.000Z"
    },
    "components": [
      {
        "type": 1,
        "components": [
          {
            "type": 2,
            "style": 1,
            "label": "Register Now!",
            "custom_id": "register_123456789012345678",
            "emoji": {
              "name": "🚀"
            }
          },
          {
            "type": 2,
            "style": 2,
            "label": "Learn More",
            "custom_id": "learn_more_123456789012345678",
            "emoji": {
              "name": "ℹ️"
            }
          }
        ]
      }
    ],
    "user": {
      "discord_id": "123456789012345678",
      "username": "Kenta",
      "avatar_url": "https://cdn.discordapp.com/avatars/123456789012345678/abc123.png"
    }
  }
}
```

### 2. Register User
**Endpoint:** `POST /api/discord/register`

**Purpose:** Registers a new user in the database.

**Request Body:**
```json
{
  "discord_id": "123456789012345678",
  "username": "Kenta",
  "avatar_url": "https://cdn.discordapp.com/avatars/123456789012345678/abc123.png"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx1234567890",
      "discord_id": "123456789012345678",
      "username": "Kenta",
      "avatar_url": "https://cdn.discordapp.com/avatars/123456789012345678/abc123.png"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "message": "User registered successfully!",
    "embed": {
      "title": "🎉 Welcome to WaddleTracker!",
      "description": "**Kenta** has successfully registered!\n\nYou can now start tracking your fitness journey!",
      "color": 65280,
      "thumbnail": {
        "url": "https://cdn.discordapp.com/avatars/123456789012345678/abc123.png"
      },
      "fields": [
        {
          "name": "🚀 Get Started",
          "value": "Use `/checkin` to log your first workout!",
          "inline": false
        },
        {
          "name": "📊 Your Stats",
          "value": "• Current Streak: 0 days\n• Total Check-ins: 0\n• Ready to start!",
          "inline": false
        }
      ],
      "footer": {
        "text": "WaddleFit - Let's get fit together!"
      },
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

## Discord Bot Implementation

### Example Bot Code (Python with discord.py)

```python
import discord
from discord.ext import commands
import aiohttp
import json

class WaddleTrackerBot(commands.Bot):
    def __init__(self):
        super().__init__(command_prefix='!', intents=discord.Intents.all())
        self.api_base_url = "https://your-vercel-domain.vercel.app/api"
    
    async def on_ready(self):
        print(f'{self.user} has connected to Discord!')
    
    @commands.command(name='profile')
    async def profile(self, ctx, user: discord.Member = None):
        """Get user profile or show registration embed if not registered"""
        if user is None:
            user = ctx.author
        
        # Check if user exists in database using Discord ID
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{self.api_base_url}/discord/user/{user.id}") as response:
                if response.status == 404:
                    # User not found, show registration embed
                    await self.show_registration_embed(ctx, user)
                elif response.status == 200:
                    # User exists, show profile
                    await self.show_user_profile(ctx, user, await response.json())
                else:
                    await ctx.send("❌ Error fetching user data.")
    
    async def show_registration_embed(self, ctx, user):
        """Show registration embed for unregistered users"""
        async with aiohttp.ClientSession() as session:
            data = {
                "discord_id": str(user.id),
                "username": user.display_name,
                "avatar_url": str(user.avatar.url) if user.avatar else None
            }
            
            async with session.post(f"{self.api_base_url}/discord/register-embed", json=data) as response:
                if response.status == 200:
                    result = await response.json()
                    embed_data = result['data']['embed']
                    components_data = result['data']['components']
                    
                    # Create Discord embed
                    embed = discord.Embed.from_dict(embed_data)
                    
                    # Create components
                    view = discord.ui.View()
                    for component_row in components_data:
                        for component in component_row['components']:
                            if component['custom_id'].startswith('register_'):
                                button = discord.ui.Button(
                                    label=component['label'],
                                    style=discord.ButtonStyle.primary,
                                    custom_id=component['custom_id'],
                                    emoji=component['emoji']['name']
                                )
                                button.callback = self.register_user_callback
                                view.add_item(button)
                    
                    await ctx.send(embed=embed, view=view)
                else:
                    await ctx.send("❌ Error generating registration embed.")
    
    async def register_user_callback(self, interaction):
        """Handle registration button click"""
        discord_id = interaction.custom_id.replace('register_', '')
        
        async with aiohttp.ClientSession() as session:
            data = {
                "discord_id": discord_id,
                "username": interaction.user.display_name,
                "avatar_url": str(interaction.user.avatar.url) if interaction.user.avatar else None
            }
            
            async with session.post(f"{self.api_base_url}/discord/register", json=data) as response:
                if response.status == 201:
                    result = await response.json()
                    embed_data = result['data']['embed']
                    
                    # Create success embed
                    embed = discord.Embed.from_dict(embed_data)
                    
                    await interaction.response.send_message(embed=embed, ephemeral=True)
                else:
                    await interaction.response.send_message("❌ Registration failed. Please try again.", ephemeral=True)

# Run the bot
bot = WaddleTrackerBot()
bot.run('YOUR_BOT_TOKEN')
```

### Example Bot Code (JavaScript with discord.js)

```javascript
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

const API_BASE_URL = 'https://your-vercel-domain.vercel.app/api';

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    
    if (interaction.customId.startsWith('register_')) {
        const discordId = interaction.customId.replace('register_', '');
        
        try {
            const response = await axios.post(`${API_BASE_URL}/discord/register`, {
                discord_id: discordId,
                username: interaction.user.displayName,
                avatar_url: interaction.user.avatarURL()
            });
            
            if (response.status === 201) {
                const embedData = response.data.data.embed;
                const embed = new EmbedBuilder()
                    .setTitle(embedData.title)
                    .setDescription(embedData.description)
                    .setColor(embedData.color)
                    .setThumbnail(embedData.thumbnail.url)
                    .setFooter({ text: embedData.footer.text })
                    .setTimestamp();
                
                embedData.fields.forEach(field => {
                    embed.addFields({ name: field.name, value: field.value, inline: field.inline });
                });
                
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        } catch (error) {
            await interaction.reply({ content: '❌ Registration failed. Please try again.', ephemeral: true });
        }
    }
});

client.on('messageCreate', async message => {
    if (message.content.startsWith('!profile')) {
        const user = message.mentions.users.first() || message.author;
        
        try {
            // Check if user exists
            const response = await axios.get(`${API_BASE_URL}/users/${user.id}`);
            
            if (response.status === 200) {
                // Show user profile
                await message.reply('User profile found!');
            }
        } catch (error) {
            if (error.response?.status === 404) {
                // User not found, show registration embed
                try {
                    const embedResponse = await axios.post(`${API_BASE_URL}/discord/register-embed`, {
                        discord_id: user.id,
                        username: user.displayName,
                        avatar_url: user.avatarURL()
                    });
                    
                    const embedData = embedResponse.data.data.embed;
                    const componentsData = embedResponse.data.data.components;
                    
                    const embed = new EmbedBuilder()
                        .setTitle(embedData.title)
                        .setDescription(embedData.description)
                        .setColor(embedData.color)
                        .setThumbnail(embedData.thumbnail.url)
                        .setFooter({ text: embedData.footer.text })
                        .setTimestamp();
                    
                    embedData.fields.forEach(field => {
                        embed.addFields({ name: field.name, value: field.value, inline: field.inline });
                    });
                    
                    const row = new ActionRowBuilder();
                    componentsData[0].components.forEach(component => {
                        const button = new ButtonBuilder()
                            .setLabel(component.label)
                            .setStyle(component.style === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary)
                            .setCustomId(component.custom_id)
                            .setEmoji(component.emoji.name);
                        row.addComponents(button);
                    });
                    
                    await message.reply({ embeds: [embed], components: [row] });
                } catch (embedError) {
                    await message.reply('❌ Error generating registration embed.');
                }
            } else {
                await message.reply('❌ Error fetching user data.');
            }
        }
    }
});

client.login('YOUR_BOT_TOKEN');
```

## Usage Flow

1. **User tries to use a command** (e.g., `!profile @Kenta`)
2. **Bot checks if user exists** in the database
3. **If user doesn't exist:**
   - Bot calls `/api/discord/register-embed`
   - Bot displays embed with registration buttons
4. **User clicks "Register Now!" button**
5. **Bot calls `/api/discord/register`**
6. **Bot displays success embed** with welcome message
7. **User can now use all WaddleTracker features**

## Benefits

- ✅ **No external website needed**
- ✅ **Seamless Discord integration**
- ✅ **One-click registration**
- ✅ **Immediate access to features**
- ✅ **Professional user experience**
- ✅ **Reduced friction for new users**

## Error Handling

The API returns proper error responses for common scenarios:
- User already registered
- Missing required fields
- Invalid Discord data
- Database errors

Handle these appropriately in your bot code to provide good user feedback.
