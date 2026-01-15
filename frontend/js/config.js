// Mr. Snowman - Configuration

const APP_CONFIG = {
  API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : 'https://snowman-2-0.onrender.com',
  STORAGE_KEYS: {
    TOKEN: 'mr_snowman_token',
    USER: 'mr_snowman_user'
  },
  ENDPOINTS: {
    AUTH_SIGNUP: '/api/auth/signup',
    AUTH_LOGIN: '/api/auth/login',
    AUTH_LOGOUT: '/api/auth/logout',
    EMAIL_ACCOUNTS: '/api/email-accounts',
    EMAIL_ACCOUNTS_TEST: '/api/email-accounts/test',
    CONTACT_LISTS: '/api/contact-lists',
    CONTACTS: '/api/contacts',
    CONTACTS_IMPORT: '/api/contacts/import',
    CAMPAIGNS: '/api/campaigns',
    CAMPAIGN_STEPS: '/api/campaign-steps',
    DASHBOARD_STATS: '/api/dashboard/stats'
  }
};
