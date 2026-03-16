

Text to Image API
Text to Image API is a feature that allows you to integrate Meshy's AI image generation capabilities into your own application. Generate high-quality images from text prompts using our powerful AI models.

POST
/openapi/v1/text-to-image
Create a Text to Image Task
This endpoint allows you to create a new Text to Image task. Refer to The Text to Image Task Object to see which properties are included with Text to Image task object.

Parameters
Required attributes
Name
ai_model
Type
string
Description
ID of the model to use for image generation.

Available values:

nano-banana: Standard model
nano-banana-pro: Pro model with enhanced quality
Name
prompt
Type
string
Description
A text description of the image you want to generate. Be descriptive for best results.

Optional attributes
Name
generate_multi_view
Type
boolean
Description
When set to true, generates a multi-view image showing the subject from multiple angles.

Default to false if not specified.

When generate_multi_view is true, the aspect_ratio parameter cannot be set.

Name
pose_mode
Type
string
Description
Specify the pose mode for character generation.

Defaults to None. When omitted, the image is generated without any pose presets.

Available values:

a-pose: Generate the character in an A pose.
t-pose: Generate the character in a T pose.
Name
aspect_ratio
Type
string
Description
Specify the aspect ratio of the generated image.

Available values:

1:1: Square format
16:9: Widescreen landscape
9:16: Widescreen portrait
4:3: Standard landscape
3:4: Standard portrait
Default to 1:1 if not specified.

Returns
The result property of the response contains the task id of the newly created Text to Image task.

Request
cURL
JavaScript
Python
POST
/openapi/v1/text-to-image
curl https://api.meshy.ai/openapi/v1/text-to-image \
  -X POST \
  -H "Authorization: Bearer ${YOUR_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "ai_model": "nano-banana",
    "prompt": "A majestic dragon soaring through clouds at sunset",
    "aspect_ratio": "16:9"
  }'

Copy
Copied!
Response
{
  "result": "018a210d-8ba4-705c-b111-1f1776f7f578"
}

Copy
Copied!
GET
/openapi/v1/text-to-image/:id
Retrieve a Text to Image Task
This endpoint allows you to retrieve a Text to Image task given a valid task id. Refer to The Text to Image Task Object to see which properties are included with Text to Image task object.

Parameters
Name
id
Type
path
Description
Unique identifier for the Text to Image task to retrieve.

Returns
The response contains the Text to Image task object. Check The Text to Image Task Object section for details.

Request
cURL
JavaScript
Python
GET
/openapi/v1/text-to-image/018a210d-8ba4-705c-b111-1f1776f7f578
curl https://api.meshy.ai/openapi/v1/text-to-image/018a210d-8ba4-705c-b111-1f1776f7f578 \
  -H "Authorization: Bearer ${YOUR_API_KEY}"

Copy
Copied!
Response
{
  "id": "018a210d-8ba4-705c-b111-1f1776f7f578",
  "type": "text-to-image",
  "ai_model": "nano-banana",
  "prompt": "A majestic dragon soaring through clouds at sunset",
  "status": "SUCCEEDED",
  "progress": 100,
  "created_at": 1692771650657,
  "started_at": 1692771667037,
  "finished_at": 1692771669037,
  "expires_at": 1692771679037,
  "image_urls": [
    "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/image.png?Expires=***"
  ]
}

Copy
Copied!
DELETE
/openapi/v1/text-to-image/:id
Delete a Text to Image Task
This endpoint permanently deletes a Text to Image task, including all associated images and data. This action is irreversible.

Path Parameters
Name
id
Type
path
Description
The ID of the Text to Image task to delete.

Returns
Returns 200 OK on success.

Request
cURL
JavaScript
Python
DELETE
/openapi/v1/text-to-image/018a210d-8ba4-705c-b111-1f1776f7f578
curl --request DELETE \
  --url https://api.meshy.ai/openapi/v1/text-to-image/018a210d-8ba4-705c-b111-1f1776f7f578 \
  -H "Authorization: Bearer ${YOUR_API_KEY}"

Copy
Copied!
Response
// Returns 200 Ok on success.

Copy
Copied!
GET
/openapi/v1/text-to-image
List Text to Image Tasks
This endpoint allows you to retrieve a list of Text to Image tasks.

Parameters
Optional attributes
Name
page_num
Type
integer
Description
Page number for pagination. Starts and defaults to 1.

Name
page_size
Type
integer
Description
Page size limit. Defaults to 10 items. Maximum allowed is 50 items.

Name
sort_by
Type
string
Description
Field to sort by. Available values:

+created_at: Sort by creation time ascendly.
-created_at: Sort by creation time descendly.
Returns
Returns a paginated list of The Text to Image Task Objects.

Request
cURL
JavaScript
Python
GET
/openapi/v1/text-to-image
curl https://api.meshy.ai/openapi/v1/text-to-image?page_size=10 \
-H "Authorization: Bearer ${YOUR_API_KEY}"

