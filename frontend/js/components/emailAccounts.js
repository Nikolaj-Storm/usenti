// Mr. Snowman - Email Accounts / Infrastructure Component


const EmailAccounts = () => {
  const [activeTab, setActiveTab] = React.useState('accounts');
  const [accounts, setAccounts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddAccountModal, setShowAddAccountModal] = React.useState(false);

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

  const handleAddAccount = async (accountData) => {
    try {
      const newAccount = await api.createEmailAccount(accountData);
      setAccounts([...accounts, newAccount]);
      setShowAddAccountModal(false);
      alert('Account added successfully!');
    } catch (error) {
      console.error('Failed to add account:', error);
      throw error;
    }
  };

  return h('div', { className: "space-y-6 animate-fade-in" },
    h('div', { className: "flex justify-between items-end" },
      h('div', null,
        h('h2', { className: "font-serif text-3xl text-jaguar-900" }, 'Infrastructure'),
        h('p', { className: "text-stone-500 mt-2 font-light" }, 'Manage your email accounts and warm-up engine.')
      ),
      activeTab === 'accounts' && h('button', {
        onClick: () => setShowAddAccountModal(true),
        className: "px-4 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 font-medium flex items-center gap-2 transition-colors"
      },
        h(Icons.Plus, { size: 18 }),
        ' Add Account'
      )
    ),
    h('div', { className: "border-b border-stone-200" },
      h('div', { className: "flex gap-8" },
        h('button', {
          onClick: () => setActiveTab('accounts'),
          className: `pb-3 border-b-2 font-medium transition-all ${
            activeTab === 'accounts'
              ? 'border-jaguar-900 text-jaguar-900'
              : 'border-transparent text-stone-500 hover:text-jaguar-900 hover:border-stone-300'
          }`
        }, 'Connected Accounts'),
        h('button', {
          onClick: () => setActiveTab('warmup'),
          className: `pb-3 border-b-2 font-medium transition-all ${
            activeTab === 'warmup'
              ? 'border-jaguar-900 text-jaguar-900'
              : 'border-transparent text-stone-500 hover:text-jaguar-900 hover:border-stone-300'
          }`
        }, 'Warm-up Engine')
      )
    ),
    loading
      ? h('div', { className: "flex justify-center py-12" },
          h(Icons.Loader2, { size: 48, className: "text-jaguar-900" })
        )
      : activeTab === 'accounts'
        ? h(AccountsTab, { accounts: accounts, onRefresh: loadAccounts })
        : h(WarmupTab, { accounts: accounts }),
    showAddAccountModal && h(AddAccountModal, {
      onClose: () => setShowAddAccountModal(false),
      onAdd: handleAddAccount
    })
  );
};

const AccountsTab = ({ accounts, onRefresh }) => {
  if (accounts.length === 0) {
    return h('div', { className: "flex flex-col items-center justify-center py-16 text-center" },
      h(Icons.Server, { size: 64, className: "text-stone-300 mb-4" }),
      h('h3', { className: "font-serif text-2xl text-jaguar-900 mb-2" }, 'No Accounts Connected'),
      h('p', { className: "text-stone-500 mb-6 max-w-md" }, 'Connect your first email account to start sending campaigns.')
    );
  }

  return h('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" },
    ...accounts.map((account) =>
      h(AccountCard, { key: account.id, account: account, onRefresh: onRefresh })
    )
  );
};

const AccountCard = ({ account, onRefresh }) => {
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
      h('div', { className: "flex items-center gap-3" },
        h('div', { className: "w-12 h-12 rounded-full bg-jaguar-900 text-cream-50 flex items-center justify-center font-serif text-xl" },
          account.email_address[0].toUpperCase()
        ),
        h('div', { className: "flex-1 min-w-0" },
          h('h3', { className: "font-medium text-jaguar-900 truncate", title: account.email_address },
            account.email_address
          ),
          h('div', { className: "flex items-center gap-1 text-xs text-green-600" },
            h(Icons.ShieldCheck, { size: 12 }),
            h('span', null, 'Verified')
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
      ),
      h('div', { className: "flex justify-between text-sm" },
        h('span', { className: "text-stone-500" }, 'Health Score'),
        h('span', {
          className: `font-medium ${
            (account.health_score || 100) >= 80 ? 'text-green-600' :
            (account.health_score || 100) >= 60 ? 'text-amber-600' :
            'text-red-600'
          }`
        }, `${account.health_score || 100}%`)
      )
    ),
    h('div', { className: "mt-4 pt-4 border-t border-stone-100 flex gap-2" },
      h('button', {
        onClick: () => setExpanded(!expanded),
        className: "flex-1 px-3 py-2 text-sm border border-stone-200 rounded-md hover:bg-stone-50 transition-colors"
      }, expanded ? 'Less' : 'Details'),
      h('button', { className: "px-3 py-2 text-sm text-stone-400 hover:text-stone-600 border border-stone-200 rounded-md hover:bg-stone-50 transition-colors" },
        h(Icons.Settings, { size: 16 })
      )
    ),
    expanded && h('div', { className: "mt-4 pt-4 border-t border-stone-100 space-y-2 text-sm animate-fade-in" },
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
      ),
      h('div', { className: "flex justify-between" },
        h('span', { className: "text-stone-500" }, 'Warm-up Status'),
        h('span', { className: "text-jaguar-900" }, account.warmup_enabled ? 'Enabled' : 'Disabled')
      )
    )
  );
};

