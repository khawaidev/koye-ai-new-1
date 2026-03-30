const fetch = require('node-fetch');
const main = async () => {
    try {
        const response = await fetch('https://api.imgbb.com/1/upload?expiration=600&key=ca7c8762f4b19a270b738b8e3e83f71d', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'image=R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        });
        console.log('ImgBB status:', response.status);
        const data = await response.json();
        console.log('ImgBB data:', JSON.stringify(data));
        
        if(data.data && data.data.url) {
            const aiRes = await fetch('https://api.ai.cc/v1/images/generations', {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer sk-VdQXrv5GPIHYJ0065CgOA6IKVXKFULPPYIEsR930yNtMPeaJ',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'google/gemini-2.5-flash-image-edit',
                    prompt: 'make it blue',
                    image_urls: [data.data.url]
                })
            });
            console.log('AICC status:', aiRes.status);
            const aiData = await aiRes.json();
            console.log('AICC data:', JSON.stringify(aiData).substring(0, 500));
        }
    } catch (e) {
        console.error(e);
    }
};
main();
