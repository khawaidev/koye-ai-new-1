


## tripo ai docs:

# AUTO RIGGING AND ANIMATIONS:

Animation
The animation task enhances the output of your previous generation tasks (draft or refine) by automatically rigging your model and adding animation. To give you an idea of what to expect, here’s a preview video showcasing the potential results:


Understanding the capabilities and limitations of our models is essential for achieving optimal results, especially when generating images that may not closely resemble human figures. To help you navigate these challenges, we recommend adhering to the following guidelines:

Preferred Subjects:
Choose subjects with human-like characteristics, such as humans, robots, or anime characters.
Ensure the model has a clear depiction of four limbs.
Opt for simpler attire, ideally with just one layer of clothing.
Subjects to Avoid:
Non-human-like figures, such as animals, large structures, or food items (e.g., your favorite hamburger).
Human-like models with unnatural connections, such as fused legs.
Excessive accessories, which could include multiple glasses or necklaces.
While these guidelines are designed to enhance the quality of the outcomes, we also value creativity and exploration. There are no strict limitations, so feel free to experiment with different concepts and ideas.

Bonus Tip: Unsure about what might work best? Try our newly introduced feature that allows for specifying A/T-poses in your text prompts. This can be a great starting point for characters and models suited for animation.

The old animate interface is split into the following three new interfaces, which means animate = prerigcheck + rigging + retarget.

PreRigCheck
POST https://api.tripo3d.ai/v2/openapi/task
Request
type: This field must be set to animate_prerigcheck.
original_model_task_id: The task_id of a previous task.
Response
task_id: The identifier for the successfully submitted task.
Behaviour
The prerigcheck task checks if a model can be rigged.

Upon completion, the output will include the following elements, as detailed in our task definition:

riggable: true means it can be rigged, false means it cannot be rigged.
rig_type: Indicates the type of rigging applied to the model. The default value is biped (humanoid skeleton). Available values are as follows.
biped
quadruped
hexapod
octopod
avian
serpentine
aquatic
It is important to note that a task can be rigged prior to its check, and a result of 0 in the PreRigCheck task output doesn’t necessarily mean it cannot be rigged.

Example
Request:

Library:
curl
curl -X POST 'https://api.tripo3d.ai/v2/openapi/task' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer ${APIKEY}" \
-d '{      "type": "animate_prerigcheck",
            "original_model_task_id": "1ec04ced-4b87-44f6-a296-beee80777941"
    }'
Response:

{
  "code": 0,
  "data": {
    "task_id": "e3046989-e69d-4e0d-b192-7573227e3ce5"
  }
}
Rig
POST https://api.tripo3d.ai/v2/openapi/task
Request
type: This field must be set to animate_rig.
original_model_task_id: The task_id of a previous task.
out_format (Optional): The file format. This parameter can only be glb or fbx, and if it is not given, the default value is glb.
model_version (Optional): Specifies the version of the rigging model to use. Available versions are:
v2.5-20260210
v2.0-20250506
v1.0-20240301 Note: Only available (and recommended) for biped rig_type. If not specified, the default value is v1.0-20240301.
rig_type (Optional): Specifies the skeletal rig type to be applied to the model. You can obtain the appropriate value for this parameter by first running a preRigCheck operation. The default value is biped.
spec (Optional): Specifies the rigging method to be used. Available options are mixamo and tripo. The default value is tripo.
Response
task_id: The identifier for the successfully submitted task.
Behaviour
The rig task accepts a model as input and outputs a version of the model that has been rigged.

Upon completion, the output will include the following elements, as detailed in our task definition:

model: An output glb or fbx model
Example
Request:

Library:
javascript
const apiKey = "tsk_***";
const url = "https://api.tripo3d.ai/v2/openapi/task";

const data = {
    type: "animate_rig",
    original_model_task_id: "1ec04ced-4b87-44f6-a296-beee80777941",
    out_format: "glb"
};

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify(data)
};

fetch(url, options)
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status},info : ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log(data);
    })
    .catch(error => {
        console.error(error);
    });
