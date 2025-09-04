#!/usr/bin/env node
/**
 * Debug LLM Call
 * Direct test of the LLM API call to debug issues
 */

import dotenv from 'dotenv';
import { callLLM } from './src/regulatory-sources/llm-processing.js';

dotenv.config();

console.log('🔍 DEBUGGING LLM API CALL');
console.log('='.repeat(40));

console.log('🔑 API Key:', process.env.LLM_API_KEY ? `${process.env.LLM_API_KEY.substring(0, 20)}...` : 'MISSING');
console.log('🤖 Model:', process.env.LLM_DEFAULT_MODEL);

async function debugLLMCall() {
  try {
    console.log('\n📝 Testing simple LLM call...');
    
    const testPrompt = `Create a brief summary of this regulation in business-friendly language:

TEACH Act: Educational institutions can use copyrighted materials in online classes under specific conditions including limiting access to enrolled students and preventing redistribution.

Respond with a 1-2 sentence summary starting with "Your educational institution".`;

    console.log('📤 Sending prompt to LLM...');
    
    const response = await callLLM(testPrompt, {
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.1
    });
    
    console.log('✅ LLM Response received:');
    console.log(`"${response}"`);
    
  } catch (error) {
    console.error('❌ LLM call failed:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugLLMCall();
