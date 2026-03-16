1. High-Level Flow (End User View)

In a game project folder:

# 1) Install CLI globally
curl -fsSL https://start.koye.ai/install.sh | bash

# 2) Initialize Koye in this project (creates koye.json, etc.)
koye init

# 3) Login / Register flow in terminal
# (email, password, email verification, etc.)

# 4) Start chatting
koye chat

# Inside chat:
# type 'koye help' to see all commands


Assets & generated files end up in:

./koye-assets/images
./koye-assets/videos
./koye-assets/audio
./koye-assets/3dmodels
./koye-assets/other


Chat sessions & messages are stored in Supabase.
Files live locally (unless explicitly uploaded via make-public).

2. koye.json – The Core Contract

Every project that uses Koye must have a koye.json at root.
If it’s missing, no koye commands work.

Example koye.json:

{
  "project_name": "my-space-game",
  "project_id": "proj_123456",
  "user_id": "user_abc123",
  "plan": "FREE",
  "servers": {
    "start": "https://start.koye.ai",
    "main": "https://api.koye.ai",
    "make_public": "https://public.koye.ai"
  },
  "assets": {
    "root": "./koye-assets",
    "images": "images",
    "videos": "videos",
    "audio": "audio",
    "models3d": "3dmodels",
    "other": "other"
  },
  "features": {
    "chat_enabled": true,
    "sync_chat_history": true,
    "allow_make_public": true
  },
  "version": "1.0.0"
}

Rules:

koye.json is created by koye init (using defaults + server response).

CLI always reads koye.json first:

If missing → error: “No koye.json found. Run koye init in your project root.”

If malformed → error with hints.

Asset paths are relative to project root.

3. CLI Commands & Behavior
3.1 Global commands

koye init

Checks if koye.json exists.

If yes → ask: “Koye is already initialized here. Reconfigure? (y/N)”

Calls Start Server to get config (plan defaults, server URLs).

Creates:

koye.json

koye-assets/… folders

.koye/ internal metadata if needed

If user is not logged in:

Prompts: 1) Login 2) Register

Continues into auth flow (see section 4).

koye login

Asks for email + password.

Sends to Start Server → Supabase.

On success, stores token in: ~/.koye/auth.json

Updates local koye.json userId & plan.

koye register

Asks for email + password.

Registers via Start Server → Supabase Auth.

Server triggers email verification.

CLI shows:

We've sent a verification email to <email>.
Press ENTER after verifying to continue.

On ENTER, CLI calls Start Server:
GET /auth/status?email=... until email_confirmed = true.

Then automatically logs in.

3.2 Chat commands (inside koye chat)

User runs:

koye chat


This starts an interactive REPL connected to Main Server.

Greeting Text Example:

Welcome to KOYE AI 👾
Connected as: user@example.com (Plan: FREE)

Type your message, or use:
  koye help   – show commands
  koye new    – start a new chat session
  koye switch – switch between chat sessions
  koye del    – delete chat sessions

---


Inside this REPL:

koye help

Shows:

Commands:
  koye help      Show this help
  koye new       Start a new chat session
  koye switch    Switch to a different chat session
  koye del       Delete a chat session
  exit           Exit KOYE chat
(Anything else is sent as a message to KOYE AI)

koye new

Sends request: POST /chat/sessions (Main Server, Supabase-backed).

Creates a new session row: chat_sessions table.

Switches current session to the new one.

Shows:

Started new chat session: #7 – “Untitled session”

koye switch

CLI requests the list of sessions from Main Server:

GET /chat/sessions → returns: [ {id, title, created_at, last_message_preview}, ... ]

Displays:

Available sessions:
[1] 2025-12-09  Space Shooter Core Loop
[2] 2025-12-09  Character Concept: Desert Knight
[3] 2025-12-08  UI Design Ideas

Enter session number:


User types e.g. 2

CLI sets current session ID to that session.

koye del

Similar listing, but with deletion prompt:

Chat sessions:
[1] Space Shooter Core Loop (2025-12-09)
[2] Character Concept: Desert Knight (2025-12-09)

Enter session number to delete:


Sends DELETE /chat/sessions/:id → Supabase deletes:

the session

related messages

4. Supabase Data Model (Simplified)
users (Supabase Auth)

id

email

plan (FREE, PRO, PRO_PLUS, ULTRA)

