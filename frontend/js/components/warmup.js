/**
 * WarmupManager
 * 
 * Provides a UI to configure email warmup settings per account.
 * Note: This file is currently NOT imported or instantiated in the main app.js 
 * as the feature is built but hidden. You can manually instantiate it in the 
 * browser console to test: `new WarmupManager('account-id-here');`
 */
class WarmupManager {
  constructor(accountId) {
    this.accountId = accountId;
    this.containerId = `warmup-container-${accountId}`;
    this.settings = null;

    // Inject the UI into the DOM
    this.initUI();
    this.fetchSettings();
  }

  getApiUrl() {
    return window.appConfig?.apiUrl || 'http://localhost:3001';
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${window.usenti_local_token}`
    };
  }

  initUI() {
    // Check if container already exists
    if (document.getElementById(this.containerId)) {
      document.getElementById(this.containerId).remove();
    }

    // Create a modal-like overly or append to body for direct testing
    const container = document.createElement('div');
    container.id = this.containerId;
    container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 12px;
      padding: 24px;
      width: 400px;
      z-index: 9999;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      color: white;
      font-family: Inter, sans-serif;
    `;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-size: 1.25rem; font-weight: 600; margin: 0;">Email Warmup</h2>
        <button id="close-warmup-${this.accountId}" style="background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 1.5rem;">&times;</button>
      </div>
      
      <div id="warmup-loading-${this.accountId}" style="text-align: center; padding: 20px;">
        Loading settings...
      </div>
      
      <form id="warmup-form-${this.accountId}" style="display: none; display: flex; flex-direction: column; gap: 16px;">
        
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="warmup-network-${this.accountId}" style="width: 16px; height: 16px; accent-color: #f97316;">
          <label for="warmup-network-${this.accountId}" style="font-size: 0.875rem; color: white;">Join P2P Network (Opt-in)</label>
        </div>

        <div>
          <label style="display: block; font-size: 0.875rem; color: #9ca3af; margin-bottom: 8px;">Status</label>
          <select id="warmup-status-${this.accountId}" style="width: 100%; padding: 8px 12px; background: #374151; border: 1px solid #4b5563; border-radius: 6px; color: white;">
            <option value="paused">Paused</option>
            <option value="active">Active</option>
          </select>
        </div>
        
        <div>
          <label style="display: block; font-size: 0.875rem; color: #9ca3af; margin-bottom: 8px;">Max Daily Sends</label>
          <input type="number" id="warmup-limit-${this.accountId}" min="1" max="200" style="width: 100%; padding: 8px 12px; background: #374151; border: 1px solid #4b5563; border-radius: 6px; color: white; box-sizing: border-box;">
        </div>
        
        <div>
          <label style="display: block; font-size: 0.875rem; color: #9ca3af; margin-bottom: 8px;">Ramp-up Per Day</label>
          <input type="number" id="warmup-ramp-${this.accountId}" min="1" max="50" style="width: 100%; padding: 8px 12px; background: #374151; border: 1px solid #4b5563; border-radius: 6px; color: white; box-sizing: border-box;">
        </div>
        
        <div>
          <label style="display: block; font-size: 0.875rem; color: #9ca3af; margin-bottom: 8px;">Reply Rate (%)</label>
          <input type="number" id="warmup-reply-${this.accountId}" min="0" max="100" style="width: 100%; padding: 8px 12px; background: #374151; border: 1px solid #4b5563; border-radius: 6px; color: white; box-sizing: border-box;">
        </div>

        <div>
           <label style="display: block; font-size: 0.875rem; color: #9ca3af; margin-bottom: 8px;">Spam Rescue Rate (%)</label>
           <input type="number" id="warmup-spam-${this.accountId}" min="0" max="100" style="width: 100%; padding: 8px 12px; background: #374151; border: 1px solid #4b5563; border-radius: 6px; color: white; box-sizing: border-box;">
           <span style="font-size: 0.7rem; color: #6b7280; margin-top: 4px; display: block;">How often to move warmup emails out of Spam.</span>
        </div>
        
        <div style="margin-top: 10px;">
          <button type="submit" style="width: 100%; padding: 10px; background: #f97316; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: background 0.2s;">
            Save Settings
          </button>
        </div>
      </form>
    `;

    document.body.appendChild(container);

    // Event listeners
    document.getElementById(`close-warmup-${this.accountId}`).addEventListener('click', () => {
      this.destroy();
    });

    document.getElementById(`warmup-form-${this.accountId}`).addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings();
    });
  }

  async fetchSettings() {
    try {
      const loadingEl = document.getElementById(`warmup-loading-${this.accountId}`);
      const formEl = document.getElementById(`warmup-form-${this.accountId}`);

      const response = await fetch(`${this.getApiUrl()}/api/warmup/${this.accountId}/settings`, {
        headers: this.getHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch settings');

      const settings = await response.json();
      this.settings = settings;

      // Populate fields
      document.getElementById(`warmup-network-${this.accountId}`).checked = settings.network_opt_in === true;
      document.getElementById(`warmup-status-${this.accountId}`).value = settings.status || 'paused';
      document.getElementById(`warmup-limit-${this.accountId}`).value = settings.daily_send_limit || 40;
      document.getElementById(`warmup-ramp-${this.accountId}`).value = settings.ramp_up_per_day || 5;
      document.getElementById(`warmup-reply-${this.accountId}`).value = settings.reply_rate_percent || 30;
      document.getElementById(`warmup-spam-${this.accountId}`).value = settings.spam_save_rate_percent !== undefined ? settings.spam_save_rate_percent : 100;

      loadingEl.style.display = 'none';
      formEl.style.display = 'flex';

    } catch (error) {
      console.error('Error fetching warmup settings:', error);
      document.getElementById(`warmup-loading-${this.accountId}`).innerHTML = `<span style="color:#ef4444;">Error loading settings. Check console.</span>`;
    }
  }

  async saveSettings() {
    try {
      const submitBtn = document.querySelector(`#warmup-form-${this.accountId} button[type="submit"]`);
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Saving...';
      submitBtn.disabled = true;

      const payload = {
        network_opt_in: document.getElementById(`warmup-network-${this.accountId}`).checked,
        status: document.getElementById(`warmup-status-${this.accountId}`).value,
        daily_send_limit: parseInt(document.getElementById(`warmup-limit-${this.accountId}`).value, 10),
        ramp_up_per_day: parseInt(document.getElementById(`warmup-ramp-${this.accountId}`).value, 10),
        reply_rate_percent: parseInt(document.getElementById(`warmup-reply-${this.accountId}`).value, 10),
        spam_save_rate_percent: parseInt(document.getElementById(`warmup-spam-${this.accountId}`).value, 10)
      };

      const response = await fetch(`${this.getApiUrl()}/api/warmup/${this.accountId}/settings`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to save settings');

      submitBtn.textContent = 'Saved!';
      submitBtn.style.background = '#22c55e'; // Green

      setTimeout(() => {
        submitBtn.textContent = originalText;
        submitBtn.style.background = '#f97316';
        submitBtn.disabled = false;
        this.destroy(); // Auto-close success
      }, 1500);

    } catch (error) {
      console.error('Error saving warmup settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  }

  destroy() {
    const el = document.getElementById(this.containerId);
    if (el) el.remove();
  }
}

// Optionally export if used in a module environment
if (typeof window !== 'undefined') {
  window.WarmupManager = WarmupManager;
} else if (typeof module !== 'undefined') {
  module.exports = WarmupManager;
}
