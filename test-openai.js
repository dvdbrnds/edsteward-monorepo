
// Simple script to test OpenAI API connection
import { OpenAI } from 'openai';

async function testOpenAIConnection() {
  console.log("Testing OpenAI API connection...");
  
  // Check if API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY is not set in environment variables");
    console.log("Please add your OpenAI API key to Replit Secrets");
    return;
  }
  
  console.log("OpenAI API key is set (value hidden)");
  
  try {
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY,
      dangerouslyAllowBrowser: false
    });
    
    console.log("OpenAI client initialized, making test API call...");
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello, this is a test message." }],
      max_tokens: 10
    });
    
    console.log("OpenAI API test successful!");
    console.log("Response:", response.choices[0].message);
    return true;
  } catch (error) {
    console.error("OpenAI API test failed:");
    console.error("Error message:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
    if (error.message.includes("API key")) {
      console.log("The API key appears to be invalid or has insufficient permissions");
    }
    return false;
  }
}

testOpenAIConnection().catch(console.error);