credits_remaining

timestamps

chat_sessions

id

user_id

project_id (optional, from koye.json)

title

created_at

updated_at

chat_messages

id

session_id

role (user | assistant | system)

content (JSON or text)

metadata (e.g. file actions, token usage)

created_at

5. Servers & Responsibilities (Your 3 Render Services)
5.1 Start Server (Render Service #1)

Domain example: https://start.koye.ai

Responsibilities:

Host install.sh

Provide initial config for koye init:

main server URL

make-public URL

versioning info

Handle auth:

/auth/register

/auth/login

/auth/status (for email verified)

Provide plan & profile info:

/user/profile (email, plan, credits)

Validate CLI tokens

Install Flow:

curl -fsSL https://start.koye.ai/install.sh | bash


install.sh does:

Checks for Node

Runs npm install -g @koye/cli

Optionally prints: “Run koye init in your game folder”.

5.2 Main Server (Render Service #2)

Domain example: https://api.koye.ai

Responsibilities:

Websocket endpoint: /ws/chat

Handles streaming chat for CLI.

REST endpoints:

/chat/sessions

/chat/messages

/generate/asset (image, audio, 3d, etc.)

/generate/code

Orchestration:

Calls LLMs (Gemini, etc.)

Calls generative APIs (image, 3D, audio, video).

Writes metadata to Supabase (sessions + messages).

Returns structured responses to CLI, including file actions.

Response format to CLI:

{
  "reply": "I created a player movement script and a placeholder sprite.",
  "actions": [
    {
      "type": "file_create",
      "relative_path": "src/playerMovement.js",
      "content_type": "text/javascript",
      "content": "export function setupPlayerMovement(...) { ... }"
    },
    {
      "type": "asset_create",
      "category": "image",
      "relative_path": "koye-assets/images/player-placeholder.png",
      "download_url": "https://assets.koye.ai/tmp/12345.png"
    }
  ]
}


CLI then interprets actions and writes files locally.

5.3 Make-Public Server (Render Service #3)

Domain example: https://public.koye.ai

Purpose:
Give temporary HTTPS URLs to assets that currently only exist locally, so external APIs can use them.

Important: It cannot magically see local files.
The CLI must upload the file to this server.

Flow when user says:

"let’s edit this image @hero.png, make it hold a sword in his right hand"

CLI parses @hero.png

Resolves path: ./koye-assets/images/hero.png (from koye.json)

CLI uploads file:

POST https://public.koye.ai/expose

form-data:

file: binary

user_id

project_id

Make-Public server:

stores file in temporary storage (e.g. S3, Supabase storage).

returns:

{
  "public_url": "https://cdn.koye.ai/tmp/hero_123.png",
  "expires_in": 600
}


CLI sends message to Main Server, including public_url.

Main Server calls image-edit API with that URL.

Edited asset returned → Main Server generates asset_create action.

CLI saves new file in:

koye-assets/images/hero_edited.png

You now have original + edited local.

6. CLI File & Asset Handling

All decisions about where to store depend on koye.json and asset.category.

Category mapping:

image → koye-assets/images

video → koye-assets/videos

audio → koye-assets/audio

model3d → koye-assets/3dmodels

(fallback) other → koye-assets/other

CLI logic:

On each action from Main Server:

compute full path: projectRoot + relative_path

create any missing folders

write the file (text or binary)

log to user:

✅ Saved: koye-assets/images/hero_edited.png


If koye.json is missing → fail fast:

Error: koye.json not found in current folder.
Run `koye init` in your game project root before using KOYE commands.

7. Profile Display in CLI

After login or koye init completes:

Logged in as: user@example.com
Plan: FREE
Credits remaining: 120

Type `koye chat` to start building with KOYE AI.
Type `koye help` inside chat to see all commands.


When you start koye chat, you can show the same header again.

8. Suggested Implementation Order (For You)

Start Server

/auth/register, /auth/login, /auth/status

/user/profile

install.sh

CLI skeleton

koye init, koye login, koye register

koye.json creation

Main Server

/chat/sessions, /chat/messages

Dumb echo chat first (no LLM), then add LLM.

koye chat REPL

streaming or line-based, plus koye help, koye new, koye switch, koye del

Assets

action format + local file writing

Make-Public Server

/expose upload → temporary URL

Hook that into the “@file” handling in CLI & LLM prompts