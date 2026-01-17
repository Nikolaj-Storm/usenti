// frontend/js/config.js

// Auto-detect environment and set API URL
const getApiBaseUrl = () => {
  if (window.location.hostname.includes('github.io')) {
    return 'https://snowman-2-0.onrender.com';
  }
  return 'http://localhost:3000';
};

const APP_CONFIG = {
  API_BASE_URL: getApiBaseUrl(),
  STORAGE_KEYS: {
    // Renamed to avoid collisions with other localhost projects
    TOKEN: 'snowman_v2_token',
    USER: 'snowman_v2_user'
  },
  ENDPOINTS: {
    AUTH_SIGNUP: '/api/auth/signup',
    AUTH_LOGIN: '/api/auth/login',
    AUTH_LOGOUT: '/api/auth/logout',
    AUTH_ME: '/api/auth/me', // Added for session verification
    EMAIL_ACCOUNTS: '/api/email-accounts',
    EMAIL_ACCOUNTS_TEST: '/api/email-accounts/test',
    CONTACT_LISTS: '/api/contact-lists',
    CONTACTS: '/api/contacts',
    CONTACTS_IMPORT: '/api/contact-lists/:id/import',
    CAMPAIGNS: '/api/campaigns',
    DASHBOARD_STATS: '/api/dashboard/stats'
  }
};
