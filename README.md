# Mr. Snowman 🎯

**Email Outreach Automation Platform**

A full-stack SaaS application for automating email campaigns with multi-step sequences and real-time analytics.

## Features

- 📧 **Multi-Step Campaigns** - Create sophisticated email sequences with delays and conditionals
- 📊 **Real-Time Analytics** - Track opens, clicks, and replies
- 👥 **Contact Management** - Import contacts via CSV with field mapping
- ⚙️ **Multi-Inbox Support** - Gmail, Outlook, and custom SMTP/IMAP
- 🎯 **Smart Scheduling** - Send during business hours with daily limits
- 🔍 **Reply Detection** - Automatic campaign pause on reply
- 📈 **Beautiful Dashboard** - Monitor all your campaigns in one place

## Tech Stack

### Backend
- **Node.js + Express** - RESTful API
- **Supabase (PostgreSQL)** - Database with Row Level Security
- **Nodemailer** - Email sending
- **Node-IMAP** - Reply detection
- **Node-Cron** - Scheduled tasks

### Frontend
- **React** (via CDN) - UI framework
- **TailwindCSS** - Styling
- **Recharts** - Analytics visualizations

### Infrastructure
- **Render** - Backend hosting
- **GitHub Pages** - Frontend hosting
- **Supabase** - Database hosting

## Quick Start



## Project Structure

```
Snowman.2.0/
├── backend/
│   ├── config/
│   │   └── supabase.js          # Supabase client configuration
│   ├── database/
│   │   ├── schema.sql           # Complete database schema
│   │   ├── migrations/          # Schema migration scripts
│   │   └── *.sql                # Cleanup and verification scripts
│   ├── middleware/
│   │   └── auth.js              # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js              # Auth endpoints
│   │   ├── campaigns.js         # Campaign management
│   │   ├── contacts.js          # Contact lists
│   │   ├── emailAccounts.js     # Email account config
│   ├── services/
│   │   ├── emailService.js      # Email sending with tracking
│   │   ├── campaignExecutor.js  # Campaign automation (cron)
│   │   └── imapMonitor.js       # Reply detection (real-time)
│   ├── utils/
│   │   ├── encryption.js        # AES-256 password encryption
│   │   └── emailTemplates.js    # Email template utilities
│   ├── server.js                # Main Express server & entry point
│   └── package.json             # Backend dependencies & scripts
│
├── frontend/
│   ├── js/
│   │   ├── components/
│   │   │   ├── auth.js          # Login/signup
│   │   │   ├── campaigns.js     # Campaign management UI
│   │   │   ├── dashboard.js     # Analytics dashboard
│   │   │   ├── contacts.js      # Contact management
│   │   │   ├── emailAccounts.js # Email account setup
│   │   │   └── landing.js       # Landing page
│   │   ├── api.js               # API service layer
│   │   ├── app.js               # Main React application
│   │   ├── config.js            # Frontend configuration
│   │   └── icons.js             # Icon components
│   └── index.html               # Frontend entry point
│
├── index.html                   # Root HTML file
├── vite.config.ts               # Vite build configuration
├── package.json                 # Root package.json (Vite)
├── README.md                    # This file
└── SETUP.md                     # Detailed deployment guide
```

## Usage

### 1. Sign Up / Login

Create an account or sign in to access the dashboard.

### 2. Add Email Account

