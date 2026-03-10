# Beta Database Isolation Guide

*Created: January 13, 2025*  
*Purpose: Complete data isolation for beta.edsteward.ai*

## 🚨 **CRITICAL: Current State**

**⚠️ WARNING**: The current beta deployment (`http://3.84.2.82:3000`) is **sharing the production database**. This means:

- Testing in beta could corrupt production data
- Data changes in beta affect production users
- Authentication uses the same user accounts as production

**🎯 GOAL**: Create complete isolation with separate Neon database for beta testing.

## 📋 **Prerequisites**

- ✅ Beta ECS infrastructure already deployed
- ✅ Neon account with ability to create new databases
- ✅ PostgreSQL client tools installed (`psql`, `pg_dump`)
- ✅ AWS CLI configured with appropriate permissions

## 🗄️ **Step 1: Create New Neon Database**

### 1.1 Create New Neon Project

1. Go to [Neon Console](https://console.neon.tech/)
2. Click "Create Project"
3. **Project Name**: `edsteward-beta`
4. **Region**: `us-east-2` (same as production)
5. **Database Name**: `neondb` (automatically set by Neon)
6. **PostgreSQL Version**: Latest (15+)

### 1.2 Get Connection String

1. Navigate to your new project dashboard
2. Click "Connection String"
3. Copy the connection string
4. **Format**: `postgresql://username:password@host:port/database?sslmode=require`

**Example**:

```
postgresql://edsteward_beta_owner:new_password@ep-beta-term-xyz.us-east-2.aws.neon.tech:5432/neondb?sslmode=require
```

## 🔧 **Step 2: Set Up Isolated Database**

### 2.1 Run Database Setup Script

```bash
# Update the script with your new database URL first
vim scripts/setup-beta-database.sh

# Then run the setup
./scripts/setup-beta-database.sh
```

### 2.2 What the Script Does

1. **Exports production schema** - Table structure only
2. **Exports sample data** - Safe subset for testing:
   - First 5 users for authentication testing
   - First 50 regulations for functionality testing
   - All reference data (tenants, institution settings)
3. **Creates isolated database** - Imports schema and data
4. **Verifies setup** - Confirms data integrity

### 2.3 Expected Results

After successful setup:

- **Beta database contains**: ~5 users, ~50 regulations
- **Production database unchanged**: 21 users, 354 regulations
- **Complete isolation**: No shared data or connections

## 🔄 **Step 3: Update Beta Deployment**

### 3.1 Update Beta Configuration

```bash
# Run the update script
./scripts/update-beta-database.sh
```

### 3.2 What the Update Does

1. **Prompts for new database URL** - Enter your Neon beta URL
2. **Tests database connection** - Verifies URL is valid
3. **Updates task definition** - Replaces DATABASE_URL
4. **Deploys to ECS** - Registers new task definition
5. **Waits for stability** - Ensures service is running
6. **Tests the service** - Verifies health and API

### 3.3 Expected Results

After successful update:

- **New beta IP address** - Different from previous deployment
- **Isolated database** - No connection to production
- **Independent authentication** - Separate user accounts

## 🧪 **Step 4: Verify Complete Isolation**

### 4.1 Test Database Separation

```bash
# Test production database (should show 21 users, 354 regulations)
psql "postgresql://neondb_owner:npg_foSr6ixkzw7W@ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech:5432/neondb?sslmode=require" -c "SELECT COUNT(*) FROM users, regulations;"

# Test beta database (should show ~5 users, ~50 regulations)
psql "YOUR_BETA_DATABASE_URL" -c "SELECT COUNT(*) FROM users, regulations;"
```

### 4.2 Test Authentication Isolation

1. **Production**: Login at `https://moravian.edsteward.ai` with `dvdbrnds/gabadhgabadh`
2. **Beta**: Login at `http://BETA_IP:3000` with beta user account

### 4.3 Test Data Isolation

1. **Create test regulation** in beta environment
2. **Verify it doesn't appear** in production environment
3. **Confirm complete separation**

## 📊 **Step 5: Database Comparison**

### Production Database

- **URL**: `moravian.edsteward.ai`
- **Users**: 21 (full user base)
- **Regulations**: 354 (complete dataset)
- **Purpose**: Live customer data
- **Risk**: HIGH - affects real users

### Beta Database  

- **URL**: `http://BETA_IP:3000`
- **Users**: ~5 (testing subset)
- **Regulations**: ~50 (testing subset)
- **Purpose**: Safe feature testing
- **Risk**: NONE - isolated testing

## 🔐 **Step 6: Authentication Strategy**

### Beta User Accounts

The beta database will contain a subset of production users:

- **Username**: `dvdbrnds` (same as production)
- **Password**: `gabadhgabadh` (same as production)
- **Purpose**: Testing authentication flows

### Key Differences

1. **Separate password hashes** - Changes in beta don't affect production
2. **Independent sessions** - Beta login doesn't affect production
3. **Isolated user data** - Profile changes only affect beta

## 🚀 **Step 7: Domain Setup (Optional)**

### 7.1 Set Up beta.edsteward.ai Domain

If you want a proper domain instead of IP access:

```bash
# Run ALB setup (creates load balancer)
./scripts/setup-beta-alb.sh

# Then configure DNS
# Point beta.edsteward.ai to ALB DNS name
```

### 7.2 SSL Certificate

1. Request certificate for `beta.edsteward.ai`
2. Configure ALB to use HTTPS
3. Test secure access

## 🔧 **Troubleshooting**

### Common Issues

1. **Database connection fails**
   - Check Neon database is running
   - Verify connection string format
   - Ensure network access allowed

2. **ECS service won't start**
   - Check CloudWatch logs for errors
   - Verify task definition is valid
   - Ensure IAM permissions are correct

3. **API returns empty data**
   - Verify data was imported correctly
   - Check database schema matches production
   - Ensure migrations ran successfully

### Debug Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster edsteward-beta-cluster --services edsteward-beta-service

# Check task logs
aws logs get-log-events --log-group-name "/aws/ecs/edsteward-beta" --log-stream-name "STREAM_NAME"

# Test database connection
psql "YOUR_BETA_DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
```

## 📝 **Summary**

### Before Isolation

- ❌ Shared production database
- ❌ Risk of data corruption
- ❌ Testing affects real users
- ❌ No safe testing environment

### After Isolation

- ✅ Separate Neon database
- ✅ Complete data isolation
- ✅ Safe feature testing
- ✅ Independent authentication
- ✅ Zero risk to production

### Next Steps

1. **Test all functionality** in beta environment
2. **Implement feature flags** for gradual rollouts
3. **Set up monitoring** for beta environment
4. **Document testing procedures** for team use

---

**🎉 Result**: You now have a completely isolated beta environment at `beta.edsteward.ai` with its own database, users, and data - perfect for safe feature testing without any risk to production!
