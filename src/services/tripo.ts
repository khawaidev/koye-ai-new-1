export type TaskStatus = "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED"

export interface RiggingTask {
  id: string
  status: TaskStatus
  progress: number
  created_at: number
  started_at: number
  finished_at: number
  expires_at: number
  task_error: {
    message: string
  }
  result?: {
    rigged_character_fbx_url?: string
    rigged_character_glb_url?: string
    basic_animations?: {
      walking_glb_url?: string
      walking_fbx_url?: string
      walking_armature_glb_url?: string
      running_glb_url?: string
      running_fbx_url?: string
      running_armature_glb_url?: string
    }
  }
  preceding_tasks: number
}

const TRIPO_API_BASE = "https://api.tripo3d.ai/v2/openapi";

function getAllTripoApiKeys(): string[] {
    const keys: string[] = [];
    const primary = import.meta.env.VITE_TRIPO_API_KEY;
    if (primary) keys.push(primary);

    for (let i = 1; i <= 10; i++) {
        const key = import.meta.env[`VITE_TRIPO_API_KEY${i}`];
        if (key) keys.push(key);
    }

    if (keys.length === 0) {
        throw new Error("No Tripo API credentials found. Please set VITE_TRIPO_API_KEY in .env");
    }
    return [...new Set(keys)];
}

function shouldTryNextKey(error: any): boolean {
    if (!error) return false;
    const msg = error instanceof Error ? error.message : String(error);
    const lower = msg.toLowerCase();
    return (
        lower.includes("401") ||
        lower.includes("403") ||
        lower.includes("429") ||
        lower.includes("2010") || // "You need more credits"
        lower.includes("2000") || // Exceeded limits
        lower.includes("unauthorized") ||
        lower.includes("quota")
    );
}

// In-memory store to track the retarget tasks spawned after a successful rig
const riggingTaskMeta = new Map<string, {
    walkTaskId?: string;
    runTaskId?: string;
    walkUrl?: string;
    runUrl?: string;
}>();

// Ensure delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function importModel(modelUrl: string, apiKey: string): Promise<string> {
    const payload = {
        type: "import_model",
        file: {
            type: "glb",
            url: modelUrl
        }
    };

    const response = await fetch(`${TRIPO_API_BASE}/task`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    if (data.code !== 0) {
        throw new Error(`Tripo Error ${data.code}: ${data.message || 'Unknown'}`);
    }

    const taskId = data.data.task_id;
    
    // Poll for import completion
    let isComplete = false;
    let attempts = 0;
    while (!isComplete && attempts < 30) {
        attempts++;
        await sleep(2000);
        const pollRes = await fetch(`${TRIPO_API_BASE}/task/${taskId}`, {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });
        const pollData = await pollRes.json();
        const status = pollData.data?.status;
        if (status === "success") {
            isComplete = true;
        } else if (status === "failed" || status === "cancelled") {
            throw new Error(`Import task failed with status: ${status}`);
        }
    }
    
    return taskId;
}

