# Mr. Snowman 🎯

**Email Outreach Automation Platform**

A full-stack SaaS application for automating email campaigns with multi-step sequences, domain warm-up, and real-time analytics.

## Features

- 📧 **Multi-Step Campaigns** - Create sophisticated email sequences with delays and conditionals
- 🔥 **Domain Warm-Up** - Gradually build sender reputation with automated warm-up
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

### 1. Clone Repository

```bash
git clone https://github.com/Nikolaj-Storm/Snowman.2.0.git
cd Snowman.2.0
```

### 2. Set Up Database

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL in `backend/database/schema.sql` in the Supabase SQL Editor
3. Get your API credentials from Project Settings → API

### 3. Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your Supabase credentials
npm install
npm start
```

### 4. Configure Frontend

Update `frontend/js/config.js` with your backend URL:

```javascript
API_BASE_URL: 'http://localhost:3001'  // or your production URL
```

### 5. Run Frontend

```bash
# Serve the root directory
python3 -m http.server 3000
# or
npx http-server -p 3000
```

Visit `http://localhost:3000`

## Deployment

See **[SETUP.md](./SETUP.md)** for complete deployment instructions including:
- Supabase database setup
- Render backend deployment
- GitHub Pages frontend deployment
- Environment variable configuration
- DNS and custom domain setup

## Project Structure

```
Snowman.2.0/
├── backend/
│   ├── config/           # Configuration files
│   ├── controllers/      # Route handlers
│   ├── database/         # Database schema
│   ├── middleware/       # Express middleware
│   ├── routes/           # API routes
│   ├── services/         # Business logic (campaigns, warmup, IMAP)
│   ├── utils/            # Helper functions
│   ├── server.js         # Entry point
│   └── package.json
│
├── frontend/
│   ├── js/
│   │   ├── components/   # React components
│   │   ├── utils/        # Frontend utilities
│   │   ├── api.js        # API service layer
│   │   ├── auth.js       # Authentication
│   │   ├── app.js        # Main app component
│   │   └── config.js     # Frontend config
│   └── index.html        # Single-page app
│
├── index.html            # Main entry point
├── README.md             # This file
└── SETUP.md              # Detailed setup guide
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

```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key
ENCRYPTION_KEY=your-64-char-hex-key
```

Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Development

### Run Tests

```bash
cd backend
npm test
```

### Lint Code

```bash
npm run lint
```

### Watch Mode

```bash
npm run dev  # Uses nodemon for auto-restart
```

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
