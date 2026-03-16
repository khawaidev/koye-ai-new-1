
## text to video [5]

// Create prediction
const response = await fetch("https://prod.api.market/api/v1/magicapi/infinite-zoom-image-to-video-api/predictions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-market-key": "cmi7593pf0009la041p0eab33"
  },
  body: JSON.stringify({
    "version": "a2527c5074fc0cf9fa6015a40d75d080d1ddf7082fabe142f1ccd882c18fce61",
    "input": {
        "prompt": "A path going into the woods",
        "inpaint_iter": 2,
        "output_format": "mp4"
    }
})
});

const prediction = await response.json();
console.log(prediction);

GET:

// Get prediction result
const predictionId = "PREDICTION_ID"; // Use the ID from create response
const response = await fetch("https://prod.api.market/api/v1/magicapi/infinite-zoom-image-to-video-api/predictions/${predictionId}", {
  method: "GET",
  headers: {
    "x-api-market-key": "cmi7593pf0009la041p0eab33"
  }
});

const result = await response.json();
console.log(result);


## images to video [10]

// Create prediction
const response = await fetch("https://prod.api.market/api/v1/magicapi/illustration-to-animation-api/predictions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-market-key": "cmi7593pf0009la041p0eab33"
  },
  body: JSON.stringify({
    "version": "0486ff07368e816ec3d5c69b9581e7a09b55817f567a0d74caad9395c9295c77",
    "input": {
        "loop": false,
        "prompt": "",
        "image_1": "https://replicate.delivery/pbxt/L1pQdyf4fPVRzU5WxhhHAdH2Eo05X3zhirvNzwAKJ80lA7Qh/replicate-prediction-5cvynz9d91rgg0cfsvqschdpww-0.webp",
        "image_2": "https://replicate.delivery/pbxt/L1pQeBF582rKH3FFAYJCxdFUurBZ1axNFVwKxEd1wIALydhh/replicate-prediction-5cvynz9d91rgg0cfsvqschdpww-1.webp",
        "image_3": "https://replicate.delivery/pbxt/L1pQdTPwSZxnfDkPkM3eArBmHWd5xttTnSkKBhszXJ88pIff/replicate-prediction-5cvynz9d91rgg0cfsvqschdpww-3.webp",
        "max_width": 512,
        "max_height": 512,
        "interpolate": false,
        "negative_prompt": "",
        "color_correction": true
    }
})
});

const prediction = await response.json();
console.log(prediction);

GET:

// Get prediction result
const predictionId = "PREDICTION_ID"; // Use the ID from create response
const response = await fetch("https://prod.api.market/api/v1/magicapi/illustration-to-animation-api/predictions/${predictionId}", {
  method: "GET",
  headers: {
    "x-api-market-key": "cmi7593pf0009la041p0eab33"
  }
});

const result = await response.json();
console.log(result);

