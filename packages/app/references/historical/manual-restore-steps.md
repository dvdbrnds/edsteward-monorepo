# Manual Database Restoration Guide

## 🎯 **Restore Your Local Database to AWS RDS**

### **Prerequisites:**
- PostgreSQL client tools installed (`brew install postgresql` on macOS)
- Your local database running
- AWS RDS connection details

### **Step 1: Create Local Database Backup**
```bash
# Create a backup of your Neon database
pg_dump "postgresql://neondb_owner:npg_fuL3z9rnkmwg@ep-tiny-cell-a6vwfmeh.us-west-2.aws.neon.tech/neondb?sslmode=require" > local_backup.sql

# Verify the backup was created
ls -la local_backup.sql
```

### **Step 2: Test AWS RDS Connection**
```bash
# Test connection to AWS RDS
psql "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=require" -c "SELECT version();"
```

### **Step 3: Restore to AWS RDS**
```bash
# Restore the backup to AWS RDS
psql "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=require" < local_backup.sql
```

### **Step 4: Verify Restoration**
```bash
# Check that tables were restored
psql "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres" -c "SELECT COUNT(*) FROM users;"

psql "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres" -c "SELECT COUNT(*) FROM regulations;"

psql "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres" -c "SELECT COUNT(*) FROM notes;"
```

### **Step 5: Test Admin Interface**
Once restored, you should be able to access your data through:
- **Admin Interface**: https://edsteward.ai/admin
- **Database Management**: Admin Settings → Database Management

---

## 🚨 **Alternative: Using pg_restore with Custom Format**

If you prefer a more robust approach:

### **Create Custom Format Backup:**
```bash
pg_dump -Fc "postgresql://postgres:password@localhost:5432/edsteward" > local_backup.dump
```

### **Restore Custom Format:**
```bash
pg_restore -d "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres" local_backup.dump
```

---

## 🔧 **Troubleshooting**

### **If you get SSL errors:**
Add `?sslmode=require` to the connection string:
```bash
psql "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres?sslmode=require"
```

### **If you get permission errors:**
Make sure you're using the correct password: `EdSteward2024!Secure`

### **If tables already exist:**
You might need to drop existing tables first:
```bash
psql "postgresql://postgres:EdSteward2024!Secure@edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com:5432/postgres" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

---

## ✅ **Expected Result**
After successful restoration:
- Your AWS RDS will have all your local data
- The existing admin interface will show your data
- You can manage the database through the web interface
- No need to wait for deployment fixes! 