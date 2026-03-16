/**
 * Multi-Database System Usage Examples
 * 
 * This file demonstrates how to use the multi-database system
 * in your application.
 */

import { getMultiDbManager } from "../services/multiDbManager"
import {
  saveChatSession,
  getUserChatSessions,
  updateChatSession,
  deleteChatSession,
  saveImage,
  getUserImages,
  saveModel,
  getUserModels,
  saveJob,
  getUserJobs,
  updateJob,
} from "../services/multiDbDataService"
import { getCurrentUser } from "../services/supabase"

// ==================== Example 1: Save a Chat Session ====================
export async function exampleSaveChatSession() {
  const user = await getCurrentUser()
  if (!user) throw new Error("User not authenticated")

  const session = await saveChatSession(user.id, {
    title: "My Game Character",
    messages: [
      {
        id: "msg1",
        role: "user",
        content: "I want to create a warrior character",
        timestamp: new Date(),
      },
      {
        id: "msg2",
        role: "assistant",
        content: "Great! Let's design your warrior...",
        timestamp: new Date(),
      },
    ],
  })

  console.log("Session saved to:", session.dbId)
  return session
}

// ==================== Example 2: Get All User Chat Sessions ====================
export async function exampleGetAllChatSessions() {
  const user = await getCurrentUser()
  if (!user) throw new Error("User not authenticated")

  // This automatically queries all databases and merges results
  const sessions = await getUserChatSessions(user.id)
  
  console.log(`Found ${sessions.length} sessions across all databases`)
  sessions.forEach((session) => {
    console.log(`- ${session.title} (stored in ${session.dbId})`)
  })

  return sessions
}

// ==================== Example 3: Save Generated Image ====================
export async function exampleSaveImage() {
  const user = await getCurrentUser()
  if (!user) throw new Error("User not authenticated")

  const image = await saveImage(user.id, {
    assetId: "asset-123",
    view: "front",
    url: "https://example.com/image.jpg",
    prompt: "A warrior character, front view",
  })

  console.log("Image saved to:", image.dbId)
  return image
}

// ==================== Example 4: Save 3D Model ====================
export async function exampleSaveModel() {
  const user = await getCurrentUser()
  if (!user) throw new Error("User not authenticated")

  const model = await saveModel(user.id, {
    assetId: "asset-123",
    url: "https://example.com/model.glb",
    format: "glb",
    status: "raw",
  })

  console.log("Model saved to:", model.dbId)
  return model
}

// ==================== Example 5: Check Database Status ====================
export async function exampleCheckDatabaseStatus() {
  const dbManager = getMultiDbManager()

  // Get status of all databases
  const statuses = await dbManager.getAllDbStatuses()

  console.log("Database Statuses:")
  statuses.forEach((status) => {
    console.log(`${status.id}:`)
    console.log(`  Active: ${status.isActive}`)
    console.log(`  Full: ${status.isFull}`)
    console.log(`  Usage: ${status.usagePercent.toFixed(2)}%`)
    console.log(`  Rows: ${status.totalRows.toLocaleString()}`)
  })

  return statuses
}

// ==================== Example 6: Manual Database Switch ====================
export async function exampleSwitchDatabase() {
  const dbManager = getMultiDbManager()

  // Manually switch to db2 (admin function)
  await dbManager.switchToDb("db2")

  console.log("Switched to db2")
}

// ==================== Example 7: Save Job and Track Progress ====================
export async function exampleSaveAndUpdateJob() {
  const user = await getCurrentUser()
  if (!user) throw new Error("User not authenticated")

  // Create job
  const job = await saveJob(user.id, {
    type: "model_generation",
    status: "pending",
    progress: 0,
  })

  console.log("Job created in:", job.dbId)

  // Update job progress
  const updatedJob = await updateJob(job.id, job.dbId, {
    status: "processing",
    progress: 50,
  })

  console.log("Job updated:", updatedJob.progress)

  // Complete job
  const completedJob = await updateJob(job.id, job.dbId, {
    status: "completed",
    progress: 100,
    result: { modelUrl: "https://example.com/model.glb" },
  })

  return completedJob
}

// ==================== Example 8: Get All User Data ====================
export async function exampleGetAllUserData() {
  const user = await getCurrentUser()
  if (!user) throw new Error("User not authenticated")

  // Get all user data from all databases
  const [sessions, images, models, jobs] = await Promise.all([
    getUserChatSessions(user.id),
    getUserImages(user.id),
    getUserModels(user.id),
    getUserJobs(user.id),
  ])

  console.log("User Data Summary:")
  console.log(`  Chat Sessions: ${sessions.length}`)
  console.log(`  Images: ${images.length}`)
  console.log(`  Models: ${models.length}`)
  console.log(`  Jobs: ${jobs.length}`)

  return { sessions, images, models, jobs }
}

// ==================== Example 9: React Component Usage ====================
/*
import { useMultiDb } from "../hooks/useMultiDb"
import { getUserChatSessions } from "../services/multiDbDataService"
import { getCurrentUser } from "../services/supabase"

function MyComponent() {
  const { activeDbId, dbStatuses } = useMultiDb()
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    async function loadSessions() {
      const user = await getCurrentUser()
      if (user) {
        const userSessions = await getUserChatSessions(user.id)
        setSessions(userSessions)
      }
    }
    loadSessions()
  }, [])

  return (
    <div>
      <p>Active Database: {activeDbId}</p>
      <p>Sessions: {sessions.length}</p>
      {dbStatuses.map(status => (
        <div key={status.id}>
          {status.id}: {status.usagePercent.toFixed(1)}% full
        </div>
      ))}
    </div>
  )
}
*/

