// Mr. Snowman - Authentication Component

const Auth = ({ view, onAuthenticate, onNavigate }) => {
  const { useState } = React;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (view === 'signup') {
        await api.signup(email, password, name);
      } else {
        await api.login(email, password);
      }
      onAuthenticate();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#FDFBF7]">
      {/* Left Side - Visual */}
      <div className="hidden lg:flex w-1/2 bg-jaguar-900 relative overflow-hidden flex-col justify-between p-12 text-cream-50">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, #C5A065 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}></div>

        <div
          onClick={() => onNavigate('landing')}
          className="relative z-10 flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 bg-gold-600 rounded-sm rotate-45 flex items-center justify-center shadow-lg shadow-gold-600/30">
            <div className="w-4 h-4 bg-jaguar-900 -rotate-45"></div>
          </div>
          <h1 className="font-serif text-2xl tracking-tight font-medium">Mr. <span className="text-gold-600 font-normal">Snowman</span></h1>
        </div>

        <div className="relative z-10 max-w-lg">
          <h2 className="font-serif text-4xl leading-tight mb-6">"Simplicity is the ultimate sophistication."</h2>
          <p className="text-jaguar-100/60 font-light text-lg">— Leonardo da Vinci</p>
          <div className="mt-12 flex gap-2">
            <div className="w-12 h-1 bg-gold-500 rounded-full"></div>
            <div className="w-2 h-1 bg-jaguar-700 rounded-full"></div>
            <div className="w-2 h-1 bg-jaguar-700 rounded-full"></div>
          </div>
        </div>

        <div className="text-xs text-jaguar-100/40">
          Secure Encryption • SOC2 Compliant • 99.9% Uptime
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-16 relative">
        <button
          onClick={() => onNavigate('landing')}
          className="absolute top-8 left-8 flex items-center gap-2 text-stone-400 hover:text-jaguar-900 transition-colors lg:hidden"
        >
          <Icons.ArrowLeft size={18} /> Back
        </button>

        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="text-center lg:text-left">
            <h2 className="font-serif text-3xl text-jaguar-900">{view === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p className="text-stone-500 mt-2">
              {view === 'login'
                ? 'Enter your credentials to access your dashboard.'
                : 'Start your 14-day free trial. No credit card required.'}
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <Icons.AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {view === 'signup' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-jaguar-900">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all placeholder:text-stone-300"
                  placeholder="John Doe"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-jaguar-900">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all placeholder:text-stone-300"
                placeholder="john@company.com"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-jaguar-900">Password</label>
                {view === 'login' && (
                  <a href="#" className="text-xs text-stone-500 hover:text-gold-600">Forgot password?</a>
                )}
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all placeholder:text-stone-300"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-jaguar-900 text-cream-50 rounded-lg font-medium hover:bg-jaguar-800 transition-all shadow-lg shadow-jaguar-900/10 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Icons.Loader2 size={20} />
              ) : (
                view === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="text-center text-sm text-stone-500">
            {view === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => onNavigate(view === 'login' ? 'signup' : 'login')}
              className="font-medium text-gold-600 hover:text-gold-700 underline underline-offset-2"
            >
              {view === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
