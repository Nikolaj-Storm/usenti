# Mr. Snowman - Setup Guide

Complete setup guide for deploying your email outreach SaaS platform.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup (Supabase)](#database-setup-supabase)
3. [Backend Setup (Render)](#backend-setup-render)
4. [Frontend Setup (GitHub Pages)](#frontend-setup-github-pages)
5. [Configuration](#configuration)
6. [Testing](#testing)
7. [Deployment](#deployment)

---

## Prerequisites

Before you begin, ensure you have:

- [Node.js](https://nodejs.org/) (v18 or higher)
- A [Supabase](https://supabase.com/) account
- A [Render](https://render.com/) account
- A GitHub account
- Git installed on your machine

---

## Database Setup (Supabase)

### 1. Create a Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in project details and wait for it to initialize

### 2. Run Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Open the file `backend/database/schema.sql`
3. Copy the entire contents
4. Paste into the SQL Editor and click "Run"
5. Wait for all tables to be created

### 3. Get Your Credentials

From your Supabase project settings:

1. Go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key**
   - **service_role key** (keep this secret!)

---

## Backend Setup (Render)

### 1. Generate Encryption Key

Run this command locally to generate your encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output - you'll need it for environment variables.

### 2. Deploy to Render

#### Option A: Deploy from GitHub (Recommended)

1. Push your code to GitHub
2. Go to [dashboard.render.com](https://dashboard.render.com)
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure the service:
   - **Name**: `snowman-backend` (or your choice)
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && node server.js`
   - **Instance Type**: Free (or paid for production)

#### Option B: Deploy Manually

```bash
# Install Render CLI
npm install -g render

# Login to Render
render login

# Deploy
render deploy
```

### 3. Set Environment Variables in Render

In your Render dashboard, go to **Environment** and add:

```
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-github-username.github.io/Snowman.2.0
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
ENCRYPTION_KEY=your-generated-64-char-hex-key
```

### 4. Get Your Backend URL

After deployment, Render will give you a URL like:
```
https://snowman-backend.onrender.com
```

Save this - you'll need it for the frontend configuration!

---

## Frontend Setup (GitHub Pages)

### 1. Update Configuration

Edit `frontend/js/config.js` and update the `API_BASE_URL`:

```javascript
API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001'
  : 'https://YOUR-RENDER-URL.onrender.com', // Replace with your actual Render URL
```

### 2. Update index.html API URL

Also update the API URL in `index.html` around line 87:

```javascript
const API_URL = 'https://YOUR-RENDER-URL.onrender.com/api';
```

### 3. Deploy to GitHub Pages

```bash
# Commit your changes
git add .
git commit -m "Configure production URLs"
git push origin main

# Enable GitHub Pages
# Go to your repo → Settings → Pages
# Source: Deploy from branch
# Branch: main
# Folder: / (root)
# Click Save
```

Your frontend will be available at:
```
https://your-username.github.io/Snowman.2.0/
```

---

## Configuration

### Backend Environment Variables

Create `backend/.env` for local development:

```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-anon-key-here
ENCRYPTION_KEY=your-64-character-hex-key-here
```

### CORS Configuration

The backend is configured to allow requests from:
- `localhost:3000` (development)
- Your GitHub Pages URL (production)
- Your custom domain (if configured)

If you need to add more origins, edit `backend/server.js`:

```javascript
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://your-username.github.io',
    'https://your-custom-domain.com' // Add your custom domain
  ],
  credentials: true
};
```

---

## Testing

### Test Locally

#### 1. Start Backend

```bash
cd backend
npm install
npm start
```

Backend will run on `http://localhost:3001`

#### 2. Start Frontend

Since the frontend is static, you can use any local server:

**Option A: Python**
```bash
python3 -m http.server 3000
```

**Option B: Node.js http-server**
```bash
npx http-server -p 3000
```

**Option C: VS Code Live Server**
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

#### 3. Test the Application

1. Go to `http://localhost:3000`
2. Sign up for a new account
3. Add an email account (use App Passwords for Gmail)
4. Import contacts (CSV)
5. Create a campaign
6. Start the campaign
7. Monitor in the dashboard

### Test Production

1. Go to your GitHub Pages URL
2. Test signup/login
3. Verify backend connectivity
4. Test all major workflows

---

## Deployment Checklist

### Pre-Deployment

- [ ] Database schema deployed to Supabase
- [ ] Row Level Security (RLS) policies enabled
- [ ] Backend environment variables configured on Render
- [ ] Frontend API URLs point to production backend
- [ ] CORS configured correctly
- [ ] Encryption key generated and stored securely

### Post-Deployment

- [ ] Test user signup/login
- [ ] Test email account connection
- [ ] Test contact import
- [ ] Test campaign creation and execution
- [ ] Verify IMAP monitoring is working
- [ ] Check cron jobs (campaign executor, warmup engine)
- [ ] Monitor Render logs for errors
- [ ] Test email tracking (opens/clicks)

---

## Monitoring & Maintenance

### Render Logs

View logs in real-time:
```bash
# In Render dashboard → Your Service → Logs
```

Or via CLI:
```bash
render logs -f
```

### Supabase Monitoring

1. Go to Supabase Dashboard → **Database** → **Query Performance**
2. Monitor for slow queries
3. Check **Auth** → **Users** for user activity

### Cron Jobs

The backend runs two cron jobs:

1. **Campaign Executor**: Runs every 5 minutes
   - Processes scheduled campaign emails
   - Respects send windows and daily limits

2. **Warmup Engine**: Runs every hour
   - Sends warmup emails to seed addresses
   - Gradually increases sending volume

Monitor these in the Render logs.

---

## Troubleshooting

### Backend Issues

**Error: "SUPABASE_URL is not defined"**
- Ensure all environment variables are set in Render dashboard
- Restart the service after adding variables

**Error: "Connection refused"**
- Check if backend is running
- Verify Render service status
- Check for deployment errors in logs

**Error: "CORS policy"**
- Add your frontend URL to `corsOptions` in `backend/server.js`
- Redeploy backend

### Frontend Issues

**Error: "Failed to fetch"**
- Verify backend URL in `frontend/js/config.js`
- Check if backend is accessible (visit the URL)
- Check browser console for detailed errors

**Login not working**
- Check Supabase auth is enabled
- Verify JWT_SECRET is set
- Check backend logs for auth errors

### Email Issues

**Emails not sending**
- Verify SMTP credentials are correct
- Check if account is active
- Verify daily send limit not exceeded
- Check campaign status is "running"

**Warm-up not working**
- Add warmup seed addresses to `warmup_seeds` table
- Verify warmup config is active
- Check Render logs for warmup engine execution

---

## Advanced Configuration

### Custom Domain

#### Frontend (GitHub Pages)
1. Go to repo Settings → Pages
2. Add your custom domain
3. Configure DNS:
   - CNAME record: `www` → `username.github.io`
   - A records for apex domain (check GitHub docs)

#### Backend (Render)
1. Go to Render dashboard → Your Service → Settings
2. Add custom domain
3. Follow DNS configuration instructions

### Email Provider Setup

#### Gmail
1. Enable 2FA
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use app password in Mr. Snowman

#### Outlook/Office 365
- Use regular email and password
- May need to enable "less secure apps" or app-specific password

#### Custom SMTP
- Get SMTP/IMAP details from your provider
- Enter manually when adding email account

### Scaling

#### Render
- Upgrade to paid plan for:
  - No cold starts
  - More memory/CPU
  - Better performance

#### Supabase
- Monitor database usage
- Add indexes for slow queries
- Upgrade plan if needed

#### Rate Limiting
- Adjust in `backend/.env`:
  ```
  RATE_LIMIT_WINDOW_MS=900000
  RATE_LIMIT_MAX_REQUESTS=100
  ```

---

## Security Best Practices

1. **Never commit `.env` files** - they contain secrets!
2. **Use strong encryption key** - 64 characters, randomly generated
3. **Enable RLS in Supabase** - already done in schema
4. **Use HTTPS only** - GitHub Pages and Render provide this
5. **Rotate credentials** periodically
6. **Monitor logs** for suspicious activity
7. **Keep dependencies updated**: `npm audit fix`

---

## Need Help?

- Check backend logs in Render dashboard
- Check browser console for frontend errors
- Review Supabase logs for database issues
- Verify all environment variables are set correctly

---

## Next Steps

Now that your application is set up:

1. **Add warmup seed addresses** (optional but recommended)
2. **Create your first campaign**
3. **Monitor performance** in the dashboard
4. **Scale as needed** based on usage

Happy outreaching! 🎯
