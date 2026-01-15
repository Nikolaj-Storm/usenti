// Mr. Snowman - Auth Component

const Auth = ({ view, onAuthenticate, onNavigate }) => {
  const { useState, createElement: h } = React;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isSignup = view === 'signup';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields'); return; }
    if (isSignup && !name) { setError('Please enter your name'); return; }
    if (isSignup && password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      if (isSignup) await api.signup(email, password, name);
      else await api.login(email, password);
      onAuthenticate();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return h('div', { className: "min-h-screen bg-gradient-to-br from-jaguar-900 via-jaguar-800 to-jaguar-900 flex items-center justify-center p-4" },
    h('div', { className: "w-full max-w-md" },
      h('div', { className: "text-center mb-8" },
        h('div', { className: "inline-flex items-center gap-3" },
          h('div', { className: "w-12 h-12 bg-gold-600 rounded-xl rotate-45 flex items-center justify-center shadow-2xl shadow-gold-600/30" },
            h('div', { className: "w-6 h-6 bg-jaguar-900 -rotate-45 rounded-lg" })),
          h('div', { className: "text-left" },
            h('h1', { className: "font-serif text-2xl text-cream-50" }, 'Mr. ', h('span', { className: "text-gold-500" }, 'Snowman')),
            h('p', { className: "text-xs text-jaguar-100/60" }, 'Email Outreach Automation')))),
      h('div', { className: "bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8" },
        h('div', { className: "mb-6" },
          h('h2', { className: "text-2xl font-bold text-jaguar-900 mb-2" }, isSignup ? 'Create Account' : 'Welcome Back'),
          h('p', { className: "text-stone-600" }, isSignup ? 'Sign up to start automating your outreach' : 'Sign in to access your campaigns')),
        error && h('div', { className: "mb-4 p-4 bg-red-50 border border-red-200 rounded-lg" },
          h('p', { className: "text-sm text-red-600" }, error)),
        h('form', { onSubmit: handleSubmit, className: "space-y-4" },
          isSignup && h('div', null,
            h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Full Name'),
            h('input', { type: "text", value: name, onChange: (e) => setName(e.target.value), placeholder: "John Doe", className: "w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent outline-none transition-all", disabled: loading })),
          h('div', null,
            h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Email Address'),
            h('input', { type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "you@company.com", className: "w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent outline-none transition-all", disabled: loading })),
          h('div', null,
            h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Password'),
            h('input', { type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "••••••••", className: "w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent outline-none transition-all", disabled: loading })),
          isSignup && h('div', null,
            h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Confirm Password'),
            h('input', { type: "password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), placeholder: "••••••••", className: "w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent outline-none transition-all", disabled: loading })),
          h('button', { type: "submit", disabled: loading, className: "w-full py-3 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed" },
            loading ? 'Processing...' : (isSignup ? 'Create Account' : 'Sign In'))),
        h('div', { className: "mt-6 text-center" },
          h('button', { onClick: () => onNavigate(isSignup ? 'login' : 'signup'), className: "text-sm text-jaguar-700 hover:text-jaguar-900 font-medium transition-colors" },
            isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"))),
      h('div', { className: "mt-6 text-center" },
        h('button', { onClick: () => onNavigate('landing'), className: "text-sm text-cream-50/80 hover:text-cream-50 transition-colors" }, '← Back to home'))));
};
