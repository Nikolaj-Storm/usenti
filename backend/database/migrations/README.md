# Database Migrations

This directory contains SQL migration scripts to update your database schema.

## How to Run Migrations

### Option 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase project: https://app.supabase.com
2. Navigate to the SQL Editor
3. Copy the contents of the migration file you want to run
4. Paste it into the SQL Editor
5. Click "Run" to execute the migration

### Option 2: Using psql Command Line

If you have direct access to your PostgreSQL database:

```bash
psql -h your-db-host -U your-username -d your-database -f migrations/002_update_account_type_constraint.sql
```

### Option 3: Using Supabase CLI

```bash
supabase db execute --file migrations/002_update_account_type_constraint.sql
```

## Migration History

### 002_update_account_type_constraint.sql

**Date:** 2026-01-18
**Purpose:** Updates the `account_type` check constraint to support all email providers

**Why this is needed:**
- The original constraint only allowed 'gmail', 'outlook', 'custom'
- The application now supports 'zoho', 'aws_workmail', and 'stalwart'
- Fixes error: "new row for relation "email_accounts" violates check constraint"

**Safe to run:** Yes - Drops and recreates the constraint with all supported types

### 001_add_warmup_enabled.sql (DEPRECATED - DO NOT RUN)

**Date:** 2026-01-18
**Purpose:** Adds the `warmup_enabled` column to the `email_accounts` table

**Status:** DEPRECATED - This migration is no longer needed as `warmup_enabled` has been removed from the application in favor of the `warmup_configs` table and `is_warming_up` flag.

## Best Practices

1. **Always backup your database** before running migrations
2. **Test migrations** on a development/staging database first
3. **Run migrations in order** (001, 002, 003, etc.)
4. **Read the migration file** before executing to understand what it does
5. **Keep track of which migrations** you've run

## Creating New Migrations

When creating new migrations:

1. Name them sequentially: `00X_description.sql`
2. Include a comment block explaining the purpose
3. Use conditional logic (IF EXISTS, IF NOT EXISTS) to make them idempotent
4. Test thoroughly before committing

## Rollback

If you need to rollback a migration:

1. Check if there's a corresponding rollback file (e.g., `001_rollback.sql`)
2. If not, manually write the reverse SQL (e.g., `ALTER TABLE ... DROP COLUMN ...`)
3. Always test rollbacks on a copy of your database first

## Support

For issues with migrations, please:
1. Check the migration file comments for specific instructions
2. Review the main schema.sql file for context
3. Open an issue on GitHub if you encounter problems
