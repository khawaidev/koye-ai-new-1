

async function main() {
    const response = await fetch('https://api.aimlapi.com/v1/images/generations', {
        method: 'POST',
        headers: {
            // Insert your AIML API Key instead of <YOUR_AIMLAPI_KEY>:
            'Authorization': 'Bearer e341327ad80841d8bdd7b5c0375d55bc',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'flux/dev/image-to-image',
            prompt: 'A T-Rex relaxing on a beach, lying on a sun lounger and wearing sunglasses.',
            image_url: 'https://raw.githubusercontent.com/aimlapi/api-docs/main/reference-files/t-rex.png',
            strength: 0.8,
        }),
    });

    const data = await response.json();
    console.log(data);
}

main();