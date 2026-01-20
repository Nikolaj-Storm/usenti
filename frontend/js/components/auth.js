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
  const [waitingForVerification, setWaitingForVerification] = React.useState(false);
  const [verificationEmail, setVerificationEmail] = React.useState('');
  const [verificationPassword, setVerificationPassword] = React.useState('');

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

  // Poll for email verification - auto-login once verified
  React.useEffect(() => {
    if (!waitingForVerification || !verificationEmail || !verificationPassword) {
      return;
    }

    console.log('📧 [Auth] Polling for email verification...');

    let attempts = 0;
    const maxAttempts = 120; // Poll for up to 10 minutes (120 * 5 seconds)

    const pollInterval = setInterval(async () => {
      attempts++;
      console.log(`🔄 [Auth] Verification poll attempt ${attempts}/${maxAttempts}`);

      try {
        // Try to login - if email is verified, this will succeed
        const response = await api.login(verificationEmail, verificationPassword);

        if (response && response.session) {
          console.log('✅ [Auth] Email verified! Logging in...');
          clearInterval(pollInterval);
          setWaitingForVerification(false);
          onAuthenticate(response.user);
        }
      } catch (err) {
        console.log('⏳ [Auth] Email not verified yet, will retry...');

        if (attempts >= maxAttempts) {
          console.warn('⚠️ [Auth] Max verification attempts reached');
          clearInterval(pollInterval);
          setWaitingForVerification(false);
          setError('Verification timeout. Please log in manually after confirming your email.');
        }
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [waitingForVerification, verificationEmail, verificationPassword, onAuthenticate]);

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
          console.log('📧 [Auth] Email confirmation required. Showing verification screen...');
          // Store credentials to auto-login after verification
          setVerificationEmail(email);
          setVerificationPassword(password);
          // Show the "waiting for verification" screen
          setWaitingForVerification(true);
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
    // Right Side - Form or Verification Screen
    h('div', { className: "w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-16 relative" },
      h('button', {
        onClick: () => {
          if (waitingForVerification) {
            setWaitingForVerification(false);
            setVerificationEmail('');
            setVerificationPassword('');
          }
          onNavigate('landing');
        },
        className: "absolute top-8 left-8 flex items-center gap-2 text-stone-400 hover:text-jaguar-900 transition-colors lg:hidden"
      },
        h(Icons.ArrowLeft, { size: 18 }),
        ' Back'
      ),

      // Email Verification Waiting Screen
      waitingForVerification ? h('div', { className: "w-full max-w-md space-y-8 animate-fade-in text-center" },
        h('div', { className: "flex justify-center mb-8" },
          h('div', { className: "w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center" },
            h(Icons.Mail, { size: 48, className: "text-blue-600" })
          )
        ),
        h('div', null,
          h('h2', { className: "font-serif text-3xl text-jaguar-900 mb-3" }, 'Check your email'),
          h('p', { className: "text-stone-600 text-lg mb-6" },
            'We sent a confirmation link to ',
            h('strong', null, verificationEmail)
          ),
          h('p', { className: "text-stone-500 mb-8" },
            'Click the link in the email to verify your account. This page will automatically redirect you to the dashboard once verified.'
          )
        ),
        h('div', { className: "flex flex-col items-center gap-4" },
          h('div', { className: "flex items-center gap-3 text-stone-500" },
            h(Icons.Loader2, { size: 20, className: "animate-spin text-blue-600" }),
            h('span', null, 'Waiting for email confirmation...')
          ),
          h('div', { className: "mt-8 p-6 bg-blue-50 border border-blue-100 rounded-lg text-left" },
            h('p', { className: "text-sm text-blue-800 font-medium mb-2" }, '📧 Didn\'t receive the email?'),
            h('ul', { className: "text-sm text-blue-700 space-y-1 ml-4 list-disc" },
              h('li', null, 'Check your spam/junk folder'),
              h('li', null, 'Make sure you entered the correct email address'),
              h('li', null, 'Wait a few minutes - emails can be delayed')
            )
          ),
          h('button', {
            onClick: () => {
              setWaitingForVerification(false);
              setVerificationEmail('');
              setVerificationPassword('');
              onNavigate('login');
            },
            className: "mt-6 text-stone-500 hover:text-jaguar-900 underline text-sm"
          }, 'I\'ll verify later and log in manually →')
        )
      ) :

      // Regular Form
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
