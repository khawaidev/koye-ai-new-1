
## changes and problems listed:


the builder page viewer still does not support any of the 3d model types, ok we're getting somewhere in the task creation and how the user confirms to the request, but there are still problems as you can see here in the interaction between the ai and the user :hi there where were we last time

{
AI
Welcome back to project hitem35!

We last left off trying to generate the 3D model for your medieval peasant character using the image images/front_d662.png. We encountered some API errors during the previous attempts.

Are you ready to try generating the 3D model again, using the standard resolution (1024) with texture? This will cost 60 credits (50 credits for Standard resolution + 10 credits for texture). Please confirm if you'd like to proceed. [GAME_TYPE: 3D]

yes

AI
Understood! You've confirmed you want to proceed with generating the 3D model for your medieval peasant character using the image images/front_d662.png, at standard resolution (1024) with texture. This will cost 60 credits.

The system will now handle the 3D model generation. [GAME_TYPE: 3D]

proceed

🧠 Task Proposal

3D Model Generation
Resolution
1024
Texture
No
Cost
60 credits
Estimated time
~40 seconds
Approve Task
Edit

}

here are the chnages needed to be made:

1.the builder page's viewer element still does not support any of the 3d model types.

2.in the worflow manager, when the ai generates a text prompt to generate for example(text to image, text to 3d mode, text to video, text to audio), the generated text should be saved as {filename}.txt in the currently connected project (if connected) show the user in the chat the txt file created for the specific prompt (if not connected to a user project then dont craete a txt), note:for both cases the generated txt should till be shown as ai response.(the txt files created for each of the prompt should be saved in the users connected github project in the root, /prompts/{filename}.txt) here the filname should be appropriate for what type of geberation.

3.user only needs one approval to initiate the api call(for iamge gen, 3d model gen and other assets gen too)

4.make the task creation ui horizontal-elongated, with professional icons(black if page theme is white and vice versa) and also the task confirm card more professional and in according to theme

5.when the user clicks on the edit btn in the task creation , the source of the geberation should be shown(for example if from assets/images/sd.png(in case of image to 3d mode, ot image to video etc, aything involving images in generation), or /prompts/character-prompt.txt (in case if text to image, text to video, etc , any other generations involving text prompts)), and also the user can change the source of the files by typing "@" and the ui will list all the available files from the connected project the user can select the file, (or search by typing in the file name, like "@body.png" etc), this should effectively change the source for the api generation calls  

6.in the task cration card, even if the user chnage the value of the settings like resolution, model type(for image gen ad video gen), etc the value of the credit does not change dynamically