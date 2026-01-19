# 🎯 START HERE - Fresh Database Build

## You Want to Rebuild Your Database? Here's Everything You Need.

Your `schema.sql` file is **ready to go** with all fixes built in! 🎉

---

## 📁 Your schema.sql File Contains:

✅ **All 12 database tables:**
- `user_profiles` - User profile data
- `email_accounts` - Email account credentials and settings
- `contact_lists` - Contact list management
- `contacts` - Individual contact records
- `campaigns` - Email campaigns
- `campaign_steps` - Campaign email sequences
- `campaign_contacts` - Track individual contact progress
- `email_events` - Opens, clicks, replies tracking
- `warmup_configs` - Email warmup configuration
- `warmup_seeds` - Warmup network addresses
- `warmup_threads` - Warmup conversations
- `warmup_messages` - Individual warmup messages

✅ **The Critical Fix:**
- Auto-creates `user_profiles` when users sign up
- This was the bug preventing email account creation!

✅ **All Constraints:**
- Proper `account_type` check (gmail, outlook, zoho, aws_workmail, stalwart, custom)
- Foreign key relationships
- Unique constraints

✅ **Security:**
- Row Level Security (RLS) policies on all tables
- Users can only access their own data

✅ **Performance:**
- Indexes on frequently queried columns
- Auto-update triggers for `updated_at` timestamps

---

## 🚀 How to Use It (Choose Your Style)

### Option 1: Ultra-Fast (3 Steps)
📄 See: **`QUICK_DATABASE_REBUILD.md`**

Perfect for: Quick rebuilds, you know what you're doing

### Option 2: Complete Guide (Detailed)
📄 See: **`DATABASE_REBUILD_GUIDE.md`**

Perfect for: First time, want verification steps, detailed troubleshooting

---

## ⚡ The Absolute Fastest Way

1. **Delete old database:**
   - Go to Supabase SQL Editor
   - Copy from `QUICK_DATABASE_REBUILD.md` → Step 1
   - Run it

2. **Build new database:**
   - Copy **ALL** of `backend/database/schema.sql`
   - Paste in Supabase SQL Editor
   - Run it

3. **Test it:**
   - Sign up at https://nikolaj-storm.github.io/Snowman.2.0/
   - Add an email account
   - Done! ✅

---

## 📄 What Each File Does

| File | Purpose |
|------|---------|
| **`backend/database/schema.sql`** | The actual database schema - run this! |
| **`QUICK_DATABASE_REBUILD.md`** | Super fast 3-step guide |
| **`DATABASE_REBUILD_GUIDE.md`** | Complete detailed guide with troubleshooting |
| **`FIXES_APPLIED.md`** | Technical details of all fixes |
| **`QUICK_START_FIX_GUIDE.md`** | Old migration approach (ignore if rebuilding) |

---

## ✅ What Will Work After Rebuild

- ✅ Users can sign up
- ✅ User profiles are automatically created
- ✅ Email accounts can be added immediately after signup
- ✅ All email account types work (Gmail, Outlook, Zoho, etc.)
- ✅ No foreign key errors
- ✅ No constraint violations
- ✅ Proper RLS security
- ✅ No CORS errors from GitHub Pages

---

## 🎯 Next Steps

1. **Now:** Follow `QUICK_DATABASE_REBUILD.md` to rebuild your database
2. **Then:** Test by creating a user and adding an email account
3. **Deploy:** Push backend changes to Render (they're already committed)
4. **Monitor:** Use queries in `DATABASE_REBUILD_GUIDE.md` to check health

---

## 🆘 Need Help?

- **Quick questions?** Check `QUICK_DATABASE_REBUILD.md`
- **Errors?** See troubleshooting in `DATABASE_REBUILD_GUIDE.md`
- **Want technical details?** Read `FIXES_APPLIED.md`

---

**Status:** ✅ Ready to rebuild
**Time Needed:** 5 minutes
**Difficulty:** Easy ⭐

🚀 **Go to `QUICK_DATABASE_REBUILD.md` and get started!**
