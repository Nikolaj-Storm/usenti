// Mr. Snowman - API Service Layer

const api = {
  async request(endpoint, options = {}) {
    const url = APP_CONFIG.API_BASE_URL + endpoint;
    const token = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);

    console.log('🌐 [API] Making request:', {
      method: options.method || 'GET',
      endpoint,
      url,
      hasToken: !!token,
      skipAuth: options.skipAuth
    });

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
      console.log('📡 [API] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ [API] Request failed:', {
          status: response.status,
          error: data.error || data.message
        });

        if (response.status === 401) {
          // Unauthorized - clear auth and reload
          console.warn('⚠️ [API] 401 Unauthorized - clearing auth and reloading page!');
          localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
          localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER);
          window.location.reload();
        }
        throw new Error(data.error || data.message || 'Request failed');
      }

      console.log('✅ [API] Request successful:', data);
      return data;
    } catch (error) {
      console.error('💥 [API] Error during request:', error);
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
    console.log('🔑 [API] Signup called with:', { email, name, hasPassword: !!password });

    const response = await this.post(
      APP_CONFIG.ENDPOINTS.AUTH_SIGNUP,
      { email, password, name },
      { skipAuth: true }
    );

    console.log('✅ [API] Signup response received:', {
      hasSession: !!response.session,
      hasAccessToken: !!response.session?.access_token,
      hasUser: !!response.user,
      userId: response.user?.id
    });

    if (response.session?.access_token) {
      console.log('💾 [API] Storing token and user in localStorage...');
      localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TOKEN, response.session.access_token);
      localStorage.setItem(APP_CONFIG.STORAGE_KEYS.USER, JSON.stringify(response.user));
      console.log('✅ [API] Token and user stored successfully');
    } else {
      console.warn('⚠️ [API] No access token in signup response!');
    }

    return response;
  },

  async login(email, password) {
    console.log('🔑 [API] Login called with:', { email, hasPassword: !!password });

    const response = await this.post(
      APP_CONFIG.ENDPOINTS.AUTH_LOGIN,
      { email, password },
      { skipAuth: true }
    );

    console.log('✅ [API] Login response received:', {
      hasSession: !!response.session,
      hasAccessToken: !!response.session?.access_token,
      hasUser: !!response.user,
      userId: response.user?.id
    });

    if (response.session?.access_token) {
      console.log('💾 [API] Storing token and user in localStorage...');
      localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TOKEN, response.session.access_token);
      localStorage.setItem(APP_CONFIG.STORAGE_KEYS.USER, JSON.stringify(response.user));
      console.log('✅ [API] Token and user stored successfully');
    } else {
      console.warn('⚠️ [API] No access token in login response!');
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
    const requestId = `API-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`\n[${requestId}] API.createEmailAccount called`);
    console.log(`[${requestId}] Endpoint: ${APP_CONFIG.ENDPOINTS.EMAIL_ACCOUNTS}`);
    console.log(`[${requestId}] Account data (redacted):`, {
      ...accountData,
      smtp_password: '[REDACTED]',
      imap_password: '[REDACTED]'
    });

    try {
      const result = await this.post(APP_CONFIG.ENDPOINTS.EMAIL_ACCOUNTS, accountData);
      console.log(`[${requestId}] ✅ API call successful:`, result);
      return result;
    } catch (error) {
      console.log(`[${requestId}] ❌ API call failed:`, error);
      throw error;
    }
  },

  async updateEmailAccount(id, accountData) {
    console.log(`[API] Updating email account ${id}...`);
    return this.put(`${APP_CONFIG.ENDPOINTS.EMAIL_ACCOUNTS}/${id}`, accountData);
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

  async deleteCampaign(id) {
    return this.delete(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${id}`);
  },

  async getCampaignContacts(id) {
    return this.get(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${id}/contacts`);
  },

  // Dashboard
  async getDashboardStats() {
    return this.get(APP_CONFIG.ENDPOINTS.DASHBOARD_STATS);
  },

  // Inbox
  async getInbox(accountId = 'all', limit = 50, offset = 0) {
    return this.get(`/api/inbox?account_id=${accountId}&limit=${limit}&offset=${offset}`);
  },

  async markInboxAsRead(messageId, isRead = true) {
    return this.put(`/api/inbox/${messageId}/read`, { is_read: isRead });
  },

  async syncInbox(accountId = null, limit = 50) {
    console.log('📥 [API] Syncing inbox from IMAP server...');
    return this.post('/api/inbox/sync', {
      account_id: accountId,
      limit
    });
  },

  // Fetch full email content (on-demand from IMAP if needed)
  async getEmailContent(messageId) {
    console.log('📧 [API] Fetching email content...');
    return this.get(`/api/inbox/${messageId}/content`);
  },

  // Cleanup old inbox messages
  async cleanupInbox() {
    console.log('🧹 [API] Cleaning up old inbox messages...');
    return this.post('/api/inbox/cleanup');
  },

  // Send reply to an inbox message (supports attachments)
  async sendReply(messageId, body, attachments = []) {
    console.log('📤 [API] Sending reply...', { hasAttachments: attachments.length > 0 });

    // If there are attachments, use FormData
    if (attachments && attachments.length > 0) {
      const formData = new FormData();
      formData.append('body', body);

      attachments.forEach((att, index) => {
        formData.append(`attachment_${index}`, att.file, att.name);
      });

      const token = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
      const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/inbox/${messageId}/reply`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return response.json();
    }

    // No attachments, use regular JSON
    return this.post(`/api/inbox/${messageId}/reply`, { body });
  }
};
