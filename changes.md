

## HERE are the problems and changes to be made:


1.in the chatting interface, when in the input element,the "@" should also show and support folders as well according to name.

2.in the animations library: remove the open builder btn, instead replace it with the back btn (white terminal style btn, black shodow, no rounded corners etc) and in this page add an vertical overflow to the content.

3.in the pricing page, if the user is not logged in, the dashbaord nav btn should change to sign up btn, and for both logged in and logged out users in the left side of the dashboard/sign up btn[not rounded corners and black shwdow , terminal like btn] a new btn back btn [also a terminal style btn]


4.in the sign up and login page replace the image background with this type/element of background use this:import { BackgroundPaths } from '@/components/ui/shadcn-io/background-paths';
export default function BackgroundPathsDemo() {
  return <BackgroundPaths title="Background Paths" />;
}
, i've already installed the shadcn-io package,

5.in here lets change the aimation of the ai thinking animation, lets use this:import { ShimmeringText } from "@/components/text/shimmering-text";

<ShimmeringText
  text="Smooth shimmer waves"
  duration={2}
  wave={true}
  shimmeringColor="hsl(var(--primary))"
/>;, i've already installed the shadcn-io package,

6.if the user is not logged in then the user should not be able to type in the pompts or upload files or click on the generate btns on the following pages: iamge gen, video gen, 3d model gen, audio gen, pages

7.in the main chatting interface, make the dasbaord/sign up(for logged out user) non rounded corners.

8.in the app icon and app text(name) of all the header of the pages add a slightly small "beta" text (with blue txt color) in the top right corner of the app icon and app text(name).

9.and for all the ai triggered loading animations like for example ai triggered ai iamge gen, the loading should be like a spinner element with the text {of the task} for example if for image gen then {black spinner element} with text {Generating images..}, this should happen as soon as the ai triggers the features no delay, and this should replace the ai response to the confirmation text of the user, like when the users says confirm/or similar confimations words to an ai comfirm request then, the next ai response should be the ai triggered asset gen loading spinning animations etc.


10. in the builder page remove the back arrow btn and also in the header(top right corner the play btn:it should be more terminla style like: no rounded, white bg, back txt and black shodow)

11.empty the engine render page, it should have no components, no 3d models initially it should only run the scripts from the current builder page(which is connected to a project)