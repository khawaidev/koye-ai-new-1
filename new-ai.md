 call format for new ai, called koye_coder

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'your_routeway_api_key',
  baseURL: 'https://api.routeway.ai/v1',
});

const response = await openai.chat.completions.create({
  model: 'deepseek-v3.1-terminus:free',
  messages: [{ role: 'user', content: 'Hello, Routeway!' }],
});