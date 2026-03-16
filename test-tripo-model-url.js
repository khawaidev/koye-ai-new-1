const fetch = require('node-fetch');

async function testAnimateRigUrl() {
    const apiKey = "tsk_b_RG_zyi6SEUCBfr9yMEEOotfzWZ13eppP58XvQ5hqO";
    const data = {
        type: "animate_prerigcheck",
        // try sending a model_url directly
        model_url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb"
    };

    const res = await fetch("https://api.tripo3d.ai/v2/openapi/task", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + apiKey
        },
        body: JSON.stringify(data)
    });
    console.log('Result:', await res.text());
}
testAnimateRigUrl();
