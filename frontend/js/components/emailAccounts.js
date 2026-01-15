// Mr. Snowman - Email Accounts Component

const EmailAccounts = () => {
  const { useState, useEffect, createElement: h } = React;
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await api.getEmailAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccountAdded = () => {
    loadAccounts();
    setShowModal(false);
  };

  return h('div', { className: "space-y-8" },
    h('div', { className: "flex justify-between items-end" },
      h('div', null,
        h('h2', { className: "font-serif text-3xl text-jaguar-900" }, 'Infrastructure'),
        h('p', { className: "text-stone-500 mt-2" }, 'Connect and manage your sending accounts.')),
      h('button', {
        onClick: () => setShowModal(true),
        className: "px-6 py-3 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-xl font-medium hover:shadow-xl transition-all duration-300 flex items-center gap-2"
      },
        Icons.Plus({ size: 20 }), 'Connect Account')),
    loading ? h('div', { className: "text-center py-12" },
      h('div', { className: "inline-block animate-spin text-jaguar-900" }, Icons.Loader2({ size: 32 })),
      h('p', { className: "text-stone-400 mt-4" }, 'Loading accounts...')
    ) : accounts.length === 0 ? h('div', { className: "text-center py-12" },
      h('p', { className: "text-stone-400" }, 'No email accounts yet. Connect your first account to get started!')
    ) : h('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" },
      ...accounts.map(account =>
        h('div', { key: account.id, className: "bg-white rounded-2xl p-6 border border-stone-200 shadow-sm hover:shadow-md transition-shadow" },
          h('div', { className: "flex items-start justify-between mb-4" },
            h('div', { className: "flex items-center gap-3" },
              h('div', { className: "w-12 h-12 rounded-xl bg-gradient-to-br from-jaguar-900 to-jaguar-800 flex items-center justify-center shadow-lg" },
                Icons.Mail({ size: 24, className: "text-cream-50" })),
              h('div', null,
                h('h3', { className: "font-medium text-jaguar-900" }, account.email_address),
                h('p', { className: "text-xs text-stone-500" }, account.account_type || 'Custom SMTP'))),
            h('span', {
              className: `px-2 py-1 text-xs rounded-full ${account.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`
            }, account.is_active ? 'Active' : 'Inactive')),
          h('div', { className: "space-y-2 text-sm" },
            h('div', { className: "flex justify-between" },
              h('span', { className: "text-stone-500" }, 'Daily Limit:'),
              h('span', { className: "font-medium text-jaguar-900" }, account.daily_send_limit || 'N/A')),
            h('div', { className: "flex justify-between" },
              h('span', { className: "text-stone-500" }, 'Warming Up:'),
              h('span', { className: "font-medium" }, account.is_warming_up ? '🔥 Yes' : 'No')),
            account.health_score && h('div', { className: "flex justify-between" },
              h('span', { className: "text-stone-500" }, 'Health:'),
              h('span', { className: `font-medium ${account.health_score > 80 ? 'text-green-600' : account.health_score > 50 ? 'text-yellow-600' : 'text-red-600'}` },
                `${account.health_score}%`))))
      )),
    showModal && h(AddEmailAccountModal, { onClose: () => setShowModal(false), onSuccess: handleAccountAdded })
  );
};