Response:

{
  "code": 0,
  "data": {
    "task_id": "e3046989-e69d-4e0d-b192-7573227e3ce5"
  }
}
Retarget
POST https://api.tripo3d.ai/v2/openapi/task
Request
type: This field must be set to animate_retarget.

original_model_task_id: The task_id of a rig task.

out_format (Optional): The file format. This parameter can only be glb or fbx, and if it is not given, the default value is glb.

bake_animation (Optional): Determines whether to bake the animation into the model upon output. The default value is true. Can only be implemented on glb model.

export_with_geometry (Optional): Determines whether to include geometry in the output. The default value is true.

animation(Optional): The preset animations. Available values are as follows.

The version below is only available for v1.0-20240301 rig version:

Biped - Click to see all biped choices
Quadruped - Click to see all quadruped choices
Hexapod - Click to see all hexapod choices
Octopod - Click to see all octopod choices
Avian - Click to see all avian choices
Serpentine - Click to see all serpentine choices
Aquatic - Click to see all aquatic choices
The version below is only available for v2.0-20250506 rig version:

preset:idle
preset:walk
preset:run
preset:dive
preset:climb
preset:jump
preset:slash
preset:shoot
preset:hurt
preset:fall
preset:turn
preset:quadruped:walk
preset:hexapod:walk
preset:octopod:walk
preset:serpentine:march
preset:aquatic:march
animate_in_place (optional): A bool to determine if the model will be animated in fixed place. The default value is false.

animations (Optional): An array of preset animation . Each element in the array should be one of the preset animations listed above. Length cannot be over 5.

Note: one of animation or animations must be set.
Response
task_id: The identifier for the successfully submitted task.
Behaviour
A retarget task actuates a rigged model to conform to a predefined animation sequence.

Upon completion, the output will include the following elements, as detailed in our task definition:

model: An output glb or fbx model
Example
Request:

Library:
curl
curl -X POST 'https://api.tripo3d.ai/v2/openapi/task' \
-H 'Content-Type: application/json' \
-H "Authorization: Bearer ${APIKEY}" \
-d '{      "type": "animate_retarget",
           "original_model_task_id": "1ec04ced-4b87-44f6-a296-beee80777941",
           "out_format": "glb",
           "animation": "preset:run"
    }'
Response:

{
  "code": 0,
  "data": {
    "task_id": "e3046989-e69d-4e0d-b192-7573227e3ce5"
  }
}
Errors
HTTP Status Code	Error Code	Description	Suggestion
429	2000	You have exceeded the limit of generation.	Please retry later.
For more infomation, please refer to Generation Rate Limit.
404	2001	Task not found.	The original model task does not exist or does not belong to the current user.
400	2002	The task type is unsupported.	Please check if you passed the correct task type.
400	2006	The type of the input original task is invalid for animate task.	Please provide a valid task.
400	2007	The status of the original task is not success.	Use a successful original model task to animate.
403	2010	You need more credits to start a new task.	Please reivew your usage at Billing and purchase more credits.
400	2016	Deprecated task type.	The task type you specified is no longer supported. Please use an alternative task type.


## Text to Model
Request
type: Must be set to text_to_model.

model_version (Optional): Model version. Available versions are as below:

P1-20260311 View supported parameter details
Turbo-v1.0-20250506
v3.1-20260211
v3.0-20250812
v2.5-20250123
v2.0-20240919
v1.4-20240625
v1.3-20240522 (Deprecated)
If this option is not set, the default value will be v2.5-20250123.

prompt: Text input that directs the model generation.

The maximum prompt length is 1024 characters, equivalent to approximately 100 words.
The API supports multiple languages. However, emojis and certain special Unicode characters are not supported.
negative_prompt (Optional): Unlike prompt, it provides a reverse direction to assist in generating content contrasting with the original prompt. The maximum length is 255 characters.

image_seed (Optional): This is the random seed used for the process based on the prompt. This parameter is an integer and is randomly chosen if not set.