Go to **Infrastructure** and add your email account:
- For Gmail: Use an [App Password](https://myaccount.google.com/apppasswords)
- For Outlook: Use your regular password
- For custom: Enter SMTP/IMAP details

### 3. Import Contacts

Go to **Contacts** and:
1. Create a new contact list
2. Click "Import CSV"
3. Map CSV columns to contact fields
4. Import

### 4. Create Campaign

Go to **Campaigns** and:
1. Click "New Campaign"
2. Name your campaign
3. Select email account and contact list
4. Add email steps with personalization (e.g., `{{firstName}}`)
5. Add delays between steps
6. Configure send schedule
7. Start campaign!

### 5. Monitor Performance

View real-time analytics in the **Dashboard**:
- Total sent, open rate, click rate, reply rate
- Campaign performance over time
- Email account health scores
- Active campaigns

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out

### Email Accounts
- `GET /api/email-accounts` - List accounts
- `POST /api/email-accounts` - Add account
- `POST /api/email-accounts/test` - Test connection

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `POST /api/campaigns/:id/start` - Start campaign
- `GET /api/campaigns/:id/stats` - Get stats

### Contacts
- `GET /api/contact-lists` - List contact lists
- `POST /api/contacts/import` - Import CSV

See backend code for complete API documentation.

## Environment Variables

### Backend (.env)

Create `backend/.env` with the following variables:

```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here
SUPABASE_ANON_KEY=your-anon-key-here

# Email Password Encryption (AES-256)
ENCRYPTION_KEY=your-64-char-hex-key-here
```

**Generate encryption key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This generates a secure 64-character hexadecimal key used by `utils/encryption.js` to encrypt SMTP/IMAP passwords in the database.

### Frontend Configuration

Edit `frontend/js/config.js`:

```javascript
export const API_BASE_URL = 'http://localhost:3001';  // or your production URL
```

### Production Environment

For production deployment (Render, etc.), set:

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-github-pages-url
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key
ENCRYPTION_KEY=your-generated-key
```

## Scripts Reference

### Backend Scripts

#### NPM Scripts (backend/package.json)

```bash
npm start          # Start production server
npm run dev        # Start development server with auto-reload (nodemon)
```

#### Core Services

**server.js** - Main Express Server
- RESTful API server with authentication
- CORS configuration for GitHub Pages
- Health check endpoint at `/health`
- Scheduled cron jobs for campaign execution (every 5 min)
- IMAP monitoring for reply detection
- Entry point: `node backend/server.js`

**services/emailService.js** - Email Sending Service
- Manages SMTP transporter connections with caching
- Email personalization with template variables ({{first_name}}, etc.)
- Open/click tracking pixel injection
- Schedule validation and daily limit checking
- Comprehensive logging for debugging

**services/campaignExecutor.js** - Campaign Execution Engine
- Processes pending campaign contacts (runs every 5 minutes via cron)
- Multi-step campaign flow handling (email, wait, condition steps)
- Send schedule validation (business hours, daily limits)
- Email personalization and tracking
- Manual trigger available at `POST /api/campaigns/executor/trigger`

**services/imapMonitor.js** - IMAP Reply Detection
- Real-time monitoring of all active email accounts
- Detects campaign replies and updates contact status
- Auto-starts on server launch
- Graceful shutdown on SIGTERM/SIGINT

**utils/encryption.js** - Password Encryption
- AES-256-CBC encryption for email passwords
- Secure key derivation from environment variable
- Used to protect SMTP/IMAP credentials in database

### Frontend Scripts

#### NPM Scripts (package.json)

```bash
npm run dev        # Start Vite dev server (port 3000)
npm run build      # Build for production
npm run preview    # Preview production build
```

#### Application Files

**frontend/js/app.js** - Main React Application
- Single-page application router
- Component orchestration
- State management

**frontend/js/api.js** - API Service Layer
- Centralized HTTP client
- JWT token management
- Error handling

**frontend/js/config.js** - Frontend Configuration
- API base URL configuration
- Environment-specific settings

**frontend/js/components/** - React Components
- `auth.js` - Login/signup forms
- `campaigns.js` - Campaign management UI
- `dashboard.js` - Analytics dashboard
- `contacts.js` - Contact list management
- `emailAccounts.js` - Email account configuration
- `landing.js` - Landing page

**frontend/js/icons.js** - SVG Icon Components
- Lucide icon set wrapped for React

### Configuration Files

**vite.config.ts** - Vite Build Configuration
- Dev server on port 3000
- Gemini API key injection
- Path aliases
- TypeScript support

### Database Scripts

**backend/database/schema.sql** - Complete Database Schema
- All table definitions with RLS policies
- User profiles, email accounts, campaigns
- Contact lists
- Email events tracking

**backend/database/migrations/** - Schema Migrations
- Version-controlled database changes
- Run in order by number prefix
- `002_update_account_type_constraint.sql` - Update email account types
- `003_add_email_to_user_profiles.sql` - User profile email field
- `004_add_name_and_email_to_user_profiles.sql` - User name field

**backend/database/cleanup_all_users.sql** - User Data Cleanup
- Removes all user data (use with caution)

**backend/database/verify_and_cleanup.sql** - Data Verification
- Validates database integrity

### Automated Background Processes

The server automatically runs several background processes:

**Campaign Executor** (Every 5 minutes)
- Processes pending campaign contacts
- Sends scheduled emails
- Handles multi-step sequences
- Respects send schedules and daily limits
- Manually trigger: `POST /api/campaigns/executor/trigger`

**IMAP Monitor** (Continuous)
- Monitors all active email accounts in real-time
- Detects campaign replies automatically
- Updates contact status on reply
- Auto-starts when server launches

These processes are essential for the platform's operation and start automatically with `npm start`.

## Development

### Run Backend

```bash
cd backend
npm install
npm run dev        # Uses nodemon for auto-restart
```

### Run Frontend

```bash
npm install
npm run dev        # Starts Vite dev server
```

### Manual Script Execution

```bash
# Start campaign executor manually
node backend/server.js
# Then trigger via API: POST /api/campaigns/executor/trigger

# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Monitoring and Logs

The backend services provide comprehensive logging for debugging and monitoring:

### Log Prefixes

- `[EXECUTOR]` - Campaign execution engine
- `[IMAP]` - IMAP reply monitoring
- `[EMAIL]` - Email sending service
- `[CRON]` - Scheduled cron jobs
- `[API]` - API request logs
- `[CONTACTS]` - Contact management

### Monitoring Campaign Execution

```bash
# Watch server logs in real-time
npm run dev

# Check if campaigns are running
curl http://localhost:3001/health

# Manually trigger campaign executor
curl -X POST http://localhost:3001/api/campaigns/executor/trigger \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Common Log Messages

- **Campaign Executor**: Runs every 5 minutes, logs pending contacts and send status
- **IMAP Monitor**: Logs connection status and new message detection
- **Email Service**: Detailed SMTP connection and send logs

### Debugging Tips

1. Check server logs for `[EXECUTOR]` messages to see campaign execution
2. Look for `✅` (success) and `❌` (error) indicators in logs
3. IMAP connection issues show as `[IMAP] ✗ Error`
4. Email send failures include error codes and messages
5. Health check endpoint provides server status: `GET /health`

## Security

- ✅ Row Level Security (RLS) enabled in Supabase
- ✅ Email passwords encrypted with AES-256
- ✅ JWT authentication
- ✅ CORS configured
- ✅ Rate limiting
- ✅ Input validation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved.

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Built with ❄️ by Mr. Snowman**
