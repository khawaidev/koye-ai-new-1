

## DOCUMENTATION FROM AI.CC API TO CALL THEIR MODELS:

code example:
const { OpenAI } = require("openai");

const baseURL = "https://api.ai.cc/v1";

// Insert your AICC API Key in the quotation marks instead of my_key:
const apiKey = "<YOUR_AICCAPI_KEY>"; 

const systemPrompt = "You are a travel agent. Be descriptive and helpful";
const userPrompt = "Tell me about San Francisco";

const api = new OpenAI({
  apiKey,
  baseURL,
});

const main = async () => {
  const completion = await api.chat.completions.create({
    model: "mistralai/Mistral-7B-Instruct-v0.2",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 256,
  });

  const response = completion.choices[0].message.content;

  console.log("User:", userPrompt);
  console.log("AI:", response);
};

main();


IMAGE TO IMAGE:

endpoint:

/v1beta/models/gemini-3.1-flash-image-preview:generateContent