model_seed (Optional): This is the random seed for model generation. For model_version>=v2.0-20240919, the seed controls the geometry generation process, ensuring identical models when the same seed is used. This parameter is an integer and is randomly chosen if not set.

The options below are only valid for model_version>=v2.0-20240919

face_limit (Optional): Limits the number of faces on the output model. If this option is not set, the face limit will be adaptively determined. If smart_low_poly=true, it should be 1000~20000, if quad=true as well, it should be 500~10000.
texture : A boolean option to enable texturing. The default value is true, set false to get a base model without any textures.
pbr (Optional): A boolean option to enable pbr. The default value is true, set false to get a model without pbr. If this option is set to true, texture will be ignored and used as true.
texture_seed (Optional): This is the random seed for texture generation for model_version>=v2.0-20240919. Using the same seed will produce identical textures. This parameter is an integer and is randomly chosen if not set. If you want a model with different textures, please use same model_seed and different texture_seed.
texture_quality (Optional): This parameter controls the texture quality. detailed provides high-resolution textures, resulting in more refined and realistic representation of intricate parts. This option is ideal for models where fine details are crucial for visual fidelity. The default value is standard.
auto_size (Optional): Automatically scale the model to real-world dimensions, with the unit in meters. The default value is false.
quad (Optional): Set true to enable quad mesh output. If quad=true and face_limit is not set, the default face_limit will be 10000.
Note: Enabling this option will force the output to be an FBX model.
compress (Optional): Specifies the compression type to apply to the texture. Available values are:
geometry: Applies geometry-based compression to optimize the output. You need to decompress the output model to use it in most model edition software if you choose this value. By default, we use meshopt compression.
smart_low_poly (Optional): Generate low-poly meshes with hand‑crafted topology. Inputs with less complexity work best. There is a possibility of failure for complex models. The default value is false.
generate_parts (Optional): Generate segmented 3D models and make each part editable. The default value is false.
Note: generate_parts is not compatible with texture=true or pbr=true, if you want to generate parts, please set texture=false and pbr=false; generate_parts is not compatible with quad=true, if you want to generate parts, please set quad=false.
export_uv (Optional): Controls whether UV unwrapping is performed during generation. The default value is true. (When set to false, generation speed is significantly improved and model size is reduced. UV unwrapping will be handled during the texturing stage.)
The options below are only valid for model_version>=v3.0-20250812

geometry_quality (Optional):
Ultra Mode: Maximum detail for the most intricate and realistic models when setting to detailed
Standard Mode: Balanced detail and speed. The default value is standard
Response
task_id: The identifier for the successfully submitted task.
Behaviour
Once the task moves out of the waiting queue, it typically completes within a few seconds.

Below are options you can use to customize the behavior and appearance of models in your prompts.

Example
Request:

Library:
javascript
const apiKey = 'tsk_***'
const url = 'https://api.tripo3d.ai/v2/openapi/task'

const data = {
  type: 'text_to_model',
  prompt: 'a small cat'
}

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  },
  body: JSON.stringify(data)
}

