// Mr. Snowman - Main Application Orchestration

const { useState, useEffect } = React;

const App = () => {
  const [authState, setAuthState] = useState('checking');
  const [publicView, setPublicView] = useState('landing');
  const [privateView, setPrivateView] = useState('dashboard');
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is authenticated on mount
    const token = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
    const userData = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.USER);

    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
        setAuthState('authenticated');
      } catch (error) {
        console.error('Failed to parse user data:', error);
        localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
        localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER);
        setAuthState('unauthenticated');
      }
    } else {
      setAuthState('unauthenticated');
    }
  }, []);

  const handleLogin = () => {
    const userData = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.USER);
    if (userData) {
      try {
        setUser(JSON.parse(userData));
        setAuthState('authenticated');
      } catch (error) {
        console.error('Failed to parse user data:', error);
      }
    }
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

  const handlePublicNavigate = (view) => {
    setPublicView(view);
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

  // Unauthenticated views
  if (authState === 'unauthenticated') {
    if (publicView === 'landing') {
      return <LandingPage onNavigate={handlePublicNavigate} />;
    }
    return <Auth view={publicView} onAuthenticate={handleLogin} onNavigate={handlePublicNavigate} />;
  }

  // Navigation Item Component
  const NavItem = ({ view, icon: IconComponent, label }) => (
    <button
      onClick={() => setPrivateView(view)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
        privateView === view
          ? 'bg-jaguar-800 text-cream-50 shadow-lg shadow-black/20'
          : 'text-jaguar-100/60 hover:text-cream-50 hover:bg-jaguar-800/50'
      }`}
    >
      <div className={`${privateView === view ? 'text-gold-500' : 'group-hover:text-gold-500 transition-colors'}`}>
        <IconComponent size={20} />
      </div>
      <span className="font-medium tracking-wide">{label}</span>
    </button>
  );

  // Authenticated app layout
  return (
    <div className="flex h-screen bg-[#FDFBF7] font-sans text-stone-800 overflow-hidden animate-fade-in">
      {/* Sidebar */}
      <aside className="w-72 bg-jaguar-900 text-white flex flex-col shadow-2xl z-20">
        {/* Logo */}
        <div className="p-8 pb-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gold-600 rounded-sm rotate-45 flex items-center justify-center shadow-lg shadow-gold-600/30">
              <div className="w-4 h-4 bg-jaguar-900 -rotate-45"></div>
            </div>
            <h1 className="font-serif text-2xl tracking-tight text-cream-50">
              Mr. <span className="text-gold-500 font-normal">Snowman</span>
            </h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-2">
          <p className="px-4 text-xs font-bold text-jaguar-700 uppercase tracking-widest mb-4">Main Menu</p>
          <NavItem view="dashboard" icon={Icons.LayoutDashboard} label="Overview" />
          <NavItem view="campaigns" icon={Icons.Send} label="Campaigns" />
          <NavItem view="contacts" icon={Icons.Users} label="Contacts" />

          <div className="py-6"></div>

          <p className="px-4 text-xs font-bold text-jaguar-700 uppercase tracking-widest mb-4">System</p>
          <NavItem view="infrastructure" icon={Icons.Layers} label="Infrastructure" />
          <NavItem view="settings" icon={Icons.Settings} label="Settings" />
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-jaguar-800">
          <div className="flex items-center gap-3 px-4 py-3 group">
            <div className="w-10 h-10 rounded-full bg-cream-100 text-jaguar-900 flex items-center justify-center font-serif font-bold">
              {user?.user_metadata?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-cream-50 truncate">
                {user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-xs text-jaguar-100/50 truncate">{user?.email || 'user@example.com'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-jaguar-100/40 hover:text-cream-50 transition-colors p-1"
              title="Logout"
            >
              <Icons.LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 border-b border-stone-200 bg-white/50 backdrop-blur-sm flex items-center justify-between px-8 z-10 sticky top-0">
          <h2 className="text-stone-400 font-light text-sm uppercase tracking-widest">
            {privateView === 'dashboard' && 'Dashboard'}
            {privateView === 'campaigns' && 'Campaign Management'}
            {privateView === 'infrastructure' && 'Infrastructure & Warm-up'}
            {privateView === 'contacts' && 'Contact Management'}
            {privateView === 'settings' && 'System Settings'}
          </h2>

          <div className="flex items-center gap-4">
            <button className="relative p-2 text-stone-400 hover:text-jaguar-900 transition-colors">
              <Icons.Inbox size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            {privateView === 'dashboard' && <Dashboard />}
            {privateView === 'campaigns' && <CampaignBuilder />}
            {privateView === 'infrastructure' && <EmailAccounts />}
            {privateView === 'contacts' && <Contacts />}
            {privateView === 'settings' && (
              <div className="flex flex-col items-center justify-center h-96 text-stone-400 animate-fade-in">
                <Icons.Settings size={48} className="mb-4 opacity-20" />
                <p className="font-serif text-xl text-jaguar-900 mb-2">Coming Soon</p>
                <p className="text-sm">This module is under construction.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
});
