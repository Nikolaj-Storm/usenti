// Mr. Snowman - Email Accounts / Infrastructure Component

const { useState, useEffect } = React;

const EmailAccounts = () => {
  const [activeTab, setActiveTab] = useState('accounts'); // 'accounts' or 'warmup'
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);

  useEffect(() => {
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-serif text-3xl text-jaguar-900">Infrastructure</h2>
          <p className="text-stone-500 mt-2 font-light">Manage your email accounts and warm-up engine.</p>
        </div>
        {activeTab === 'accounts' && (
          <button
            onClick={() => setShowAddAccountModal(true)}
            className="px-4 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 font-medium flex items-center gap-2 transition-colors"
          >
            <Icons.Plus size={18} /> Add Account
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-stone-200">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`pb-3 border-b-2 font-medium transition-all ${
              activeTab === 'accounts'
                ? 'border-jaguar-900 text-jaguar-900'
                : 'border-transparent text-stone-500 hover:text-jaguar-900 hover:border-stone-300'
            }`}
          >
            Connected Accounts
          </button>
          <button
            onClick={() => setActiveTab('warmup')}
            className={`pb-3 border-b-2 font-medium transition-all ${
              activeTab === 'warmup'
                ? 'border-jaguar-900 text-jaguar-900'
                : 'border-transparent text-stone-500 hover:text-jaguar-900 hover:border-stone-300'
            }`}
          >
            Warm-up Engine
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Icons.Loader2 size={48} className="text-jaguar-900" />
        </div>
      ) : activeTab === 'accounts' ? (
        <AccountsTab accounts={accounts} onRefresh={loadAccounts} />
      ) : (
        <WarmupTab accounts={accounts} />
      )}

      {/* Add Account Modal */}
      {showAddAccountModal && (
        <AddAccountModal
          onClose={() => setShowAddAccountModal(false)}
          onAdd={handleAddAccount}
        />
      )}
    </div>
  );
};

// Accounts Tab Component
const AccountsTab = ({ accounts, onRefresh }) => {
  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Icons.Server size={64} className="text-stone-300 mb-4" />
        <h3 className="font-serif text-2xl text-jaguar-900 mb-2">No Accounts Connected</h3>
        <p className="text-stone-500 mb-6 max-w-md">
          Connect your first email account to start sending campaigns.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {accounts.map((account) => (
        <AccountCard key={account.id} account={account} onRefresh={onRefresh} />
      ))}
    </div>
  );
};

// Account Card Component
const AccountCard = ({ account, onRefresh }) => {
  const [expanded, setExpanded] = useState(false);

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
      case 'gmail':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-stone-100 text-stone-600';
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-6 hover:shadow-lg transition-all group">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-jaguar-900 text-cream-50 flex items-center justify-center font-serif text-xl">
            {account.email_address[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-jaguar-900 truncate" title={account.email_address}>
              {account.email_address}
            </h3>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <Icons.ShieldCheck size={12} />
              <span>Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex gap-2 mb-4">
        <span className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${getTypeColor(account.account_type)}`}>
          {account.account_type?.replace('_', ' ')}
        </span>
        <span className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${getStatusColor(account.status || 'active')}`}>
          {account.status || 'active'}
        </span>
      </div>

      {/* Stats */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">Daily Limit</span>
          <span className="font-medium text-jaguar-900">
            {account.daily_send_limit?.toLocaleString() || '500'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">Sent Today</span>
          <span className="font-medium text-jaguar-900">
            {account.sent_today || 0} / {account.daily_send_limit || 500}
          </span>
        </div>
        <div className="w-full bg-stone-100 rounded-full h-2">
          <div
            className="bg-jaguar-900 h-2 rounded-full transition-all"
            style={{
              width: `${Math.min(100, ((account.sent_today || 0) / (account.daily_send_limit || 500)) * 100)}%`
            }}
          ></div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">Health Score</span>
          <span className={`font-medium ${
            (account.health_score || 100) >= 80 ? 'text-green-600' :
            (account.health_score || 100) >= 60 ? 'text-amber-600' :
            'text-red-600'
          }`}>
            {account.health_score || 100}%
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 pt-4 border-t border-stone-100 flex gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 px-3 py-2 text-sm border border-stone-200 rounded-md hover:bg-stone-50 transition-colors"
        >
          {expanded ? 'Less' : 'Details'}
        </button>
        <button className="px-3 py-2 text-sm text-stone-400 hover:text-stone-600 border border-stone-200 rounded-md hover:bg-stone-50 transition-colors">
          <Icons.Settings size={16} />
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-stone-100 space-y-2 text-sm animate-fade-in">
          <div className="flex justify-between">
            <span className="text-stone-500">SMTP Host</span>
            <span className="text-jaguar-900 font-mono text-xs">{account.smtp_host || 'smtp.example.com'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">SMTP Port</span>
            <span className="text-jaguar-900">{account.smtp_port || 587}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">IMAP Host</span>
            <span className="text-jaguar-900 font-mono text-xs">{account.imap_host || 'imap.example.com'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Warm-up Status</span>
            <span className="text-jaguar-900">{account.warmup_enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Warmup Tab Component
const WarmupTab = ({ accounts }) => {
  const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } = window.Recharts;

  // Mock data for warmup stats
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

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border border-stone-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-jaguar-100 flex items-center justify-center">
              <Icons.Flame size={20} className="text-gold-600" />
            </div>
            <div>
              <p className="text-sm text-stone-500">Active Warmups</p>
              <h3 className="text-2xl font-serif text-jaguar-900">{activeWarmups}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-stone-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Icons.Mail size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-stone-500">Emails Sent</p>
              <h3 className="text-2xl font-serif text-jaguar-900">1,247</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-stone-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Icons.ArrowUpRight size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-stone-500">Avg Reply Rate</p>
              <h3 className="text-2xl font-serif text-jaguar-900">88%</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-stone-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Icons.Zap size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-stone-500">Avg Health</p>
              <h3 className="text-2xl font-serif text-jaguar-900">92%</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume Progression */}
        <div className="bg-white border border-stone-200 rounded-lg p-6">
          <h3 className="font-serif text-xl text-jaguar-900 mb-4">Volume Progression</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volumeData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Line type="monotone" dataKey="target" stroke="#D1D5DB" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="sent" stroke="#0B2B26" strokeWidth={2} dot={{ fill: '#0B2B26', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Reply Rate */}
        <div className="bg-white border border-stone-200 rounded-lg p-6">
          <h3 className="font-serif text-xl text-jaguar-900 mb-4">Reply Rate Trend</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={replyRateData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="rate" fill="#C5A065" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Account Warmup Status */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-cream-50 border-b border-stone-200">
          <h3 className="font-serif text-xl text-jaguar-900">Account Warmup Status</h3>
        </div>
        <div className="divide-y divide-stone-100">
          {warmupAccounts.length === 0 ? (
            <div className="px-6 py-12 text-center text-stone-500">
              <Icons.Flame size={48} className="mx-auto mb-3 text-stone-300" />
              <p>No accounts with warmup enabled</p>
            </div>
          ) : (
            warmupAccounts.map((account) => (
              <WarmupAccountRow key={account.id} account={account} />
            ))
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-cream-50 border border-stone-200 rounded-lg p-6">
        <div className="flex gap-4">
          <Icons.AlertCircle size={24} className="text-gold-600 shrink-0" />
          <div>
            <h4 className="font-medium text-jaguar-900 mb-2">How Warmup Works</h4>
            <p className="text-sm text-stone-600 leading-relaxed mb-3">
              Our AI-driven warmup engine gradually increases your sending volume while maintaining natural conversation patterns.
              This helps establish a positive sender reputation with email providers.
            </p>
            <ul className="text-sm text-stone-600 space-y-1 list-disc list-inside">
              <li>Starts with 10-15 emails per day</li>
              <li>Gradually increases to your target limit over 14-21 days</li>
              <li>Monitors reply rates and engagement</li>
              <li>Automatically adjusts based on deliverability signals</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Warmup Account Row Component
const WarmupAccountRow = ({ account }) => {
  const daysActive = 7; // Mock data
  const currentVolume = account.sent_today || 0;
  const targetVolume = account.daily_send_limit || 500;
  const progress = Math.min(100, (currentVolume / targetVolume) * 100);

  return (
    <div className="px-6 py-4 hover:bg-cream-50 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-jaguar-900 text-cream-50 flex items-center justify-center text-sm font-medium">
            {account.email_address[0].toUpperCase()}
          </div>
          <div>
            <h4 className="font-medium text-jaguar-900">{account.email_address}</h4>
            <p className="text-xs text-stone-500">Day {daysActive} of warmup</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-jaguar-900">
            {currentVolume} / {targetVolume}
          </div>
          <div className="text-xs text-stone-500">emails today</div>
        </div>
      </div>
      <div className="w-full bg-stone-100 rounded-full h-2">
        <div
          className="bg-gold-500 h-2 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};

// Add Account Modal Component
const AddAccountModal = ({ onClose, onAdd }) => {
  const [step, setStep] = useState('type'); // 'type', 'details', 'testing'
  const [accountType, setAccountType] = useState('');
  const [formData, setFormData] = useState({
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
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTypeSelect = (type) => {
    setAccountType(type);

    // Pre-fill some fields based on type
    if (type === 'gmail') {
      setFormData({
        ...formData,
        smtp_host: 'smtp.gmail.com',
        smtp_port: '587',
        imap_host: 'imap.gmail.com',
        imap_port: '993'
      });
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-serif text-2xl text-jaguar-900">Add Email Account</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <Icons.X size={24} />
          </button>
        </div>

        {step === 'type' && (
          <div className="space-y-4">
            <p className="text-stone-600 mb-6">Choose your email provider:</p>

            <button
              onClick={() => handleTypeSelect('stalwart')}
              className="w-full p-6 border-2 border-stone-200 rounded-lg hover:border-jaguar-900 hover:bg-cream-50 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl group-hover:scale-110 transition-transform">
                  ST
                </div>
                <div>
                  <h4 className="font-medium text-jaguar-900 mb-1">Stalwart SMTP</h4>
                  <p className="text-sm text-stone-500">Custom SMTP relay for maximum deliverability</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleTypeSelect('aws_workmail')}
              className="w-full p-6 border-2 border-stone-200 rounded-lg hover:border-jaguar-900 hover:bg-cream-50 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xl group-hover:scale-110 transition-transform">
                  AWS
                </div>
                <div>
                  <h4 className="font-medium text-jaguar-900 mb-1">AWS WorkMail</h4>
                  <p className="text-sm text-stone-500">Enterprise email service from Amazon</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleTypeSelect('gmail')}
              className="w-full p-6 border-2 border-stone-200 rounded-lg hover:border-jaguar-900 hover:bg-cream-50 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center text-red-700 font-bold text-xl group-hover:scale-110 transition-transform">
                  G
                </div>
                <div>
                  <h4 className="font-medium text-jaguar-900 mb-1">Gmail / Google Workspace</h4>
                  <p className="text-sm text-stone-500">Connect your Gmail or Google Workspace account</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {step === 'details' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Address */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Email Address</label>
              <input
                type="email"
                required
                value={formData.email_address}
                onChange={(e) => setFormData({ ...formData, email_address: e.target.value })}
                className="w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
                placeholder="john@company.com"
              />
            </div>

            {/* SMTP Settings */}
            <div className="p-4 bg-cream-50 rounded-lg space-y-4">
              <h4 className="font-medium text-jaguar-900">SMTP Settings (Outgoing)</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">SMTP Host</label>
                  <input
                    type="text"
                    required
                    value={formData.smtp_host}
                    onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
                    placeholder="smtp.example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">SMTP Port</label>
                  <input
                    type="number"
                    required
                    value={formData.smtp_port}
                    onChange={(e) => setFormData({ ...formData, smtp_port: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">SMTP Username</label>
                  <input
                    type="text"
                    required
                    value={formData.smtp_username}
                    onChange={(e) => setFormData({ ...formData, smtp_username: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">SMTP Password</label>
                  <input
                    type="password"
                    required
                    value={formData.smtp_password}
                    onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
                  />
                </div>
              </div>
            </div>

            {/* IMAP Settings */}
            <div className="p-4 bg-cream-50 rounded-lg space-y-4">
              <h4 className="font-medium text-jaguar-900">IMAP Settings (Incoming)</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">IMAP Host</label>
                  <input
                    type="text"
                    required
                    value={formData.imap_host}
                    onChange={(e) => setFormData({ ...formData, imap_host: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
                    placeholder="imap.example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">IMAP Port</label>
                  <input
                    type="number"
                    required
                    value={formData.imap_port}
                    onChange={(e) => setFormData({ ...formData, imap_port: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">IMAP Username</label>
                  <input
                    type="text"
                    required
                    value={formData.imap_username}
                    onChange={(e) => setFormData({ ...formData, imap_username: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">IMAP Password</label>
                  <input
                    type="password"
                    required
                    value={formData.imap_password}
                    onChange={(e) => setFormData({ ...formData, imap_password: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
                  />
                </div>
              </div>
            </div>

            {/* Additional Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Daily Send Limit</label>
                <input
                  type="number"
                  required
                  value={formData.daily_send_limit}
                  onChange={(e) => setFormData({ ...formData, daily_send_limit: e.target.value })}
                  className="w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Warmup</label>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.warmup_enabled}
                    onChange={(e) => setFormData({ ...formData, warmup_enabled: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-stone-600">Enable warmup engine</span>
                </label>
              </div>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`p-4 rounded-lg border ${
                testResult.success
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <div className="flex items-center gap-2">
                  {testResult.success ? <Icons.Check size={20} /> : <Icons.AlertCircle size={20} />}
                  <span className="font-medium">{testResult.message}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('type')}
                className="px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50 transition-colors flex items-center gap-2"
              >
                {testing ? <Icons.Loader2 size={16} /> : <Icons.Zap size={16} />}
                Test Connection
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 transition-colors"
              >
                Add Account
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
