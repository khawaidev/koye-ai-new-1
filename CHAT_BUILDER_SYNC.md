# Chat-Builder Real-Time Synchronization

## Overview
Implemented bidirectional real-time synchronization between the chat interface and builder page when a project is connected.

## Features Implemented

### 1. Auto-Open Builder Tab
When a user connects a project to a chat session:
- The builder page for that project automatically opens in a new tab
- Tab is named uniquely per project: `builder_${projectId}`
- URL format: `/builder/${projectId}?name=${projectName}`

### 2. Bidirectional Sync Mechanism

#### Chat → Builder Sync
- **Trigger**: When files are created, edited, or deleted in chat
- **Method**: localStorage with sync key `project_${projectId}_sync`
- **Data Stored**:
  ```json
  {
    "timestamp": 1234567890,
    "sessionId": "chat_session_id",
    "files": { /* generatedFiles object */ }
  }
  ```
- **Update Frequency**: Immediate when files change

#### Builder → Chat Sync
- **Trigger**: When files are modified in builder
- **Method**: Same localStorage sync key
- **Data Stored**: Same format with `sessionId: 'builder'`
- **Update Frequency**: Immediate when files change

### 3. Sync Polling

#### In Builder (`Builder.tsx`)
- Checks for updates every 1 second
- Only applies updates if:
  - Timestamp is newer than last check
  - Files are actually different (prevents unnecessary re-renders)
  - Change didn't come from builder itself
- Prevents undo/redo history pollution using `isUndoRedoRef`

#### In Chat (`ChatInterface.tsx`)
- Checks for updates every 2 seconds
- Only applies updates if:
  - Change came from builder (different sessionId)
  - Timestamp is newer than last check
  - Files are actually different

### 4. Session Tracking
- Chat session connection stored: `chat_project_sync_${sessionId}`
- Last check timestamps stored separately for chat and builder
- Prevents infinite sync loops

## Technical Implementation

### Files Modified

1. **ChatInterface.tsx**
   - Added auto-open builder on project connect
   - Added sync trigger when files change
   - Added listener for builder changes
   - Updated disconnect to clean up sync keys

2. **Builder.tsx**
   - Added sync trigger when files change
   - Added listener for chat changes
   - Integrated with existing auto-save mechanism

### Sync Flow Example

```
Chat creates file → 
  Update generatedFiles store → 
    Trigger useEffect in Chat → 
      Write to localStorage sync key → 
        Builder polling detects change → 
          Update Builder's generatedFiles → 
            UI updates in Builder
```

### Performance Considerations

1. **Debouncing**: Auto-save uses 2-second debounce
2. **Change Detection**: JSON comparison prevents unnecessary updates
3. **Undo/Redo Protection**: Sync operations don't create history entries
4. **Polling Intervals**: 
   - Builder: 1 second (more responsive)
   - Chat: 2 seconds (less frequent)

## Usage

1. User starts chat session
2. User connects or creates project
3. Builder opens automatically in new tab
4. Any file operations in chat appear in builder within 1 second
5. Any file operations in builder appear in chat within 2 seconds
6. Works for: create, edit, delete operations

## Limitations

- Requires localStorage (works only within same browser/device)
- Polling-based (not WebSocket real-time, but sufficient for single-user workflow)
- No conflict resolution (last write wins)
- Maximum update latency: 2 seconds

## Future Enhancements

- WebSocket implementation for true real-time sync
- Multi-user collaboration with conflict resolution
- Offline sync queue
- Visual indicators for sync status
