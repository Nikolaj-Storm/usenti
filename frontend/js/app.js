// frontend/js/app.js

const App = () => {
  const [authState, setAuthState] = React.useState('checking');
  const [publicView, setPublicView] = React.useState('landing');
  const [privateView, setPrivateView] = React.useState('dashboard');
  const [user, setUser] = React.useState(null);
  const [recoveryToken, setRecoveryToken] = React.useState(null);
  const [unansweredCount, setUnansweredCount] = React.useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

  // Handle session expiry (401 from any API call) — redirect to login without a page reload
  React.useEffect(() => {
    const handleSessionExpired = () => {
      console.warn('⚠️ [App] Session expired. Redirecting to login page.');
      setUser(null);
      setAuthState('unauthenticated');
      setPublicView('login');
    };
    window.addEventListener('usenti:session-expired', handleSessionExpired);
    return () => window.removeEventListener('usenti:session-expired', handleSessionExpired);
  }, []);

  // 1. Check for password recovery token in URL hash, then verify session
  React.useEffect(() => {
    const hash = window.location.hash;

    // Case 1: Password recovery token
    if (hash && hash.includes('type=recovery')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      if (accessToken) {
        console.log('🔑 [App] Password recovery token detected in URL');
        setRecoveryToken(accessToken);
        setPublicView('reset-password');
        setAuthState('unauthenticated');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        return;
      }
    }

    // Case 2: OAuth callback (Google sign-in) — hash contains access_token
    if (hash && hash.includes('access_token')) {
      console.log('🔑 [App] OAuth callback detected in URL hash. Waiting for Supabase to process...');
      (async () => {
        try {
          await api.initSupabase();
          // Give Supabase a moment to parse the hash and establish the session
          const { data, error } = await window.usentiSupabase.auth.getSession();
          if (data?.session) {
            console.log('✅ [App] OAuth session established! Logging in...');
            localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TOKEN, data.session.access_token);
            localStorage.setItem(APP_CONFIG.STORAGE_KEYS.USER, JSON.stringify(data.session.user));
            setUser(data.session.user);
            setAuthState('authenticated');
            setPrivateView('dashboard');
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
            return;
          } else {
            console.warn('⚠️ [App] OAuth hash found but no session yet. Falling back to verifySession.');
          }
        } catch (e) {
          console.warn('⚠️ [App] Error processing OAuth callback:', e);
        }
        verifySession();
      })();
      return;
    }

    // Case 3: Normal page load
    verifySession();
  }, []);

  // Fetch unanswered inbox count when authenticated
  const fetchUnansweredCount = async () => {
    try {
      const data = await api.getUnansweredCount();
      setUnansweredCount(data.count || 0);
    } catch (error) {
      console.error('Failed to fetch unanswered count:', error);
    }
  };

  React.useEffect(() => {
    if (authState === 'authenticated') {
      fetchUnansweredCount();
      // Poll every 60 seconds for updates
      const interval = setInterval(fetchUnansweredCount, 60000);
      return () => clearInterval(interval);
    }
  }, [authState]);

  // Re-fetch when navigating away from inbox (user may have replied/deleted)
  React.useEffect(() => {
    if (authState === 'authenticated' && privateView !== 'inbox') {
      fetchUnansweredCount();
    }
  }, [privateView]);

  const verifySession = async () => {
    console.log('🔄 [App] Verifying session...');

    // First, try to sync native Supabase session (e.g. from Google OAuth redirect)
    try {
      await api.initSupabase();
      if (window.usentiSupabase) {
        const { data } = await window.usentiSupabase.auth.getSession();
        if (data?.session?.access_token) {
          console.log('⚡ [App] Native Supabase session found! Syncing to Usenti storage.');
          localStorage.setItem(APP_CONFIG.STORAGE_KEYS.TOKEN, data.session.access_token);
          localStorage.setItem(APP_CONFIG.STORAGE_KEYS.USER, JSON.stringify(data.session.user));
        }
      }
    } catch (e) {
      console.warn("⚠️ [App] Could not sync native Supabase session:", e);
    }

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
        // Check if returning from email OAuth flow
        const params = new URLSearchParams(window.location.search);
        if (params.get('success')?.includes('_connected') || params.get('error')) {
          setPrivateView('infrastructure');
        }
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
      // Check if returning from email OAuth flow
      const params = new URLSearchParams(window.location.search);
      if (params.get('success')?.includes('_connected') || params.get('error')) {
        setPrivateView('infrastructure');
      } else {
        setPrivateView('dashboard');
      }
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
        h('div', { className: "flex items-center justify-center gap-3 animate-pulse" },
          h('img', { src: 'visuals/logo_white.png', alt: 'Usenti Logo', style: { height: '32px', width: 'auto' } }),
          h('h1', { className: "font-serif text-3xl tracking-tight text-white" }, 'Usenti')
        ),
        h('p', { className: "text-white/60 font-medium" }, 'Connecting to Usenti...')
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

  const NavItem = ({ view, icon: IconComponent, label, badge }) =>
    h('button', {
      onClick: () => setPrivateView(view),
      title: isSidebarCollapsed ? label : undefined,
      className: `w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl transition-all duration-200 group relative ${privateView === view
        ? 'bg-cream-100 text-rust-900 shadow-lg'
        : 'text-white/60 hover:text-white hover:bg-white/10'
        }`
    },
      h('div', { className: `${privateView === view ? 'text-rust-800' : 'group-hover:text-cream-100 transition-colors'} ${isSidebarCollapsed ? 'mx-auto' : ''}` },
        h(IconComponent, { size: 20 })
      ),
      !isSidebarCollapsed && h('span', { className: "font-medium tracking-wide flex-1 text-left whitespace-nowrap overflow-hidden transition-all duration-200" }, label),
      !isSidebarCollapsed && badge > 0 && h('span', {
        className: `min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[11px] font-bold rounded-full ${privateView === view
          ? 'bg-red-500 text-white'
          : 'bg-red-500 text-white'
          }`
      }, badge > 99 ? '99+' : badge),
      isSidebarCollapsed && badge > 0 && h('div', {
        className: "absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500"
      })
    );

  return h('div', { className: "flex h-screen font-sans text-white overflow-hidden animate-fade-in" },
    // Sidebar - Glassmorphism
    h('aside', { className: `glass-sidebar h-full text-white flex flex-col z-20 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-24' : 'w-72'}` },
      h('div', { className: `p-6 pb-8 flex items-center shrink-0 ${isSidebarCollapsed ? 'flex-col justify-center gap-4' : 'justify-between'}` },
        !isSidebarCollapsed && h('div', { className: "flex items-center gap-3 overflow-hidden ml-2" },
          h('img', { src: 'visuals/logo_white.png', alt: 'Usenti Logo', style: { height: '28px', width: 'auto', flexShrink: 0 } }),
          h('h1', { className: "font-serif text-2xl tracking-tight text-white whitespace-nowrap" },
            'Usenti'
          )
        ),
        isSidebarCollapsed && h('img', { src: 'visuals/logo_white.png', alt: 'Usenti Logo', style: { height: '24px', width: 'auto', flexShrink: 0 } }),
        h('button', {
          onClick: () => setIsSidebarCollapsed(!isSidebarCollapsed),
          className: "text-white/40 hover:text-white transition-colors p-1 flex-shrink-0"
        }, h(Icons.ChevronRight, { size: 20, className: `transition-transform duration-300 ${isSidebarCollapsed ? '' : 'rotate-180'}` }))
      ),
      h('nav', { className: `flex-1 px-4 space-y-2 overflow-y-auto min-h-0 ${isSidebarCollapsed ? 'overflow-x-hidden' : ''}` },
        !isSidebarCollapsed && h('p', { className: "px-4 text-xs font-bold text-white/40 uppercase tracking-widest mb-4 transition-all" }, 'Main Menu'),
        isSidebarCollapsed && h('div', { className: "w-full border-t border-white/10 mb-4" }),
        h(NavItem, { view: "dashboard", icon: Icons.LayoutDashboard, label: "Overview" }),
        h(NavItem, { view: "campaigns", icon: Icons.Send, label: "Campaigns" }),
        h(NavItem, { view: "contacts", icon: Icons.Users, label: "Contacts" }),
        h(NavItem, { view: "inbox", icon: Icons.Inbox, label: "Inbox", badge: unansweredCount }),
        h('div', { className: "py-4" }),
        !isSidebarCollapsed && h('p', { className: "px-4 text-xs font-bold text-white/40 uppercase tracking-widest mb-4 transition-all" }, 'System'),
        isSidebarCollapsed && h('div', { className: "w-full border-t border-white/10 mb-4" }),
        h(NavItem, { view: "infrastructure", icon: Icons.Layers, label: "Accounts" }),
        h(NavItem, { view: "settings", icon: Icons.Settings, label: "Settings" })
      ),
      h('div', { className: "p-4 border-t border-white/10 shrink-0" },
        h('div', { className: `flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 group` },
          h('div', { className: "w-10 h-10 rounded-full bg-cream-100 text-rust-900 flex items-center justify-center font-serif font-bold flex-shrink-0" },
            (user?.user_metadata?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U')
          ),
          !isSidebarCollapsed && h('div', { className: "flex-1 min-w-0 transition-opacity" },
            h('p', { className: "text-sm font-medium text-white truncate" },
              (user?.user_metadata?.name || user?.email?.split('@')[0] || 'User')
            ),
            h('p', { className: "text-xs text-white/50 truncate" }, (user?.email || 'user@example.com'))
          ),
          !isSidebarCollapsed && h('button', {
            onClick: handleLogout,
            className: "text-white/40 hover:text-white transition-colors p-1 flex-shrink-0",
            title: "Logout"
          }, h(Icons.LogOut, { size: 16 }))
        ),
        isSidebarCollapsed && h('div', { className: "flex justify-center mt-2 group" },
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
          privateView === 'inbox' && 'Unified Inbox',
          privateView === 'settings' && 'Settings'
        ),
        h('div', { className: "flex items-center gap-4" })
      ),
      h('div', { className: "flex-1 overflow-y-auto p-8 scroll-smooth" },
        h('div', { className: "max-w-7xl mx-auto" },
          privateView === 'dashboard' && h(Dashboard),
          privateView === 'campaigns' && h(CampaignBuilder),
          privateView === 'infrastructure' && h(EmailAccounts),
          privateView === 'contacts' && h(Contacts),
          privateView === 'inbox' && h(Inbox, { onUnansweredCountChange: fetchUnansweredCount }),
          privateView === 'settings' && h(Settings)
        )
      )
    )
  );
};

document.addEventListener('DOMContentLoaded', () => {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
});
