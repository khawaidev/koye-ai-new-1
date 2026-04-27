

Powerful LLM chat API with streaming support. Ideal for building chatbots, content generation, code assistance, and any conversational AI application.

Try in Chat
Available Models
claude-opus-4-6
Claude Opus 4.6(Anthropic)20% OFF
Input: $4.00/MTok · Output: $20.00/MTok · Context: 200k
claude-sonnet-4-6
Claude Sonnet 4.6(Anthropic)20% OFF
Input: $2.40/MTok · Output: $12.00/MTok · Context: 200k
qwen3.5-plus
Qwen 3.5 Plus(Alibaba)40% OFF
Input: $0.60/MTok · Output: $3.60/MTok · Context: 128k
qwen3-max
Qwen3 Max(Alibaba)40% OFF
Input: $1.10/MTok · Output: $4.20/MTok · Context: 128k
qwen3.5-flash
Qwen 3.5 Flash(Alibaba)40% OFF
Input: $0.20/MTok · Output: $1.80/MTok · Context: 128k
deepseek-v3.2
DeepSeek V3.2(DeepSeek)40% OFF
Input: $0.60/MTok · Output: $2.40/MTok · Context: 128k
glm-5
GLM-5(Zhipu)40% OFF
Input: $0.60/MTok · Output: $2.70/MTok · Context: 128k
kimi-k2.5
Kimi K2.5(Moonshot)39% OFF
Input: $0.60/MTok · Output: $3.20/MTok · Context: 128k
MiniMax-M2.5
MiniMax M2.5(MiniMax)38% OFF
Input: $0.35/MTok · Output: $1.30/MTok · Context: 128k
claude-haiku-4-5
Claude Haiku 4.5(Anthropic)40% OFF
Input: $0.60/MTok · Output: $3.00/MTok · Context: 200k
gemini-2.0-flash
Gemini 2.0 Flash(Google)10% OFF
Input: $0.08/MTok · Output: $0.36/MTok · Context: 1M
gemini-2.5-flash
Gemini 2.5 Flash(Google)40% OFF
Input: $0.18/MTok · Output: $1.50/MTok · Context: 1M
gemini-2.5-pro
Gemini 2.5 Pro(Google)40% OFF
Input: $0.76/MTok · Output: $6.00/MTok · Context: 1M
gemini-3-flash
Gemini 3 Flash(Google)25% OFF
Input: $0.30/MTok · Output: $1.80/MTok · Context: 1M
gemini-3.1-fast
Gemini 3.1 Fast(Google)56% OFF
Input: $0.70/MTok · Output: $4.20/MTok · Context: 1M
gpt-5
GPT-5(OpenAI)50% OFF
Input: $0.50/MTok · Output: $4.00/MTok · Context: 128k
gpt-5.4
GPT-5.4(OpenAI)50% OFF
Input: $1.00/MTok · Output: $6.00/MTok · Context: 128k
gpt-5.4-mini
GPT-5.4 Mini(OpenAI)50% OFF
Input: $0.30/MTok · Output: $1.80/MTok · Context: 128k
gpt-5.4-nano
GPT-5.4 Nano(OpenAI)50% OFF
Input: $0.08/MTok · Output: $0.48/MTok · Context: 128k
gemini-3.1-pro
Gemini 3.1 Pro(Google)50% OFF
Input: $0.80/MTok · Output: $4.80/MTok · Context: 1M
dolphin
Dolphin (Uncensored)(Venice)
Input: $0.20/MTok · Output: $0.90/MTok · Context: 33k
Request Body
model
Optional
Model ID from the list above (default: claude-sonnet-4-6)
messages
Required
Array of message objects with role and content
temperature
Optional
Sampling temperature 0.0-2.0 (default: 0.8)
max_tokens
Optional
Maximum tokens to generate (default: 4096)
stream
Optional
Enable SSE streaming (default: true)


CODE EXAMPLE:

curl -X POST https://api.hypereal.cloud/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "stream": false
  }'
Response (200 OK)
{
  "id": "chatcmpl-abc123",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! I'm doing great..."
    },
    "finish_reason": "stop"
  }],
  "creditsUsed": 2
}
JavaScript (Streaming)
const response = await fetch('https://api.hypereal.cloud/v1/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Hi!' }],
    stream: true
  })
});

const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // Process SSE chunks
}

