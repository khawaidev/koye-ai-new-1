


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
