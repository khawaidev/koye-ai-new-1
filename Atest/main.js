import fetch from "node-fetch";

const API_KEY = "ck_c72528ee4907eaf87c687147fe1d901e4226429badc62d7153b846377f596257";

async function editImage() {
    const url = "https://api.hypereal.tech/v1/images/edit";

    const body = {
        prompt: "Remove the two katanas from his waist",
        images: [
            "https://i.ibb.co/4wh62YyW/0032fab1-803a-479e-bde5-be57c2f33b90-1.png"
        ],
        aspect_ratio: "16:9",
        output_format: "png"
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_KEY}`
            },
            body: JSON.stringify(body)
        });

        const text = await response.text();
        console.log(text);

        // If API returns an image URL
        if (data?.data?.[0]?.url) {
            console.log("Edited Image URL:", data.data[0].url);
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

editImage();