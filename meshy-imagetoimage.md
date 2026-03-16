

mage to Image API
Image to Image API is a feature that allows you to integrate Meshy's AI image editing capabilities into your own application. Transform and edit existing images using reference images and text prompts with our powerful AI models.

POST
/openapi/v1/image-to-image
Create an Image to Image Task
This endpoint allows you to create a new Image to Image task. Refer to The Image to Image Task Object to see which properties are included with Image to Image task object.

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
A text description of the transformation or edit you want to apply to the reference images.

Name
reference_image_urls
Type
array
Description
An array of 1 to 5 reference images to use for the image editing task. We currently support .jpg, .jpeg, and .png formats.

There are two ways to provide each image:

Publicly accessible URL: A URL that is accessible from the public internet.
Data URI: A base64-encoded data URI of the image. Example of a data URI: data:image/jpeg;base64,<your base64-encoded image data>.
Optional attributes
Name
generate_multi_view
Type
boolean
Description
When set to true, generates a multi-view image showing the subject from multiple angles.

Default to false if not specified.

Returns
The result property of the response contains the task id of the newly created Image to Image task.

Request
cURL
JavaScript
Python
POST
/openapi/v1/image-to-image
curl https://api.meshy.ai/openapi/v1/image-to-image \
  -X POST \
  -H "Authorization: Bearer ${YOUR_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "ai_model": "nano-banana",
    "prompt": "Transform this into a cyberpunk style artwork",
    "reference_image_urls": [
      "<your publicly accessible image url or base64-encoded data URI>"
    ]
  }'


 ## Using Data URI example
curl https://api.meshy.ai/openapi/v1/image-to-image \
  -X POST \
  -H "Authorization: Bearer ${YOUR_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "ai_model": "nano-banana",
    "prompt": "Transform this into a cyberpunk style artwork",
    "reference_image_urls": [
      "data:image/png;base64,${YOUR_BASE64_ENCODED_IMAGE_DATA}"
    ]
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
/openapi/v1/image-to-image/:id
Retrieve an Image to Image Task
This endpoint allows you to retrieve an Image to Image task given a valid task id. Refer to The Image to Image Task Object to see which properties are included with Image to Image task object.

Parameters
Name
id
Type
path
Description
Unique identifier for the Image to Image task to retrieve.

Returns
The response contains the Image to Image task object. Check The Image to Image Task Object section for details.

Request
cURL
JavaScript
Python
GET
/openapi/v1/image-to-image/018a210d-8ba4-705c-b111-1f1776f7f578
curl https://api.meshy.ai/openapi/v1/image-to-image/018a210d-8ba4-705c-b111-1f1776f7f578 \
  -H "Authorization: Bearer ${YOUR_API_KEY}"

Copy
Copied!
Response
{
  "id": "018a210d-8ba4-705c-b111-1f1776f7f578",
  "type": "image-to-image",
  "ai_model": "nano-banana",
  "prompt": "Transform this into a cyberpunk style artwork",
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
/openapi/v1/image-to-image/:id
Delete an Image to Image Task
This endpoint permanently deletes an Image to Image task, including all associated images and data. This action is irreversible.

Path Parameters
Name
id
Type
path
Description
The ID of the Image to Image task to delete.

Returns
Returns 200 OK on success.

Request
cURL
JavaScript
Python
DELETE
/openapi/v1/image-to-image/018a210d-8ba4-705c-b111-1f1776f7f578
curl --request DELETE \
  --url https://api.meshy.ai/openapi/v1/image-to-image/018a210d-8ba4-705c-b111-1f1776f7f578 \
  -H "Authorization: Bearer ${YOUR_API_KEY}"

Copy
Copied!
Response
// Returns 200 Ok on success.

Copy
Copied!
GET
/openapi/v1/image-to-image
List Image to Image Tasks
This endpoint allows you to retrieve a list of Image to Image tasks.

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
Returns a paginated list of The Image to Image Task Objects.

Request
cURL
JavaScript
Python
GET
/openapi/v1/image-to-image
curl https://api.meshy.ai/openapi/v1/image-to-image?page_size=10 \
-H "Authorization: Bearer ${YOUR_API_KEY}"

Copy
Copied!
Response
[
  {
    "id": "018a210d-8ba4-705c-b111-1f1776f7f578",
    "type": "image-to-image",
    "ai_model": "nano-banana",
    "prompt": "Transform this into a cyberpunk style artwork",
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
/openapi/v1/image-to-image/:id/stream
Stream an Image to Image Task
This endpoint streams real-time updates for an Image to Image task using Server-Sent Events (SSE).

Parameters
Name
id
Type
path
Description
Unique identifier for the Image to Image task to stream.

Returns
Returns a stream of The Image to Image Task Objects as Server-Sent Events.

For PENDING or IN_PROGRESS tasks, the response stream will only include necessary progress and status fields.

Request
cURL
JavaScript
Python
GET
/openapi/v1/image-to-image/018a210d-8ba4-705c-b111-1f1776f7f578/stream
curl -N https://api.meshy.ai/openapi/v1/image-to-image/018a210d-8ba4-705c-b111-1f1776f7f578/stream \
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
  "type": "image-to-image",
  "ai_model": "nano-banana",
  "prompt": "Transform this into a cyberpunk style artwork",
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
The Image to Image Task Object
The Image to Image Task object is a work unit that Meshy keeps track of to generate an image from reference images and a text prompt input. The object has the following properties:

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
The type of image generation task. For Image to Image tasks, this will always be image-to-image.

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
The text prompt that was used to guide the image transformation.

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

Example Image to Image Task Object
{
  "id": "018a210d-8ba4-705c-b111-1f1776f7f578",
  "type": "image-to-image",
  "ai_model": "nano-banana",
  "prompt": "Transform this into a cyberpunk style artwork",
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