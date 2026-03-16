const apiKey = "tsk_b_RG_zyi6SEUCBfr9yMEEOotfzWZ13eppP58XvQ5hqO";
const url = "https://api.tripo3d.ai/v2/openapi/task";

async function test() {
    // We need to give it a file or an existing task ID. But we don't have one, so we just use an invalid one and check the schema of the error or see what it looks like.
    const res = await fetch("https://api.tripo3d.ai/v2/openapi/task/e3046989-e69d-4e0d-b192-7573227e3ce5", {
        headers: { Authorization: "Bearer " + apiKey }
    });
    console.log(await res.text());
}
test();
