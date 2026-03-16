

here should be the new flow for the ai image gen trigger:


1:the ai will chat with the user, user will describe the game, the ai will ask more questions according to the idea,plan,of the users game etc

2.if its a 3d game (which the ai will know from chatting with the user): then asks questions -> how many image should gen question(min 1, max 4)this also will affect users usage, and then so the ai will trigger te image gen accordingly (use clipdrop(now named as koye-2dv1) if FREE, pro trail), and if above plans then ask user which to use:koye-2dv1(clipdrop in the backend), or koye-2dv2(banana in backend), and then trigger and generate the image(s) continue to the flow,


3. if 2d game then: chat with user -> then ai should ask more whethere the asset will be static(if non animated icons, items, ui etc) or animated(characters, animations etc)(break down nicely)(here it will use koye-2dv1(clipdrop) if free and pro trail) and then a prompt for the text to image generation is shown to the user for confirmation and then if yes, it generates the sample image according to the ideas discussed(prompt) with the user, (this sample image should be 2 min, 5 max)(for each images use slightly different prompt from one another) and then the user can select one(as type the serial number of the images into the chats) regenerate the sample,if ok then

if static:
its complete from the above step

if needs-animation:
(here use koye-2dv1)
 asks use to describe the action or animation to be performed by the sprite(image selected from the sample)
 and then it will show four video element cards(i'll provide the video path(not from env)) which will play the differences in frames like:

 [ 5 sprites]      [ 11 sprites ]      [22 sprites]   [ 44sprites ]
 |          |        
 |          |        
 |  [video] |        X four elements
 |          |        

 the user can select by typing in the labels into the chat

typed in the valid number of sprites then it will generate by using the method below:

 then it uses the prompts of the selected generated images from the samples generated and then it modifies the prompt to match the animation of the next message as described in the action or animation by the user, for the first animation prompt will be refered to as prompt1, and then for the next image gen it will be prompt2(slightly modifies version of prompt1) and so on.. this will continue depending on  the number of sprites generated

 and then after the generated sprites then it will show a view sprites btn (which when clicked redirects to the new sprites page)

sprites page:
 
sprite player element like:

here it will play the sprites in according to the duration select:

0.5s, 1s, 1.5s, or custom(here user can input certain time) [this is the time where all the sprites will play in under the selected duration]

            [ header elements with the navigation elemenets ]

             [ animation name                               ]
             |                                              |
             | [here it will  player the sprites generated] |
             |                                              |
             | [player control-pause play,duration select]  |
             


