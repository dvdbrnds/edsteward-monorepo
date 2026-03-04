/**
 * Test Regulations Uploader
 * 
 * This script adds sample regulations to the MCP server registry
 * to demonstrate the system's capabilities.
 */

import axios from 'axios';
const REGISTRY_API_URL = 'http://127.0.0.1:3010/api/regulations';

const sampleRegulations = [
  {
    regulationId: 'gdpr-2018',
    name: 'General Data Protection Regulation',
    description: 'EU data protection and privacy regulation',
    version: '1.0',
    enactedDate: '2018-05-25',
    publicLaw: 'EU 2016/679',
    keyProvisions: [
      {
        title: 'Right to Access',
        description: 'Individuals have the right to access their personal data'
      },
      {
        title: 'Right to be Forgotten',
        description: 'Individuals have the right to have their personal data erased'
      }
    ]
  },
  {
    regulationId: 'hipaa-1996',
    name: 'Health Insurance Portability and Accountability Act',
    description: 'US healthcare privacy regulation',
    version: '2.1',
    enactedDate: '1996-08-21',
    publicLaw: '104-191',
    keyProvisions: [
      {
        title: 'Privacy Rule',
        description: 'Establishes national standards for the protection of health information'
      },
      {
        title: 'Security Rule',
        description: 'Sets standards for securing patient data'
      }
    ]
  },
  {
    regulationId: 'ccpa-2018',
    name: 'California Consumer Privacy Act',
    description: 'California law focused on consumer privacy rights',
    version: '1.0',
    enactedDate: '2018-06-28',
    publicLaw: 'AB-375',
    keyProvisions: [
      {
        title: 'Right to Know',
        description: 'Consumers have the right to know what personal information businesses collect'
      },
      {
        title: 'Right to Delete',
        description: 'Consumers have the right to request deletion of personal information'
      }
    ]
  }
];

async function uploadSampleRegulations() {
  try {
    console.log('Uploading sample regulations to registry...');
    console.log(`Connecting to: ${REGISTRY_API_URL}`);
    
    const response = await axios.post(REGISTRY_API_URL, sampleRegulations);
    
    console.log('Upload response:', response.data);
    console.log(`Added: ${response.data.added}`);
    console.log(`Updated: ${response.data.updated}`);
    console.log(`Added IDs: ${response.data.addedIds ? response.data.addedIds.join(', ') : 'none'}`);
    
    console.log('Sample regulations added successfully!');
  } catch (error) {
    console.error('Error uploading sample regulations:', error.message);
    console.error('Error details:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      console.error('No response received. Is the server running?');
    } else {
      console.error('Error setting up request:', error.message);
    }
  }
}

uploadSampleRegulations(); 