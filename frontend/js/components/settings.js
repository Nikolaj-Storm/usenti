// frontend/js/components/settings.js

const Settings = () => {
    const [activeTab, setActiveTab] = React.useState('billing');
    const [loading, setLoading] = React.useState(false);
    const [currentTier, setCurrentTier] = React.useState('loading');
    const [usage, setUsage] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [successMsg, setSuccessMsg] = React.useState(null);
    const [showCancelModal, setShowCancelModal] = React.useState(false);
    const [showDowngradeModal, setShowDowngradeModal] = React.useState(false);
    const [inviteCode, setInviteCode] = React.useState('');
    const [redeeming, setRedeeming] = React.useState(false);

    // Fetch subscription on mount + handle Stripe redirect params
    React.useEffect(() => {
        fetchSubscription();

        const params = new URLSearchParams(window.location.search);
        if (params.get('success') === 'true') {
            setSuccessMsg('Payment successful! Your subscription has been updated.');
            setActiveTab('billing');
            window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        }
        if (params.get('canceled') === 'true') {
            setError('Checkout was canceled. Your plan has not been changed.');
            setActiveTab('billing');
            window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        }
    }, []);

    const fetchSubscription = async () => {
        try {
            const data = await api.get('/api/stripe/status');
            setCurrentTier(data.planTier || 'free');
            setUsage(data.usage || { sent: 0, limit: 200, cycle: 'week' });
        } catch (err) {
            console.error('Failed to fetch subscription:', err);
            setCurrentTier('free');
            setUsage({ sent: 0, limit: 200, cycle: 'week' });
        }
    };

    const handleUpgrade = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.post('/api/stripe/create-checkout-session', { planTier: 'rebel_plan' });
            if (data.url) {
                window.location.href = data.url;
            } else {
                setError('Failed to create checkout session.');
            }
        } catch (err) {
            console.error('Upgrade error:', err);
            setError(err.message || 'An error occurred during checkout.');
        } finally {
            setLoading(false);
        }
    };

    const handleCustomerPortal = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.post('/api/stripe/customer-portal');
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            setError(err.message || 'Could not open billing portal. Please try again.');
            setLoading(false);
        }
    };

    const handleCancelSubscription = async () => {
        setShowCancelModal(false);
        try {
            setLoading(true);
            setError(null);
            const data = await api.post('/api/stripe/customer-portal');
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            setError(err.message || 'Could not open cancellation portal. Please try again.');
            setLoading(false);
        }
    };

    const handleDowngrade = async () => {
        setShowDowngradeModal(false);
        try {
            setLoading(true);
            setError(null);
            const data = await api.post('/api/stripe/customer-portal');
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            setError(err.message || 'Could not open billing portal. Please try again.');
            setLoading(false);
        }
    };

    const handleRedeemInvite = async (e) => {
        e.preventDefault();
        if (!inviteCode.trim()) return;

        try {
            setRedeeming(true);
            setError(null);
            setSuccessMsg(null);

            const data = await api.post('/api/invite/redeem', { code: inviteCode });
            setSuccessMsg(data.message);
            setInviteCode('');
            fetchSubscription(); // Refresh plan status
        } catch (err) {
            setError(err.message || 'Failed to redeem invite code');
        } finally {
            setRedeeming(false);
        }
    };

    // --- Usage Progress Bar ---
    const usagePercent = usage ? Math.min(100, Math.round((usage.sent / usage.limit) * 100)) : 0;
    const usageColor = usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500';

    // --- Tab Button ---
    const TabButton = ({ id, icon: IconComponent, label }) =>
        h('button', {
            onClick: () => { setActiveTab(id); setError(null); setSuccessMsg(null); },
            className: `flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === id
                ? 'bg-cream-100 text-rust-900 shadow-lg'
                : 'text-white/60 hover:text-white hover:bg-white/10'
                }`
        },
            h(IconComponent, { size: 18 }),
            label
        );

    // ==============================
    // ACCOUNT TAB
    // ==============================
    const AccountTab = () => {
        const storedUser = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.USER);
        let user = null;
        try { user = JSON.parse(storedUser); } catch (e) { /* ignore */ }

        return h('div', { className: 'space-y-8 animate-fade-in' },
            h('div', null,
                h('h2', { className: 'text-2xl font-serif text-white tracking-tight' }, 'Account'),
                h('p', { className: 'text-white/50 mt-1 text-sm' }, 'Your profile information and account details.')
            ),
            h('div', { className: 'glass-panel p-8 rounded-2xl space-y-6 max-w-2xl' },
                // Avatar + Name
                h('div', { className: 'flex items-center gap-5' },
                    h('div', { className: 'w-16 h-16 rounded-full bg-cream-100 text-rust-900 flex items-center justify-center font-serif font-bold text-2xl' },
                        (user?.user_metadata?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U')
                    ),
                    h('div', null,
                        h('h3', { className: 'text-lg font-medium text-white' },
                            user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'
                        ),
                        h('p', { className: 'text-white/50 text-sm' }, user?.email || 'No email found')
                    )
                ),
                // Divider
                h('div', { className: 'border-t border-white/10' }),
                // Info fields
                h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-6' },
                    h('div', null,
                        h('label', { className: 'text-xs font-medium text-white/40 uppercase tracking-wider' }, 'Full Name'),
                        h('p', { className: 'text-white mt-1 font-medium' },
                            user?.user_metadata?.name || 'Not set'
                        )
                    ),
                    h('div', null,
                        h('label', { className: 'text-xs font-medium text-white/40 uppercase tracking-wider' }, 'Email Address'),
                        h('p', { className: 'text-white mt-1 font-medium' }, user?.email || '—')
                    ),
                    h('div', null,
                        h('label', { className: 'text-xs font-medium text-white/40 uppercase tracking-wider' }, 'Account ID'),
                        h('p', { className: 'text-white/60 mt-1 text-sm font-mono' }, user?.id?.slice(0, 8) + '...' || '—')
                    ),
                    h('div', null,
                        h('label', { className: 'text-xs font-medium text-white/40 uppercase tracking-wider' }, 'Current Plan'),
                        h('p', { className: 'mt-1' },
                            h('span', {
                                className: `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${currentTier === 'rebel_plan'
                                    ? 'bg-cream-100/20 text-cream-100 border border-cream-100/30'
                                    : 'bg-white/10 text-white/70 border border-white/10'
                                    }`
                            },
                                currentTier === 'rebel_plan' ? '⚡ Rebel Plan' : 'Free Plan'
                            )
                        )
                    )
                )
            )
        );
    };

    // ==============================
    // BILLING TAB
    // ==============================
    const BillingTab = () =>
        h('div', { className: 'space-y-8 animate-fade-in' },
            h('div', null,
                h('h2', { className: 'text-2xl font-serif text-white tracking-tight' }, 'Billing & Subscription'),
                h('p', { className: 'text-white/50 mt-1 text-sm' }, 'Manage your plan, usage limits, and payment information.')
            ),

            // --- Current Plan + Usage Card ---
            h('div', { className: 'glass-panel p-6 rounded-2xl' },
                h('div', { className: 'flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6' },
                    h('div', { className: 'flex-1 space-y-4' },
                        h('div', { className: 'flex items-center gap-3' },
                            h('div', {
                                className: `w-10 h-10 rounded-xl flex items-center justify-center ${currentTier === 'rebel_plan' ? 'bg-cream-100/20' : 'bg-white/10'
                                    }`
                            },
                                h(Icons.Zap, { size: 20, className: currentTier === 'rebel_plan' ? 'text-cream-100' : 'text-white/60' })
                            ),
                            h('div', null,
                                h('h3', { className: 'text-lg font-medium text-white' }, 'Current Plan'),
                                h('p', { className: 'text-cream-100 font-bold capitalize' },
                                    currentTier === 'rebel_plan' ? 'Rebel Plan — $45/mo' : 'Free Plan — $0/mo'
                                )
                            )
                        ),
                        // Usage bar
                        usage && h('div', { className: 'space-y-2' },
                            h('div', { className: 'flex justify-between text-sm' },
                                h('span', { className: 'text-white/60' }, 'Emails sent this ' + (usage.cycle || 'cycle')),
                                h('span', { className: 'text-white font-medium' },
                                    `${(usage.sent || 0).toLocaleString()} / ${(usage.limit || 0).toLocaleString()}`
                                )
                            ),
                            h('div', { className: 'w-full h-2.5 bg-white/10 rounded-full overflow-hidden' },
                                h('div', {
                                    className: `h-full rounded-full transition-all duration-500 ${usageColor}`,
                                    style: { width: `${usagePercent}%` }
                                })
                            ),
                            usagePercent > 90 && h('p', { className: 'text-xs text-red-400 flex items-center gap-1' },
                                h(Icons.AlertCircle, { size: 12 }),
                                'You are approaching your sending limit.'
                            )
                        )
                    ),
                    // Action buttons (right side)
                    h('div', { className: 'flex flex-col gap-3 lg:min-w-[200px]' },
                        currentTier !== 'free' && h('button', {
                            onClick: handleCustomerPortal,
                            disabled: loading,
                            className: 'px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50'
                        },
                            h(Icons.CreditCard, { size: 16 }),
                            'Update Payment Method'
                        ),
                        currentTier !== 'free' && h('button', {
                            onClick: () => setShowCancelModal(true),
                            disabled: loading,
                            className: 'px-5 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all text-sm font-medium flex items-center justify-center gap-2 border border-red-500/20 hover:border-red-500/40 disabled:opacity-50'
                        },
                            h(Icons.X, { size: 16 }),
                            'Cancel Subscription'
                        )
                    )
                )
            ),

            // --- Plan Comparison Cards ---
            h('div', null,
                h('h3', { className: 'text-lg font-medium text-white mb-4' }, 'Available Plans'),
                h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl' },

                    // Free Plan Card
                    h('div', {
                        className: `glass-panel p-8 rounded-2xl relative flex flex-col transition-all duration-300 ${currentTier === 'free' ? 'ring-2 ring-cream-100' : 'hover:bg-white/5'
                            }`
                    },
                        currentTier === 'free' && h('div', { className: 'absolute -top-3 left-1/2 -translate-x-1/2 bg-cream-100 text-rust-900 text-xs font-bold px-3 py-1 rounded-full shadow-lg' }, 'CURRENT PLAN'),
                        h('div', { className: 'mb-6' },
                            h('h4', { className: 'text-xl font-medium text-white mb-2' }, 'Free'),
                            h('div', null,
                                h('span', { className: 'text-4xl font-serif text-white' }, '$0'),
                                h('span', { className: 'text-white/60' }, '/mo')
                            )
                        ),
                        h('ul', { className: 'space-y-3 mb-8 flex-1' },
                            h('li', { className: 'flex items-center text-sm text-white/80' },
                                h(Icons.Check, { size: 16, className: 'text-cream-100 mr-2.5 flex-shrink-0' }), '50 emails / day, 200 / week'
                            ),
                            h('li', { className: 'flex items-center text-sm text-white/80' },
                                h(Icons.Check, { size: 16, className: 'text-cream-100 mr-2.5 flex-shrink-0' }), 'Up to 1,000 active contacts'
                            ),
                            h('li', { className: 'flex items-center text-sm text-white/80' },
                                h(Icons.Check, { size: 16, className: 'text-cream-100 mr-2.5 flex-shrink-0' }), 'Basic email automation'
                            ),
                            h('li', { className: 'flex items-start text-sm text-white/60' },
                                h(Icons.X, { size: 16, className: 'text-white/30 mr-2.5 flex-shrink-0 mt-0.5' }), 'Includes "Powered by Usenti" footer'
                            )
                        ),
                        currentTier === 'free'
                            ? h('div', { className: 'w-full py-3 px-4 rounded-xl font-medium text-center bg-white/5 text-white/40' }, 'Active')
                            : h('button', {
                                onClick: () => setShowDowngradeModal(true),
                                disabled: loading,
                                className: 'w-full py-3 px-4 rounded-xl font-medium transition-all bg-white/10 hover:bg-white/20 text-white disabled:opacity-50'
                            }, 'Downgrade to Free')
                    ),

                    // Rebel Plan Card
                    h('div', {
                        className: `glass-panel p-8 rounded-2xl relative flex flex-col transition-all duration-300 bg-gradient-to-b from-white/5 to-transparent ${currentTier === 'rebel_plan' ? 'ring-2 ring-cream-100' : 'border border-cream-100/20 hover:border-cream-100/40'
                            }`
                    },
                        currentTier === 'rebel_plan' && h('div', { className: 'absolute -top-3 left-1/2 -translate-x-1/2 bg-cream-100 text-rust-900 text-xs font-bold px-3 py-1 rounded-full shadow-lg' }, 'CURRENT PLAN'),
                        h('div', { className: 'mb-6' },
                            h('div', { className: 'flex items-center gap-2 mb-2' },
                                h('h4', { className: 'text-xl font-medium text-cream-100' }, 'Rebel Plan'),
                                h('span', { className: 'text-[10px] px-2 py-0.5 bg-cream-100 text-rust-900 rounded-full font-bold' }, 'PRO')
                            ),
                            h('div', null,
                                h('span', { className: 'text-4xl font-serif text-white' }, '$45'),
                                h('span', { className: 'text-white/60' }, '/mo')
                            )
                        ),
                        h('ul', { className: 'space-y-3 mb-8 flex-1' },
                            h('li', { className: 'flex items-center text-sm text-white/80' },
                                h(Icons.Check, { size: 16, className: 'text-cream-100 mr-2.5 flex-shrink-0' }), '100,000 emails / month'
                            ),
                            h('li', { className: 'flex items-center text-sm text-white/80' },
                                h(Icons.Check, { size: 16, className: 'text-cream-100 mr-2.5 flex-shrink-0' }), 'Up to 25,000 total contacts'
                            ),
                            h('li', { className: 'flex items-center text-sm text-white/80' },
                                h(Icons.Check, { size: 16, className: 'text-cream-100 mr-2.5 flex-shrink-0' }), 'No Usenti branding'
                            ),
                            h('li', { className: 'flex items-center text-sm text-white/80' },
                                h(Icons.Check, { size: 16, className: 'text-cream-100 mr-2.5 flex-shrink-0' }), 'Priority support'
                            )
                        ),
                        currentTier === 'rebel_plan'
                            ? h('div', { className: 'w-full py-3 px-4 rounded-xl font-medium text-center bg-white/5 text-white/40' }, 'Active')
                            : h('button', {
                                onClick: handleUpgrade,
                                disabled: loading,
                                className: 'w-full py-3 px-4 rounded-xl font-medium transition-all bg-cream-100 hover:bg-cream-200 text-rust-900 shadow-[0_0_20px_rgba(245,230,211,0.3)] hover:shadow-[0_0_25px_rgba(245,230,211,0.5)] disabled:opacity-50 flex items-center justify-center gap-2'
                            },
                                loading ? h(Icons.Loader2, { size: 18, className: 'animate-spin' }) : null,
                                loading ? 'Processing...' : 'Upgrade to Rebel Plan'
                            )
                    )
                )
            ),

            // --- Billing Info Section (for paid users) ---
            currentTier !== 'free' && h('div', { className: 'glass-panel p-6 rounded-2xl' },
                h('div', { className: 'flex items-center justify-between' },
                    h('div', null,
                        h('h3', { className: 'text-lg font-medium text-white' }, 'Billing Information'),
                        h('p', { className: 'text-white/50 text-sm mt-1' }, 'Update your payment method, view invoices, or change your billing address via the Stripe Customer Portal.')
                    ),
                    h('button', {
                        onClick: handleCustomerPortal,
                        disabled: loading,
                        className: 'px-5 py-2.5 bg-cream-100/10 hover:bg-cream-100/20 text-cream-100 rounded-xl transition-all text-sm font-medium flex items-center gap-2 border border-cream-100/20 disabled:opacity-50'
                    },
                        h(Icons.ArrowUpRight, { size: 16 }),
                        'Manage Billing'
                    )
                )
            ),

            // --- Redeem Invite Code ---
            currentTier === 'free' && h('div', { className: 'glass-panel p-6 rounded-2xl flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between' },
                h('div', { className: 'flex-1' },
                    h('h3', { className: 'text-lg font-medium text-white' }, 'Redeem Invite Code'),
                    h('p', { className: 'text-white/50 text-sm mt-1' }, 'Have an invite code? Redeem it here to get 3 months of the Rebel Plan for free.')
                ),
                h('form', { onSubmit: handleRedeemInvite, className: 'flex w-full sm:max-w-xs items-center gap-2' },
                    h('input', {
                        type: 'text',
                        value: inviteCode,
                        onChange: (e) => setInviteCode(e.target.value.toUpperCase()),
                        placeholder: 'Enter Code',
                        disabled: redeeming,
                        className: 'w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-cream-100/50 transition-colors uppercase'
                    }),
                    h('button', {
                        type: 'submit',
                        disabled: redeeming || !inviteCode.trim(),
                        className: 'px-5 py-2.5 bg-cream-100/10 hover:bg-cream-100/20 text-cream-100 rounded-xl transition-all font-medium whitespace-nowrap border border-cream-100/20 disabled:opacity-50 flex items-center gap-2'
                    },
                        redeeming ? h(Icons.Loader2, { size: 16, className: 'animate-spin' }) : null,
                        redeeming ? 'Redeeming' : 'Redeem'
                    )
                )
            )
        );

    // ==============================
    // CONFIRMATION MODALS
    // ==============================

    const CancelModal = () =>
        h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in' },
            h('div', { className: 'glass-panel p-8 rounded-2xl max-w-md w-full mx-4 space-y-6 shadow-2xl' },
                h('div', { className: 'flex items-center gap-3' },
                    h('div', { className: 'w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center' },
                        h(Icons.AlertCircle, { size: 24, className: 'text-red-400' })
                    ),
                    h('div', null,
                        h('h3', { className: 'text-xl font-serif text-white' }, 'Cancel Subscription?'),
                        h('p', { className: 'text-white/50 text-sm' }, 'This action cannot be undone immediately.')
                    )
                ),
                h('div', { className: 'bg-white/5 p-4 rounded-xl space-y-2' },
                    h('p', { className: 'text-white/80 text-sm' }, 'If you cancel your Rebel Plan subscription:'),
                    h('ul', { className: 'text-white/60 text-sm space-y-1 ml-4 list-disc' },
                        h('li', null, 'You\'ll lose access to 100k monthly email limit'),
                        h('li', null, 'Your contact limit drops to 1,000'),
                        h('li', null, '"Powered by Usenti" footer will be added to emails'),
                        h('li', null, 'Access continues until end of current billing period')
                    )
                ),
                h('div', { className: 'flex gap-3' },
                    h('button', {
                        onClick: () => setShowCancelModal(false),
                        className: 'flex-1 py-3 px-4 rounded-xl font-medium bg-white/10 hover:bg-white/20 text-white transition-all'
                    }, 'Keep My Plan'),
                    h('button', {
                        onClick: handleCancelSubscription,
                        className: 'flex-1 py-3 px-4 rounded-xl font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-all'
                    }, 'Cancel Subscription')
                )
            )
        );

    const DowngradeModal = () =>
        h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in' },
            h('div', { className: 'glass-panel p-8 rounded-2xl max-w-md w-full mx-4 space-y-6 shadow-2xl' },
                h('div', { className: 'flex items-center gap-3' },
                    h('div', { className: 'w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center' },
                        h(Icons.AlertCircle, { size: 24, className: 'text-amber-400' })
                    ),
                    h('div', null,
                        h('h3', { className: 'text-xl font-serif text-white' }, 'Downgrade to Free?'),
                        h('p', { className: 'text-white/50 text-sm' }, 'You\'ll be redirected to manage your subscription.')
                    )
                ),
                h('div', { className: 'bg-white/5 p-4 rounded-xl space-y-2' },
                    h('p', { className: 'text-white/80 text-sm' }, 'By downgrading to the Free plan:'),
                    h('ul', { className: 'text-white/60 text-sm space-y-1 ml-4 list-disc' },
                        h('li', null, 'Email limit drops from 100k/month to 200/week'),
                        h('li', null, 'Contact limit drops from 25,000 to 1,000'),
                        h('li', null, 'Usenti branding will be added to outgoing emails'),
                        h('li', null, 'Changes take effect at end of billing period')
                    )
                ),
                h('div', { className: 'flex gap-3' },
                    h('button', {
                        onClick: () => setShowDowngradeModal(false),
                        className: 'flex-1 py-3 px-4 rounded-xl font-medium bg-white/10 hover:bg-white/20 text-white transition-all'
                    }, 'Stay on Rebel'),
                    h('button', {
                        onClick: handleDowngrade,
                        className: 'flex-1 py-3 px-4 rounded-xl font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-all'
                    }, 'Downgrade')
                )
            )
        );

    // ==============================
    // MAIN RENDER
    // ==============================
    return h('div', { className: 'max-w-5xl mx-auto space-y-8 animate-fade-in' },
        // Page Header
        h('div', null,
            h('h1', { className: 'text-3xl font-serif text-white tracking-tight' }, 'Settings'),
            h('p', { className: 'text-white/50 mt-1' }, 'Manage your account, subscription, and billing.')
        ),

        // Alerts
        error && h('div', { className: 'p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 animate-slide-up flex items-center gap-2' },
            h(Icons.AlertCircle, { size: 18 }),
            error,
            h('button', {
                onClick: () => setError(null),
                className: 'ml-auto text-red-300 hover:text-white transition-colors'
            }, h(Icons.X, { size: 16 }))
        ),
        successMsg && h('div', { className: 'p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-200 animate-slide-up flex items-center gap-2' },
            h(Icons.Check, { size: 18 }),
            successMsg,
            h('button', {
                onClick: () => setSuccessMsg(null),
                className: 'ml-auto text-emerald-300 hover:text-white transition-colors'
            }, h(Icons.X, { size: 16 }))
        ),

        // Tab Navigation
        h('div', { className: 'flex gap-2 p-1 glass-panel rounded-2xl w-fit' },
            h(TabButton, { id: 'account', icon: Icons.Users, label: 'Account' }),
            h(TabButton, { id: 'billing', icon: Icons.CreditCard, label: 'Billing & Subscription' })
        ),

        // Tab Content
        activeTab === 'account' && h(AccountTab),
        activeTab === 'billing' && h(BillingTab),

        // Modals
        showCancelModal && h(CancelModal),
        showDowngradeModal && h(DowngradeModal)
    );
};
