// Mr. Snowman - Main Application

const App = () => {
  const { useState, useEffect, createElement: h } = React;
  const [authState, setAuthState] = useState('checking');
  const [publicView, setPublicView] = useState('landing');
  const [privateView, setPrivateView] = useState('dashboard');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
    const userData = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.USER);
    if (token && userData) {
      setUser(JSON.parse(userData));
      setAuthState('authenticated');
    } else {
      setAuthState('unauthenticated');
    }
  }, []);

  const handleLogin = () => {
    const userData = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.USER);
    if (userData) setUser(JSON.parse(userData));
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

  if (authState === 'checking') {
    return h('div', { className: "min-h-screen bg-[#FDFBF7] flex items-center justify-center" },
      h('div', { className: "text-center space-y-4" },
        h('div', { className: "w-16 h-16 bg-gold-600 rounded-xl rotate-45 mx-auto flex items-center justify-center shadow-2xl animate-pulse" },
          h('div', { className: "w-8 h-8 bg-jaguar-900 -rotate-45 rounded-lg" })),
        h('p', { className: "text-stone-500 font-medium" }, 'Loading Mr. Snowman...')));
  }

  if (authState === 'unauthenticated') {
    if (publicView === 'landing') return h(LandingPage, { onNavigate: setPublicView });
    return h(Auth, { view: publicView, onAuthenticate: handleLogin, onNavigate: setPublicView });
  }

  const NavItem = ({ view, icon, label }) => h('button', {
    onClick: () => setPrivateView(view),
    className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${privateView === view ? 'bg-jaguar-800 text-cream-50 shadow-lg' : 'text-jaguar-100/60 hover:bg-jaguar-800/50 hover:text-cream-50'}`
  }, icon({ size: 20 }), h('span', { className: "font-medium" }, label));

  return h('div', { className: "flex h-screen bg-[#FDFBF7] overflow-hidden" },
    h('aside', { className: "w-72 bg-gradient-to-b from-jaguar-900 to-jaguar-800 text-white flex flex-col shadow-2xl" },
      h('div', { className: "p-8 border-b border-jaguar-700" },
        h('div', { className: "flex items-center gap-3" },
          h('div', { className: "w-10 h-10 bg-gold-600 rounded-xl rotate-45 flex items-center justify-center shadow-xl" },
            h('div', { className: "w-5 h-5 bg-jaguar-900 -rotate-45 rounded-lg" })),
          h('div', null,
            h('h1', { className: "font-serif text-xl text-cream-50" }, 'Mr. ', h('span', { className: "text-gold-500" }, 'Snowman')),
            h('p', { className: "text-xs text-jaguar-100/60" }, 'Outreach Automation')))),
      h('nav', { className: "flex-1 px-4 py-6 space-y-2" },
        h(NavItem, { view: 'dashboard', icon: Icons.LayoutDashboard, label: 'Overview' }),
        h(NavItem, { view: 'campaigns', icon: Icons.Send, label: 'Campaigns' }),
        h(NavItem, { view: 'contacts', icon: Icons.Users, label: 'Contacts' }),
        h(NavItem, { view: 'infrastructure', icon: Icons.Layers, label: 'Infrastructure' })),
      h('div', { className: "p-4 border-t border-jaguar-700" },
        h('div', { className: "flex items-center justify-between px-4 py-3 bg-jaguar-800/50 rounded-xl" },
          h('div', { className: "flex items-center gap-3" },
            h('div', { className: "w-10 h-10 rounded-full bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center font-serif text-lg text-jaguar-900" },
              (user?.user_metadata?.name?.[0] || user?.email?.[0])?.toUpperCase() || 'U'),
            h('div', { className: "flex-1 min-w-0" },
              h('p', { className: "text-sm font-medium text-cream-50 truncate" }, user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'))),
          h('button', { onClick: handleLogout, className: "text-jaguar-100/40 hover:text-cream-50 transition-colors p-2 hover:bg-jaguar-700 rounded-lg", title: "Logout" },
            Icons.LogOut({ size: 18 }))))),
    h('main', { className: "flex-1 flex flex-col overflow-hidden" },
      h('header', { className: "h-20 border-b border-stone-200 bg-white/80 backdrop-blur-sm flex items-center px-8 shadow-sm" },
        h('div', { className: "flex-1" },
          h('h2', { className: "text-stone-400 text-sm uppercase tracking-widest font-medium" },
            privateView === 'dashboard' ? 'Dashboard' : privateView === 'campaigns' ? 'Campaign Builder' : privateView === 'contacts' ? 'Contacts' : 'Infrastructure'))),
      h('div', { className: "flex-1 overflow-y-auto" },
        h('div', { className: "max-w-7xl mx-auto p-8" },
          privateView === 'dashboard' && h(Dashboard),
          privateView === 'campaigns' && h(Campaigns),
          privateView === 'contacts' && h(Contacts),
          privateView === 'infrastructure' && h(EmailAccounts)))));
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
});