export async function createRiggingTask(options: { input_task_id?: string; model_url?: string; rig_type?: string }): Promise<string> {
    const keys = getAllTripoApiKeys();
    let lastError: any = null;

    if (!options.input_task_id && !options.model_url) {
        throw new Error("Tripo auto-rigging requires either an input_task_id or a model_url.");
    }

    for (let i = 0; i < keys.length; i++) {
        const apiKey = keys[i];
        try {
            console.log(`[Tripo] Creating rig task with key ${i + 1}`);

            let originalTaskId = options.input_task_id;
            
            // If we only have a model_url, import it first
            if (!originalTaskId && options.model_url) {
                console.log(`[Tripo] Importing model first: ${options.model_url}`);
                originalTaskId = await importModel(options.model_url, apiKey);
            }

            const payload = {
                type: "animate_rig",
                original_model_task_id: originalTaskId,
                out_format: "glb",
                rig_type: options.rig_type || "biped"
            };

            const response = await fetch(`${TRIPO_API_BASE}/task`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            const data = await response.json();
            if (data.code !== 0) {
                throw new Error(`Tripo Error ${data.code}: ${data.message || 'Unknown'}`);
            }

            return data.data.task_id;
        } catch (error) {
            lastError = error;
            console.warn(`[Tripo] Key ${i + 1} failed:`, error);
            if (!shouldTryNextKey(error)) throw error;
        }
    }
    throw lastError || new Error("All Tripo API keys failed");
}

async function triggerRetarget(rigTaskId: string, animation: string): Promise<string> {
    const keys = getAllTripoApiKeys();
    for (let i = 0; i < keys.length; i++) {
        try {
            const payload = {
                type: "animate_retarget",
                original_model_task_id: rigTaskId,
                out_format: "glb",
                animation: animation
            };
            const response = await fetch(`${TRIPO_API_BASE}/task`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${keys[i]}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.code === 0) return data.data.task_id;
        } catch (e) {
            if (i === keys.length - 1) throw e;
        }
    }
    throw new Error("Failed to trigger retarget task");
}

export async function getRiggingTask(taskId: string): Promise<RiggingTask> {
    const keys = getAllTripoApiKeys();
    let lastError: any = null;

    for (let i = 0; i < keys.length; i++) {
        const apiKey = keys[i];
        try {
            const response = await fetch(`${TRIPO_API_BASE}/task/${taskId}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            if (data.code !== 0) throw new Error(`Tripo Error ${data.code}`);

            const taskData = data.data;
            let status: TaskStatus = "PENDING";
            let riggedModelUrl = "";

            if (taskData.status === "running" || taskData.status === "queued") status = "IN_PROGRESS";
            else if (taskData.status === "success") {
                status = "SUCCEEDED";
                riggedModelUrl = taskData.output?.model?.url || taskData.result?.model?.url;
            }
            else if (taskData.status === "failed") status = "FAILED";
            else if (taskData.status === "cancelled") status = "CANCELED";

            const riggingTask: RiggingTask = {
                id: taskId,
                status,
                progress: taskData.progress || 0,
                created_at: taskData.create_time ? taskData.create_time * 1000 : Date.now(),
                started_at: taskData.start_time ? taskData.start_time * 1000 : Date.now(),
                finished_at: taskData.end_time ? taskData.end_time * 1000 : Date.now(),
                expires_at: Date.now() + 86400000,
                task_error: { message: taskData.error?.message || "Task failed" },
                preceding_tasks: 0,
            };

            // Handle animations if rigging succeeded
            if (status === "SUCCEEDED" && riggedModelUrl) {
                let meta = riggingTaskMeta.get(taskId);
                if (!meta) {
                    meta = {};
                    riggingTaskMeta.set(taskId, meta);

                    // Trigger retarget tasks dynamically without blocking the main Rig polling response
                    triggerRetarget(taskId, "preset:walk").then(id => meta!.walkTaskId = id).catch(console.error);
                    triggerRetarget(taskId, "preset:run").then(id => meta!.runTaskId = id).catch(console.error);
                }

                // Poll the retarget tasks if they exist and aren't completed
                if (meta.walkTaskId && !meta.walkUrl) {
                    const walkRes = await fetch(`${TRIPO_API_BASE}/task/${meta.walkTaskId}`, { headers: { "Authorization": `Bearer ${apiKey}` } });
                    const walkData = await walkRes.json();
                    if (walkData.data?.status === "success") meta.walkUrl = walkData.data.output?.model?.url || walkData.data.result?.model?.url;
                }

                if (meta.runTaskId && !meta.runUrl) {
                    const runRes = await fetch(`${TRIPO_API_BASE}/task/${meta.runTaskId}`, { headers: { "Authorization": `Bearer ${apiKey}` } });
                    const runData = await runRes.json();
                    if (runData.data?.status === "success") meta.runUrl = runData.data.output?.model?.url || runData.data.result?.model?.url;
                }

                riggingTask.result = {
                    rigged_character_glb_url: riggedModelUrl,
                    basic_animations: {
                        walking_glb_url: meta.walkUrl,
                        running_glb_url: meta.runUrl
                    }
                };
            }

            return riggingTask;

        } catch (error) {
            lastError = error;
            if (!shouldTryNextKey(error)) throw error;
        }
    }
    throw lastError || new Error("All Tripo API keys failed");
}

// ==================== Text-to-3D Model Generation ====================

export type TripoModelVersion =
    | "P1-20260311"
    | "Turbo-v1.0-20250506"
    | "v3.1-20260211"
    | "v3.0-20250812"
    | "v2.5-20250123"
    | "v2.0-20240919"
    | "v1.4-20240625"

export type TripoTextureQuality = "standard" | "detailed"
export type TripoGeometryQuality = "standard" | "detailed"

export interface TextTo3DOptions {
    model_version?: TripoModelVersion
    negative_prompt?: string
    image_seed?: number
    model_seed?: number
    texture_seed?: number
    face_limit?: number
    texture?: boolean
    pbr?: boolean
    texture_quality?: TripoTextureQuality
    auto_size?: boolean
    quad?: boolean
    smart_low_poly?: boolean
    geometry_quality?: TripoGeometryQuality
}

/**
 * Create a text-to-3D model task using Tripo AI
 * Returns the task_id to poll for results
 */
export async function createTextTo3DTask(prompt: string, options?: TextTo3DOptions): Promise<string> {
    const keys = getAllTripoApiKeys();
    let lastError: any = null;

    if (!prompt || prompt.trim().length === 0) {
        throw new Error("Prompt is required for text-to-3D generation");
    }

    for (let i = 0; i < keys.length; i++) {
        const apiKey = keys[i];
        try {
            console.log(`[Tripo Text-to-3D] Creating task with key ${i + 1}`);

            const payload: Record<string, any> = {
                type: "text_to_model",
                prompt: prompt.trim(),
                model_version: options?.model_version || "v2.5-20250123",
            };

            // Add optional parameters (only for model_version >= v2.0)
            if (options?.negative_prompt) payload.negative_prompt = options.negative_prompt;
            if (options?.image_seed !== undefined) payload.image_seed = options.image_seed;
            if (options?.model_seed !== undefined) payload.model_seed = options.model_seed;
            if (options?.texture_seed !== undefined) payload.texture_seed = options.texture_seed;
            if (options?.face_limit !== undefined) payload.face_limit = options.face_limit;
            if (options?.texture !== undefined) payload.texture = options.texture;
            if (options?.pbr !== undefined) payload.pbr = options.pbr;
            if (options?.texture_quality) payload.texture_quality = options.texture_quality;
            if (options?.auto_size !== undefined) payload.auto_size = options.auto_size;
            if (options?.quad !== undefined) payload.quad = options.quad;
            if (options?.smart_low_poly !== undefined) payload.smart_low_poly = options.smart_low_poly;
            if (options?.geometry_quality) payload.geometry_quality = options.geometry_quality;

            console.log("[Tripo Text-to-3D] Payload:", JSON.stringify(payload));

            const response = await fetch(`${TRIPO_API_BASE}/task`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            if (data.code !== 0) {
                throw new Error(`Tripo Error ${data.code}: ${data.message || "Unknown"}`);
            }

            const taskId = data.data.task_id;
            console.log(`[Tripo Text-to-3D] ✅ Task created: ${taskId}`);
            return taskId;

        } catch (error) {
            lastError = error;
            console.warn(`[Tripo Text-to-3D] Key ${i + 1} failed:`, error);
            if (!shouldTryNextKey(error)) throw error;
        }
    }
    throw lastError || new Error("All Tripo API keys failed for text-to-3D");
}

/**
 * Poll a Tripo task for its result.
 * Returns a normalized result compatible with the component's GeneratedModel interface.
 */
export interface TripoTaskResult {
    status: "pending" | "processing" | "completed" | "failed"
    progress?: number
    result?: {
        modelUrl: string
        format: string
    }
    error?: string
    taskId: string
}

export async function getTripoTaskResult(taskId: string): Promise<TripoTaskResult> {
    const keys = getAllTripoApiKeys();
    let lastError: any = null;

    for (let i = 0; i < keys.length; i++) {
        const apiKey = keys[i];
        try {
            const response = await fetch(`${TRIPO_API_BASE}/task/${taskId}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                },
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            if (data.code !== 0) throw new Error(`Tripo Error ${data.code}`);

            const taskData = data.data;
            let status: TripoTaskResult["status"] = "pending";
            let modelUrl = "";

            if (taskData.status === "running" || taskData.status === "queued") {
                status = "processing";
            } else if (taskData.status === "success") {
                status = "completed";
                modelUrl = taskData.output?.model?.url || taskData.result?.model?.url || "";
            } else if (taskData.status === "failed") {
                status = "failed";
            }

            return {
                status,
                progress: taskData.progress || 0,
                result: status === "completed" && modelUrl ? {
                    modelUrl,
                    format: "glb",
                } : undefined,
                error: taskData.error?.message || (status === "failed" ? "Task failed" : undefined),
                taskId,
            };

        } catch (error) {
            lastError = error;
            if (!shouldTryNextKey(error)) throw error;
        }
    }
    throw lastError || new Error("All Tripo API keys failed for getTripoTaskResult");
}