// Add Email Account Modal Component
const AddEmailAccountModal = ({ onClose, onSuccess }) => {
  const { useState, createElement: h } = React;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email_address: '',
    account_type: 'stalwart',
    imap_host: '',
    imap_port: 993,
    imap_username: '',
    imap_password: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    daily_send_limit: 10000
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.createEmailAccount(formData);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to add email account');
    } finally {
      setLoading(false);
    }
  };

  return h('div', {
    className: "fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4",
    onClick: onClose
  },
    h('div', {
      className: "bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl",
      onClick: e => e.stopPropagation()
    },
      h('div', { className: "sticky top-0 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 p-6 rounded-t-2xl" },
        h('div', { className: "flex justify-between items-center" },
          h('div', null,
            h('h3', { className: "font-serif text-2xl" }, 'Add Email Account'),
            h('p', { className: "text-jaguar-100 text-sm mt-1" }, 'Connect your IMAP and SMTP servers')),
          h('button', {
            onClick: onClose,
            className: "w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-300"
          }, Icons.X({ size: 20 })))),
      h('form', { onSubmit: handleSubmit, className: "p-6 space-y-6" },
        error && h('div', { className: "p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2" },
          Icons.AlertCircle({ size: 16 }), error),

        // Basic Info
        h('div', { className: "space-y-4" },
          h('h4', { className: "font-medium text-jaguar-900 flex items-center gap-2" },
            Icons.Mail({ size: 18 }), 'Basic Information'),
          h('div', { className: "grid grid-cols-2 gap-4" },
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Email Address'),
              h('input', {
                type: "email",
                required: true,
                value: formData.email_address,
                onChange: e => updateField('email_address', e.target.value),
                className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all",
                placeholder: "your@email.com"
              })),
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Account Type'),
              h('select', {
                value: formData.account_type,
                onChange: e => updateField('account_type', e.target.value),
                className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all"
              },
                h('option', { value: "stalwart" }, 'Stalwart SMTP'),
                h('option', { value: "aws_workmail" }, 'AWS WorkMail'),
                h('option', { value: "other" }, 'Other'))))),

        // IMAP Settings
        h('div', { className: "space-y-4 p-4 bg-cream-50 rounded-xl border border-stone-200" },
          h('h4', { className: "font-medium text-jaguar-900 flex items-center gap-2" },
            Icons.Download({ size: 18 }), 'IMAP Settings (Incoming)'),
          h('div', { className: "grid grid-cols-3 gap-4" },
            h('div', { className: "col-span-2" },
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'IMAP Host'),
              h('input', {
                type: "text",
                required: true,
                value: formData.imap_host,
                onChange: e => updateField('imap_host', e.target.value),
                className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all",
                placeholder: "imap.yourserver.com"
              })),
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Port'),
              h('input', {
                type: "number",
                required: true,
                value: formData.imap_port,
                onChange: e => updateField('imap_port', parseInt(e.target.value)),
                className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all"
              }))),
          h('div', { className: "grid grid-cols-2 gap-4" },
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Username'),
              h('input', {
                type: "text",
                required: true,
                value: formData.imap_username,
                onChange: e => updateField('imap_username', e.target.value),
                className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all"
              })),
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Password'),
              h('input', {
                type: "password",
                required: true,
                value: formData.imap_password,
                onChange: e => updateField('imap_password', e.target.value),
                className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all"
              })))),

        // SMTP Settings
        h('div', { className: "space-y-4 p-4 bg-cream-50 rounded-xl border border-stone-200" },
          h('h4', { className: "font-medium text-jaguar-900 flex items-center gap-2" },
            Icons.Upload({ size: 18 }), 'SMTP Settings (Outgoing)'),
          h('div', { className: "grid grid-cols-3 gap-4" },
            h('div', { className: "col-span-2" },
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'SMTP Host'),
              h('input', {
                type: "text",
                required: true,
                value: formData.smtp_host,
                onChange: e => updateField('smtp_host', e.target.value),
                className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all",
                placeholder: "smtp.yourserver.com"
              })),
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Port'),
              h('input', {
                type: "number",
                required: true,
                value: formData.smtp_port,
                onChange: e => updateField('smtp_port', parseInt(e.target.value)),
                className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all"
              }))),
          h('div', { className: "grid grid-cols-2 gap-4" },
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Username'),
              h('input', {
                type: "text",
                required: true,
                value: formData.smtp_username,
                onChange: e => updateField('smtp_username', e.target.value),
                className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all"
              })),
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Password'),
              h('input', {
                type: "password",
                required: true,
                value: formData.smtp_password,
                onChange: e => updateField('smtp_password', e.target.value),
                className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all"
              })))),

        // Daily Limit
        h('div', null,
          h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Daily Send Limit'),
          h('input', {
            type: "number",
            value: formData.daily_send_limit,
            onChange: e => updateField('daily_send_limit', parseInt(e.target.value)),
            className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all",
            placeholder: "10000"
          })),

        // Actions
        h('div', { className: "flex gap-3 pt-4 border-t border-stone-200" },
          h('button', {
            type: "button",
            onClick: onClose,
            className: "flex-1 px-6 py-3 bg-white border-2 border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition-all duration-300 font-medium"
          }, 'Cancel'),
          h('button', {
            type: "submit",
            disabled: loading,
            className: "flex-1 px-6 py-3 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-xl hover:from-jaguar-800 hover:to-jaguar-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 font-medium flex items-center justify-center gap-2"
          }, loading ? [Icons.Loader2({ size: 18 }), ' Adding...'] : 'Add Account'))))
  );
};
