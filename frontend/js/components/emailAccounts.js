// Mr. Snowman - Email Accounts / Infrastructure Component


const EmailAccounts = () => {
  const [accounts, setAccounts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showModal, setShowModal] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState(null);

  React.useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await api.getEmailAccounts();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = () => {
    setEditingAccount(null);
    setShowModal(true);
  };

  const handleEditAccount = (account) => {
    setEditingAccount(account);
    setShowModal(true);
  };

  const handleSaveAccount = async (accountData) => {
    try {
      if (editingAccount) {
        await api.updateEmailAccount(editingAccount.id, accountData);
        alert('Account updated successfully!');
      } else {
        await api.createEmailAccount(accountData);
        alert('Account added successfully!');
      }
      setShowModal(false);
      setEditingAccount(null);
      loadAccounts();
    } catch (error) {
      console.error('Failed to save account:', error);
      throw error;
    }
  };

  return h('div', { className: "space-y-6 animate-fade-in" },
    h('div', { className: "flex justify-between items-end" },
      h('div', null,
        h('h2', { className: "font-serif text-3xl text-jaguar-900" }, 'Infrastructure'),
        h('p', { className: "text-stone-500 mt-2 font-light" }, 'Manage your connected email accounts.')
      ),
      h('button', {
        onClick: handleAddAccount,
        className: "px-4 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 font-medium flex items-center gap-2 transition-colors"
      },
        h(Icons.Plus, { size: 18 }),
        ' Add Account'
      )
    ),
    h('div', { className: "border-b border-stone-200" }),
    loading
      ? h('div', { className: "flex justify-center py-12" },
          h(Icons.Loader2, { size: 48, className: "text-jaguar-900" })
        )
      : h(AccountsTab, { accounts: accounts, onEdit: handleEditAccount }),
    showModal && h(AccountModal, {
      account: editingAccount,
      onClose: () => { setShowModal(false); setEditingAccount(null); },
      onSave: handleSaveAccount
    })
  );
};

const AccountsTab = ({ accounts, onEdit }) => {
  if (accounts.length === 0) {
    return h('div', { className: "flex flex-col items-center justify-center py-16 text-center" },
      h(Icons.Server, { size: 64, className: "text-stone-300 mb-4" }),
      h('h3', { className: "font-serif text-2xl text-jaguar-900 mb-2" }, 'No Accounts Connected'),
      h('p', { className: "text-stone-500 mb-6 max-w-md" }, 'Connect your first email account to start sending campaigns.')
    );
  }

  return h('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" },
    ...accounts.map((account) =>
      h(AccountCard, { key: account.id, account: account, onEdit: onEdit })
    )
  );
};

