// ============================================================================
// Mr. Snowman - API Service Layer
// ============================================================================
// Handles all HTTP requests to the backend API

const api = {
  // ============================================================================
  // Core HTTP Methods
  // ============================================================================

  async request(endpoint, options = {}) {
    const url = APP_CONFIG.getApiUrl(endpoint);
    const token = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // Add auth token if available
    if (token && !options.skipAuth) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Handle auth errors
        if (response.status === 401) {
          this.handleUnauthorized();
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

  // Special method for file uploads
  async upload(endpoint, formData, options = {}) {
    const url = APP_CONFIG.getApiUrl(endpoint);
    const token = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);

    const config = {
      method: 'POST',
      body: formData,
      headers: {},
      ...options
    };

    // Add auth token
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      return data;
    } catch (error) {
      console.error('Upload Error:', error);
      throw error;
    }
  },

  handleUnauthorized() {
    // Clear local storage
    localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER);
    localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);

    // Redirect to login (handled by app)
    window.location.reload();
  },

  // ============================================================================
  // Authentication
  // ============================================================================

  async signup(email, password) {
    const response = await this.post(APP_CONFIG.ENDPOINTS.AUTH_SIGNUP, {
      email,
      password
    }, { skipAuth: true });

    if (response.token) {
      localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TOKEN, response.token);
      localStorage.setItem(APP_CONFIG.STORAGE_KEYS.USER, JSON.stringify(response.user));
    }

    return response;
  },

  async login(email, password) {
    const response = await this.post(APP_CONFIG.ENDPOINTS.AUTH_LOGIN, {
      email,
      password
    }, { skipAuth: true });

    if (response.token) {
      localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TOKEN, response.token);
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
      localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
    }
  },

  // ============================================================================
  // Email Accounts
  // ============================================================================

  async getEmailAccounts() {
    return this.get(APP_CONFIG.ENDPOINTS.EMAIL_ACCOUNTS);
  },

  async createEmailAccount(accountData) {
    return this.post(APP_CONFIG.ENDPOINTS.EMAIL_ACCOUNTS, accountData);
  },

  async updateEmailAccount(id, accountData) {
    return this.put(`${APP_CONFIG.ENDPOINTS.EMAIL_ACCOUNTS}/${id}`, accountData);
  },

  async deleteEmailAccount(id) {
    return this.delete(`${APP_CONFIG.ENDPOINTS.EMAIL_ACCOUNTS}/${id}`);
  },

  async testEmailAccount(accountData) {
    return this.post(APP_CONFIG.ENDPOINTS.EMAIL_ACCOUNTS_TEST, accountData);
  },

  // ============================================================================
  // Contact Lists
  // ============================================================================

  async getContactLists() {
    return this.get(APP_CONFIG.ENDPOINTS.CONTACT_LISTS);
  },

  async createContactList(name, description = '') {
    return this.post(APP_CONFIG.ENDPOINTS.CONTACT_LISTS, { name, description });
  },

  async updateContactList(id, name, description = '') {
    return this.put(`${APP_CONFIG.ENDPOINTS.CONTACT_LISTS}/${id}`, { name, description });
  },

  async deleteContactList(id) {
    return this.delete(`${APP_CONFIG.ENDPOINTS.CONTACT_LISTS}/${id}`);
  },

  // ============================================================================
  // Contacts
  // ============================================================================

  async getContacts(listId) {
    return this.get(`${APP_CONFIG.ENDPOINTS.CONTACTS}?listId=${listId}`);
  },

  async createContact(listId, contactData) {
    return this.post(APP_CONFIG.ENDPOINTS.CONTACTS, { listId, ...contactData });
  },

  async updateContact(id, contactData) {
    return this.put(`${APP_CONFIG.ENDPOINTS.CONTACTS}/${id}`, contactData);
  },

  async deleteContact(id) {
    return this.delete(`${APP_CONFIG.ENDPOINTS.CONTACTS}/${id}`);
  },

  async importContacts(listId, csvFile) {
    const formData = new FormData();
    formData.append('csv', csvFile);
    formData.append('listId', listId);
    return this.upload(APP_CONFIG.ENDPOINTS.CONTACTS_IMPORT, formData);
  },

  // ============================================================================
  // Campaigns
  // ============================================================================

  async getCampaigns() {
    return this.get(APP_CONFIG.ENDPOINTS.CAMPAIGNS);
  },

  async getCampaign(id) {
    return this.get(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${id}`);
  },

  async createCampaign(campaignData) {
    return this.post(APP_CONFIG.ENDPOINTS.CAMPAIGNS, campaignData);
  },

  async updateCampaign(id, campaignData) {
    return this.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${id}`, campaignData);
  },

  async deleteCampaign(id) {
    return this.delete(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${id}`);
  },

  async startCampaign(id) {
    const endpoint = APP_CONFIG.buildEndpoint(APP_CONFIG.ENDPOINTS.CAMPAIGN_START, { id });
    return this.post(endpoint);
  },

  async pauseCampaign(id) {
    const endpoint = APP_CONFIG.buildEndpoint(APP_CONFIG.ENDPOINTS.CAMPAIGN_PAUSE, { id });
    return this.post(endpoint);
  },

  async getCampaignStats(id) {
    const endpoint = APP_CONFIG.buildEndpoint(APP_CONFIG.ENDPOINTS.CAMPAIGN_STATS, { id });
    return this.get(endpoint);
  },

  // ============================================================================
  // Campaign Steps
  // ============================================================================

  async getCampaignSteps(campaignId) {
    return this.get(`${APP_CONFIG.ENDPOINTS.CAMPAIGN_STEPS}?campaignId=${campaignId}`);
  },

  async createCampaignStep(stepData) {
    return this.post(APP_CONFIG.ENDPOINTS.CAMPAIGN_STEPS, stepData);
  },

  async updateCampaignStep(id, stepData) {
    return this.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGN_STEPS}/${id}`, stepData);
  },

  async deleteCampaignStep(id) {
    return this.delete(`${APP_CONFIG.ENDPOINTS.CAMPAIGN_STEPS}/${id}`);
  },

  // ============================================================================
  // Dashboard
  // ============================================================================

  async getDashboardStats() {
    return this.get(APP_CONFIG.ENDPOINTS.DASHBOARD_STATS);
  },

  // ============================================================================
  // Email Events
  // ============================================================================

  async getEmailEvents(campaignId, filters = {}) {
    const queryParams = new URLSearchParams({ campaignId, ...filters });
    return this.get(`${APP_CONFIG.ENDPOINTS.EMAIL_EVENTS}?${queryParams}`);
  }
};
