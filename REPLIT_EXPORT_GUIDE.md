# Export Database from Replit to Local

This guide helps you export your RegulatoryTrackr database from Replit and set it up locally.

## Option 1: Direct Connection (Easiest)

### Step 1: Get Replit Database URL
1. In your Replit project, go to the **Secrets** tab (🔑)
2. Find or create a secret called `DATABASE_URL`
3. Copy the complete URL (looks like: `postgresql://username:password@host:port/database`)

### Step 2: Update Local Environment
1. Paste your Replit database URL into `.env`:
   ```
   DATABASE_URL=your-replit-database-url-here
   ```
2. Test the connection:
   ```bash
   npm run dev
   ```

✅ **Pros:** Fastest setup, always up-to-date data
❌ **Cons:** Requires internet connection, depends on Replit

---

## Option 2: Export & Import (Local Copy)

### Step 1: Export from Replit
1. **Set your Replit database URL as environment variable:**
   ```bash
   export REPLIT_DATABASE_URL="your-replit-database-url-here"
   ```

2. **Run the export script:**
   ```bash
   npm run db:export
   ```
   
   This creates:
   - `exports/complete_export.sql` - Full database export
   - `exports/[table_name].sql` - Individual table exports

### Step 2: Set Up Local PostgreSQL
1. **Install PostgreSQL** (if not installed):
   - **macOS:** `brew install postgresql && brew services start postgresql`
   - **Windows:** Download from [postgresql.org](https://www.postgresql.org/download/windows/)
   - **Ubuntu:** `sudo apt install postgresql postgresql-contrib`

2. **Create local database:**
   ```bash
   npm run db:setup-local
   ```
   
   This creates:
   - Database: `regulatorytrackr`
   - User: `regulatorytrackr_user`
   - Password: `local_dev_password`

### Step 3: Update Local Configuration
1. **Update `.env` with local database:**
   ```
   DATABASE_URL=postgresql://regulatorytrackr_user:local_dev_password@localhost:5432/regulatorytrackr
   ```

2. **Create database schema:**
   ```bash
   npm run db:push
   ```

### Step 4: Import Data
1. **Import the exported data:**
   ```bash
   psql -U regulatorytrackr_user -d regulatorytrackr -f exports/complete_export.sql
   ```
   
   Or import specific tables:
   ```bash
   psql -U regulatorytrackr_user -d regulatorytrackr -f exports/users.sql
   psql -U regulatorytrackr_user -d regulatorytrackr -f exports/regulations.sql
   # ... etc
   ```

### Step 5: Test Local Setup
```bash
npm run dev
```

Your local application should now run with your Replit data!

---

## Method 3: pg_dump (Advanced)

If you have direct PostgreSQL access to your Replit database:

### Export:
```bash
pg_dump "your-replit-database-url" > replit_backup.sql
```

### Import:
```bash
psql -U regulatorytrackr_user -d regulatorytrackr < replit_backup.sql
```

---

## Troubleshooting

### Connection Issues
- Ensure your Replit database allows external connections
- Check if SSL is required: `?sslmode=require` at end of URL
- Verify firewall settings

### Export Issues
- Make sure all required npm packages are installed: `npm install`
- Check that the export script has the correct table names
- Verify you have read permissions on the Replit database

### Import Issues
- Ensure local PostgreSQL is running: `sudo systemctl status postgresql`
- Check database exists: `psql -U postgres -l`
- Verify user permissions: `psql -U postgres -c "\du"`

### Data Conflicts
- Drop existing data before import: `TRUNCATE table_name CASCADE;`
- Or use `--clean` flag with pg_dump/restore

---

## Next Steps

After successful export/import:

1. **Test the application:** `npm run dev`
2. **Verify data integrity:** Check that users, regulations, etc. are present
3. **Update any hardcoded references** to Replit URLs in your code
4. **Set up regular backups** for your local database

---

## Security Notes

- Never commit your actual database URLs to version control
- Use strong passwords for local databases
- Consider using connection pooling for production setups
- Regularly backup your local database

---

Need help? Check the console output for specific error messages and troubleshoot accordingly! 