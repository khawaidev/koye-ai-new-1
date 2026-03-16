

const response = await fetch('https://fluxkontextapi.org/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    description: 'A beautiful landscape with mountains and lakes',
    model: 'flux-kontext-pro',
    aspect_ratio: '16:9',
    format: 'jpeg',
    auto_translate_to_en: true,
    enhance_prompt: true,
    input_image: 'https://example.com/example.png',
    watermark: 'test'
  })
});

const data = await response.json();
console.log('Task ID:', data.data.taskId);