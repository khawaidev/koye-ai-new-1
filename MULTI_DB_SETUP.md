# Multi-Database System Setup Guide

## Overview

This system uses multiple Supabase databases:
- **Main Database**: Handles authentication, user profiles, subscriptions, and plans
- **Data Databases (db1, db2, db3, etc.)**: Store user-generated content (chats, images, 3D models, jobs)

The system automatically switches to the next database when one reaches 95% capacity.

## Environment Variables

Add these to your `.env` file:

```env
# Main Database (for auth, profiles, subscriptions)
VITE_SUPABASE_URL=your_main_supabase_url
VITE_SUPABASE_ANON_KEY=your_main_supabase_anon_key

# Data Database 1
VITE_SUPABASE_DB1_URL=your_db1_supabase_url
VITE_SUPABASE_DB1_ANON_KEY=your_db1_anon_key
VITE_SUPABASE_DB1_SERVICE_KEY=your_db1_service_key  # Optional

# Data Database 2
VITE_SUPABASE_DB2_URL=your_db2_supabase_url
VITE_SUPABASE_DB2_ANON_KEY=your_db2_anon_key
VITE_SUPABASE_DB2_SERVICE_KEY=your_db2_service_key  # Optional

# Data Database 3
VITE_SUPABASE_DB3_URL=your_db3_supabase_url
VITE_SUPABASE_DB3_ANON_KEY=your_db3_anon_key
VITE_SUPABASE_DB3_SERVICE_KEY=your_db3_service_key  # Optional

# Optional: Set max rows per database (default: 1,000,000)
VITE_MAX_ROWS_PER_DB=1000000
```

## Setup Steps

### 1. Create Additional Supabase Projects

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create new projects for each data database (db1, db2, db3, etc.)
3. Note down the URL and anon key for each project

### 2. Apply Schema to Data Databases

For each data database (db1, db2, db3, etc.):

1. Go to **SQL Editor** in the Supabase dashboard
2. Run the SQL from `supabase-data-db-schema.sql`
3. This creates:
   - `chat_sessions` table
   - `images` table
   - `models` table
   - `jobs` table
   - Indexes for performance
   - Row Level Security policies
   - Storage buckets

### 3. Configure Environment Variables

1. Copy the `.env.example` to `.env` (if it exists)
2. Add all database URLs and keys
3. Restart your development server

### 4. Initialize the System

The multi-database manager initializes automatically when the app starts. It will:
- Load all configured databases
- Set the first database (db1) as active
- Monitor database usage

## How It Works

### Database Switching

1. **Automatic Detection**: The system checks database usage before each write operation
2. **Capacity Threshold**: When a database reaches 95% capacity, it's marked as full
3. **Automatic Switch**: The system automatically switches to the next available database
4. **Persistence**: The active database preference is saved in localStorage

### Data Queries

- **Read Operations**: Query all databases and merge results
- **Write Operations**: Always write to the currently active database
- **Cross-Database**: The system handles queries across multiple databases seamlessly

### Usage Monitoring

The system tracks:
- Total rows per database
- Usage percentage
- Last checked timestamp
- Full status

## API Usage

### Initialize the Manager

```typescript
import { initMultiDbManager } from "./services/multiDbManager"

// Initialize on app start
const dbManager = initMultiDbManager()
```

### Get Active Database

```typescript
import { getMultiDbManager } from "./services/multiDbManager"

const dbManager = getMultiDbManager()
const activeDb = dbManager.getActiveDb()
```

### Save Chat Session

```typescript
import { saveChatSession } from "./services/multiDbDataService"

const session = await saveChatSession(userId, {
  title: "My Chat",
  messages: [...]
})
// Returns: { ...session, dbId: "db1" }
```

### Get User Data (across all databases)

```typescript
import { getUserChatSessions, getUserImages, getUserModels } from "./services/multiDbDataService"

// Gets sessions from all databases
const sessions = await getUserChatSessions(userId)

// Gets images from all databases
const images = await getUserImages(userId)

// Gets models from all databases
const models = await getUserModels(userId)
```

### Check Database Status

```typescript
import { getMultiDbManager } from "./services/multiDbManager"

const dbManager = getMultiDbManager()

// Get status of all databases
const statuses = await dbManager.getAllDbStatuses()

// Get status of specific database
const status = await dbManager.getDbStatus("db1")
```

### Manual Database Switch (Admin)

```typescript
import { getMultiDbManager } from "./services/multiDbManager"

const dbManager = getMultiDbManager()

// Manually switch to a specific database
await dbManager.switchToDb("db2")
```

## Database Schema

### chat_sessions
- `id`: UUID (primary key)
- `userId`: UUID (user identifier from main DB)
- `title`: TEXT
- `messages`: JSONB (array of messages)
- `createdAt`: TIMESTAMP
- `updatedAt`: TIMESTAMP

### images
- `id`: UUID (primary key)
- `userId`: UUID
- `assetId`: UUID (optional)
- `view`: TEXT ('front', 'left', 'right', 'back')
- `url`: TEXT
- `prompt`: TEXT
- `createdAt`: TIMESTAMP

### models
- `id`: UUID (primary key)
- `userId`: UUID
- `assetId`: UUID (optional)
- `url`: TEXT
- `format`: TEXT ('glb', 'obj', 'fbx')
- `status`: TEXT ('raw', 'textured', 'rigged')
- `createdAt`: TIMESTAMP

### jobs
- `id`: UUID (primary key)
- `userId`: UUID
- `type`: TEXT
- `status`: TEXT
- `progress`: INTEGER
- `result`: JSONB
- `error`: TEXT
- `createdAt`: TIMESTAMP
- `updatedAt`: TIMESTAMP

## Security Considerations

1. **Authentication**: All operations verify the user is authenticated via the main database
2. **User Verification**: The application must verify `userId` matches the authenticated user
3. **RLS Policies**: Row Level Security is enabled but relies on application-level verification
4. **Service Keys**: Store service keys securely and never expose them in client-side code

## Monitoring

### Check Database Usage

```typescript
const statuses = await dbManager.getAllDbStatuses()
statuses.forEach(status => {
  console.log(`${status.id}: ${status.usagePercent}% full (${status.totalRows} rows)`)
})
```

### Database Health

The system automatically:
- Checks database usage before writes
- Switches databases when needed
- Logs database switches
- Handles errors gracefully

## Troubleshooting

### Database Not Found
- Check environment variables are set correctly
- Verify database URLs and keys are correct
- Ensure databases are created in Supabase

### Database Full Error
- Add more databases to your configuration
- Increase `VITE_MAX_ROWS_PER_DB` if needed
- Manually switch to a new database

### Cross-Database Queries Failing
- Ensure all databases have the same schema
- Check network connectivity
- Verify RLS policies are set correctly

## Best Practices

1. **Start with 2-3 databases**: Begin with db1 and db2, add more as needed
2. **Monitor usage**: Regularly check database status
3. **Backup regularly**: Backup each database independently
4. **Test switching**: Test database switching in development
5. **Error handling**: Always handle database errors gracefully

## Migration from Single Database

If you're migrating from a single database:

1. Export existing data
2. Import to db1
3. Update environment variables
4. Test thoroughly
5. Deploy

The system will automatically use db1 as the active database.

