
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("Testing gemini-1.5-flash...");
        // Try a simple generation to verify
        const result = await model.generateContent("Test");
        console.log("Success:", result.response.text());
    } catch (e) {
        console.error("Error with gemini-1.5-flash:", e.message);
    }

    // Try gemini-pro
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        console.log("Testing gemini-pro...");
        const result = await model.generateContent("Test");
        console.log("Success with gemini-pro:", result.response.text());
    } catch (e) {
        console.error("Error with gemini-pro:", e.message);
    }
}

listModels();
