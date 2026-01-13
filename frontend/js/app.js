// Main Application Component - Orchestrates everything
const App = () => {
  const { useState, useEffect } = React;
  const [authState, setAuthState] = useState('checking');
  const [publicView, setPublicView] = useState('landing');
  const [privateView, setPrivateView] = useState('dashboard');
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    const token = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
    const userData = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.USER);
    
    if (token && userData) {
      setUser(JSON.parse(userData));
      setAuthState('authenticated');
    } else {
      setAuthState('unauthenticated');
    }
  };

  const handleLogin = () => {
    const userData = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.USER);
    if (userData) {
      setUser(JSON.parse(userData));
    }
    setAuthState('authenticated');
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    setAuthState('unauthenticated');
    setPublicView('landing');
  };

  // Loading state
  if (authState === 'checking') {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gold-600 rounded-xl rotate-45 mx-auto flex items-center justify-center shadow-2xl animate-pulse">
            <div className="w-8 h-8 bg-jaguar-900 -rotate-45 rounded-lg"></div>
          </div>
          <p className="text-stone-500 font-medium">Loading Mr. Snowman...</p>
        </div>
      </div>
    );
  }

  // Public views (unauthenticated)
  if (authState === 'unauthenticated') {
    if (publicView === 'landing') {
      return <LandingPage onNavigate={setPublicView} />;
    }
    return <Auth view={publicView} onAuthenticate={handleLogin} onNavigate={setPublicView} />;
  }

  // Private views (authenticated)
  const NavItem = ({ view, icon: IconComponent, label }) => (
    <button
      onClick={() => setPrivateView(view)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
        privateView === view 
          ? 'bg-jaguar-800 text-cream-50 shadow-lg scale-105' 
          : 'text-jaguar-100/60 hover:bg-jaguar-800/50 hover:text-cream-50'
      }`}
    >
      <IconComponent size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-[#FDFBF7] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-gradient-to-b from-jaguar-900 to-jaguar-800 text-white flex flex-col shadow-2xl">
        {/* Logo */}
        <div className="p-8 border-b border-jaguar-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold-600 rounded-xl rotate-45 flex items-center justify-center shadow-xl shadow-gold-600/30 transition-all duration-300 hover:rotate-[50deg]">
              <div className="w-5 h-5 bg-jaguar-900 -rotate-45 rounded-lg"></div>
            </div>
            <div>
              <h1 className="font-serif text-xl text-cream-50">Mr. <span className="text-gold-500 font-normal">Snowman</span></h1>
              <p className="text-xs text-jaguar-100/60">Outreach Automation</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <NavItem view="dashboard" icon={Icons.LayoutDashboard} label="Overview" />
          <NavItem view="campaigns" icon={Icons.Send} label="Campaigns" />
          <NavItem view="contacts" icon={Icons.Users} label="Contacts" />
          <NavItem view="infrastructure" icon={Icons.Layers} label="Infrastructure" />
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-jaguar-700">
          <div className="flex items-center justify-between px-4 py-3 bg-jaguar-800/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center font-serif text-lg text-jaguar-900 shadow-lg">
                {user?.email?.[0].toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-cream-50 truncate">{user?.email?.split('@')[0] || 'User'}</p>
                <p className="text-xs text-jaguar-100/60">Workspace</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="text-jaguar-100/40 hover:text-cream-50 transition-colors p-2 hover:bg-jaguar-700 rounded-lg"
              title="Logout"
            >
              <Icons.LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 border-b border-stone-200 bg-white/80 backdrop-blur-sm flex items-center px-8 shadow-sm">
          <div className="flex-1">
            <h2 className="text-stone-400 text-sm uppercase tracking-widest font-medium">
              {privateView === 'dashboard' ? 'Dashboard' : 
               privateView === 'campaigns' ? 'Campaign Builder' : 
               privateView === 'contacts' ? 'Contacts' :
               'Infrastructure'}
            </h2>
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg hover:bg-cream-50 transition-all duration-300 relative">
              <Icons.Settings size={20} className="text-stone-600" />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8">
            {privateView === 'dashboard' && <Dashboard />}
            {privateView === 'campaigns' && <CampaignBuilder />}
            {privateView === 'contacts' && <Contacts />}
            {privateView === 'infrastructure' && <EmailAccounts />}
          </div>
        </div>
      </main>
    </div>
  );
};

// Render the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
