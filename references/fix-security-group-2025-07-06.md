# Fix Security Group for RDS Access

The connection is timing out because the security group doesn't allow inbound traffic on port 5432.

## Steps to Fix:

### 1. Go to AWS Console → EC2 → Security Groups

### 2. Find your RDS security group
- Look for a security group associated with your RDS instance
- It might be named something like `default` or `rds-launch-wizard-X`

### 3. Edit Inbound Rules
- Click on the security group
- Go to "Inbound rules" tab
- Click "Edit inbound rules"

### 4. Add PostgreSQL Rule
- Click "Add rule"
- Type: `PostgreSQL`
- Protocol: `TCP`
- Port range: `5432`
- Source: `0.0.0.0/0` (for testing - you can restrict this later)
- Description: `PostgreSQL access for database restoration`

### 5. Save Rules
- Click "Save rules"

### 6. Test Again
Once you've added the rule, run the restoration script again:
```bash
python3 final_restoration.py
```

## Alternative: Quick Test
You can also test the connection with:
```bash
telnet edsteward-db.cwv4g6g0yzmg.us-east-1.rds.amazonaws.com 5432
```

If it connects, you'll see "Connected to..." - then you can run the restoration script. 