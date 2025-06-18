// Script to check if the regulation update API is working properly
import fetch from 'node-fetch';

async function checkUpdateEndpoints() {
  console.log("Testing regulation updates API endpoints...");
  
  try {
    // 1. Check the pending updates endpoint
    console.log("\nChecking pending updates endpoint:");
    const pendingResponse = await fetch('http://localhost:5000/api/regulation-updates/pending');
    
    if (!pendingResponse.ok) {
      console.error(`Error: ${pendingResponse.status} ${pendingResponse.statusText}`);
    } else {
      const pendingData = await pendingResponse.json();
      console.log(`Found ${pendingData.length} pending updates`);
      console.log(JSON.stringify(pendingData, null, 2).substring(0, 500) + "...");
    }
    
    // 2. Check the specific update endpoint
    console.log("\nChecking specific update endpoint (ID: 1):");
    const updateResponse = await fetch('http://localhost:5000/api/regulation-updates/1');
    
    if (!updateResponse.ok) {
      console.error(`Error: ${updateResponse.status} ${updateResponse.statusText}`);
    } else {
      const updateData = await updateResponse.json();
      console.log("Successfully retrieved update with ID 1");
      console.log("Update summary:", updateData.update ? updateData.update.summary : "N/A");
      
      // Print the beginning of the diff data to verify it's working
      if (updateData.diffData && updateData.diffData.differences) {
        console.log(`Found ${updateData.diffData.differences.length} differences`);
        console.log("Change statistics:");
        console.log(`- Added: ${updateData.diffData.addedPercentage}%`);
        console.log(`- Removed: ${updateData.diffData.removedPercentage}%`);
        console.log(`- Changed: ${updateData.diffData.changedPercentage}%`);
      } else {
        console.log("No diff data found");
      }
    }
    
  } catch (error) {
    console.error("Error testing API:", error);
  }
}

checkUpdateEndpoints();