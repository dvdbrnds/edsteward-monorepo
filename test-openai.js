
// Simple script to test OpenAI API connection
import { OpenAI } from 'openai';

async function testOpenAIConnection() {
  console.log("Testing OpenAI API connection...");
  
  // Check if API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY is not set in environment variables");
    console.log("Please add your OpenAI API key to Replit Secrets");
    return false;
  }
  
  // Check API key format
  if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
    console.error("Error: OpenAI API key format is invalid");
    console.log("API key should start with 'sk-'");
    return false;
  }
  
  console.log(`✅ OPENAI_API_KEY is set in the environment`);
  console.log(`API key length: ${process.env.OPENAI_API_KEY.length} characters`);
  console.log(`First 4 characters: ${process.env.OPENAI_API_KEY.substring(0, 4)}...`);
  
  try {
    // Initialize the OpenAI client
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY
    });
    
    console.log("OpenAI client initialized, making test API call...");
    
    // Make a simple test call
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Use more widely available model
      messages: [{ role: "user", content: "Hello, this is a test message." }],
      max_tokens: 20
    });
    
    console.log("OpenAI API test successful!");
    console.log("Response:", response.choices[0].message);
    return true;
  } catch (error) {
    console.error("OpenAI API test failed:");
    console.error("Error message:", error.message);
    
    // Additional error diagnostics
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
    
    // Common error analysis
    if (error.message.includes("401")) {
      console.error("❌ API key is invalid or unauthorized");
      console.log("Please check that your API key is correct and has the proper permissions");
    } else if (error.message.includes("429")) {
      console.error("❌ API rate limit exceeded");
      console.log("Your account has reached its API call limit or quota");
    } else if (error.message.includes("model")) {
      console.error("❌ Model not available");
      console.log("The requested model may not be available for your account tier");
    } else if (error.message.includes("network") || error.message.includes("ETIMEDOUT")) {
      console.error("❌ Network error");
      console.log("Please check your internet connection");
    }
    
    return false;
  }
}

// Add a key format validation function
function validateApiKey() {
  console.log("Running OpenAI API key validation script...");
  console.log("Checking OpenAI API key format:");
  
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY is not set in environment variables");
    return false;
  }
  
  if (process.env.OPENAI_API_KEY.startsWith('sk-') && 
      process.env.OPENAI_API_KEY.length > 20) {
    console.log("✅ API key format appears valid (starts with sk- and has sufficient length)");
    return true;
  } else {
    console.error("❌ API key format is invalid");
    console.log("API key should start with 'sk-' and be at least 20 characters long");
    return false;
  }
}

// Run validation first, then test connection if validation passes
validateApiKey();
testOpenAIConnection().catch(console.error);
