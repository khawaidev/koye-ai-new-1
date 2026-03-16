// Backend API service for job queue and WebSocket updates
// This would typically connect to your backend server

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001"

export interface JobRequest {
  type: "image_generation" | "model_generation" | "texture_generation" | "rigging"
  payload: any
}

export interface JobResponse {
  jobId: string
  status: "pending" | "processing" | "completed" | "failed"
  progress?: number
  result?: any
  error?: string
}

export async function createJob(request: JobRequest): Promise<JobResponse> {
  const response = await fetch(`${BACKEND_URL}/api/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Failed to create job: ${response.statusText}`)
  }

  return await response.json()
}

export async function getJobStatus(jobId: string): Promise<JobResponse> {
  const response = await fetch(`${BACKEND_URL}/api/jobs/${jobId}`)

  if (!response.ok) {
    throw new Error(`Failed to get job status: ${response.statusText}`)
  }

  return await response.json()
}

// WebSocket connection for real-time job updates
export function connectJobWebSocket(
  jobId: string,
  onUpdate: (update: JobResponse) => void
): () => void {
  const ws = new WebSocket(`${BACKEND_URL.replace("http", "ws")}/ws/jobs/${jobId}`)

  ws.onmessage = (event) => {
    const update: JobResponse = JSON.parse(event.data)
    onUpdate(update)
  }

  ws.onerror = (error) => {
    console.error("WebSocket error:", error)
  }

  return () => {
    ws.close()
  }
}

