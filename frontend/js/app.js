// frontend/js/app.js

const App = () => {
  const [authState, setAuthState] = React.useState('checking');
  const [publicView, setPublicView] = React.useState('landing');
  const [privateView, setPrivateView] = React.useState('dashboard');
  const [user, setUser] = React.useState(null);
  const [recoveryToken, setRecoveryToken] = React.useState(null);

  // 1. Check for password recovery token in URL hash, then verify session
  React.useEffect(() => {
    // Supabase redirects with hash params: #access_token=xxx&type=recovery
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      if (accessToken) {
        console.log('🔑 [App] Password recovery token detected in URL');
        setRecoveryToken(accessToken);
        setPublicView('reset-password');
        setAuthState('unauthenticated');
        // Clean the URL hash so it doesn't persist
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        return;
      }
    }
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
    return h('div', { className: "min-h-screen flex items-center justify-center" },
      h('div', { className: "text-center space-y-4" },
        h('div', { className: "w-16 h-16 bg-cream-100 rounded-xl rotate-45 mx-auto flex items-center justify-center shadow-2xl animate-pulse" },
          h('div', { className: "w-8 h-8 bg-rust-900 -rotate-45 rounded-lg" })
        ),
        h('p', { className: "text-white/60 font-medium" }, 'Connecting to Snowman...')
      )
    );
  }

  if (authState === 'unauthenticated') {
    console.log('📍 [Router] Rendering public view:', publicView);
    if (publicView === 'landing') {
      return h(LandingPage, { onNavigate: handlePublicNavigate });
    }
    return h(Auth, { view: publicView, onAuthenticate: handleLogin, onNavigate: handlePublicNavigate, recoveryToken: recoveryToken });
  }

  // --- Private Dashboard View ---
  console.log('📍 [Router] Rendering private view:', privateView, '| User:', user?.email);

  const NavItem = ({ view, icon: IconComponent, label }) =>
    h('button', {
      onClick: () => setPrivateView(view),
      className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${privateView === view
          ? 'bg-cream-100 text-rust-900 shadow-lg'
          : 'text-white/60 hover:text-white hover:bg-white/10'
        }`
    },
      h('div', { className: `${privateView === view ? 'text-rust-800' : 'group-hover:text-cream-100 transition-colors'}` },
        h(IconComponent, { size: 20 })
      ),
      h('span', { className: "font-medium tracking-wide" }, label)
    );

  return h('div', { className: "flex h-screen font-sans text-white overflow-hidden animate-fade-in" },
    // Sidebar - Glassmorphism
    h('aside', { className: "w-72 glass-sidebar text-white flex flex-col z-20" },
      h('div', { className: "p-8 pb-10" },
        h('div', { className: "flex items-center gap-3" },
          h('div', { className: "w-8 h-8 bg-cream-100 rounded-sm rotate-45 flex items-center justify-center shadow-lg" },
            h('div', { className: "w-4 h-4 bg-rust-900 -rotate-45" })
          ),
          h('h1', { className: "font-serif text-2xl tracking-tight text-white" },
            'Mr. ',
            h('span', { className: "text-cream-100 font-normal" }, 'Snowman')
          )
        )
      ),
      h('nav', { className: "flex-1 px-4 space-y-2" },
        h('p', { className: "px-4 text-xs font-bold text-white/40 uppercase tracking-widest mb-4" }, 'Main Menu'),
        h(NavItem, { view: "dashboard", icon: Icons.LayoutDashboard, label: "Overview" }),
        h(NavItem, { view: "campaigns", icon: Icons.Send, label: "Campaigns" }),
        h(NavItem, { view: "contacts", icon: Icons.Users, label: "Contacts" }),
        h(NavItem, { view: "inbox", icon: Icons.Inbox, label: "Inbox" }),
        h('div', { className: "py-6" }),
        h('p', { className: "px-4 text-xs font-bold text-white/40 uppercase tracking-widest mb-4" }, 'System'),
        h(NavItem, { view: "infrastructure", icon: Icons.Layers, label: "Accounts" })
      ),
      h('div', { className: "p-4 border-t border-white/10" },
        h('div', { className: "flex items-center gap-3 px-4 py-3 group" },
          h('div', { className: "w-10 h-10 rounded-full bg-cream-100 text-rust-900 flex items-center justify-center font-serif font-bold" },
            (user?.user_metadata?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U')
          ),
          h('div', { className: "flex-1 min-w-0" },
            h('p', { className: "text-sm font-medium text-white truncate" },
              (user?.user_metadata?.name || user?.email?.split('@')[0] || 'User')
            ),
            h('p', { className: "text-xs text-white/50 truncate" }, (user?.email || 'user@example.com'))
          ),
          h('button', {
            onClick: handleLogout,
            className: "text-white/40 hover:text-white transition-colors p-1",
            title: "Logout"
          }, h(Icons.LogOut, { size: 16 }))
        )
      )
    ),
    // Main Content
    h('main', { className: "flex-1 flex flex-col h-screen overflow-hidden" },
      h('header', { className: "h-16 glass-header flex items-center justify-between px-8 z-10 sticky top-0" },
        h('h2', { className: "text-white/60 font-light text-sm uppercase tracking-widest" },
          privateView === 'dashboard' && 'Dashboard',
          privateView === 'campaigns' && 'Campaign Management',
          privateView === 'infrastructure' && 'Email Accounts',
          privateView === 'contacts' && 'Contact Management',
          privateView === 'inbox' && 'Unified Inbox'
        ),
        h('div', { className: "flex items-center gap-4" })
      ),
      h('div', { className: "flex-1 overflow-y-auto p-8 scroll-smooth" },
        h('div', { className: "max-w-7xl mx-auto" },
          privateView === 'dashboard' && h(Dashboard),
          privateView === 'campaigns' && h(CampaignBuilder),
          privateView === 'infrastructure' && h(EmailAccounts),
          privateView === 'contacts' && h(Contacts),
          privateView === 'inbox' && h(Inbox)
        )
      )
    )
  );
};

document.addEventListener('DOMContentLoaded', () => {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
});
