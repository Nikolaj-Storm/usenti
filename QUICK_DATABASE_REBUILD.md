# ⚡ Quick Database Rebuild - 2 Steps Only

## What You Need:
1. Supabase Dashboard access: https://app.supabase.com
2. The `schema.sql` file from this repo
3. 5 minutes

---

## Step 1: Delete Everything (Copy & Run This)

Go to **Supabase SQL Editor** and run:

```sql
-- DELETE ALL TABLES AND DATA
DROP TABLE IF EXISTS warmup_messages CASCADE;
DROP TABLE IF EXISTS warmup_threads CASCADE;
DROP TABLE IF EXISTS warmup_seeds CASCADE;
DROP TABLE IF EXISTS warmup_configs CASCADE;
DROP TABLE IF EXISTS email_events CASCADE;
DROP TABLE IF EXISTS campaign_contacts CASCADE;
DROP TABLE IF EXISTS campaign_steps CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS contact_lists CASCADE;
DROP TABLE IF EXISTS email_accounts CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
```

✅ Click **RUN** → Wait for "Success"

---

## Step 2: Rebuild Everything

1. Open: `backend/database/schema.sql`
2. Copy **ALL 450 lines**
3. Paste into Supabase SQL Editor
4. Click **RUN**

✅ Wait for "Success. No rows returned"

---

## Step 3: Test It Works

1. Go to: https://nikolaj-storm.github.io/Snowman.2.0/
2. Press F12 → Console → Type: `localStorage.clear()` → Enter
3. Refresh page
4. Sign up with a new account
5. Go to Infrastructure → Add Email Account
6. Try adding a Zoho account

✅ If it works without errors, you're done!

---

## Quick Verification

Run this to verify the trigger exists:

```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

Should return: `on_auth_user_created | users`

---

**That's it! Your database is now clean and fully functional.**

For detailed troubleshooting, see: `DATABASE_REBUILD_GUIDE.md`
