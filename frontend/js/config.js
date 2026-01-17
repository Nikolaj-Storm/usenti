// Mr. Snowman - Configuration

// Auto-detect environment and set API URL
const getApiBaseUrl = () => {
  // If running on GitHub Pages
  if (window.location.hostname.includes('github.io')) {
    return 'https://snowman-2-0.onrender.com';
  }

  // Local development
  return 'http://localhost:3000';
};

const APP_CONFIG = {
  API_BASE_URL: getApiBaseUrl(),
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
    CONTACTS_IMPORT: '/api/contact-lists/:id/import',
    CAMPAIGNS: '/api/campaigns',
    DASHBOARD_STATS: '/api/dashboard/stats'
  }
};