fetch(url, options)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, info: ${response.statusText}`)
    }
    return response.json()
  })
  .then((data) => {
    console.log(data)
  })
  .catch((error) => {
    console.error(error)
  })
Response:

{
  "code": 0,
  "data": {
    "task_id": "1ec04ced-4b87-44f6-a296-beee80777941"
  }
}



## Pricing & Billing
Pricing
Changelog

2026/03/11: Add price for model version P1
2025/08/12: Add price for text to model & image to model & texture model for v3.0
2025/01/23: Add price for quad param for generation endpoints.
2024/11/11: Add more prices for various endpoints.
2024/08/16: Checking wallet balance is added.
2024/04/24: Rigging, stylization, and export services are now subject to fees.
2024/04/08: Introduction of initial pricing plan.
Pricing Details
3D Generation
Model Version
P1.0(Latest Model)
Without Texture 1	Standard Texture 2
Text to 3D7	30	40
Image to 3D7	40	50
Multiview to 3D 47	40	50
Model Version
Turbo V1.0, V3.1, V3.0, V2.5 and V2.0
Without Texture 1	Standard Texture 2
Text to 3D7	10	20
Image to 3D7	20	30
Multiview to 3D 47	20	30
Model Version
V1.4 (Fatest Model)
Text	20
Image	30
Refine	30
Image Generation
Image	5
Advanced Generation Setup
This is added on top of the generation credits cost if selected

Low Poly	10
Generate in parts	20
Quad Topology	5
Style	5
HD Texture3	10
Detailed Geometry Quality	20
Texture Generation
Standard Texture	10
HD Texture	20
Style Reference	5
Segmentation and Parts Completion
Segmentation	40
Part Completion	50
Post Processing
Post Stylization	20
Format Conversion - Basic5	5
Format Conversion - Advanced 6	10
Retopology	10
Post Low-poly	30
Rigging and Animation
Rig Check	Free
Rigging	25
Retarget	10 per animation
Note
The basic output includes only the base model, without texture, or PBR. Set texture=False and pbr=False to enable.
For standard quality output, both the baked texture model and PBR model are included. This is the default setting.
High definition quality output also includes both the baked texture model and PBR model, but at a higher resolution. Set texture_quality=detailed to enable.
The model version of Multiview not support Turbo-v1.0-*.
When converting only the base model, no other parameters are included in the output.
The advanced export includes retopologize, control of face counts, and format conversion, providing enhanced flexibility and precision in model processing. This feature will be triggered by any other parameters except format.
If quad or style param is set, it will cost 5 more credits. For example:
Standard text based generation with style: 20 + 5 = 25 credits
HD texture image based generation with style and quad: 40 + 5 + 5 = 50 credits
FAQ
How Do Credits Work?
Credits come in two categories: available and frozen.

Available Credits are ready to use for generating new tasks.
Frozen Credits are temporarily held when a new task is initiated and are deducted upon successful task completion. If a task fails, expires, or encounters an issue, credits are automatically refunded from frozen back to available after a certain period.
Additionally, initiating a new payment adds to your frozen credits, which transition to available upon payment completion.

Do You Offer Different Payment Models?
Currently, we operate on a pay-as-you-go model where users purchase credits in advance and use them as needed. We’re continuously exploring new options to better meet the needs of all our users. If you have specific requirements or ideas, we’d love to hear from you.

How Can I Check My Wallet Balance?
Currently, you can check your wallet balance by following the guidance at wallet.

Do Credits Expire?
No, purchased credits are permanent and do not expire. Use them at your convenience without worry.

Can I Request a Refund?
We do not offer refunds for purchased credits. To ensure you’re comfortable with your purchase, we recommend starting with the free credits to gauge your needs before making a purchase.

Are There Any Discounts Available?
Yes! You can earn discounts and even free credits through our hackathons, workshops, or community giveaways. For the latest opportunities, join our Discord, follow us on social media, and stay engaged.

Special discounts are also available for teams, studios, and enterprises. For more details, please reach out to us at payment@tripo3d.ai.

What Payment Methods Are Accepted?
We accept a variety of payment methods, including credit cards and debit cards. Depending on your location and the platform, options like Apple Pay, Google Pay, Alipay, and WeChat Pay may also be available. Enterprises seeking more flexible payment options are encouraged to contact us directly.

How Is Payment and Personal Information Handled?
We use Stripe for our payment processing. This means your payment information is securely handled by Stripe and is not stored or accessed by our systems. Stripe is a PCI-compliant service provider, and we conduct regular reviews to ensure your information remains secure.

How Can I Find My Receipt After Payment?
Receipts are sent to the email address provided during the Stripe checkout process (this may differ from your registered email if using a different address). If you haven’t received your receipt within 24 hours, please contact us.

How Can I Request an Invoice After Payment?
Payments made after October 21, 2024 can be automatically invoiced and found from Recharge-History. For other payments, please contact us.

What If I Encounter Payment or Billing Issues?
For any payment and billing-related inquiries or issues, feel free to contact us at payment@tripo3d.ai or support@tripo3d.ai. We’re here to assist you.


