// Mr. Snowman - Email Accounts / Infrastructure Component


const LabelWithTooltip = ({ label, helpText }) => (
  h('div', { className: "flex items-center gap-2 mb-2" },
    h('label', { className: "block text-sm font-medium text-white/70" }, label),
    helpText && h('div', { className: "group relative" },
      h(Icons.HelpCircle, { size: 14, className: "text-white/30 hover:text-white/70 cursor-help transition-colors" }),
      h('div', { className: "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 border border-white/10 rounded-lg text-xs text-white/80 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none" },
        helpText,
        h('div', { className: "absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900" })
      )
    )
  )
);

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

  const handleDeleteAccount = async (account) => {
    if (!confirm(`Are you sure you want to delete ${account.email_address}?\n\nThis will permanently remove the account and all related data.`)) {
      return;
    }

    try {
      await api.deleteEmailAccount(account.id);
      loadAccounts(); // Refresh the list
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('Failed to delete account: ' + (error.message || 'Unknown error'));
    }
  };

  return h('div', { className: "space-y-6 animate-fade-in" },
    h('div', { className: "flex justify-between items-end" },
      h('div', null,
        h('h2', { className: "font-serif text-3xl text-white" }, 'Infrastructure'),
        h('p', { className: "text-white/60 mt-2 font-light" }, 'Manage your connected email accounts.')
      ),
      h('button', {
        onClick: handleAddAccount,
        className: "px-4 py-3 bg-cream-100 text-rust-900 rounded-full hover:bg-cream-200 font-medium flex items-center gap-2 transition-colors"
      },
        h(Icons.Plus, { size: 18 }),
        ' Add Account'
      )
    ),
    h('div', { className: "border-b border-white/10" }),
    loading
      ? h('div', { className: "flex justify-center py-12" },
        h(Icons.Loader2, { size: 48, className: "text-cream-100 animate-spin" })
      )
      : h(AccountsTab, { accounts: accounts, onEdit: handleEditAccount, onDelete: handleDeleteAccount }),
    showModal && h(AccountModal, {
      account: editingAccount,
      onClose: () => { setShowModal(false); setEditingAccount(null); },
      onSave: handleSaveAccount
    })
  );
};

const AccountsTab = ({ accounts, onEdit, onDelete }) => {
  if (accounts.length === 0) {
    return h('div', { className: "flex flex-col items-center justify-center py-16 text-center" },
      h(Icons.Server, { size: 64, className: "text-white/30 mb-4" }),
      h('h3', { className: "font-serif text-2xl text-white mb-2" }, 'No Accounts Connected'),
      h('p', { className: "text-white/60 mb-6 max-w-md" }, 'Connect your first email account to start sending campaigns.')
    );
  }

  return h('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" },
    ...accounts.map((account) =>
      h(AccountCard, { key: account.id, account: account, onEdit: onEdit, onDelete: onDelete })
    )
  );
};

