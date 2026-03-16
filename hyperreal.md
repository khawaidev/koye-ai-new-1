

## documentation for calling hyperreal api  :

1.text to image api(gpt-4o-image):

models:

nano-banana-t2i(text to image) -34
gpt-4o-image(text to image) -52

for gpt-4o-image:

prompt
Required(string)
Text description for image generation
size
Optional(string)
Image dimensions
1024x1024
1024x1792
1792x1024
Default: 1024x1024

(but in the frontend show it like 16:9, 9:16, 1:1 )

{
  "prompt": "A golden retriever in a sunflower field at sunset",
  "size": "1024x1024"
}


for nanno-banana-t2i:

prompt
Required(string)
Text description for image generation
aspect_ratio
Optional(string)
Output aspect ratio
1:1
3:2
2:3
3:4
4:3
4:5
5:4
9:16
16:9
21:9
Default: 1:1
output_format
Optional(string)
Output image format
png
jpeg
Default: png

{
  "prompt": "A golden retriever in a sunflower field at sunset",
  "aspect_ratio": "16:9",
  "output_format": "png"
}

POST
/api/v1/images/generate
Generate Images
Generate images using state-of-the-art AI models. This endpoint processes requests synchronously and returns the generated image URL directly in the response.

Request Body
prompt
Required
Text description of the image to generate
model
Optional
Model slug (defaults to nano-banana-t2i)
size
Optional
Output resolution (e.g., "1024*1024")
image
Optional
Source image URL (for image editing models)
Response Fields
created
Unix timestamp of when the image was created
data
Array containing the generated image(s) with url and model
creditsUsed
Number of credits consumed for this generation
resultId
Unique identifier for the generated result
cURL Request
curl -X POST https://api.hypereal.tech/v1/images/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "prompt": "A futuristic cityscape at sunset with flying cars",
    "model": "nano-banana-t2i",
    "aspect_ratio": "16:9"
  }'
Response (200 OK)
{
  "created": 1766841456,
  "data": [
    {
      "url": "https://pub-xxx.r2.dev/generated/images/xxx.png",
      "model": "nano-banana-t2i"
    }
  ],
  "resultId": "res_abc123456",
  "creditsUsed": 4
}

FOR image edits it should be like this: 
{
  "prompt": "Replace the cloudy sky with a clear sunset",
  "images": [
    "https://hypereal.tech/demo-girl.webp"
  ],
  "aspect_ratio": "16:9",
  "output_format": "png"
}


## for text  to video api():

models:
sora-2-i2v(image to video) -4
sora-2-t2v(text to video) -4

POST
/api/v1/videos/generate
Generate Videos
Generate videos using state-of-the-art AI models. This endpoint supports both text-to-video and image-to-video generation with webhook callbacks for async delivery.

Request Body
model
Required
Model slug (e.g., sora-2-i2v)
input.prompt
Optional
Text description for video generation
input.image
Optional
Source image URL for image-to-video models
input.duration
Optional
Video duration in seconds (model-dependent)
webhook_url
Optional
URL to receive the result when generation completes
Response Fields
jobId
Unique job identifier for polling status
outputUrl
Generated video URL (available when complete)
creditsUsed
Number of credits consumed for this generation
cURL Request
curl -X POST https://api.hypereal.tech/v1/videos/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "sora-2-i2v",
    "input": {
      "prompt": "Camera slowly pans across the scene",
      "image": "https://hypereal.tech/demo-girl.webp",
      "duration": 5
    },
    "webhook_url": "https://your-server.com/webhook"
  }'
Response (202 Accepted)
{
  "jobId": "job_abc123456",
  "status": "processing",
  "message": "Generation started. Result will be sent to your webhook URL.",
  "creditsUsed": 69


## single view(1 image) and multi view (3 image ) to 3d models api:

example models:

hunyuan3d-v2-base(single image to 3d model) -3
hunyuan3d-v2-multiview( three image to 3d model) -3
tripo3d-2-5-i3d(single image to 3d model) -5
tripo3d-multiview-to-3d(four image to 3d model) - 52


Generate 3D Models
Convert images to 3D models using state-of-the-art AI. Generate high-quality GLB models ready for use in games, AR/VR, and web applications.

Available Models
tripo3d-2-5-i3d
Single image to 3D (Tripo3D V2.5)
tripo3d-multiview-to-3d
4-view images to 3D (front, back, left, right)
hunyuan3d-v2-base
Single image to 3D with 4K textures (Hunyuan3D)
hunyuan3d-v2-multiview
3-view images to 3D, fast ~30s (front, back, left)
Output Format
All 3D models are returned in GLB format, which is widely supported by 3D viewers, game engines, and web frameworks.

Single Image to 3D
curl -X POST https://api.hypereal.tech/api/media/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "hunyuan3d-v2-base",
    "input": {
      "image": "https://example.com/object.png"
    }
  }'
Multi-View to 3D
{
  "model": "tripo3d-multiview-to-3d",
  "input": {
    "front_image_url": "https://example.com/front.png",
    "back_image_url": "https://example.com/back.png",
    "left_image_url": "https://example.com/left.png",
    "right_image_url": "https://example.com/right.png"
  }
}
Response
{
  "success": true,
  "outputUrl": "https://cdn.hypereal.tech/3d/model.glb",
  "creditsUsed": 45
}



# for text + image -> image (image edit) api:

models:

nano-banana-edit:

prompt
Required(string)
Natural language instruction for image editing
images
Required(array)
Array of image URLs (1-10 images)
aspect_ratio
Optional(string)
Output aspect ratio
1:1
3:2
2:3
3:4
4:3
4:5
5:4
9:16
16:9
21:9
output_format
Optional(string)
Output image format
png
jpeg
Default: png

{
  "prompt": "Replace the cloudy sky with a clear sunset",
  "images": [
    "https://hypereal.tech/demo-girl.webp"
  ],
  "aspect_ratio": "16:9",
  "output_format": "png"
}

cost:
$0.04/image

nano-banana-pro-edit:

prompt
Required(string)
Natural language instruction for image editing
images
Required(array)
Array of image URLs (1-14 images)
resolution
Optional(string)
Output resolution
1k
2k
4k
Default: 1k
aspect_ratio
Optional(string)
Output aspect ratio
1:1
3:2
2:3
3:4
4:3
4:5
5:4
9:16
16:9
21:9
output_format
Optional(string)
Output image format
png
jpeg
Default: png
Pricing
1k/2k resolution: $0.14
4k resolution: $0.24
Example Input
{
  "prompt": "Replace the background with a sunset beach scene",
  "images": [
    "https://hypereal.tech/demo-girl.webp"
  ],
  "resolution": "2k",
  "output_format": "png"
}

