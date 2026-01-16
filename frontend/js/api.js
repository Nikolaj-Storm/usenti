// Mr. Snowman - API Service Layer

const api = {
  async request(endpoint, options = {}) {
    const url = APP_CONFIG.API_BASE_URL + endpoint;
    const token = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    if (token && !options.skipAuth) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Unauthorized - clear auth and reload
          localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
          localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER);
          window.location.reload();
        }
        throw new Error(data.error || data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  async get(endpoint, options = {}) {
    return this.request(endpoint, { method: 'GET', ...options });
  },

  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options
    });
  },

  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options
    });
  },

  async delete(endpoint, options = {}) {
    return this.request(endpoint, { method: 'DELETE', ...options });
  },

  // Authentication
  async signup(email, password, name) {
    const response = await this.post(
      APP_CONFIG.ENDPOINTS.AUTH_SIGNUP,
      { email, password, name },
      { skipAuth: true }
    );

    if (response.session?.access_token) {
      localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TOKEN, response.session.access_token);
      localStorage.setItem(APP_CONFIG.STORAGE_KEYS.USER, JSON.stringify(response.user));
    }

    return response;
  },

  async login(email, password) {
    const response = await this.post(
      APP_CONFIG.ENDPOINTS.AUTH_LOGIN,
      { email, password },
      { skipAuth: true }
    );

    if (response.session?.access_token) {
      localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TOKEN, response.session.access_token);
      localStorage.setItem(APP_CONFIG.STORAGE_KEYS.USER, JSON.stringify(response.user));
    }

    return response;
  },

  async logout() {
    try {
      await this.post(APP_CONFIG.ENDPOINTS.AUTH_LOGOUT);
    } finally {
      localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
      localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER);
    }
  },

  // Email Accounts
  async getEmailAccounts() {
    return this.get(APP_CONFIG.ENDPOINTS.EMAIL_ACCOUNTS);
  },

  async createEmailAccount(accountData) {
    return this.post(APP_CONFIG.ENDPOINTS.EMAIL_ACCOUNTS, accountData);
  },

  async testEmailAccount(accountData) {
    return this.post(APP_CONFIG.ENDPOINTS.EMAIL_ACCOUNTS_TEST, accountData);
  },

  // Contact Lists
  async getContactLists() {
    return this.get(APP_CONFIG.ENDPOINTS.CONTACT_LISTS);
  },

  async createContactList(name, description = '') {
    return this.post(APP_CONFIG.ENDPOINTS.CONTACT_LISTS, { name, description });
  },

  // Contacts
  async getContacts(listId) {
    return this.get(`${APP_CONFIG.ENDPOINTS.CONTACTS}?listId=${listId}`);
  },

  async importContacts(listId, contacts) {
    return this.post(
      APP_CONFIG.ENDPOINTS.CONTACTS_IMPORT.replace(':id', listId),
      { contacts }
    );
  },

  // Campaigns
  async getCampaigns() {
    return this.get(APP_CONFIG.ENDPOINTS.CAMPAIGNS);
  },

  async createCampaign(campaignData) {
    return this.post(APP_CONFIG.ENDPOINTS.CAMPAIGNS, campaignData);
  },

  async startCampaign(id) {
    return this.post(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${id}/start`);
  },

  async getCampaignStats(id) {
    return this.get(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${id}/stats`);
  },

  // Dashboard
  async getDashboardStats() {
    return this.get(APP_CONFIG.ENDPOINTS.DASHBOARD_STATS);
  }
};