const WarmupTab = ({ accounts }) => {
  const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } = window.Recharts;

  const volumeData = [
    { day: 'Day 1', sent: 10, target: 10 },
    { day: 'Day 2', sent: 15, target: 15 },
    { day: 'Day 3', sent: 22, target: 25 },
    { day: 'Day 4', sent: 35, target: 35 },
    { day: 'Day 5', sent: 48, target: 50 },
    { day: 'Day 6', sent: 68, target: 70 },
    { day: 'Day 7', sent: 95, target: 100 },
  ];

  const replyRateData = [
    { day: 'Day 1', rate: 85 },
    { day: 'Day 2', rate: 82 },
    { day: 'Day 3', rate: 88 },
    { day: 'Day 4', rate: 90 },
    { day: 'Day 5', rate: 87 },
    { day: 'Day 6', rate: 92 },
    { day: 'Day 7', rate: 94 },
  ];

  const warmupAccounts = accounts.filter(a => a.warmup_enabled);
  const activeWarmups = warmupAccounts.filter(a => a.status === 'warming').length;

  return h('div', { className: "space-y-6" },
    h('div', { className: "grid grid-cols-1 md:grid-cols-4 gap-6" },
      h('div', { className: "bg-white p-6 rounded-lg border border-stone-200" },
        h('div', { className: "flex items-center gap-3 mb-2" },
          h('div', { className: "w-10 h-10 rounded-full bg-jaguar-100 flex items-center justify-center" },
            h(Icons.Flame, { size: 20, className: "text-gold-600" })
          ),
          h('div', null,
            h('p', { className: "text-sm text-stone-500" }, 'Active Warmups'),
            h('h3', { className: "text-2xl font-serif text-jaguar-900" }, activeWarmups)
          )
        )
      ),
      h('div', { className: "bg-white p-6 rounded-lg border border-stone-200" },
        h('div', { className: "flex items-center gap-3 mb-2" },
          h('div', { className: "w-10 h-10 rounded-full bg-green-100 flex items-center justify-center" },
            h(Icons.Mail, { size: 20, className: "text-green-600" })
          ),
          h('div', null,
            h('p', { className: "text-sm text-stone-500" }, 'Emails Sent'),
            h('h3', { className: "text-2xl font-serif text-jaguar-900" }, '1,247')
          )
        )
      ),
      h('div', { className: "bg-white p-6 rounded-lg border border-stone-200" },
        h('div', { className: "flex items-center gap-3 mb-2" },
          h('div', { className: "w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center" },
            h(Icons.ArrowUpRight, { size: 20, className: "text-blue-600" })
          ),
          h('div', null,
            h('p', { className: "text-sm text-stone-500" }, 'Avg Reply Rate'),
            h('h3', { className: "text-2xl font-serif text-jaguar-900" }, '88%')
          )
        )
      ),
      h('div', { className: "bg-white p-6 rounded-lg border border-stone-200" },
        h('div', { className: "flex items-center gap-3 mb-2" },
          h('div', { className: "w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center" },
            h(Icons.Zap, { size: 20, className: "text-amber-600" })
          ),
          h('div', null,
            h('p', { className: "text-sm text-stone-500" }, 'Avg Health'),
            h('h3', { className: "text-2xl font-serif text-jaguar-900" }, '92%')
          )
        )
      )
    ),
    h('div', { className: "grid grid-cols-1 lg:grid-cols-2 gap-6" },
      h('div', { className: "bg-white border border-stone-200 rounded-lg p-6" },
        h('h3', { className: "font-serif text-xl text-jaguar-900 mb-4" }, 'Volume Progression'),
        h('div', { className: "h-[300px]" },
          h(ResponsiveContainer, { width: "100%", height: "100%" },
            h(LineChart, { data: volumeData, margin: { top: 5, right: 20, left: 0, bottom: 5 } },
              h(CartesianGrid, { strokeDasharray: "3 3", vertical: false, stroke: "#E5E7EB" }),
              h(XAxis, { dataKey: "day", axisLine: false, tickLine: false, tick: { fill: '#9CA3AF', fontSize: 12 } }),
              h(YAxis, { axisLine: false, tickLine: false, tick: { fill: '#9CA3AF', fontSize: 12 } }),
              h(Tooltip, {
                contentStyle: {
                  backgroundColor: '#FFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize: '12px'
                }
              }),
              h(Line, { type: "monotone", dataKey: "target", stroke: "#D1D5DB", strokeWidth: 2, strokeDasharray: "5 5", dot: false }),
              h(Line, { type: "monotone", dataKey: "sent", stroke: "#0B2B26", strokeWidth: 2, dot: { fill: '#0B2B26', r: 4 } })
            )
          )
        )
      ),
      h('div', { className: "bg-white border border-stone-200 rounded-lg p-6" },
        h('h3', { className: "font-serif text-xl text-jaguar-900 mb-4" }, 'Reply Rate Trend'),
        h('div', { className: "h-[300px]" },
          h(ResponsiveContainer, { width: "100%", height: "100%" },
            h(BarChart, { data: replyRateData, margin: { top: 5, right: 20, left: 0, bottom: 5 } },
              h(CartesianGrid, { strokeDasharray: "3 3", vertical: false, stroke: "#E5E7EB" }),
              h(XAxis, { dataKey: "day", axisLine: false, tickLine: false, tick: { fill: '#9CA3AF', fontSize: 12 } }),
              h(YAxis, { axisLine: false, tickLine: false, tick: { fill: '#9CA3AF', fontSize: 12 } }),
              h(Tooltip, {
                contentStyle: {
                  backgroundColor: '#FFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize: '12px'
                }
              }),
              h(Bar, { dataKey: "rate", fill: "#C5A065", radius: [4, 4, 0, 0] })
            )
          )
        )
      )
    ),
    h('div', { className: "bg-white border border-stone-200 rounded-lg overflow-hidden" },
      h('div', { className: "px-6 py-4 bg-cream-50 border-b border-stone-200" },
        h('h3', { className: "font-serif text-xl text-jaguar-900" }, 'Account Warmup Status')
      ),
      h('div', { className: "divide-y divide-stone-100" },
        warmupAccounts.length === 0
          ? h('div', { className: "px-6 py-12 text-center text-stone-500" },
              h(Icons.Flame, { size: 48, className: "mx-auto mb-3 text-stone-300" }),
              h('p', null, 'No accounts with warmup enabled')
            )
          : warmupAccounts.map((account) =>
              h(WarmupAccountRow, { key: account.id, account: account })
            )
      )
    ),
    h('div', { className: "bg-cream-50 border border-stone-200 rounded-lg p-6" },
      h('div', { className: "flex gap-4" },
        h(Icons.AlertCircle, { size: 24, className: "text-gold-600 shrink-0" }),
        h('div', null,
          h('h4', { className: "font-medium text-jaguar-900 mb-2" }, 'How Warmup Works'),
          h('p', { className: "text-sm text-stone-600 leading-relaxed mb-3" },
            'Our AI-driven warmup engine gradually increases your sending volume while maintaining natural conversation patterns. This helps establish a positive sender reputation with email providers.'
          ),
          h('ul', { className: "text-sm text-stone-600 space-y-1 list-disc list-inside" },
            h('li', null, 'Starts with 10-15 emails per day'),
            h('li', null, 'Gradually increases to your target limit over 14-21 days'),
            h('li', null, 'Monitors reply rates and engagement'),
            h('li', null, 'Automatically adjusts based on deliverability signals')
          )
        )
      )
    )
  );
};

