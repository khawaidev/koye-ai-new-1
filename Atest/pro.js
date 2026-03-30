
import axios from "axios";
import FormData from "form-data";

const API_KEY = "infip-1393a22d";

async function editImage() {
    const imageUrl = "https://i.ibb.co/4wh62YyW/0032fab1-803a-479e-bde5-be57c2f33b90-1.png";

    // Download the image as a stream
    const imageResponse = await axios.get(imageUrl, {
        responseType: "stream"
    });

    const form = new FormData();

    form.append("image", imageResponse.data, "image.png");
    form.append("prompt", "remove the two katanas from his waist");
    form.append("model", "flux2-klein-9b");
    form.append("n", "1");
    form.append("aspect_ratio", "square");
    form.append("response_format", "url");

    const response = await axios.post(
        "https://api.infip.pro/v1/images/edits",
        form,
        {
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                ...form.getHeaders()
            }
        }
    );

    console.log(response.data);
}

editImage();