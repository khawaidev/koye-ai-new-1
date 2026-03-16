

Video Generation Request
Try it 
Veo 3.1 Video Generation API Documentation
Overview
The Veo 3.1 API enables high-quality AI video generation with advanced features including text-to-video, image-to-video, and reference-based generation. This API provides professional-grade video synthesis with customizable duration, resolution, and aspect ratios.

Base URL: https://gateway.pixazo.ai/veo/v1

Authentication
To utilize this API, you must subscribe to the service and obtain an Ocp-Apim-Subscription-Key. This key should be included in the request headers to authenticate your API calls.

Generate Video Endpoint
POST /veo-3.1/generate
Generate a video based on text prompt, with optional image input and advanced controls.

Endpoint: https://gateway.pixazo.ai/veo/v1/veo-3.1/generate

Method: POST

Content-Type: application/json

Request Body
{
  "prompt": "A serene lake with mountains in the background at sunset",
  "aspect_ratio": "16:9",
  "duration": 8,
  "resolution": "1080p",
  "generate_audio": true,
  "negative_prompt": "blur, distortion, low quality",
  "image": "https://example.com/input-image.jpg",
  "last_frame": "https://example.com/end-frame.jpg",
  "reference_images": [
    "https://example.com/ref1.jpg",
    "https://example.com/ref2.jpg"
  ],
  "seed": 42,
  "webhook": "https://your-server.com/webhook"
}
Response (201 Created)
{
  "success": true,
  "id": "abc123def456",
  "status": "starting",
  "input": {
    "prompt": "A serene lake with mountains in the background at sunset",
    "aspect_ratio": "16:9",
    "duration": 8,
    "resolution": "1080p",
    "generate_audio": true
  },
  "created_at": "2025-10-16T12:00:00.000Z"
}
Important: Save the id to check the video generation status later.

Check Status Endpoint
POST /veo-3.1/prediction
Check the status of a video generation task.

Endpoint: https://gateway.pixazo.ai/veo/v1/veo-3.1/prediction

Method: POST

Content-Type: application/json

Request Body
{
  "prediction_id": "abc123def456"
}
Response - Processing
{
  "success": true,
  "id": "abc123def456",
  "status": "processing",
  "input": {
    "prompt": "A serene lake with mountains in the background at sunset",
    "aspect_ratio": "16:9",
    "duration": 8,
    "resolution": "1080p",
    "generate_audio": true
  },
  "created_at": "2025-10-16T12:00:00.000Z"
}
Response - Completed
{
  "success": true,
  "id": "abc123def456",
  "status": "succeeded",
  "input": {
    "prompt": "A serene lake with mountains in the background at sunset",
    "aspect_ratio": "16:9",
    "duration": 8,
    "resolution": "1080p",
    "generate_audio": true
  },
  "output": "https://.../veo-3.1/abc123def456/output_0.mp4",
  "created_at": "2025-10-16T12:00:00.000Z"
}
Request Parameters
Required Parameters
Parameter	Type	Description
prompt	string	Text description of the video to generate (required)
Optional Parameters
Parameter	Type	Default	Description
aspect_ratio	string	"16:9"	Video aspect ratio: "16:9" or "9:16"
duration	integer	8	Video duration in seconds: 4, 6, or 8
resolution	string	"1080p"	Video resolution: "720p" or "1080p"
generate_audio	boolean	true	Whether to generate audio with the video
negative_prompt	string	null	What to exclude from the generated video
image	string	null	Input image URL for image-to-video generation
last_frame	string	null	Ending image URL for interpolation (requires image)
reference_images	array	[]	1-3 reference images for subject-consistent generation (R2V)
seed	integer	random	Random seed for reproducible results (optional)
webhook	string	null	Webhook URL for completion notifications
webhook_events_filter	array	[]	Event types to receive: ["start", "completed"]
Parameter Constraints
aspect_ratio
Allowed values: "16:9", "9:16"
Note: Reference images only work with "16:9"
duration
Allowed values: 4, 6, 8 (seconds)
Note: Reference images only work with 8 seconds
resolution
Allowed values: "720p" (1280x720), "1080p" (1920x1080)
Performance: 720p is faster and uses less resources
reference_images
Array of 1-3 image URLs
Requirements:
Must use aspect_ratio: "16:9"
Must use duration: 8
last_frame is ignored when reference images are provided
seed
Type: Positive integer
Use case: Set a specific seed to reproduce the same video with the same prompt
Response Format
Status Values
Status	Description
starting	Video generation task has been queued
processing	Video is being generated
succeeded	Video generation completed successfully
failed	Video generation failed
canceled	Video generation was canceled
Output Format
When status is "succeeded", the output field contains a direct URL to the generated video (MP4 format):

{
  "output": "https://.../veo-3.1/abc123def456/output_0.mp4"
}