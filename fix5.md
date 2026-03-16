


## here are a few changes and fixes needed to be made:


1.in the builder page in its viewer element, when the user selects a 3d model(type, glb, fbx)m the viweer says does not support (it should support it, with controls(as panning, zooming, etc))

2.in 

ChatInterface.tsx
, 

WorkflowManager.tsx
, etc here are a few changes needed to be made: 1. lets change how the ai asks user for aproval for asset generation api calls and how the user responds , now the request confirmation should not be through ai llm messages but through a card element like: ┌─────────────────────────────────┐
🧠 TASK PROPOSAL

Generate 3D Model

Source Image
images/front_d662.png

Resolution
1024

Cost
60 credits

Estimated time
~40 seconds

[ Approve Task ]   [ Edit ]   [ Cancel ]
└─────────────────────────────────┘, here the user has the options , and the edit options the user can edit the for example for iamge gen, the resolutions, number of images(and the credit cost changes dynamicaly accordingly, and for 3d model generation: the user can change the source of the image/or edit the text (if text to 3d model), resolution, texture or not, credit cost chnages dunamically). 2. lets change how the ai triggers the api calls for image gen, 3d model gen, video gen, audio gen, auto rigging gen, animations gen, now these will be classified as tasks, like when the ai asks the user to aprove the generation of assets and if the user approves it , it creates a tasks that runs in the background(call the api in the bacground), [the ui should be like: once a task is created, then a dropup menu should be created on the input bar, and then only one task along with the task name(example: image generation, 3d model generation etc), only one task should be showned by deafult when the dropup is closed and when opened show max 5 task, and if any other (more than 5 , then scroll), the tasks element should be like: {task name/type} {time elapsed} {spinner element(loading/generating state:for complete state show a green incircle tick correct icon)} {a long horizontal loading element like this 

loading-ref.css
} {a "x" icon that does: (stopping the task imidiately): when task is running: else if task is already complete then just for closing the curent task element(not all task, only this)} ]

(the above system like tasking creation, task organise, task ui etc are still not implemented, please implement it)

3.in the main chatting interface , even if the user presses the stop icon in the input bar it should stop all the current operations including: 1.searching for valid api's , api calling, etc

but in here even after the user clicks on the stop icon, this process still continues:
 Hitem3D: Trying API key pair 1/8 (ak_55e41...)
hitem3d.ts:314 ❌ Hitem3D key pair 1/8 failed: Hitem3D API error: balance is not enough (code: 30010000)
create3DModelTask @ hitem3d.ts:314
hitem3d.ts:325 🔄 Hitem3D: Falling back to key pair 2...
hitem3d.ts:227 🔑 Hitem3D: Trying API key pair 2/8 (k_ddf157...)
hitem3d.ts:314 ❌ Hitem3D key pair 2/8 failed: Hitem3D API error: client credentials are invalid (code: 40010000)
create3DModelTask @ hitem3d.ts:314
hitem3d.ts:325 🔄 Hitem3D: Falling back to key pair 3...
hitem3d.ts:227 🔑 Hitem3D: Trying API key pair 3/8 (ak_68120...)
hitem3d.ts:314 ❌ Hitem3D key pair 3/8 failed: Hitem3D API error: balance is not enough (code: 30010000)
create3DModelTask @ hitem3d.ts:314
hitem3d.ts:325 🔄 Hitem3D: Falling back to key pair 4...
hitem3d.ts:227 🔑 Hitem3D: Trying API key pair 4/8 (ak_cb6ca...)
hitem3d.ts:314 ❌ Hitem3D key pair 4/8 failed: Hitem3D API error: balance is not enough (code: 30010000)
create3DModelTask @ hitem3d.ts:314
hitem3d.ts:325 🔄 Hitem3D: Falling back to key pair 5...
hitem3d.ts:227 🔑 Hitem3D: Trying API key pair 5/8 (ak_7a805...)

, this fix should be not only for 3d model generation but for other asset generations too.

COMPLETE THE ABOVE TASKS STEP BY STEP, BREAK IT DOWN INTO SMALLER TASKS AND IMPLEMENT IT.