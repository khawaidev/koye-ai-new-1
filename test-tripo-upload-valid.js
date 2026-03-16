import FormData from 'form-data';
import fs from 'fs';
import fetch from 'node-fetch';

async function uploadValidModel() {
    const apiKey = "tsk_b_RG_zyi6SEUCBfr9yMEEOotfzWZ13eppP58XvQ5hqO";

    // download a real glb
    const modelRes = await fetch("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb");
    const buffer = await modelRes.buffer();
    fs.writeFileSync('box.glb', buffer);

    const form = new FormData();
    form.append('file', fs.createReadStream('box.glb'));

    const res = await fetch("https://api.tripo3d.ai/v2/openapi/upload", {
        method: "POST",
        headers: { Authorization: "Bearer " + apiKey, ...form.getHeaders() },
        body: form
    });

    const text = await res.text();
    console.log('Upload Result:', text);
}
uploadValidModel();
