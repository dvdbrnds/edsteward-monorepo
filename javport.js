// Create this as a script in your Replit environment
const fs = require("fs");
const { pool } = require("./server/db"); // Adjust path as needed

async function exportRegulations() {
  try {
    const result = await pool.query("SELECT * FROM regulations");
    fs.writeFileSync("regulations.json", JSON.stringify(result.rows, null, 2));
    console.log(
      `Exported ${result.rows.length} regulations to regulations.json`,
    );
  } catch (error) {
    console.error("Error exporting regulations:", error);
  } finally {
    await pool.end();
  }
}

exportRegulations();
