import { db } from './db.js';
import { regulations } from '../shared/schema.js';
import { eq, like, or } from 'drizzle-orm';
import { syslog, LogLevel, LogFacility } from './services/syslog';

async function updateDOLAgencyInfo() {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 'Starting DOL agency info update...');

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

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Found ${dolRegulations.length} potential DOL regulations`);

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

      // Only update if changes are needed and we're in production
      if (Object.keys(updates).length > 0) {
        try {
          await db.update(regulations)
            .set({
              ...updates,
              lastUpdated: new Date()
            })
            .where(eq(regulations.id, regulation.id));

          syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
            `Updated regulation: ${regulation.name} (ID: ${regulation.id})`);
          updateCount++;
        } catch (updateError) {
          syslog.log(LogFacility.LOCAL0, LogLevel.ERROR,
            `Failed to update regulation ${regulation.id}:`, {
              error: updateError instanceof Error ? updateError.message : String(updateError)
            });
        }
      }
    }

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Completed DOL agency info update. Updated ${updateCount} regulations.`);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 'Error updating DOL agency info:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Run the function if executed directly
if (require.main === module) {
  updateDOLAgencyInfo()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Failed to update DOL agency info:', error);
      process.exit(1);
    });
}

export { updateDOLAgencyInfo };