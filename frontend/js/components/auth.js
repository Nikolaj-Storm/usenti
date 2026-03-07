// Usenti - Authentication Component

const Auth = ({ view, onAuthenticate, onNavigate, recoveryToken }) => {
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
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [agreedToTerms, setAgreedToTerms] = React.useState(false);
  const [agreedToEmails, setAgreedToEmails] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState('free');

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

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.forgotPassword(email);
      setSuccess('If an account exists with that email, a password reset link has been sent. Check your inbox (and spam folder).');
      setEmail('');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    try {
      await api.resetPassword(recoveryToken, newPassword);
      setSuccess('Your password has been reset successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    console.log('🎯 [Auth] Form submitted!', { view, email, hasPassword: !!password, hasName: !!name });
    e.preventDefault();

    // Validate signup-specific fields
    if (view === 'signup' && !agreedToTerms) {
      setError('You must agree to the Terms & Conditions to create an account.');
      return;
    }

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

  return h('div', { className: "min-h-screen flex" },
    // Left Side - Brand
    h('div', { className: "hidden lg:flex w-1/2 glass-sidebar relative overflow-hidden flex-col justify-between p-12 text-white" },
      h('div', {
        className: "absolute inset-0 opacity-10",
        style: {
          backgroundImage: 'radial-gradient(circle at 2px 2px, #F5E6D3 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }
      }),
      h('div', {
        onClick: () => onNavigate('landing'),
        className: "relative z-10 flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
      },
        h('img', { src: 'visuals/logo_white.png', alt: 'Usenti Logo', style: { height: '28px', width: 'auto' } }),
        h('h1', { className: "font-serif text-2xl tracking-tight font-medium text-white" },
          'Usenti'
        )
      ),
      h('div', { className: "relative z-10 max-w-lg" },
        h('h2', { className: "font-serif text-4xl leading-tight mb-6" }, '"Hell yeah! This is going to be awesome!"'),
        h('div', { className: "text-white/60 font-light text-lg" },
          'Magnus',
          h('br'),
          'Company Hypeman'
        ),
        h('div', { className: "mt-12 flex gap-2" },
          h('div', { className: "w-12 h-1 bg-cream-100 rounded-full" }),
          h('div', { className: "w-2 h-1 bg-white/20 rounded-full" }),
          h('div', { className: "w-2 h-1 bg-white/20 rounded-full" })
        )
      ),

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
        className: "absolute top-8 left-8 flex items-center gap-2 text-white/40 hover:text-white transition-colors lg:hidden"
      },
        h(Icons.ArrowLeft, { size: 18 }),
        ' Back'
      ),

      // Email Verification Waiting Screen
      waitingForVerification ? h('div', { className: "w-full max-w-md space-y-8 animate-fade-in text-center" },
        h('div', { className: "flex justify-center mb-8" },
          h('div', { className: "w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center" },
            h(Icons.Mail, { size: 48, className: "text-blue-300" })
          )
        ),
        h('div', null,
          h('h2', { className: "font-serif text-3xl text-white mb-3" }, 'Check your email'),
          h('p', { className: "text-white/70 text-lg mb-6" },
            'We sent a confirmation link to ',
            h('strong', { className: "text-white" }, verificationEmail)
          ),
          h('p', { className: "text-white/60 mb-8" },
            'Click the link in the email to verify your account. This page will automatically redirect you to the dashboard once verified.'
          )
        ),
        h('div', { className: "flex flex-col items-center gap-4" },
          h('div', { className: "flex items-center gap-3 text-white/60" },
            h(Icons.Loader2, { size: 20, className: "animate-spin text-blue-400" }),
            h('span', null, 'Waiting for email confirmation...')
          ),
          h('div', { className: "mt-8 p-6 glass-card text-left" },
            h('p', { className: "text-sm text-white font-medium mb-2" }, 'Didn\'t receive the email?'),
            h('ul', { className: "text-sm text-white/70 space-y-1 ml-4 list-disc" },
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
            className: "mt-6 text-white/60 hover:text-white underline text-sm"
          }, 'I\'ll verify later and log in manually \u2192')
        )
      ) :

        // Forgot Password Form
        view === 'forgot-password' ? h('div', { className: "w-full max-w-md space-y-8 animate-fade-in" },
          h('div', { className: "text-center lg:text-left" },
            h('h2', { className: "font-serif text-3xl text-white" }, 'Reset your password'),
            h('p', { className: "text-white/60 mt-2" },
              'Enter the email address associated with your account and we\'ll send you a link to reset your password.'
            )
          ),
          error && h('div', { className: "p-4 glass-card border-red-500/30 text-red-300 text-sm flex items-center gap-2" },
            h(Icons.AlertCircle, { size: 16 }),
            error
          ),
          success && h('div', { className: "p-4 glass-card border-green-500/30 text-green-300 text-sm flex items-center gap-2" },
            h(Icons.Mail, { size: 16 }),
            h('div', null,
              h('div', { className: "font-medium" }, success),
              h('button', {
                onClick: () => { setSuccess(''); onNavigate('login'); },
                className: "mt-2 text-green-300 underline hover:text-green-200"
              }, 'Back to login \u2192')
            )
          ),
          !success && h('form', { onSubmit: handleForgotPassword, className: "space-y-6" },
            h('div', { className: "space-y-2" },
              h('label', { className: "text-sm font-medium text-white/70" }, 'Email Address'),
              h('input', {
                type: "email",
                required: true,
                value: email,
                onChange: (e) => setEmail(e.target.value),
                className: "w-full px-4 py-3 glass-input rounded-xl transition-all",
                placeholder: "john@company.com"
              })
            ),
            h('button', {
              type: "submit",
              disabled: loading,
              className: "w-full py-3 bg-cream-100 text-rust-900 rounded-full font-medium hover:bg-cream-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            },
              loading
                ? h(Icons.Loader2, { size: 20, className: "animate-spin" })
                : 'Send Reset Link'
            )
          ),
          h('div', { className: "text-center text-sm text-white/60" },
            'Remember your password? ',
            h('button', {
              onClick: () => { setError(''); setSuccess(''); onNavigate('login'); },
              className: "font-medium text-cream-100 hover:text-white underline underline-offset-2"
            }, 'Log in')
          )
        ) :

          // Reset Password Form (after clicking email link)
          view === 'reset-password' ? h('div', { className: "w-full max-w-md space-y-8 animate-fade-in" },
            h('div', { className: "text-center lg:text-left" },
              h('h2', { className: "font-serif text-3xl text-white" }, 'Set new password'),
              h('p', { className: "text-white/60 mt-2" },
                'Enter your new password below.'
              )
            ),
            error && h('div', { className: "p-4 glass-card border-red-500/30 text-red-300 text-sm flex items-center gap-2" },
              h(Icons.AlertCircle, { size: 16 }),
              error
            ),
            success && h('div', { className: "p-4 glass-card border-green-500/30 text-green-300 text-sm flex items-center gap-2" },
              h(Icons.Mail, { size: 16 }),
              h('div', null,
                h('div', { className: "font-medium" }, success),
                h('button', {
                  onClick: () => { setSuccess(''); onNavigate('login'); },
                  className: "mt-2 text-green-300 underline hover:text-green-200"
                }, 'Go to login \u2192')
              )
            ),
            !success && h('form', { onSubmit: handleResetPassword, className: "space-y-6" },
              h('div', { className: "space-y-2" },
                h('label', { className: "text-sm font-medium text-white/70" }, 'New Password'),
                h('input', {
                  type: "password",
                  required: true,
                  value: newPassword,
                  onChange: (e) => setNewPassword(e.target.value),
                  className: "w-full px-4 py-3 glass-input rounded-xl transition-all",
                  placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
                  minLength: 6
                })
              ),
              h('div', { className: "space-y-2" },
                h('label', { className: "text-sm font-medium text-white/70" }, 'Confirm New Password'),
                h('input', {
                  type: "password",
                  required: true,
                  value: confirmPassword,
                  onChange: (e) => setConfirmPassword(e.target.value),
                  className: "w-full px-4 py-3 glass-input rounded-xl transition-all",
                  placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
                  minLength: 6
                })
              ),
              h('button', {
                type: "submit",
                disabled: loading,
                className: "w-full py-3 bg-cream-100 text-rust-900 rounded-full font-medium hover:bg-cream-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              },
                loading
                  ? h(Icons.Loader2, { size: 20, className: "animate-spin" })
                  : 'Reset Password'
              )
            )
          ) :

            // Regular Login/Signup Form
            h('div', { className: "w-full max-w-md space-y-8 animate-fade-in" },
              h('div', { className: "text-center lg:text-left" },
                h('h2', { className: "font-serif text-3xl text-white" },
                  view === 'login' ? 'Welcome back' : 'Create your account'
                ),
                h('p', { className: "text-white/60 mt-2" },
                  view === 'login'
                    ? 'Enter your credentials to access your dashboard.'
                    : 'Start your 14-day free trial. No credit card required.'
                )
              ),
              error && h('div', { className: "p-4 glass-card border-red-500/30 text-red-300 text-sm flex items-center gap-2" },
                h(Icons.AlertCircle, { size: 16 }),
                error
              ),
              success && h('div', { className: "p-4 glass-card border-green-500/30 text-green-300 text-sm flex items-center gap-2" },
                h(Icons.Mail, { size: 16 }),
                h('div', null,
                  h('div', { className: "font-medium" }, success),
                  h('button', {
                    onClick: () => onNavigate('login'),
                    className: "mt-2 text-green-300 underline hover:text-green-200"
                  }, 'Go to login \u2192')
                )
              ),

              // --- Google Sign Auth Button ---
              h('button', {
                type: "button",
                onClick: async () => {
                  setLoading(true);
                  setError('');
                  try {
                    await api.loginWithGoogle();
                  } catch (err) {
                    setError(err.message || 'Google Sign-In failed.');
                    setLoading(false);
                  }
                },
                disabled: loading || cooldownRemaining > 0,
                className: "w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-full font-medium transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              },
                h('svg', { viewBox: "0 0 24 24", width: "20", height: "20", xmlns: "http://www.w3.org/2000/svg" },
                  h('g', { transform: "matrix(1, 0, 0, 1, 27.009001, -39.238998)" },
                    h('path', { fill: "#4285F4", d: "M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" }),
                    h('path', { fill: "#34A853", d: "M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" }),
                    h('path', { fill: "#FBBC05", d: "M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" }),
                    h('path', { fill: "#EA4335", d: "M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" })
                  )
                ),
                'Continue with Google'
              ),

              h('div', { className: "relative flex items-center py-2" },
                h('div', { className: "flex-grow border-t border-white/10" }),
                h('span', { className: "flex-shrink-0 mx-4 text-white/40 text-sm" }, "Or continue with email"),
                h('div', { className: "flex-grow border-t border-white/10" })
              ),
              // --------------------------------

              h('form', { onSubmit: handleSubmit, className: "space-y-6" },
                view === 'signup' && h('div', { className: "space-y-2" },
                  h('label', { className: "text-sm font-medium text-white/70" }, 'Full Name'),
                  h('input', {
                    type: "text",
                    required: true,
                    value: name,
                    onChange: (e) => setName(e.target.value),
                    className: "w-full px-4 py-3 glass-input rounded-xl transition-all",
                    placeholder: "John Doe"
                  })
                ),
                h('div', { className: "space-y-2" },
                  h('label', { className: "text-sm font-medium text-white/70" }, 'Email Address'),
                  h('input', {
                    type: "email",
                    required: true,
                    value: email,
                    onChange: (e) => setEmail(e.target.value),
                    className: "w-full px-4 py-3 glass-input rounded-xl transition-all",
                    placeholder: "john@company.com"
                  })
                ),
                h('div', { className: "space-y-2" },
                  h('div', { className: "flex justify-between" },
                    h('label', { className: "text-sm font-medium text-white/70" }, 'Password'),
                    view === 'login' && h('button', {
                      type: "button",
                      onClick: (e) => { e.preventDefault(); setError(''); setSuccess(''); onNavigate('forgot-password'); },
                      className: "text-xs text-white/50 hover:text-cream-100"
                    }, 'Forgot password?')
                  ),
                  h('input', {
                    type: "password",
                    required: true,
                    value: password,
                    onChange: (e) => setPassword(e.target.value),
                    className: "w-full px-4 py-3 glass-input rounded-xl transition-all",
                    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                  })
                ),

                // --- Signup-only: Plan Selection ---
                view === 'signup' && h('div', { className: "space-y-3" },
                  h('label', { className: "text-sm font-medium text-white/70" }, 'Choose your plan'),
                  h('div', { className: "grid grid-cols-2 gap-3" },
                    h('button', {
                      type: "button",
                      onClick: () => setSelectedPlan('free'),
                      className: `p-4 rounded-xl border-2 transition-all text-left ${selectedPlan === 'free'
                        ? 'border-cream-100 bg-white/10'
                        : 'border-white/10 hover:border-white/30'
                        }`
                    },
                      h('div', { className: "font-bold text-white text-sm" }, 'Free'),
                      h('div', { className: "text-white/50 text-xs mt-1" }, '$0/mo'),
                      h('div', { className: "text-white/40 text-xs mt-2" }, '50 emails/day'),
                      h('div', { className: "text-white/40 text-xs" }, '1,000 contacts')
                    ),
                    h('button', {
                      type: "button",
                      onClick: () => setSelectedPlan('rebel_plan'),
                      className: `p-4 rounded-xl border-2 transition-all text-left ${selectedPlan === 'rebel_plan'
                        ? 'border-cream-100 bg-white/10'
                        : 'border-white/10 hover:border-white/30'
                        }`
                    },
                      h('div', { className: "flex items-center gap-2" },
                        h('span', { className: "font-bold text-white text-sm" }, 'Rebel Plan'),
                        h('span', { className: "text-[10px] px-1.5 py-0.5 bg-cream-100 text-rust-900 rounded-full font-bold" }, 'PRO')
                      ),
                      h('div', { className: "text-white/50 text-xs mt-1" }, '$45/mo'),
                      h('div', { className: "text-white/40 text-xs mt-2" }, '100k emails/mo'),
                      h('div', { className: "text-white/40 text-xs" }, '25,000 contacts')
                    )
                  )
                ),

                // --- Signup-only: T&C and Marketing Consent checkboxes ---
                view === 'signup' && h('div', { className: "space-y-3" },
                  h('label', { className: "flex items-start gap-3 cursor-pointer group" },
                    h('input', {
                      type: "checkbox",
                      checked: agreedToTerms,
                      onChange: () => setAgreedToTerms(!agreedToTerms),
                      className: "mt-1 w-4 h-4 accent-cream-100 rounded"
                    }),
                    h('span', { className: "text-xs text-white/60 leading-relaxed" },
                      'I agree to the ',
                      h('a', { href: '#', className: "text-cream-100 underline" }, 'Terms & Conditions'),
                      '. I understand that I am solely responsible for complying with all applicable email and anti-spam laws (CAN-SPAM, GDPR, etc.) when using this service, and that Usenti is not liable for any misuse of its outreach tools.'
                    )
                  ),
                  h('label', { className: "flex items-start gap-3 cursor-pointer group" },
                    h('input', {
                      type: "checkbox",
                      checked: agreedToEmails,
                      onChange: () => setAgreedToEmails(!agreedToEmails),
                      className: "mt-1 w-4 h-4 accent-cream-100 rounded"
                    }),
                    h('span', { className: "text-xs text-white/60 leading-relaxed" },
                      'I agree to receive product updates and marketing emails from Usenti. You can unsubscribe at any time.'
                    )
                  )
                ),

                h('button', {
                  type: "submit",
                  disabled: loading || cooldownRemaining > 0 || (view === 'signup' && !agreedToTerms),
                  className: "w-full py-3 bg-cream-100 text-rust-900 rounded-full font-medium hover:bg-cream-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                },
                  loading
                    ? h(Icons.Loader2, { size: 20, className: "animate-spin" })
                    : cooldownRemaining > 0
                      ? `Please wait ${cooldownRemaining}s (anti-bot security)`
                      : (view === 'login' ? 'Sign In' : 'Create Account')
                )
              ),
              h('div', { className: "text-center text-sm text-white/60" },
                view === 'login' ? "Don't have an account? " : "Already have an account? ",
                h('button', {
                  onClick: () => {
                    setError('');
                    onNavigate(view === 'login' ? 'signup' : 'login');
                  },
                  className: "font-medium text-cream-100 hover:text-white underline underline-offset-2"
                },
                  view === 'login' ? 'Sign up' : 'Log in'
                )
              )
            )
    )
  );
};