const WarmupAccountRow = ({ account }) => {
  const daysActive = 7;
  const currentVolume = account.sent_today || 0;
  const targetVolume = account.daily_send_limit || 500;
  const progress = Math.min(100, (currentVolume / targetVolume) * 100);

  return h('div', { className: "px-6 py-4 hover:bg-cream-50 transition-colors" },
    h('div', { className: "flex items-center justify-between mb-3" },
      h('div', { className: "flex items-center gap-3" },
        h('div', { className: "w-10 h-10 rounded-full bg-jaguar-900 text-cream-50 flex items-center justify-center text-sm font-medium" },
          account.email_address[0].toUpperCase()
        ),
        h('div', null,
          h('h4', { className: "font-medium text-jaguar-900" }, account.email_address),
          h('p', { className: "text-xs text-stone-500" }, `Day ${daysActive} of warmup`)
        )
      ),
      h('div', { className: "text-right" },
        h('div', { className: "text-sm font-medium text-jaguar-900" }, `${currentVolume} / ${targetVolume}`),
        h('div', { className: "text-xs text-stone-500" }, 'emails today')
      )
    ),
    h('div', { className: "w-full bg-stone-100 rounded-full h-2" },
      h('div', {
        className: "bg-gold-500 h-2 rounded-full transition-all",
        style: { width: `${progress}%` }
      })
    )
  );
};

