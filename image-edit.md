

## flow and working system for ai image edit:


here is the request code should look form (according to provider's documentation):
const url = 'https://gateway.pixazo.ai/byteplus/v1/getEditImage'; const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Ocp-Apim-Subscription-Key': 'YOUR_SUBSCRIPTION_KEY' }; const data = { prompt: 'Make the cat eye blue', image: 'https://pub-582b7213209642b9b995c96c95a30381.r2.dev/byteplus/1757499948018-hntkjsg9kj.jpg', guidance_scale: 6, seed: 42 }; fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(data) }) .then(response => response.json()) .then(data => console.log(data)) .catch(error => console.error('Error:', error));

(should use the same api as the image gen from koye-2dv1.5(pixazo api))

and should also have the loading state for this too, where the send messafge/sent arrow btn form the input element in the builder which appears after clicking on the edit image appears, here the send btn should be turned into a spinner animations icon, and should be disabled (not clickable) and when the image edit gen is done then bring back the send icon(remove the spinner) and make it clickable, here the edited image should be opened automatically in the viewer, also the previous image should be saved(the image the user used to edit) and the edit prompt(input element from below) should remain active unless closed