Copy
Copied!
Response
[
  {
    "id": "018a210d-8ba4-705c-b111-1f1776f7f578",
    "type": "text-to-image",
    "ai_model": "nano-banana",
    "prompt": "A majestic dragon soaring through clouds at sunset",
    "status": "SUCCEEDED",
    "progress": 100,
    "created_at": 1692771650657,
    "started_at": 1692771667037,
    "finished_at": 1692771669037,
    "expires_at": 1692771679037,
    "image_urls": [
      "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/image.png?Expires=***"
    ]
  }
]

Copy
Copied!
GET
/openapi/v1/text-to-image/:id/stream
Stream a Text to Image Task
This endpoint streams real-time updates for a Text to Image task using Server-Sent Events (SSE).

Parameters
Name
id
Type
path
Description
Unique identifier for the Text to Image task to stream.

Returns
Returns a stream of The Text to Image Task Objects as Server-Sent Events.

For PENDING or IN_PROGRESS tasks, the response stream will only include necessary progress and status fields.

Request
cURL
JavaScript
Python
GET
/openapi/v1/text-to-image/018a210d-8ba4-705c-b111-1f1776f7f578/stream
curl -N https://api.meshy.ai/openapi/v1/text-to-image/018a210d-8ba4-705c-b111-1f1776f7f578/stream \
-H "Authorization: Bearer ${YOUR_API_KEY}"

Copy
Copied!
Response Stream
// Error event example
event: error
data: {
  "status_code": 404,
  "message": "Task not found"
}

// Message event examples illustrate task progress.
// For PENDING or IN_PROGRESS tasks, the response stream will not include all fields.
event: message
data: {
  "id": "018a210d-8ba4-705c-b111-1f1776f7f578",
  "progress": 0,
  "status": "PENDING"
}

event: message
data: {
  "id": "018a210d-8ba4-705c-b111-1f1776f7f578",
  "type": "text-to-image",
  "ai_model": "nano-banana",
  "prompt": "A majestic dragon soaring through clouds at sunset",
  "status": "SUCCEEDED",
  "progress": 100,
  "created_at": 1692771650657,
  "started_at": 1692771667037,
  "finished_at": 1692771669037,
  "expires_at": 1692771679037,
  "image_urls": [
    "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/image.png?Expires=***"
  ]
}

Copy
Copied!
The Text to Image Task Object
The Text to Image Task object is a work unit that Meshy keeps track of to generate an image from a text prompt input. The object has the following properties:

Properties
Name
id
Type
string
Description
Unique identifier for the task. While we use a k-sortable UUID for task ids as the implementation detail, you should not make any assumptions about the format of the id.

Name
type
Type
string
Description
The type of image generation task. For Text to Image tasks, this will always be text-to-image.

Name
ai_model
Type
string
Description
The AI model used for this task. Possible values are nano-banana or nano-banana-pro.

Name
prompt
Type
string
Description
The text prompt that was used to generate the image.

Name
status
Type
string
Description
Status of the task. Possible values are one of PENDING, IN_PROGRESS, SUCCEEDED, FAILED, CANCELED.

Name
progress
Type
integer
Description
Progress of the task. If the task is not started yet, this property will be 0. Once the task has succeeded, this will become 100.

Name
created_at
Type
timestamp
Description
Timestamp of when the task was created, in milliseconds.

A timestamp represents the number of milliseconds elapsed since January 1, 1970 UTC, following the RFC 3339 standard. For example, Friday, September 1, 2023 12:00:00 PM GMT is represented as 1693569600000. This applies to all timestamps in Meshy API.

Name
started_at
Type
timestamp
Description
Timestamp of when the task was started, in milliseconds. If the task is not started yet, this property will be 0.

Name
finished_at
Type
timestamp
Description
Timestamp of when the task was finished, in milliseconds. If the task is not finished yet, this property will be 0.

Name
expires_at
Type
timestamp
Description
Timestamp of when the task result expires, in milliseconds.

Name
preceding_tasks
Type
integer
Description
The count of preceding tasks.

The value of this field is meaningful only if the task status is PENDING.

Name
image_urls
Type
array
Description
An array of downloadable URLs to the generated images. When generate_multi_view is enabled, this array contains three image URLs representing different viewing angles. Otherwise, it contains a single image URL.

Name
task_error
Type
object
Description
Error object that contains the error message if the task failed. The message property should be empty if the task succeeded.

Name
message
Type
string
Description
Detailed error message.

Example Text to Image Task Object
{
  "id": "018a210d-8ba4-705c-b111-1f1776f7f578",
  "type": "text-to-image",
  "ai_model": "nano-banana",
  "prompt": "A majestic dragon soaring through clouds at sunset",
  "status": "SUCCEEDED",
  "progress": 100,
  "created_at": 1692771650657,
  "started_at": 1692771667037,
  "finished_at": 1692771669037,
  "expires_at": 1692771679037,
  "preceding_tasks": 0,
  "image_urls": [
    "https://assets.meshy.ai/***/tasks/018a210d-8ba4-705c-b111-1f1776f7f578/output/image.png?Expires=***"
  ],
  "task_error": {
    "message": ""
  }
}