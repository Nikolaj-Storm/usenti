// frontend/js/app.js

const App = () => {
  const [authState, setAuthState] = React.useState('checking');
  const [publicView, setPublicView] = React.useState('landing');
  const [privateView, setPrivateView] = React.useState('dashboard');
  const [user, setUser] = React.useState(null);

  // 1. Verify Session on Load
  React.useEffect(() => {
    verifySession();
  }, []);

  const verifySession = async () => {
    console.log('🔄 [App] Verifying session...');
    const token = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
    const storedUser = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.USER);
    console.log('🔍 [App] Session check:', { hasToken: !!token, hasStoredUser: !!storedUser });

    // If no token, show Landing Page immediately
    if (!token) {
      console.log('⚠️ [App] No token found. User is signed out.');
      setAuthState('unauthenticated');
      return;
    }

    // Quick load from local storage to prevent flickering
    if (storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            console.log('✅ [App] Loaded user from localStorage:', parsedUser.email);
            setUser(parsedUser);
            setAuthState('authenticated');
        } catch (e) {
            console.error("❌ [App] Error parsing stored user", e);
        }
    }

    // Verify it with the backend in the background
    try {
      console.log('🌐 [App] Verifying session with backend...');
      const userData = await api.get('/api/auth/me');
      if (userData && userData.user) {
          console.log('✅ [App] Backend verification successful:', userData.user.email);
          setUser(userData.user);
          setAuthState('authenticated');
      }
    } catch (error) {
      console.warn('⚠️ [App] Session verification failed:', error);
      // Only clear if the server explicitly rejects the token
      if (error.message.includes('401') || error.message.includes('Invalid')) {
          console.error('⛔ [App] Invalid session. Clearing auth data and redirecting to landing.');
          localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
          localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER);
          setAuthState('unauthenticated');
      }
    }
  };

  // --- FIX IS HERE: Simplified handleLogin ---
  const handleLogin = (userData) => {
    // Auth.js has already called the API and verified credentials.
    // We just need to update the app state with the user object it passed us.
    console.log('🔄 [App] Auth State Changed: SIGNED_IN', userData);
    console.log('✅ [App] User is signed in. Current location:', window.location.hash || '(root)');

    if (userData) {
      console.log('📍 [App] Setting auth state to authenticated and navigating to dashboard');
      setUser(userData);
      setAuthState('authenticated');
      setPrivateView('dashboard');
    } else {
      console.error('❌ [App] handleLogin called with no userData!');
    }
  };

  const handleLogout = async () => {
    console.log('🔄 [App] Auth State Changed: SIGNED_OUT');
    try {
      await api.logout();
    } catch (error) {
      console.error('❌ [App] Logout error:', error);
    }
    console.log('⚠️ [App] User is signed out. Redirecting to landing page.');
    setUser(null);
    setAuthState('unauthenticated');
    setPublicView('landing');
    localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.USER);
  };

  const handlePublicNavigate = (view) => {
    setPublicView(view);
  };

  // --- Views ---

  if (authState === 'checking') {
    return h('div', { className: "min-h-screen bg-[#FDFBF7] flex items-center justify-center" },
      h('div', { className: "text-center space-y-4" },
        h('div', { className: "w-16 h-16 bg-gold-600 rounded-xl rotate-45 mx-auto flex items-center justify-center shadow-2xl animate-pulse" },
          h('div', { className: "w-8 h-8 bg-jaguar-900 -rotate-45 rounded-lg" })
        ),
        h('p', { className: "text-stone-500 font-medium" }, 'Connecting to Snowman...')
      )
    );
  }

  if (authState === 'unauthenticated') {
    console.log('📍 [Router] Rendering public view:', publicView);
    if (publicView === 'landing') {
      return h(LandingPage, { onNavigate: handlePublicNavigate });
    }
    return h(Auth, { view: publicView, onAuthenticate: handleLogin, onNavigate: handlePublicNavigate });
  }

  // --- Private Dashboard View ---
  console.log('📍 [Router] Rendering private view:', privateView, '| User:', user?.email);

  const NavItem = ({ view, icon: IconComponent, label }) =>
    h('button', {
      onClick: () => setPrivateView(view),
      className: `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
        privateView === view
          ? 'bg-jaguar-800 text-cream-50 shadow-lg shadow-black/20'
          : 'text-jaguar-100/60 hover:text-cream-50 hover:bg-jaguar-800/50'
      }`
    },
      h('div', { className: `${privateView === view ? 'text-gold-500' : 'group-hover:text-gold-500 transition-colors'}` },
        h(IconComponent, { size: 20 })
      ),
      h('span', { className: "font-medium tracking-wide" }, label)
    );

  return h('div', { className: "flex h-screen bg-[#FDFBF7] font-sans text-stone-800 overflow-hidden animate-fade-in" },
    // Sidebar
    h('aside', { className: "w-72 bg-jaguar-900 text-white flex flex-col shadow-2xl z-20" },
      h('div', { className: "p-8 pb-10" },
        h('div', { className: "flex items-center gap-3" },
          h('div', { className: "w-8 h-8 bg-gold-600 rounded-sm rotate-45 flex items-center justify-center shadow-lg shadow-gold-600/30" },
            h('div', { className: "w-4 h-4 bg-jaguar-900 -rotate-45" })
          ),
          h('h1', { className: "font-serif text-2xl tracking-tight text-cream-50" },
            'Mr. ',
            h('span', { className: "text-gold-500 font-normal" }, 'Snowman')
          )
        )
      ),
      h('nav', { className: "flex-1 px-4 space-y-2" },
        h('p', { className: "px-4 text-xs font-bold text-jaguar-700 uppercase tracking-widest mb-4" }, 'Main Menu'),
        h(NavItem, { view: "dashboard", icon: Icons.LayoutDashboard, label: "Overview" }),
        h(NavItem, { view: "campaigns", icon: Icons.Send, label: "Campaigns" }),
        h(NavItem, { view: "contacts", icon: Icons.Users, label: "Contacts" }),
        h(NavItem, { view: "inbox", icon: Icons.Inbox, label: "Inbox" }),
        h('div', { className: "py-6" }),
        h('p', { className: "px-4 text-xs font-bold text-jaguar-700 uppercase tracking-widest mb-4" }, 'System'),
        h(NavItem, { view: "infrastructure", icon: Icons.Layers, label: "Infrastructure" }),
        h(NavItem, { view: "settings", icon: Icons.Settings, label: "Settings" })
      ),
      h('div', { className: "p-4 border-t border-jaguar-800" },
        h('div', { className: "flex items-center gap-3 px-4 py-3 group" },
          h('div', { className: "w-10 h-10 rounded-full bg-cream-100 text-jaguar-900 flex items-center justify-center font-serif font-bold" },
            (user?.user_metadata?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U')
          ),
          h('div', { className: "flex-1 min-w-0" },
            h('p', { className: "text-sm font-medium text-cream-50 truncate" },
              (user?.user_metadata?.name || user?.email?.split('@')[0] || 'User')
            ),
            h('p', { className: "text-xs text-jaguar-100/50 truncate" }, (user?.email || 'user@example.com'))
          ),
          h('button', {
            onClick: handleLogout,
            className: "text-jaguar-100/40 hover:text-cream-50 transition-colors p-1",
            title: "Logout"
          }, h(Icons.LogOut, { size: 16 }))
        )
      )
    ),
    // Main Content
    h('main', { className: "flex-1 flex flex-col h-screen overflow-hidden" },
      h('header', { className: "h-20 border-b border-stone-200 bg-white/50 backdrop-blur-sm flex items-center justify-between px-8 z-10 sticky top-0" },
        h('h2', { className: "text-stone-400 font-light text-sm uppercase tracking-widest" },
          privateView === 'dashboard' && 'Dashboard',
          privateView === 'campaigns' && 'Campaign Management',
          privateView === 'infrastructure' && 'Infrastructure & Warm-up',
          privateView === 'contacts' && 'Contact Management',
          privateView === 'inbox' && 'Unified Inbox',
          privateView === 'settings' && 'System Settings'
        ),
        h('div', { className: "flex items-center gap-4" })
      ),
      h('div', { className: "flex-1 overflow-y-auto p-8 scroll-smooth" },
        h('div', { className: "max-w-7xl mx-auto" },
          privateView === 'dashboard' && h(Dashboard),
          privateView === 'campaigns' && h(CampaignBuilder),
          privateView === 'infrastructure' && h(EmailAccounts),
          privateView === 'contacts' && h(Contacts),
          privateView === 'inbox' && h(Inbox),
          privateView === 'settings' && h('div', { className: "flex flex-col items-center justify-center h-96 text-stone-400 animate-fade-in" },
            h(Icons.Settings, { size: 48, className: "mb-4 opacity-20" }),
            h('p', { className: "font-serif text-xl text-jaguar-900 mb-2" }, 'Coming Soon'),
            h('p', { className: "text-sm" }, 'This module is under construction.')
          )
        )
      )
    )
  );
};

document.addEventListener('DOMContentLoaded', () => {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
});
