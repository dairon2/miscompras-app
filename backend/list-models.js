
const https = require('https');
require('dotenv').config();

const key = process.env.GEMINI_API_KEY;

https.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const models = JSON.parse(data);
            console.log(JSON.stringify(models, null, 2));
        } catch (e) { console.error(e); console.log(data); }
    });
}).on('error', (err) => {
    console.log("Error: " + err.message);
});
