const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);

async function run() {
  console.log("Testing generation with model: gemini-2.0-flash");
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash"});
    const result = await model.generateContent("Hello?");
    const response = await result.response;
    console.log("Success with gemini-2.0-flash! Response:", response.text());
  } catch (e) {
    console.error("Error with gemini-2.0-flash:", JSON.stringify(e, null, 2));
    console.error("Error message:", e.message);
  }
}

run();