const AccountCard = ({ account, onEdit }) => {
  const [expanded, setExpanded] = React.useState(false);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'warming':
        return 'bg-amber-100 text-amber-700';
      case 'paused':
        return 'bg-stone-100 text-stone-600';
      default:
        return 'bg-stone-100 text-stone-600';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'stalwart':
        return 'bg-indigo-100 text-indigo-700';
      case 'aws_workmail':
        return 'bg-orange-100 text-orange-700';
      case 'zoho':
        return 'bg-purple-100 text-purple-700';
      case 'gmail':
        return 'bg-red-100 text-red-700';
      case 'outlook':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-stone-100 text-stone-600';
    }
  };

  return h('div', { className: "bg-white border border-stone-200 rounded-lg p-6 hover:shadow-lg transition-all group" },
    h('div', { className: "flex justify-between items-start mb-4" },
      h('div', { className: "flex items-center gap-3 w-full overflow-hidden" },
        h('div', { className: "w-12 h-12 rounded-full bg-jaguar-900 text-cream-50 flex items-center justify-center font-serif text-xl shrink-0" },
          account.email_address[0].toUpperCase()
        ),
        h('div', { className: "flex-1 min-w-0" },
          account.sender_name
            ? h('div', null,
                h('h3', { className: "font-medium text-jaguar-900 truncate", title: account.sender_name },
                  account.sender_name
                ),
                h('p', { className: "text-xs text-stone-500 truncate", title: account.email_address }, account.email_address)
              )
            : h('h3', { className: "font-medium text-jaguar-900 truncate", title: account.email_address },
                account.email_address
              )
        )
      )
    ),
    h('div', { className: "flex gap-2 mb-4" },
      h('span', { className: `px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${getTypeColor(account.account_type)}` },
        account.account_type?.replace('_', ' ')
      ),
      h('span', { className: `px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${getStatusColor(account.status || 'active')}` },
        account.status || 'active'
      )
    ),
    h('div', { className: "space-y-3" },
      h('div', { className: "flex justify-between text-sm" },
        h('span', { className: "text-stone-500" }, 'Daily Limit'),
        h('span', { className: "font-medium text-jaguar-900" },
          (account.daily_send_limit?.toLocaleString() || '500')
        )
      ),
      h('div', { className: "flex justify-between text-sm" },
        h('span', { className: "text-stone-500" }, 'Sent Today'),
        h('span', { className: "font-medium text-jaguar-900" },
          `${account.sent_today || 0} / ${account.daily_send_limit || 500}`
        )
      ),
      h('div', { className: "w-full bg-stone-100 rounded-full h-2" },
        h('div', {
          className: "bg-jaguar-900 h-2 rounded-full transition-all",
          style: {
            width: `${Math.min(100, ((account.sent_today || 0) / (account.daily_send_limit || 500)) * 100)}%`
          }
        })
      )
    ),
    h('div', { className: "mt-4 pt-4 border-t border-stone-100 flex gap-2" },
      h('button', {
        onClick: () => setExpanded(!expanded),
        className: "flex-1 px-3 py-2 text-sm border border-stone-200 rounded-md hover:bg-stone-50 transition-colors"
      }, expanded ? 'Less' : 'Details'),
      h('button', {
        onClick: () => onEdit(account),
        className: "px-3 py-2 text-sm text-stone-400 hover:text-stone-600 border border-stone-200 rounded-md hover:bg-stone-50 transition-colors"
      },
        h(Icons.Settings, { size: 16 })
      )
    ),
    expanded && h('div', { className: "mt-4 pt-4 border-t border-stone-100 space-y-2 text-sm animate-fade-in" },
      account.sender_name && h('div', { className: "flex justify-between" },
        h('span', { className: "text-stone-500" }, 'Sender Name'),
        h('span', { className: "text-jaguar-900" }, account.sender_name)
      ),
      h('div', { className: "flex justify-between" },
        h('span', { className: "text-stone-500" }, 'SMTP Host'),
        h('span', { className: "text-jaguar-900 font-mono text-xs" }, account.smtp_host || 'smtp.example.com')
      ),
      h('div', { className: "flex justify-between" },
        h('span', { className: "text-stone-500" }, 'SMTP Port'),
        h('span', { className: "text-jaguar-900" }, account.smtp_port || 587)
      ),
      h('div', { className: "flex justify-between" },
        h('span', { className: "text-stone-500" }, 'IMAP Host'),
        h('span', { className: "text-jaguar-900 font-mono text-xs" }, account.imap_host || 'imap.example.com')
      )
    )
  );
};

