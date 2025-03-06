
// Simple script to test OpenAI API connection
const { OpenAI } = require('openai');

async function testOpenAIConnection() {
  console.log("Testing OpenAI API connection...");
  
  // Check if API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY is not set in environment variables");
    console.log("Please add your OpenAI API key to Replit Secrets");
    return;
  }
  
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    console.log("Making test API call...");
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: "test" }],
      max_tokens: 5
    });
    
    console.log("OpenAI API test successful!");
    console.log("Response:", response.choices[0].message);
  } catch (error) {
    console.error("OpenAI API test failed:", error.message);
    if (error.message.includes("API key")) {
      console.log("The API key appears to be invalid or has insufficient permissions");
    }
  }
}

testOpenAIConnection().catch(console.error);
