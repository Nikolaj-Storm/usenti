// Email Accounts Component - Smooth and elegant
const EmailAccounts = () => {
  const { useState, useEffect } = React;
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [testingConnection, setTestingConnection] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await api.getEmailAccounts();
      setAccounts(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load accounts:', error);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end animate-fade-in">
        <div>
          <h2 className="font-serif text-3xl text-jaguar-900">Infrastructure</h2>
          <p className="text-stone-500 mt-2 font-light">Connect and manage your sending accounts.</p>
        </div>
        <button className="px-6 py-3 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-xl font-medium hover:shadow-xl transition-all duration-300 flex items-center gap-2 hover:scale-105">
          <Icons.Plus size={20} />
          Connect Account
        </button>
      </div>

      {/* Email Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Add Account Card */}
        <button className="group relative bg-white border-2 border-dashed border-stone-300 rounded-2xl p-8 flex flex-col items-center justify-center text-stone-400 hover:border-jaguar-900 hover:bg-cream-50 transition-all duration-500 min-h-[240px] hover:shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 group-hover:bg-jaguar-100 flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110">
            <Icons.Plus size={28} className="text-stone-400 group-hover:text-jaguar-900 transition-colors" />
          </div>
          <span className="font-medium text-stone-600 group-hover:text-jaguar-900 transition-colors">Connect New Account</span>
          <span className="text-xs text-stone-400 mt-1">AWS WorkMail or SMTP</span>
        </button>

        {accounts.map((account, index) => (
          <div 
            key={account.id} 
            className="group relative bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden hover:-translate-y-1"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Status Badge */}
            <div className="absolute top-4 right-4 z-10">
              <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider transition-all duration-300 ${
                account.account_type === 'stalwart' 
                  ? 'bg-indigo-100 text-indigo-700' 
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {account.account_type}
              </span>
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-jaguar-900 to-jaguar-700 text-cream-50 flex items-center justify-center font-serif text-2xl shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-6">
                {account.email_address[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-jaguar-900 truncate group-hover:text-gold-600 transition-colors">
                  {account.email_address}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Icons.ShieldCheck size={14} className="text-green-600" />
                  <span className="text-xs text-green-600 font-medium">Verified & Active</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-500">Daily Limit</span>
                <span className="font-medium text-jaguar-900">{account.daily_send_limit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-stone-500">Health Score</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-stone-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-1000"
                      style={{ width: `${account.health_score}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-jaguar-900">{account.health_score}%</span>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Daily Limit</span>
                  <span className="font-medium text-jaguar-900">{account.daily_send_limit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Status</span>
                  <span className={`font-medium ${account.is_active ? 'text-green-600' : 'text-stone-400'}`}>
                    {account.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {account.is_warming_up && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                    <Icons.Flame size={16} />
                    <span className="font-medium">Warming up...</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-stone-100">
                <button 
                  onClick={() => handleTestConnection(account.id, 'imap')}
                  className="flex-1 py-2 text-xs font-medium text-jaguar-900 bg-cream-50 rounded-lg hover:bg-jaguar-900 hover:text-cream-50 transition-all duration-300"
                >
                  Test IMAP
                </button>
                <button className="flex-1 px-4 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-all duration-300 text-sm">
                  Test SMTP
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <AddEmailAccountModal 
          onClose={() => setShowAddModal(false)}
          onSuccess={loadAccounts}
        />
      )}
    </div>
  );
};

// Add Email Account Modal
const AddEmailAccountModal = ({ onClose, onSuccess }) => {
  const { useState } = React;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState({ imap: null, smtp: null });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const account = await api.addEmailAccount(formData);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (type) => {
    setTesting(true);
    setError('');
    
    try {
      // Create temp account to test
      const tempAccount = await api.addEmailAccount(formData);
      
      if (type === 'imap') {
        const result = await api.testIMAPConnection(tempAccount.id);
        setTestResults(prev => ({ ...prev, imap: result.success }));
      } else {
        const result = await api.testSMTPConnection(tempAccount.id);
        setTestResults(prev => ({ ...prev, smtp: result.success }));
      }
    } catch (err) {
      setError(err.message);
      setTestResults(prev => ({ ...prev, [type]: false }));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 p-6 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-serif text-2xl">Add Email Account</h3>
              <p className="text-jaguar-100 text-sm mt-1">Connect your IMAP and SMTP servers</p>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-300"
            >
              <Icons.X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2 animate-fade-in">
              <Icons.AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h4 className="font-medium text-jaguar-900 flex items-center gap-2">
              <Icons.Mail size={18} />
              Basic Information
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Email Address</label>
                <input 
                  type="email"
                  required
                  value={formData.email_address}
                  onChange={(e) => setFormData({...formData, email_address: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all"
                  placeholder="your@email.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Account Type</label>
                <select 
                  value={formData.account_type}
                  onChange={(e) => setFormData({...formData, account_type: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all"
                >
                  <option value="stalwart">Stalwart SMTP</option>
                  <option value="aws_workmail">AWS WorkMail</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* IMAP Settings */}
          <div className="space-y-4 p-4 bg-cream-50 rounded-xl border border-stone-200">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-jaguar-900 flex items-center gap-2">
                <Icons.Download size={18} />
                IMAP Settings (Incoming)
              </h4>
              {testResults.imap !== null && (
                <span className={`text-xs px-3 py-1 rounded-full ${testResults.imap ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {testResults.imap ? '✓ Connected' : '✗ Failed'}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-stone-700 mb-2">IMAP Host</label>
                <input 
                  type="text"
                  required
                  value={formData.imap_host}
                  onChange={(e) => setFormData({...formData, imap_host: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all"
                  placeholder="imap.yourserver.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Port</label>
                <input 
                  type="number"
                  required
                  value={formData.imap_port}
                  onChange={(e) => setFormData({...formData, imap_port: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Username</label>
                <input 
                  type="text"
                  required
                  value={formData.imap_username}
                  onChange={(e) => setFormData({...formData, imap_username: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Password</label>
                <input 
                  type="password"
                  required
                  value={formData.imap_password}
                  onChange={(e) => setFormData({...formData, imap_password: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* SMTP Settings */}
          <div className="space-y-4 p-4 bg-cream-50 rounded-xl border border-stone-200">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-jaguar-900 flex items-center gap-2">
                <Icons.Upload size={18} />
                SMTP Settings (Outgoing)
              </h4>
              {testResults.smtp !== null && (
                <span className={`text-xs px-3 py-1 rounded-full ${testResults.smtp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {testResults.smtp ? '✓ Connected' : '✗ Failed'}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-stone-700 mb-2">SMTP Host</label>
                <input 
                  type="text"
                  required
                  value={formData.smtp_host}
                  onChange={(e) => setFormData({...formData, smtp_host: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all"
                  placeholder="smtp.yourserver.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Port</label>
                <input 
                  type="number"
                  required
                  value={formData.smtp_port}
                  onChange={(e) => setFormData({...formData, smtp_port: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Username</label>
                <input 
                  type="text"
                  required
                  value={formData.smtp_username}
                  onChange={(e) => setFormData({...formData, smtp_username: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Password</label>
                <input 
                  type="password"
                  required
                  value={formData.smtp_password}
                  onChange={(e) => setFormData({...formData, smtp_password: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-stone-200">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-white border-2 border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition-all duration-300 font-medium"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-xl hover:from-jaguar-800 hover:to-jaguar-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {loading ? <><Icons.Loader2 size={18} /> Adding...</> : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Make EmailAccounts globally available
window.EmailAccounts = EmailAccounts;
