

const url = 'https://gateway.pixazo.ai/byteplus/v1/getTextToImage'; const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Ocp-Apim-Subscription-Key': 'YOUR_SUBSCRIPTION_KEY' }; const data = { prompt: 'A fisheye lens close-up of a cat’s head, where the unique distortion of the lens exaggerates and warps the cat’s facial features for a playful, dramatic effect.', model: 'seedream-3-0-t2i-250415', size: '1024x1024', guidance_scale: 2.5, watermark: true }; fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(data) }) .then(response => response.json()) .then(data => console.log(data)) .catch(error => console.error('Error:', error));

Output
Successful API response:

{ "created": 1757499942, "data": [{ "url": "https://..../byteplus/XXXXXXXXXXXXXXX-hntkjsg9kj.jpg" }], "usage": { "generated_images": 1 } }

const body = {
  model: "seedream-3-0-t2i-250415",
  prompt: "A fisheye lens close-up of a cat’s head, where the unique distortion of the lens exaggerates and warps the cat’s facial features for a playful, dramatic effect."
};

fetch('https://gateway.pixazo.ai/byteplus/v1/getTextToImage', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Ocp-Apim-Subscription-Key': 'XXXXXXXXXXXXXXXXX'
  },
  body: JSON.stringify(body) 
})
.then(response => response.json())
.then(data => console.log(data))
.catch(err => console.error(err));



## models for different types of images, 
1.for icons: V_2

2.for 2d character design and sprites generations: seedream-3-0-t2i-250415

3.for images for 3d generations later on: use this , 
const url = 'https://gateway.pixazo.ai/nano-banana/v1/nano-banana/generateTextToImageRequest'; const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Ocp-Apim-Subscription-Key': 'YOUR_SUBSCRIPTION_KEY' }; const data = { prompt: 'A futuristic cityscape at sunset with flying cars', num_images: 1, output_format: 'jpeg', aspect_ratio: '16:9' }; fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(data) }) .then(response => response.json()) .then(data => console.log(data)) .catch(error => console.error('Error:', error));

