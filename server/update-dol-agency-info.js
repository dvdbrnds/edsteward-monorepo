
import { db } from './db.js';
import { regulations } from '../shared/schema.ts';
import { eq, like, or } from 'drizzle-orm';

async function updateDOLAgencyInfo() {
  try {
    console.log('Starting DOL agency info update...');
    
    // Find all regulations that might be DOL related
    const dolRegulations = await db.query.regulations.findMany({
      where: (regulations, { or, like, eq }) => or(
        like(regulations.name, '%labor%'),
        like(regulations.statute, '%labor%'),
        like(regulations.summary, '%labor%'),
        eq(regulations.agency_name, 'Department of Labor'),
        like(regulations.name, '%employment%'),
        like(regulations.name, '%wage%')
      )
    });
    
    console.log(`Found ${dolRegulations.length} potential DOL regulations`);
    
    let updateCount = 0;
    
    for (const regulation of dolRegulations) {
      // Update with DOL agency info if missing
      const updates = {};
      
      if (!regulation.agency_url) {
        updates.agency_url = 'https://www.dol.gov/agencies/oasam/regulatory/statutes';
      }
      
      if (!regulation.agency_name) {
        updates.agency_name = 'Department of Labor';
      }
      
      if (!regulation.agency_department) {
        updates.agency_department = 'Office of the Assistant Secretary for Administration and Management';
      }
      
      // Customize regulation URL based on name
      const nameLower = regulation.name.toLowerCase();
      if (!regulation.regulationUrl) {
        if (nameLower.includes('age discrimination')) {
          updates.regulationUrl = 'https://www.dol.gov/agencies/oasam/regulatory/statutes/age-discrimination-act';
        } else if (nameLower.includes('fair labor standards')) {
          updates.regulationUrl = 'https://www.dol.gov/agencies/whd/flsa';
        } else if (nameLower.includes('family and medical leave')) {
          updates.regulationUrl = 'https://www.dol.gov/agencies/whd/fmla';
        } else if (nameLower.includes('occupational safety')) {
          updates.regulationUrl = 'https://www.osha.gov/laws-regulations';
        } else {
          updates.regulationUrl = 'https://www.dol.gov/agencies/oasam/regulatory/statutes';
        }
      }
      
      // Only update if changes are needed
      if (Object.keys(updates).length > 0) {
        await db.update(regulations)
          .set(updates)
          .where(eq(regulations.id, regulation.id));
        
        console.log(`Updated regulation: ${regulation.name} (ID: ${regulation.id})`);
        updateCount++;
      }
    }
    
    console.log(`Completed DOL agency info update. Updated ${updateCount} regulations.`);
  } catch (error) {
    console.error('Error updating DOL agency info:', error);
  }
}

// Run the function
updateDOLAgencyInfo().catch(console.error);
