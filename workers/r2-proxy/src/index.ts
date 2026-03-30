/**
 * Cloudflare Worker — R2 Asset Proxy for KOYE AI
 *
 * Handles secure upload, delete, and list operations against the
 * `koye-assets` R2 bucket. Browser never touches R2 secrets.
 *
 * Routes:
 *   POST   /upload   — upload a file
 *   DELETE /delete    — delete a file
 *   GET    /list      — list files under a prefix
 *   GET    /health    — health check
 */

export interface Env {
  KOYE_ASSETS: R2Bucket
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  ALLOWED_ORIGINS: string
}

// ----- CORS helpers -----

function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin") || ""
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim())

  // Allow the origin if it's in the allow-list, otherwise use first origin
  const allowedOrigin = allowed.includes(origin) ? origin : allowed[0] || "*"

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-File-Key, X-Content-Type",
    "Access-Control-Max-Age": "86400",
  }
}

function corsResponse(request: Request, env: Env, body: string | null, init: ResponseInit = {}): Response {
  const cors = getCorsHeaders(request, env)
  const headers = new Headers(init.headers || {})
  for (const [k, v] of Object.entries(cors)) headers.set(k, v)
  return new Response(body, { ...init, headers })
}

// ----- Auth helper -----

async function verifyAuth(request: Request, env: Env): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null

  const token = authHeader.slice(7)

  // Verify JWT by calling Supabase auth.getUser
  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.SUPABASE_ANON_KEY,
      },
    })

    if (!response.ok) return null

    const user = (await response.json()) as { id: string }
    if (!user.id) return null

    return { userId: user.id }
  } catch {
    return null
  }
}

// ----- Request handlers -----

async function handleUpload(request: Request, env: Env): Promise<Response> {
  const auth = await verifyAuth(request, env)
  if (!auth) {
    return corsResponse(request, env, JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Get the file key from header (path inside R2)
  const fileKey = request.headers.get("X-File-Key")
  if (!fileKey) {
    return corsResponse(request, env, JSON.stringify({ error: "Missing X-File-Key header" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Ensure the key starts with the user's own ID (prevent cross-user writes)
  if (!fileKey.startsWith(`${auth.userId}/`)) {
    return corsResponse(request, env, JSON.stringify({ error: "Forbidden: path must start with your userId" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  const contentType = request.headers.get("X-Content-Type") || request.headers.get("Content-Type") || "application/octet-stream"
  const body = await request.arrayBuffer()

  if (!body || body.byteLength === 0) {
    return corsResponse(request, env, JSON.stringify({ error: "Empty body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Upload to R2 with immutable cache headers
  await env.KOYE_ASSETS.put(fileKey, body, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      uploadedBy: auth.userId,
      uploadedAt: new Date().toISOString(),
    },
  })

  return corsResponse(request, env, JSON.stringify({
    success: true,
    key: fileKey,
    size: body.byteLength,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

async function handleDelete(request: Request, env: Env): Promise<Response> {
  const auth = await verifyAuth(request, env)
  if (!auth) {
    return corsResponse(request, env, JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  let fileKey: string | null = null

  // Support both header and body
  fileKey = request.headers.get("X-File-Key")
  if (!fileKey) {
    try {
      const body = await request.json() as { key?: string }
      fileKey = body.key || null
    } catch {
      // ignore
    }
  }

  if (!fileKey) {
    return corsResponse(request, env, JSON.stringify({ error: "Missing file key" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Ensure user can only delete their own files
  if (!fileKey.startsWith(`${auth.userId}/`)) {
    return corsResponse(request, env, JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  await env.KOYE_ASSETS.delete(fileKey)

  return corsResponse(request, env, JSON.stringify({ success: true, key: fileKey }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

async function handleList(request: Request, env: Env): Promise<Response> {
  const auth = await verifyAuth(request, env)
  if (!auth) {
    return corsResponse(request, env, JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const url = new URL(request.url)
  let prefix = url.searchParams.get("prefix") || `${auth.userId}/`

  // Ensure users can only list their own files
  if (!prefix.startsWith(`${auth.userId}/`)) {
    prefix = `${auth.userId}/${prefix}`
  }

  const listed = await env.KOYE_ASSETS.list({ prefix, limit: 1000 })

  const files = listed.objects.map(obj => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded.toISOString(),
  }))

  return corsResponse(request, env, JSON.stringify({ files, truncated: listed.truncated }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

// ----- Main handler -----

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse(request, env, null, { status: 204 })
    }

    const url = new URL(request.url)
    const path = url.pathname

    try {
      if (path === "/upload" && request.method === "POST") {
        return await handleUpload(request, env)
      }

      if (path === "/delete" && request.method === "DELETE") {
        return await handleDelete(request, env)
      }

      if (path === "/list" && request.method === "GET") {
        return await handleList(request, env)
      }

      if (path === "/health") {
        return corsResponse(request, env, JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      // Serve files directly from R2 bucket
      if (path.startsWith("/file/") && request.method === "GET") {
        const fileKey = decodeURIComponent(path.slice(6)).replace(/^\/+/, "")
        const object = await env.KOYE_ASSETS.get(fileKey)

        if (!object || !object.body) {
          return corsResponse(request, env, "File not found", { status: 404 })
        }

        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set("etag", object.httpEtag)

        // Add CORS to allow browser reads
        const cors = getCorsHeaders(request, env)
        for (const [k, v] of Object.entries(cors)) headers.set(k, v)

        // Ensure browser caching
        headers.set("Cache-Control", "public, max-age=31536000, immutable")

        return new Response(object.body, { headers })
      }

      return corsResponse(request, env, JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error"
      console.error("Worker error:", err)
      return corsResponse(request, env, JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  },
}