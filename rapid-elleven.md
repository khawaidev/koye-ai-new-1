
const url = 'https://elevenlabs-sound-effects.p.rapidapi.com/generate-sound';
const options = {
	method: 'POST',
	headers: {
		'x-rapidapi-key': 'e7d7af970dmsh41260964d77d480p1ffe02jsnb5fe41f47e0b',
		'x-rapidapi-host': 'elevenlabs-sound-effects.p.rapidapi.com',
		'Content-Type': 'application/json'
	},
	body: {
		text: 'Crickets making sounds in the wild',
		prompt_influence: 0.3,
		duration_seconds: null
	}
};

try {
	const response = await fetch(url, options);
	const result = await response.text();
	console.log(result);
} catch (error) {
	console.error(error);
}








{
  "status": "OK",
  "request_id": "440b2120-6294-442e-a0e0-56c23bbd71da",
  "parameters": {
    "text": "Crickets making sounds in the wild",
    "prompt_influence": 0.3,
    "duration_seconds": null
  },
  "data": [
    {
      "content_base64": "//vgBAAABfxovm0lgACzLRfdoyQAHpYvHfmaAAN9ReP/NUAABYACUnYAFcqNGTt6QIBQCAAwBgmGxWjJ9UMz9fdevXr16xYsoeLFiyl5mjCxZE2sp07M0WGa9fe95YMAbg3AmBMG5PfYJANwbiWZmZ+vXrzxYsWLFixyl73ve95+ZxhYsWLKTra8zMzM/XrFlKUpSlF69evX3vdesWLFjlKUWGZmZmZ+vfvMzMzM0ovXr169evXrzAwMDxY5SZp0zMzO0pRY5SnTSlKUpTmzAwd+UB8HwfgmH8HwQBAEFg4CDijoSgAvt/ACnMEZZMmTJ0YAwGTJk0yd8jJ9gogQYuKEGTRo50gJydGjnSBBnmjFYrJ29UFc//6ggFYrBMNitukAoBMExWjbnNdtAgQIECBAgYbnOc5znNAgQIECCEII5znOaNGjQIECBAghCCNGjRo0aNG3CCBAghCEEaNGjbn//6ggQIECBGjRoxWTo0bZIgQMZ57U0aNGjRo29/9QQIIWgQIEDHXRk4oFH/ieXB8Hwff+s....",
      "content_type": "audio/mpeg"
    }
  ]
}