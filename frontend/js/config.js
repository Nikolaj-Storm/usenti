// frontend/js/config.js

// FORCE LIVE CONFIGURATION
const APP_CONFIG = {
  // Always point to the live Render backend
  API_BASE_URL: 'https://usenti-2-0.onrender.com',
  
  // New unique keys to clear out any old "ghost" sessions
  STORAGE_KEYS: {
    TOKEN: 'usenti_live_token',
    USER: 'usenti_live_user'
  },
  
  ENDPOINTS: {
    AUTH_SIGNUP: '/api/auth/signup',
    AUTH_LOGIN: '/api/auth/login',
    AUTH_LOGOUT: '/api/auth/logout',
    AUTH_ME: '/api/auth/me', // Critical for security check
    EMAIL_ACCOUNTS: '/api/email-accounts',
    EMAIL_ACCOUNTS_TEST: '/api/email-accounts/test',
    CONTACT_LISTS: '/api/contact-lists',
    CONTACTS: '/api/contacts',
    CONTACTS_IMPORT: '/api/contact-lists/:id/import',
    CAMPAIGNS: '/api/campaigns',
    DASHBOARD_STATS: '/api/dashboard/stats',
    AUTH_FORGOT_PASSWORD: '/api/auth/forgot-password',
    AUTH_RESET_PASSWORD: '/api/auth/reset-password'
  }
};