const AccountModal = ({ account, onClose, onSave }) => {
  const isEditing = !!account;
  const [step, setStep] = React.useState(isEditing ? 'details' : 'type');
  const [accountType, setAccountType] = React.useState(account?.account_type || '');
  const [formData, setFormData] = React.useState({
    email_address: account?.email_address || '',
    sender_name: account?.sender_name || '',
    smtp_host: account?.smtp_host || '',
    smtp_port: account?.smtp_port || '587',
    smtp_username: account?.smtp_username || '',
    smtp_password: '',
    imap_host: account?.imap_host || '',
    imap_port: account?.imap_port || '993',
    imap_username: account?.imap_username || '',
    imap_password: '',
    daily_send_limit: account?.daily_send_limit || '500'
  });
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState(null);

  const handleTypeSelect = (type) => {
    setAccountType(type);

    if (!isEditing) {
      if (type === 'zoho') {
        setFormData(prev => ({
          ...prev,
          smtp_host: 'smtp.zoho.com',
          smtp_port: '587',
          imap_host: 'imap.zoho.com',
          imap_port: '993'
        }));
      } else if (type === 'gmail') {
        setFormData(prev => ({
          ...prev,
          smtp_host: 'smtp.gmail.com',
          smtp_port: '587',
          imap_host: 'imap.gmail.com',
          imap_port: '993'
        }));
        alert('⚠️ Important: Gmail requires App Passwords for third-party applications.\n\nTo connect your Gmail account:\n\n1. Enable 2-Step Verification on your Google account\n2. Go to https://myaccount.google.com/apppasswords\n3. Generate an app password for "Mail"\n4. Use that password (not your regular password) in the IMAP/SMTP password fields');
      } else if (type === 'outlook') {
        setFormData(prev => ({
          ...prev,
          smtp_host: 'smtp.office365.com',
          smtp_port: '587',
          imap_host: 'outlook.office365.com',
          imap_port: '993'
        }));
        alert('⚠️ Important: Microsoft disabled basic authentication for Outlook/Office 365 in late 2022.\n\nTo connect your Outlook account, you MUST use an App Password:\n\n1. Go to https://account.microsoft.com/security\n2. Navigate to "Advanced security options"\n3. Create a new app password\n4. Use that password (not your regular password) in the IMAP/SMTP password fields\n\nIf app passwords are disabled by your organization, you will need to contact your IT administrator.');
      }
    }

    setStep('details');
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const testData = { ...formData, account_type: accountType };
      const result = await api.testEmailAccount(testData);
      setTestResult({ success: true, message: result.message || 'Connection successful!' });
    } catch (error) {
      setTestResult({ success: false, message: error.message || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...formData,
      account_type: accountType
    };

    // Remove empty password fields when editing (to keep existing passwords)
    if (isEditing) {
      if (!payload.smtp_password) delete payload.smtp_password;
      if (!payload.imap_password) delete payload.imap_password;
    }

    try {
      await onSave(payload);
    } catch (err) {
      alert('Failed to save account: ' + err.message);
    }
  };

  return h('div', {
    className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in",
    onClick: onClose
  },
    h('div', {
      className: "bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto",
      onClick: (e) => e.stopPropagation()
    },
      h('div', { className: "flex justify-between items-center mb-6" },
        h('h3', { className: "font-serif text-2xl text-jaguar-900" }, isEditing ? 'Edit Email Account' : 'Add Email Account'),
        h('button', {
          onClick: onClose,
          className: "text-stone-400 hover:text-stone-600 transition-colors"
        }, h(Icons.X, { size: 24 }))
      ),
      step === 'type' && h('div', { className: "space-y-4" },
        h('p', { className: "text-stone-600 mb-6" }, 'Choose your email provider:'),
        h('button', {
          onClick: () => handleTypeSelect('stalwart'),
          className: "w-full p-6 border-2 border-stone-200 rounded-lg hover:border-jaguar-900 hover:bg-cream-50 transition-all text-left group"
        },
          h('div', { className: "flex items-center gap-4" },
            h('div', { className: "w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl group-hover:scale-110 transition-transform" }, 'ST'),
            h('div', null,
              h('h4', { className: "font-medium text-jaguar-900 mb-1" }, 'Stalwart SMTP'),
              h('p', { className: "text-sm text-stone-500" }, 'Custom SMTP relay for maximum deliverability')
            )
          )
        ),
        h('button', {
          onClick: () => handleTypeSelect('aws_workmail'),
          className: "w-full p-6 border-2 border-stone-200 rounded-lg hover:border-jaguar-900 hover:bg-cream-50 transition-all text-left group"
        },
          h('div', { className: "flex items-center gap-4" },
            h('div', { className: "w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xl group-hover:scale-110 transition-transform" }, 'AWS'),
            h('div', null,
              h('h4', { className: "font-medium text-jaguar-900 mb-1" }, 'AWS WorkMail'),
              h('p', { className: "text-sm text-stone-500" }, 'Enterprise email service from Amazon')
            )
          )
        ),
        h('button', {
          onClick: () => handleTypeSelect('zoho'),
          className: "w-full p-6 border-2 border-stone-200 rounded-lg hover:border-jaguar-900 hover:bg-cream-50 transition-all text-left group"
        },
          h('div', { className: "flex items-center gap-4" },
            h('div', { className: "w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-xl group-hover:scale-110 transition-transform" }, 'Z'),
            h('div', null,
              h('h4', { className: "font-medium text-jaguar-900 mb-1" }, 'Zoho Mail'),
              h('p', { className: "text-sm text-stone-500" }, 'Professional email with simple setup (no app passwords needed)')
            )
          )
        ),
        h('button', {
          onClick: () => handleTypeSelect('gmail'),
          className: "w-full p-6 border-2 border-stone-200 rounded-lg hover:border-jaguar-900 hover:bg-cream-50 transition-all text-left group"
        },
          h('div', { className: "flex items-center gap-4" },
            h('div', { className: "w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center text-red-700 font-bold text-xl group-hover:scale-110 transition-transform" }, 'G'),
            h('div', null,
              h('h4', { className: "font-medium text-jaguar-900 mb-1" }, 'Gmail / Google Workspace'),
              h('p', { className: "text-sm text-stone-500" }, 'Connect your Gmail or Google Workspace account')
            )
          )
        ),
        h('button', {
          onClick: () => handleTypeSelect('outlook'),
          className: "w-full p-6 border-2 border-stone-200 rounded-lg hover:border-jaguar-900 hover:bg-cream-50 transition-all text-left group"
        },
          h('div', { className: "flex items-center gap-4" },
            h('div', { className: "w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl group-hover:scale-110 transition-transform" }, 'M'),
            h('div', null,
              h('h4', { className: "font-medium text-jaguar-900 mb-1" }, 'Microsoft Outlook / Office 365'),
              h('p', { className: "text-sm text-stone-500" }, 'Connect your Outlook or Microsoft 365 account')
            )
          )
        )
      ),
      step === 'details' && h('form', { onSubmit: handleSubmit, className: "space-y-6" },
        (accountType === 'outlook' || accountType === 'gmail') && h('div', { className: "p-4 bg-amber-50 border border-amber-200 rounded-lg" },
          h('div', { className: "flex gap-3" },
            h(Icons.AlertCircle, { size: 20, className: "text-amber-600 shrink-0 mt-0.5" }),
            h('div', null,
              h('h4', { className: "font-medium text-amber-900 mb-1" }, 'App Password Required'),
              h('p', { className: "text-sm text-amber-700 mb-2" },
                accountType === 'outlook'
                  ? 'Microsoft disabled basic authentication for Outlook/Office 365. You must use an App Password:'
                  : 'Gmail requires App Passwords for third-party applications. You must use an App Password:'
              ),
              h('ol', { className: "text-sm text-amber-700 list-decimal list-inside space-y-1" },
                accountType === 'outlook' ? [
                  h('li', { key: 1 }, 'Visit ', h('a', { href: "https://account.microsoft.com/security", target: "_blank", className: "underline" }, 'account.microsoft.com/security')),
                  h('li', { key: 2 }, 'Create a new app password under "Advanced security options"'),
                  h('li', { key: 3 }, 'Use that password in the IMAP/SMTP password fields below')
                ] : [
                  h('li', { key: 1 }, 'Enable 2-Step Verification on your Google account'),
                  h('li', { key: 2 }, 'Visit ', h('a', { href: "https://myaccount.google.com/apppasswords", target: "_blank", className: "underline" }, 'myaccount.google.com/apppasswords')),
                  h('li', { key: 3 }, 'Generate an app password for "Mail"'),
                  h('li', { key: 4 }, 'Use that password in the IMAP/SMTP password fields below')
                ]
              )
            )
          )
        ),
        h('div', null,
          h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Email Address'),
          h('input', {
            type: "email",
            required: true,
            value: formData.email_address,
            onChange: (e) => setFormData({ ...formData, email_address: e.target.value }),
            className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20",
            placeholder: "john@company.com"
          })
        ),
        h('div', null,
          h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Sender Display Name'),
          h('input', {
            type: "text",
            value: formData.sender_name,
            onChange: (e) => setFormData({ ...formData, sender_name: e.target.value }),
            className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20",
            placeholder: "John Smith"
          }),
          h('p', { className: "text-xs text-stone-500 mt-1" }, 'How your name appears in the From field. E.g., "John Smith" results in "John Smith <john@company.com>". Improves deliverability.')
        ),
        h('div', { className: "p-4 bg-cream-50 rounded-lg space-y-4" },
          h('h4', { className: "font-medium text-jaguar-900" }, 'SMTP Settings (Outgoing)'),
          h('div', { className: "grid grid-cols-2 gap-4" },
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'SMTP Host'),
              h('input', {
                type: "text",
                required: true,
                value: formData.smtp_host,
                onChange: (e) => setFormData({ ...formData, smtp_host: e.target.value }),
                className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20",
                placeholder: "smtp.example.com"
              })
            ),
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'SMTP Port'),
              h('input', {
                type: "number",
                required: true,
                value: formData.smtp_port,
                onChange: (e) => setFormData({ ...formData, smtp_port: e.target.value }),
                className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
              })
            )
          ),
          h('div', { className: "grid grid-cols-2 gap-4" },
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'SMTP Username'),
              h('input', {
                type: "text",
                required: true,
                value: formData.smtp_username,
                onChange: (e) => setFormData({ ...formData, smtp_username: e.target.value }),
                className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
              })
            ),
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'SMTP Password'),
              h('input', {
                type: "password",
                required: !isEditing,
                placeholder: isEditing ? '(Leave blank to keep unchanged)' : '',
                value: formData.smtp_password,
                onChange: (e) => setFormData({ ...formData, smtp_password: e.target.value }),
                className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
              })
            )
          )
        ),
        h('div', { className: "p-4 bg-cream-50 rounded-lg space-y-4" },
          h('h4', { className: "font-medium text-jaguar-900" }, 'IMAP Settings (Incoming)'),
          h('div', { className: "grid grid-cols-2 gap-4" },
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'IMAP Host'),
              h('input', {
                type: "text",
                required: true,
                value: formData.imap_host,
                onChange: (e) => setFormData({ ...formData, imap_host: e.target.value }),
                className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20",
                placeholder: "imap.example.com"
              })
            ),
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'IMAP Port'),
              h('input', {
                type: "number",
                required: true,
                value: formData.imap_port,
                onChange: (e) => setFormData({ ...formData, imap_port: e.target.value }),
                className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
              })
            )
          ),
          h('div', { className: "grid grid-cols-2 gap-4" },
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'IMAP Username'),
              h('input', {
                type: "text",
                required: true,
                value: formData.imap_username,
                onChange: (e) => setFormData({ ...formData, imap_username: e.target.value }),
                className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
              })
            ),
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'IMAP Password'),
              h('input', {
                type: "password",
                required: !isEditing,
                placeholder: isEditing ? '(Leave blank to keep unchanged)' : '',
                value: formData.imap_password,
                onChange: (e) => setFormData({ ...formData, imap_password: e.target.value }),
                className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
              })
            )
          )
        ),
        h('div', null,
          h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Daily Send Limit'),
          h('input', {
            type: "number",
            required: true,
            value: formData.daily_send_limit,
            onChange: (e) => setFormData({ ...formData, daily_send_limit: e.target.value }),
            className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
          })
        ),
        testResult && h('div', {
          className: `p-4 rounded-lg border ${
            testResult.success
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`
        },
          h('div', { className: "flex items-center gap-2" },
            testResult.success ? h(Icons.Check, { size: 20 }) : h(Icons.AlertCircle, { size: 20 }),
            h('span', { className: "font-medium" }, testResult.message)
          )
        ),
        h('div', { className: "flex gap-3" },
          !isEditing && h('button', {
            type: "button",
            onClick: () => setStep('type'),
            className: "px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50 transition-colors"
          }, 'Back'),
          h('button', {
            type: "button",
            onClick: handleTest,
            disabled: testing,
            className: "px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50 transition-colors flex items-center gap-2"
          },
            testing ? h(Icons.Loader2, { size: 16, className: "animate-spin" }) : h(Icons.Zap, { size: 16 }),
            'Test Connection'
          ),
          h('button', {
            type: "submit",
            className: "flex-1 px-4 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 transition-colors"
          }, isEditing ? 'Save Changes' : 'Add Account')
        )
      )
    )
  );
};
