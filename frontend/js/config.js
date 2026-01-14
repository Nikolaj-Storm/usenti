// ============================================================================
// Mr. Snowman - Frontend Configuration
// ============================================================================

const APP_CONFIG = {
  // API Configuration
  // For production (GitHub Pages), use your Render backend URL
  // For local development, use localhost
  API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : 'https://snowman-2-0.onrender.com', // Update with your actual Render URL

  // Local Storage Keys
  STORAGE_KEYS: {
    TOKEN: 'mr_snowman_token',
    USER: 'mr_snowman_user',
    REFRESH_TOKEN: 'mr_snowman_refresh_token'
  },

  // App Settings
  APP_NAME: 'Mr. Snowman',
  APP_VERSION: '2.0.0',

  // Pagination
  DEFAULT_PAGE_SIZE: 25,

  // Campaign Settings
  MAX_CAMPAIGN_STEPS: 10,
  DEFAULT_DAILY_LIMIT: 500,
  DEFAULT_SEND_SCHEDULE: {
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    startHour: 9,
    endHour: 17
  },

  // Email Account Types
  EMAIL_PROVIDERS: {
    gmail: {
      name: 'Gmail',
      imapHost: 'imap.gmail.com',
      imapPort: 993,
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      instructions: 'Use an App Password for Gmail. Generate one at: https://myaccount.google.com/apppasswords'
    },
    outlook: {
      name: 'Outlook',
      imapHost: 'outlook.office365.com',
      imapPort: 993,
      smtpHost: 'smtp.office365.com',
      smtpPort: 587,
      instructions: 'Use your regular Outlook password'
    },
    custom: {
      name: 'Custom SMTP/IMAP',
      instructions: 'Enter your custom SMTP and IMAP server details'
    }
  },

  // Warm-up Settings
  WARMUP_DEFAULTS: {
    dailyWarmupVolume: 1000,
    currentDailyVolume: 50,
    rampupIncrement: 50,
    repliesPerThread: 20
  },

  // API Endpoints
  ENDPOINTS: {
    // Auth
    AUTH_SIGNUP: '/api/auth/signup',
    AUTH_LOGIN: '/api/auth/login',
    AUTH_LOGOUT: '/api/auth/logout',

    // Email Accounts
    EMAIL_ACCOUNTS: '/api/email-accounts',
    EMAIL_ACCOUNTS_TEST: '/api/email-accounts/test',

    // Contacts
    CONTACT_LISTS: '/api/contact-lists',
    CONTACTS: '/api/contacts',
    CONTACTS_IMPORT: '/api/contacts/import',

    // Campaigns
    CAMPAIGNS: '/api/campaigns',
    CAMPAIGN_STEPS: '/api/campaign-steps',
    CAMPAIGN_START: '/api/campaigns/:id/start',
    CAMPAIGN_PAUSE: '/api/campaigns/:id/pause',
    CAMPAIGN_STATS: '/api/campaigns/:id/stats',

    // Dashboard
    DASHBOARD_STATS: '/api/dashboard/stats',

    // Events
    EMAIL_EVENTS: '/api/email-events',
    TRACK_OPEN: '/api/track/open/:trackingId',
    TRACK_CLICK: '/api/track/click/:trackingId'
  }
};

// Helper function to build full API URLs
APP_CONFIG.getApiUrl = function(endpoint) {
  return this.API_BASE_URL + endpoint;
};

// Helper function to replace URL parameters
APP_CONFIG.buildEndpoint = function(endpoint, params = {}) {
  let url = endpoint;
  Object.keys(params).forEach(key => {
    url = url.replace(`:${key}`, params[key]);
  });
  return url;
};
