// Mr. Snowman - Authentication Component

const Auth = ({ view, onAuthenticate, onNavigate }) => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [cooldownRemaining, setCooldownRemaining] = React.useState(0);
  const [cooldownEndTime, setCooldownEndTime] = React.useState(null);

  // Countdown timer for Supabase's rate limit
  React.useEffect(() => {
    if (!cooldownEndTime) {
      setCooldownRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((cooldownEndTime - Date.now()) / 1000));
      setCooldownRemaining(remaining);

      if (remaining === 0) {
        setCooldownEndTime(null);
        setError(''); // Clear error when countdown completes
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [cooldownEndTime]);

  const handleSubmit = async (e) => {
    console.log('🎯 [Auth] Form submitted!', { view, email, hasPassword: !!password, hasName: !!name });
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('📝 [Auth] Form data validated, proceeding with authentication...');

    try {
      let response;

      // Handle API calls locally to catch specific errors
      if (view === 'signup') {
        console.log('🔐 [Auth] Starting signup process...');
        response = await api.signup(email, password, name);
        console.log('✅ [Auth] Signup successful. User created:', response?.user);

        // Check if email confirmation is required (no session returned)
        if (response.user && !response.session) {
          console.log('📧 [Auth] Email confirmation required. No session returned.');
          setSuccess('Account created! Please check your email to confirm your account, then log in.');
          // Clear the form
          setEmail('');
          setPassword('');
          setName('');
          // Don't redirect - let user read the message and manually go to login
          return;
        }
      } else {
        console.log('🔐 [Auth] Starting login process...');
        response = await api.login(email, password);
        console.log('✅ [Auth] Login successful. User authenticated:', response?.user);
      }

      // CRITICAL: Pass the user object and session to App.js
      // Only redirect if we have both user AND session
      if (response && response.user && response.session) {
        console.log('⏳ [Auth] Redirecting to dashboard...', {
          view,
          userId: response.user.id,
          email: response.user.email
        });
        onAuthenticate(response.user);
      } else if (response && response.user && !response.session) {
        throw new Error('Email not confirmed. Please check your email and confirm your account.');
      } else {
        throw new Error('No user data received');
      }

    } catch (err) {
      console.error('❌ [Auth] Authentication error caught:', err);
      console.error('💥 [Auth] Error details:', {
        message: err.message,
        stack: err.stack,
        response: err.response
      });

      // Check if this is a rate limit error and extract the required wait time
      const rateLimitMatch = err.message?.match(/after (\d+) seconds/);
      if (rateLimitMatch) {
        const requiredSeconds = parseInt(rateLimitMatch[1], 10);
        console.warn(`⏰ [Auth] Rate limit detected. Need to wait ${requiredSeconds} seconds.`);
        // Set the cooldown end time to now + required seconds + 2 second buffer
        setCooldownEndTime(Date.now() + (requiredSeconds + 2) * 1000);
        setError(`Anti-bot security: Please wait ${requiredSeconds} seconds before trying again.`);
      } else {
        setError(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
      console.log('🏁 [Auth] Authentication attempt completed. Loading:', false);
    }
  };

  return h('div', { className: "min-h-screen flex bg-[#FDFBF7]" },
    // Left Side - Brand
    h('div', { className: "hidden lg:flex w-1/2 bg-jaguar-900 relative overflow-hidden flex-col justify-between p-12 text-cream-50" },
      h('div', {
        className: "absolute inset-0 opacity-10",
        style: {
          backgroundImage: 'radial-gradient(circle at 2px 2px, #C5A065 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }
      }),
      h('div', {
        onClick: () => onNavigate('landing'),
        className: "relative z-10 flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
      },
        h('div', { className: "w-8 h-8 bg-gold-600 rounded-sm rotate-45 flex items-center justify-center shadow-lg shadow-gold-600/30" },
          h('div', { className: "w-4 h-4 bg-jaguar-900 -rotate-45" })
        ),
        h('h1', { className: "font-serif text-2xl tracking-tight font-medium" },
          'Mr. ',
          h('span', { className: "text-gold-600 font-normal" }, 'Snowman')
        )
      ),
      h('div', { className: "relative z-10 max-w-lg" },
        h('h2', { className: "font-serif text-4xl leading-tight mb-6" }, '"Simplicity is the ultimate sophistication."'),
        h('p', { className: "text-jaguar-100/60 font-light text-lg" }, '— Leonardo da Vinci'),
        h('div', { className: "mt-12 flex gap-2" },
          h('div', { className: "w-12 h-1 bg-gold-500 rounded-full" }),
          h('div', { className: "w-2 h-1 bg-jaguar-700 rounded-full" }),
          h('div', { className: "w-2 h-1 bg-jaguar-700 rounded-full" })
        )
      ),
      h('div', { className: "text-xs text-jaguar-100/40" },
        'Secure Encryption • SOC2 Compliant • 99.9% Uptime'
      )
    ),
    // Right Side - Form
    h('div', { className: "w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-16 relative" },
      h('button', {
        onClick: () => onNavigate('landing'),
        className: "absolute top-8 left-8 flex items-center gap-2 text-stone-400 hover:text-jaguar-900 transition-colors lg:hidden"
      },
        h(Icons.ArrowLeft, { size: 18 }),
        ' Back'
      ),
      h('div', { className: "w-full max-w-md space-y-8 animate-fade-in" },
        h('div', { className: "text-center lg:text-left" },
          h('h2', { className: "font-serif text-3xl text-jaguar-900" },
            view === 'login' ? 'Welcome back' : 'Create your account'
          ),
          h('p', { className: "text-stone-500 mt-2" },
            view === 'login'
              ? 'Enter your credentials to access your dashboard.'
              : 'Start your 14-day free trial. No credit card required.'
          )
        ),
        error && h('div', { className: "p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2" },
          h(Icons.AlertCircle, { size: 16 }),
          error
        ),
        success && h('div', { className: "p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2" },
          h(Icons.Mail, { size: 16 }),
          h('div', null,
            h('div', { className: "font-medium" }, success),
            h('button', {
              onClick: () => onNavigate('login'),
              className: "mt-2 text-green-800 underline hover:text-green-900"
            }, 'Go to login →')
          )
        ),
        h('form', { onSubmit: handleSubmit, className: "space-y-6" },
          view === 'signup' && h('div', { className: "space-y-2" },
            h('label', { className: "text-sm font-medium text-jaguar-900" }, 'Full Name'),
            h('input', {
              type: "text",
              required: true,
              value: name,
              onChange: (e) => setName(e.target.value),
              className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all placeholder:text-stone-300",
              placeholder: "John Doe"
            })
          ),
          h('div', { className: "space-y-2" },
            h('label', { className: "text-sm font-medium text-jaguar-900" }, 'Email Address'),
            h('input', {
              type: "email",
              required: true,
              value: email,
              onChange: (e) => setEmail(e.target.value),
              className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all placeholder:text-stone-300",
              placeholder: "john@company.com"
            })
          ),
          h('div', { className: "space-y-2" },
            h('div', { className: "flex justify-between" },
              h('label', { className: "text-sm font-medium text-jaguar-900" }, 'Password'),
              view === 'login' && h('a', { href: "#", className: "text-xs text-stone-500 hover:text-gold-600" }, 'Forgot password?')
            ),
            h('input', {
              type: "password",
              required: true,
              value: password,
              onChange: (e) => setPassword(e.target.value),
              className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all placeholder:text-stone-300",
              placeholder: "••••••••"
            })
          ),
          h('button', {
            type: "submit",
            disabled: loading || cooldownRemaining > 0,
            className: "w-full py-3 bg-jaguar-900 text-cream-50 rounded-lg font-medium hover:bg-jaguar-800 transition-all shadow-lg shadow-jaguar-900/10 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          },
            loading
              ? h(Icons.Loader2, { size: 20, className: "animate-spin" })
              : cooldownRemaining > 0
                ? `Please wait ${cooldownRemaining}s (anti-bot security)`
                : (view === 'login' ? 'Sign In' : 'Create Account')
          )
        ),
        h('div', { className: "text-center text-sm text-stone-500" },
          view === 'login' ? "Don't have an account? " : "Already have an account? ",
          h('button', {
            onClick: () => {
                setError('');
                onNavigate(view === 'login' ? 'signup' : 'login');
            },
            className: "font-medium text-gold-600 hover:text-gold-700 underline underline-offset-2"
          },
            view === 'login' ? 'Sign up' : 'Log in'
          )
        )
      )
    )
  );
};