const AccountCard = ({ account, onEdit, onDelete }) => {
  const [expanded, setExpanded] = React.useState(false);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'badge-active';
      case 'paused':
        return 'badge-neutral';
      default:
        return 'badge-neutral';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'stalwart':
        return 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
      case 'aws_workmail':
        return 'bg-orange-500/20 text-orange-300 border border-orange-500/30';
      case 'zoho':
        return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
      case 'gmail':
        return 'bg-red-500/20 text-red-300 border border-red-500/30';
      case 'outlook':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
      default:
        return 'badge-neutral';
    }
  };

  return h('div', { className: "glass-card p-6 hover:bg-white/10 transition-all group" },
    h('div', { className: "flex justify-between items-start mb-4" },
      h('div', { className: "flex items-center gap-3 w-full overflow-hidden" },
        h('div', { className: "w-12 h-12 rounded-full bg-cream-100 text-rust-900 flex items-center justify-center font-serif text-xl shrink-0" },
          account.email_address[0].toUpperCase()
        ),
        h('div', { className: "flex-1 min-w-0" },
          account.sender_name
            ? h('div', null,
              h('h3', { className: "font-medium text-white truncate", title: account.sender_name },
                account.sender_name
              ),
              h('p', { className: "text-xs text-white/50 truncate", title: account.email_address }, account.email_address)
            )
            : h('h3', { className: "font-medium text-white truncate", title: account.email_address },
              account.email_address
            )
        )
      )
    ),
    h('div', { className: "flex gap-2 mb-4" },
      h('span', { className: `px-2 py-1 rounded-lg text-xs font-medium uppercase tracking-wider ${getTypeColor(account.account_type)}` },
        account.account_type?.replace('_', ' ')
      ),
      h('span', { className: `px-2 py-1 rounded-lg text-xs font-medium uppercase tracking-wider ${getStatusColor(account.status || 'active')}` },
        account.status || 'active'
      )
    ),
    h('div', { className: "space-y-3" },
      h('div', { className: "flex justify-between text-sm" },
        h('span', { className: "text-white/60" }, 'Daily Limit'),
        h('span', { className: "font-medium text-white" },
          (account.daily_send_limit?.toLocaleString() || '500')
        )
      ),
      h('div', { className: "flex justify-between text-sm" },
        h('span', { className: "text-white/60" }, 'Sent Today'),
        h('span', { className: "font-medium text-white" },
          `${account.sent_today || 0} / ${account.daily_send_limit || 500}`
        )
      ),
      h('div', { className: "w-full bg-white/10 rounded-full h-2" },
        h('div', {
          className: "bg-cream-100 h-2 rounded-full transition-all",
          style: {
            width: `${Math.min(100, ((account.sent_today || 0) / (account.daily_send_limit || 500)) * 100)}%`
          }
        })
      )
    ),
    h('div', { className: "mt-4 pt-4 border-t border-white/10 flex gap-2" },
      h('button', {
        onClick: () => setExpanded(!expanded),
        className: "flex-1 px-3 py-2 text-sm glass-card text-white hover:bg-white/15 transition-colors"
      }, expanded ? 'Less' : 'Details'),
      h('button', {
        onClick: () => onEdit(account),
        className: "px-3 py-2 text-sm text-white/40 hover:text-white glass-card hover:bg-white/15 transition-colors"
      },
        h(Icons.Settings, { size: 16 })
      ),
      h('button', {
        onClick: () => onDelete(account),
        className: "px-3 py-2 text-sm text-red-400 hover:text-red-300 glass-card hover:bg-red-500/10 transition-colors",
        title: "Delete Account"
      },
        h(Icons.Trash2, { size: 16 })
      )
    ),
    expanded && h('div', { className: "mt-4 pt-4 border-t border-white/10 space-y-2 text-sm animate-fade-in" },
      account.sender_name && h('div', { className: "flex justify-between" },
        h('span', { className: "text-white/60" }, 'Sender Name'),
        h('span', { className: "text-white" }, account.sender_name)
      ),
      h('div', { className: "flex justify-between" },
        h('span', { className: "text-white/60" }, 'SMTP Host'),
        h('span', { className: "text-white font-mono text-xs" }, account.smtp_host || 'smtp.example.com')
      ),
      h('div', { className: "flex justify-between" },
        h('span', { className: "text-white/60" }, 'SMTP Port'),
        h('span', { className: "text-white" }, account.smtp_port || 587)
      ),
      h('div', { className: "flex justify-between" },
        h('span', { className: "text-white/60" }, 'IMAP Host'),
        h('span', { className: "text-white font-mono text-xs" }, account.imap_host || 'imap.example.com')
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
      if (type === 'stalwart') {
        setFormData(prev => ({
          ...prev,
          smtp_port: '587',
          imap_port: '993'
        }));
      } else if (type === 'zoho') {
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
      } else if (type === 'outlook') {
        setFormData(prev => ({
          ...prev,
          smtp_host: 'smtp.office365.com',
          smtp_port: '587',
          imap_host: 'outlook.office365.com',
          imap_port: '993'
        }));
      }
    }

    setStep('details');
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const testData = {
        ...formData,
        account_type: accountType,
        id: account?.id
      };

      const result = await api.testEmailAccount(testData);
      setTestResult(result);
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
    className: "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in",
    onClick: onClose
  },
    h('div', {
      className: "glass-modal p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto",
      onClick: (e) => e.stopPropagation()
    },
      h('div', { className: "flex justify-between items-center mb-6" },
        h('h3', { className: "font-serif text-2xl text-white" }, isEditing ? 'Edit Email Account' : 'Add Email Account'),
        h('button', {
          onClick: onClose,
          className: "text-white/40 hover:text-white transition-colors"
        }, h(Icons.X, { size: 24 }))
      ),
      step === 'type' && h('div', { className: "space-y-4" },
        h('p', { className: "text-white/70 mb-6" }, 'Choose your email provider:'),
        h('button', {
          onClick: () => handleTypeSelect('stalwart'),
          className: "w-full p-6 glass-card hover:bg-white/15 hover:border-cream-100/30 transition-all text-left group"
        },
          h('div', { className: "flex items-center gap-4" },
            h('div', { className: "w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-xl group-hover:scale-110 transition-transform" }, 'ST'),
            h('div', null,
              h('h4', { className: "font-medium text-white mb-1" }, 'Stalwart')
            )
          )
        ),
        h('button', {
          onClick: () => handleTypeSelect('aws_workmail'),
          className: "w-full p-6 glass-card hover:bg-white/15 hover:border-cream-100/30 transition-all text-left group"
        },
          h('div', { className: "flex items-center gap-4" },
            h('div', { className: "w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-300 font-bold text-xl group-hover:scale-110 transition-transform" }, 'AWS'),
            h('div', null,
              h('h4', { className: "font-medium text-white mb-1" }, 'AWS')
            )
          )
        ),
        h('button', {
          onClick: () => handleTypeSelect('zoho'),
          className: "w-full p-6 glass-card hover:bg-white/15 hover:border-cream-100/30 transition-all text-left group"
        },
          h('div', { className: "flex items-center gap-4" },
            h('div', { className: "w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-300 font-bold text-xl group-hover:scale-110 transition-transform" }, 'Z'),
            h('div', null,
              h('h4', { className: "font-medium text-white mb-1" }, 'Zoho Mail')
            )
          )
        ),
        h('button', {
          onClick: () => handleTypeSelect('gmail'),
          className: "w-full p-6 glass-card hover:bg-white/15 hover:border-cream-100/30 transition-all text-left group"
        },
          h('div', { className: "flex items-center gap-4" },
            h('div', { className: "w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center text-red-300 font-bold text-xl group-hover:scale-110 transition-transform" }, 'G'),
            h('div', null,
              h('h4', { className: "font-medium text-white mb-1" }, 'Gmail / Google Workspace')
            )
          )
        ),
        h('button', {
          onClick: () => handleTypeSelect('outlook'),
          className: "w-full p-6 glass-card hover:bg-white/15 hover:border-cream-100/30 transition-all text-left group"
        },
          h('div', { className: "flex items-center gap-4" },
            h('div', { className: "w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-300 font-bold text-xl group-hover:scale-110 transition-transform" }, 'M'),
            h('div', null,
              h('h4', { className: "font-medium text-white mb-1" }, 'Microsoft Outlook / Office 365')
            )
          )
        )
      ),
      step === 'details' && h('form', { onSubmit: handleSubmit, className: "space-y-6" },
        accountType === 'stalwart' && h('div', { className: "p-4 glass-card border-indigo-500/30" },
          h('div', { className: "flex gap-3" },
            h(Icons.Server, { size: 20, className: "text-indigo-400 shrink-0 mt-0.5" }),
            h('div', null,
              h('h4', { className: "font-medium text-indigo-300 mb-1" }, 'Stalwart Mail Server Setup'),
              h('p', { className: "text-sm text-indigo-200/80 mb-2" },
                'Connect your self-hosted Stalwart mail server. Uses STARTTLS on port 587 for SMTP and TLS on port 993 for IMAP.'
              ),
              h('ul', { className: "text-sm text-indigo-200/80 list-disc list-inside space-y-1" },
                h('li', { key: 1 }, 'SMTP/IMAP Host: Your server hostname (e.g., mail.yourdomain.com)'),
                h('li', { key: 2 }, 'Username: Your Stalwart account username (usually just the local part, e.g., "storm")'),
                h('li', { key: 3 }, 'Password: The password set in Stalwart for your account')
              )
            )
          )
        ),
        accountType === 'gmail' && h('div', { className: "p-4 glass-card border-red-500/30" },
          h('div', { className: "flex gap-3" },
            h(Icons.AlertCircle, { size: 20, className: "text-red-400 shrink-0 mt-0.5" }),
            h('div', null,
              h('h4', { className: "font-medium text-red-300 mb-1" }, 'Gmail App Password Required'),
              h('p', { className: "text-sm text-red-200/80 mb-2" },
                'Gmail requires App Passwords for third-party applications. You must use an App Password instead of your regular login:'
              ),
              h('ol', { className: "text-sm text-red-200/80 list-decimal list-inside space-y-1" },
                h('li', { key: 1 }, 'Enable 2-Step Verification on your Google account'),
                h('li', { key: 2 }, 'Visit ', h('a', { href: "https://myaccount.google.com/apppasswords", target: "_blank", className: "underline text-red-300" }, 'myaccount.google.com/apppasswords')),
                h('li', { key: 3 }, 'Generate an app password for "Mail"'),
                h('li', { key: 4 }, 'Use that password in the IMAP/SMTP password fields below')
              )
            )
          )
        ),
        accountType === 'outlook' && h('div', { className: "p-4 glass-card border-blue-500/30" },
          h('div', { className: "flex gap-3" },
            h(Icons.AlertCircle, { size: 20, className: "text-blue-400 shrink-0 mt-0.5" }),
            h('div', null,
              h('h4', { className: "font-medium text-blue-300 mb-1" }, 'Outlook App Password Required'),
              h('p', { className: "text-sm text-blue-200/80 mb-2" },
                'Microsoft disabled basic authentication. You must use an App Password:'
              ),
              h('ol', { className: "text-sm text-blue-200/80 list-decimal list-inside space-y-1" },
                h('li', { key: 1 }, 'Visit ', h('a', { href: "https://account.microsoft.com/security", target: "_blank", className: "underline text-blue-300" }, 'account.microsoft.com/security')),
                h('li', { key: 2 }, 'Go to "Advanced security options"'),
                h('li', { key: 3 }, 'Create a new app password'),
                h('li', { key: 4 }, 'Use that password in the IMAP/SMTP password fields below')
              )
            )
          )
        ),
        accountType === 'zoho' && h('div', { className: "p-4 glass-card border-purple-500/30" },
          h('div', { className: "flex gap-3" },
            h(Icons.Info, { size: 20, className: "text-purple-400 shrink-0 mt-0.5" }),
            h('div', null,
              h('h4', { className: "font-medium text-purple-300 mb-1" }, 'Zoho App Password Setup'),
              h('p', { className: "text-sm text-purple-200/80 mb-2" },
                'If you have Two-Factor Authentication (TFA) enabled, you must use an Application Specific Password:'
              ),
              h('ol', { className: "text-sm text-purple-200/80 list-decimal list-inside space-y-1" },
                h('li', { key: 1 }, 'Log in to ', h('a', { href: "https://accounts.zoho.com/home#security/app_password", target: "_blank", className: "underline text-purple-300" }, 'accounts.zoho.com')),
                h('li', { key: 2 }, 'Go to Security > App Passwords'),
                h('li', { key: 3 }, 'Generate a new password (e.g. name it "MrSnowman")'),
                h('li', { key: 4 }, 'Use that password in the IMAP/SMTP password fields below')
              )
            )
          )
        ),
        accountType === 'aws_workmail' && h('div', { className: "p-4 glass-card border-orange-500/30" },
          h('div', { className: "flex gap-3" },
            h(Icons.Server, { size: 20, className: "text-orange-400 shrink-0 mt-0.5" }),
            h('div', null,
              h('h4', { className: "font-medium text-orange-300 mb-1" }, 'AWS SMTP Credentials'),
              h('p', { className: "text-sm text-orange-200/80 mb-2" },
                'For AWS SES/WorkMail, ensure you use SMTP credentials, not IAM user credentials:'
              ),
              h('ol', { className: "text-sm text-orange-200/80 list-decimal list-inside space-y-1" },
                h('li', { key: 1 }, 'Go to the AWS SES Console -> SMTP Settings'),
                h('li', { key: 2 }, 'Click "Create My SMTP Credentials"'),
                h('li', { key: 3 }, 'Use the generated SMTP Username and Password below'),
                h('li', { key: 4 }, 'Note: These are different from your AWS console login!')
              )
            )
          )
        ),
        h('div', null,
          h(LabelWithTooltip, {
            label: 'Email Address',
            helpText: 'The full email address you want to send campaigns from (e.g. john@company.com).'
          }),
          h('input', {
            type: "email",
            required: true,
            value: formData.email_address,
            onChange: (e) => {
              const email = e.target.value;
              const updates = { email_address: email };
              if (accountType === 'stalwart' && email.includes('@')) {
                const domain = email.split('@')[1];
                if (!formData.smtp_host) updates.smtp_host = 'mail.' + domain;
                if (!formData.imap_host) updates.imap_host = 'mail.' + domain;
              }
              setFormData(prev => ({ ...prev, ...updates }));
            },
            className: "w-full px-4 py-3 glass-input rounded-xl transition-all",
            placeholder: "john@company.com"
          })
        ),
        h('div', null,
          h(LabelWithTooltip, {
            label: 'Sender Display Name',
            helpText: 'How your name appears in the recipient\'s inbox. E.g., "John Smith" results in "John Smith <john@company.com>". Essential for high deliverability.'
          }),
          h('input', {
            type: "text",
            value: formData.sender_name,
            onChange: (e) => setFormData({ ...formData, sender_name: e.target.value }),
            className: "w-full px-4 py-3 glass-input rounded-xl transition-all",
            placeholder: "John Smith"
          }),
          h('p', { className: "text-xs text-white/50 mt-1" }, 'How your name appears in the From field.')
        ),
        h('div', { className: "p-4 glass-card space-y-4" },
          h('h4', { className: "font-medium text-white" }, 'SMTP Settings (Outgoing)'),
          h('div', { className: "grid grid-cols-2 gap-4" },
            h('div', null,
              h(LabelWithTooltip, {
                label: 'SMTP Host',
                helpText: 'The server address for sending emails (e.g. smtp.gmail.com, smtp.office365.com).'
              }),
              h('input', {
                type: "text",
                required: true,
                value: formData.smtp_host,
                onChange: (e) => setFormData({ ...formData, smtp_host: e.target.value }),
                className: "w-full px-4 py-3 glass-input rounded-xl transition-all",
                placeholder: "smtp.example.com"
              })
            ),
            h('div', null,
              h(LabelWithTooltip, {
                label: 'SMTP Port',
                helpText: 'Usually 587 (STARTTLS) or 465 (SSL/TLS). Port 25 is not recommended.'
              }),
              h('input', {
                type: "number",
                required: true,
                value: formData.smtp_port,
                onChange: (e) => setFormData({ ...formData, smtp_port: e.target.value }),
                className: "w-full px-4 py-3 glass-input rounded-xl transition-all"
              })
            )
          ),
          h('div', { className: "grid grid-cols-2 gap-4" },
            h('div', null,
              h(LabelWithTooltip, {
                label: 'SMTP Username',
                helpText: 'Usually your full email address. Some providers use a different username.'
              }),
              h('input', {
                type: "text",
                required: true,
                value: formData.smtp_username,
                onChange: (e) => setFormData({ ...formData, smtp_username: e.target.value }),
                className: "w-full px-4 py-3 glass-input rounded-xl transition-all"
              })
            ),
            h('div', null,
              h(LabelWithTooltip, {
                label: 'SMTP Password',
                helpText: 'Your email password or App Password. If editing, leave blank to keep the existing password.'
              }),
              h('input', {
                type: "password",
                required: !isEditing,
                placeholder: isEditing ? '(Leave blank to keep unchanged)' : '',
                value: formData.smtp_password,
                onChange: (e) => setFormData({ ...formData, smtp_password: e.target.value }),
                className: "w-full px-4 py-3 glass-input rounded-xl transition-all"
              })
            )
          )
        ),
        h('div', { className: "p-4 glass-card space-y-4" },
          h('h4', { className: "font-medium text-white" }, 'IMAP Settings (Incoming)'),
          h('div', { className: "grid grid-cols-2 gap-4" },
            h('div', null,
              h(LabelWithTooltip, {
                label: 'IMAP Host',
                helpText: 'The server address for receiving emails (e.g. imap.gmail.com).'
              }),
              h('input', {
                type: "text",
                required: true,
                value: formData.imap_host,
                onChange: (e) => setFormData({ ...formData, imap_host: e.target.value }),
                className: "w-full px-4 py-3 glass-input rounded-xl transition-all",
                placeholder: "imap.example.com"
              })
            ),
            h('div', null,
              h(LabelWithTooltip, {
                label: 'IMAP Port',
                helpText: 'Usually 993 (SSL/TLS) or 143 (STARTTLS).'
              }),
              h('input', {
                type: "number",
                required: true,
                value: formData.imap_port,
                onChange: (e) => setFormData({ ...formData, imap_port: e.target.value }),
                className: "w-full px-4 py-3 glass-input rounded-xl transition-all"
              })
            )
          ),
          h('div', { className: "grid grid-cols-2 gap-4" },
            h('div', null,
              h(LabelWithTooltip, {
                label: 'IMAP Username',
                helpText: 'Usually your full email address.'
              }),
              h('input', {
                type: "text",
                required: true,
                value: formData.imap_username,
                onChange: (e) => setFormData({ ...formData, imap_username: e.target.value }),
                className: "w-full px-4 py-3 glass-input rounded-xl transition-all"
              })
            ),
            h('div', null,
              h(LabelWithTooltip, {
                label: 'IMAP Password',
                helpText: 'Your email password or App Password (same as SMTP). If editing, leave blank to keep existing.'
              }),
              h('input', {
                type: "password",
                required: !isEditing,
                placeholder: isEditing ? '(Leave blank to keep unchanged)' : '',
                value: formData.imap_password,
                onChange: (e) => setFormData({ ...formData, imap_password: e.target.value }),
                className: "w-full px-4 py-3 glass-input rounded-xl transition-all"
              })
            )
          )
        ),
        h('div', null,
          h(LabelWithTooltip, {
            label: 'Daily Send Limit',
            helpText: 'Maximum emails to send from this account per day. Used to respect provider limits (e.g. Gmail ~500/day, paid Workspace ~2000/day).'
          }),
          h('input', {
            type: "number",
            required: true,
            value: formData.daily_send_limit,
            onChange: (e) => setFormData({ ...formData, daily_send_limit: e.target.value }),
            className: "w-full px-4 py-3 glass-input rounded-xl transition-all"
          })
        ),
        testResult && h('div', {
          className: `p-4 rounded-xl space-y-2 ${testResult.success
            ? 'bg-green-500/20 border border-green-500/30 text-green-300'
            : 'bg-red-500/20 border border-red-500/30 text-red-300'
            }`
        },
          h('div', { className: "flex items-center gap-2 font-medium" },
            testResult.success ? h(Icons.Check, { size: 20 }) : h(Icons.AlertCircle, { size: 20 }),
            testResult.message
          ),
          testResult.results && h('div', { className: "mt-2 pt-2 border-t border-white/10 text-sm space-y-1" },
            testResult.results.smtp && h('div', { className: "flex items-center gap-2 justify-between" },
              h('span', null, 'SMTP (Outgoing):'),
              testResult.results.smtp.success
                ? h('span', { className: "text-green-300 flex items-center gap-1" }, h(Icons.Check, { size: 14 }), 'Connected')
                : h('span', { className: "text-red-300 flex items-center gap-1" }, h(Icons.X, { size: 14 }), 'Failed')
            ),
            (!testResult.results.smtp?.success && testResult.results.smtp?.message) &&
            h('p', { className: "text-xs opacity-80 pl-2 border-l-2 border-white/20 ml-1" }, testResult.results.smtp.message),

            testResult.results.imap && h('div', { className: "flex items-center gap-2 justify-between mt-2" },
              h('span', null, 'IMAP (Incoming):'),
              testResult.results.imap.success
                ? h('span', { className: "text-green-300 flex items-center gap-1" }, h(Icons.Check, { size: 14 }), 'Connected')
                : h('span', { className: "text-red-300 flex items-center gap-1" }, h(Icons.X, { size: 14 }), 'Failed')
            ),
            (!testResult.results.imap?.success && testResult.results.imap?.message) &&
            h('p', { className: "text-xs opacity-80 pl-2 border-l-2 border-white/20 ml-1" }, testResult.results.imap.message)
          )
        ),
        h('div', { className: "flex gap-3" },
          !isEditing && h('button', {
            type: "button",
            onClick: () => setStep('type'),
            className: "px-4 py-3 glass-card text-white hover:bg-white/15 rounded-full transition-colors"
          }, 'Back'),
          h('button', {
            type: "button",
            onClick: handleTest,
            disabled: testing,
            className: "px-4 py-3 glass-card text-white hover:bg-white/15 rounded-full transition-colors flex items-center gap-2"
          },
            testing ? h(Icons.Loader2, { size: 16, className: "animate-spin" }) : h(Icons.Zap, { size: 16 }),
            'Test Connection'
          ),
          h('button', {
            type: "submit",
            className: "flex-1 px-4 py-3 bg-cream-100 text-rust-900 rounded-full hover:bg-cream-200 transition-colors font-medium"
          }, isEditing ? 'Save Changes' : 'Add Account')
        )
      )
    )
  );
};
