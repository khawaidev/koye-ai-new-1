# Multi-Database System - Quick Reference

## Quick Start

### 1. Environment Setup

```env
# Main DB (auth, profiles, subscriptions)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

# Data DBs (chats, images, models)
VITE_SUPABASE_DB1_URL=...
VITE_SUPABASE_DB1_ANON_KEY=...
VITE_SUPABASE_DB2_URL=...
VITE_SUPABASE_DB2_ANON_KEY=...
```

### 2. Apply Schema

Run `supabase-data-db-schema.sql` in each data database (db1, db2, db3, etc.)

### 3. Use in Code

```typescript
import { saveChatSession, getUserChatSessions } from "./services/multiDbDataService"
import { getCurrentUser } from "./services/supabase"

// Save data (automatically uses active DB)
const user = await getCurrentUser()
const session = await saveChatSession(user.id, { title: "...", messages: [...] })

// Get data (queries all DBs)
const sessions = await getUserChatSessions(user.id)
```

## Common Operations

### Chat Sessions
```typescript
// Save
await saveChatSession(userId, { title, messages })

// Get all
await getUserChatSessions(userId)

// Update
await updateChatSession(sessionId, dbId, { title: "New Title" })

// Delete
await deleteChatSession(sessionId, dbId)
```

### Images
```typescript
// Save
await saveImage(userId, { assetId, view, url, prompt })

// Get all
await getUserImages(userId, assetId?) // assetId is optional
```

### Models
```typescript
// Save
await saveModel(userId, { assetId, url, format, status })

// Get all
await getUserModels(userId, assetId?) // assetId is optional
```

### Jobs
```typescript
// Save
await saveJob(userId, { type, status, progress })

// Get all
await getUserJobs(userId)

// Update
await updateJob(jobId, dbId, { status: "completed", progress: 100 })
```

## Database Management

### Check Status
```typescript
import { getMultiDbManager } from "./services/multiDbManager"

const dbManager = getMultiDbManager()
const statuses = await dbManager.getAllDbStatuses()
```

### Manual Switch
```typescript
await dbManager.switchToDb("db2")
```

### Get Active DB
```typescript
const activeDb = dbManager.getActiveDb()
const activeDbId = dbManager.getCurrentActiveDbId()
```

## React Hook

```typescript
import { useMultiDb } from "./hooks/useMultiDb"

function MyComponent() {
  const { activeDbId, dbStatuses, refreshStatuses } = useMultiDb()
  
  return (
    <div>
      <p>Active: {activeDbId}</p>
      {dbStatuses.map(s => (
        <div key={s.id}>{s.id}: {s.usagePercent}%</div>
      ))}
    </div>
  )
}
```

## How It Works

1. **Main DB**: Handles auth, profiles, subscriptions
2. **Data DBs**: Store user content (db1 → db2 → db3...)
3. **Auto-Switch**: When a DB reaches 95% capacity, switches to next
4. **Cross-DB Queries**: Read operations query all DBs and merge results
5. **Write Operations**: Always write to currently active DB

## Important Notes

- The system automatically switches databases when full
- All read operations query all databases
- Write operations always go to the active database
- Database IDs (dbId) are included in all returned data
- Always verify userId matches authenticated user in your app