const AddAccountModal = ({ onClose, onAdd }) => {
  const [step, setStep] = React.useState('type');
  const [accountType, setAccountType] = React.useState('');
  const [formData, setFormData] = React.useState({
    email_address: '',
    smtp_host: '',
    smtp_port: '587',
    smtp_username: '',
    smtp_password: '',
    imap_host: '',
    imap_port: '993',
    imap_username: '',
    imap_password: '',
    daily_send_limit: '500',
    warmup_enabled: true
  });
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState(null);

  const handleTypeSelect = (type) => {
    setAccountType(type);

    if (type === 'zoho') {
      setFormData({
        ...formData,
        smtp_host: 'smtp.zoho.com',
        smtp_port: '587',
        imap_host: 'imap.zoho.com',
        imap_port: '993'
      });
    } else if (type === 'gmail') {
      setFormData({
        ...formData,
        smtp_host: 'smtp.gmail.com',
        smtp_port: '587',
        imap_host: 'imap.gmail.com',
        imap_port: '993'
      });

      // Show app password info for Gmail
      alert('⚠️ Important: Gmail requires App Passwords for third-party applications.\n\nTo connect your Gmail account:\n\n1. Enable 2-Step Verification on your Google account\n2. Go to https://myaccount.google.com/apppasswords\n3. Generate an app password for "Mail"\n4. Use that password (not your regular password) in the IMAP/SMTP password fields');
    } else if (type === 'outlook') {
      setFormData({
        ...formData,
        smtp_host: 'smtp.office365.com',
        smtp_port: '587',
        imap_host: 'outlook.office365.com',
        imap_port: '993'
      });

      // Show OAuth 2.0 warning for Outlook
      alert('⚠️ Important: Microsoft disabled basic authentication for Outlook/Office 365 in late 2022.\n\nTo connect your Outlook account, you MUST use an App Password:\n\n1. Go to https://account.microsoft.com/security\n2. Navigate to "Advanced security options"\n3. Create a new app password\n4. Use that password (not your regular password) in the IMAP/SMTP password fields\n\nIf app passwords are disabled by your organization, you will need to contact your IT administrator.');
    }

    setStep('details');
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const result = await api.testEmailAccount({
        ...formData,
        account_type: accountType
      });
      setTestResult({ success: true, message: result.message || 'Connection successful!' });
    } catch (error) {
      setTestResult({ success: false, message: error.message || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await onAdd({
        ...formData,
        account_type: accountType
      });
    } catch (error) {
      alert('Failed to add account: ' + error.message);
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
        h('h3', { className: "font-serif text-2xl text-jaguar-900" }, 'Add Email Account'),
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
                required: true,
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
                required: true,
                value: formData.imap_password,
                onChange: (e) => setFormData({ ...formData, imap_password: e.target.value }),
                className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
              })
            )
          )
        ),
        h('div', { className: "grid grid-cols-2 gap-4" },
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
          h('div', null,
            h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Warmup'),
            h('label', { className: "flex items-center gap-2 mt-2 cursor-pointer" },
              h('input', {
                type: "checkbox",
                checked: formData.warmup_enabled,
                onChange: (e) => setFormData({ ...formData, warmup_enabled: e.target.checked }),
                className: "rounded"
              }),
              h('span', { className: "text-sm text-stone-600" }, 'Enable warmup engine')
            )
          )
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
          h('button', {
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
            testing ? h(Icons.Loader2, { size: 16 }) : h(Icons.Zap, { size: 16 }),
            'Test Connection'
          ),
          h('button', {
            type: "submit",
            className: "flex-1 px-4 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 transition-colors"
          }, 'Add Account')
        )
      )
    )
  );
};
