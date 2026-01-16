// Mr. Snowman - Configuration

const APP_CONFIG = {
  API_BASE_URL: 'http://localhost:3000',
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
