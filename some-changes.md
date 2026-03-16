

## some changes to the new 3d game dev flow:


in the chatting interface's right sidebar workflow element, this right sidebar should be made dynamic: the worflow of 3d games and 2d games should be different: for the 3d use the default worflow:, in between the animate and the export add a audio gen icon.

in the chatting interface

instead of a floating element which shows the current step, show it in the right sidebar worflow element[in between the generation task icons, like step : 1,2,3 etc and the step name]


## problems:
1.while generating the images , even if the user said single front/single image it still generates four images, and make sure the generation is using koye-2dv1.5(fallback to koye-2dv1 if koye-2dv1.5 is not available or error, and show the error as a pop up message to the user, with option to contact the dev)

2.when finished image generation the whole of the current main chatting interface disappears