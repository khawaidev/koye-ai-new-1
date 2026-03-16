const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

async function testUpload() {
    const apiKey = "tsk_b_RG_zyi6SEUCBfr9yMEEOotfzWZ13eppP58XvQ5hqO";
    // Check if Tripo has an upload task
    const res = await fetch("https://api.tripo3d.ai/v2/openapi/upload", {
        method: "POST",
        headers: { Authorization: "Bearer " + apiKey },
    });
    console.log('Upload check:', await res.text());
}
testUpload();
