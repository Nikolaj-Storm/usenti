// frontend/js/components/billing.js

const Billing = () => {
    const [loading, setLoading] = React.useState(false);
    const [currentTier, setCurrentTier] = React.useState('loading');
    const [usage, setUsage] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [successMsg, setSuccessMsg] = React.useState(null);

    React.useEffect(() => {
        fetchSubscription();

        // Check URL for Stripe redirect parameters
        const params = new URLSearchParams(window.location.search);
        if (params.get('success') === 'true') {
            setSuccessMsg('Payment successful! Your subscription has been updated.');
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        }
        if (params.get('canceled') === 'true') {
            setError('Checkout canceled. Your plan has not been changed.');
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        }
    }, []);

    const fetchSubscription = async () => {
        try {
            // Create a temporary endpoint in the backend for fetching billing status
            const data = await api.get('/api/stripe/status');
            setCurrentTier(data.planTier || 'free');
            setUsage(data.usage || { sent: 0, limit: 200, cycle: 'week' });
        } catch (err) {
            console.error('Failed to fetch subscription:', err);
            // Fallback for development if endpoint isn't ready
            setCurrentTier('free');
            setUsage({ sent: 0, limit: 200, cycle: 'week' });
        }
    };

    const handleSubscribe = async (tier) => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.post('/api/stripe/create-checkout-session', { planTier: tier });
            if (data.url) {
                window.location.href = data.url;
            } else {
                setError('Failed to create checkout session.');
            }
        } catch (err) {
            console.error('Subscription error:', err);
            setError(err.message || 'An error occurred during checkout.');
        } finally {
            setLoading(false);
        }
    };

    const handleCustomerPortal = async () => {
        try {
            setLoading(true);
            setError(null);
            // Future scope: customer portal endpoint
            const data = await api.post('/api/stripe/customer-portal');
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            setError('Customer portal is not available yet.');
            setLoading(false);
        }
    };

    return h('div', { className: 'max-w-5xl mx-auto space-y-8 animate-fade-in' },
        // Header
        h('div', { className: 'flex justify-between items-center' },
            h('div', null,
                h('h1', { className: 'text-3xl font-serif text-white tracking-tight' }, 'Billing & Usage'),
                h('p', { className: 'text-white/60 mt-2' }, 'Manage your subscription and monitor email sending limits.')
            )
        ),

        error && h('div', { className: 'p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 animate-slide-up' }, error),
        successMsg && h('div', { className: 'p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-200 animate-slide-up font-medium flex items-center' },
            h(Icons.Check, { size: 20, className: 'mr-3' }),
            successMsg
        ),

        // Current Usage Widget
        h('div', { className: 'glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6' },
            h('div', null,
                h('h3', { className: 'text-lg font-medium text-white mb-1' }, 'Current Plan: ',
                    h('span', { className: 'text-cream-100 capitalize font-bold' }, currentTier)
                ),
                usage && h('p', { className: 'text-white/60 text-sm' },
                    `You have sent ${usage.sent} emails this ${usage.cycle}. Your limit is ${usage.limit?.toLocaleString() || '∞'}.`
                )
            ),
            currentTier !== 'free' && h('button', {
                onClick: handleCustomerPortal,
                disabled: loading,
                className: 'px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all'
            }, 'Manage Billing')
        ),

        // Pricing Cards
        h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 max-w-4xl mx-auto' },

            // Free Tier
            h('div', { className: `glass-panel p-8 rounded-2xl relative flex flex-col ${currentTier === 'free' ? 'ring-2 ring-cream-100' : ''}` },
                currentTier === 'free' && h('div', { className: 'absolute -top-3 left-1/2 -translate-x-1/2 bg-cream-100 text-rust-900 text-xs font-bold px-3 py-1 rounded-full' }, 'CURRENT PLAN'),
                h('h3', { className: 'text-xl font-medium text-white mb-2' }, 'Free'),
                h('div', { className: 'mb-6' },
                    h('span', { className: 'text-4xl font-serif text-white' }, '$0'),
                    h('span', { className: 'text-white/60' }, '/mo')
                ),
                h('ul', { className: 'space-y-3 mb-8 flex-1' },
                    h('li', { className: 'flex items-center text-sm text-white/80' }, h(Icons.Check, { size: 16, className: 'text-cream-100 mr-2 flex-shrink-0' }), '50 emails / day, 200 / week'),
                    h('li', { className: 'flex items-center text-sm text-white/80' }, h(Icons.Check, { size: 16, className: 'text-cream-100 mr-2 flex-shrink-0' }), 'Up to 1,000 active contacts'),
                    h('li', { className: 'flex items-start text-sm text-white/80' }, h(Icons.Check, { size: 16, className: 'text-cream-100 mr-2 flex-shrink-0 mt-0.5' }), 'Includes "Powered by Usenti" footer'),
                ),
                h('button', {
                    disabled: true,
                    className: 'w-full py-3 px-4 rounded-xl font-medium transition-all bg-white/5 text-white/40 cursor-not-allowed'
                }, currentTier === 'free' ? 'Active' : 'Free')
            ),

            // Rebel Plan Tier
            h('div', { className: `glass-panel p-8 rounded-2xl relative flex flex-col bg-gradient-to-b from-white/5 to-transparent ${currentTier === 'rebel_plan' ? 'ring-2 ring-cream-100' : 'border border-cream-100/20'}` },
                currentTier === 'rebel_plan' && h('div', { className: 'absolute -top-3 left-1/2 -translate-x-1/2 bg-cream-100 text-rust-900 text-xs font-bold px-3 py-1 rounded-full' }, 'CURRENT PLAN'),
                h('h3', { className: 'text-xl font-medium text-cream-100 mb-2' }, 'Rebel Plan'),
                h('div', { className: 'mb-6' },
                    h('span', { className: 'text-4xl font-serif text-white' }, '$45'),
                    h('span', { className: 'text-white/60' }, '/mo')
                ),
                h('ul', { className: 'space-y-3 mb-8 flex-1' },
                    h('li', { className: 'flex items-center text-sm text-white/80' }, h(Icons.Check, { size: 16, className: 'text-cream-100 mr-2 flex-shrink-0' }), '100,000 emails / month'),
                    h('li', { className: 'flex items-center text-sm text-white/80' }, h(Icons.Check, { size: 16, className: 'text-cream-100 mr-2 flex-shrink-0' }), 'Up to 25,000 total contacts'),
                    h('li', { className: 'flex items-start text-sm text-white/80' }, h(Icons.Check, { size: 16, className: 'text-cream-100 mr-2 flex-shrink-0 mt-0.5' }), 'No Usenti branding'),
                ),
                h('button', {
                    onClick: () => handleSubscribe('rebel_plan'),
                    disabled: loading || currentTier === 'rebel_plan',
                    className: `w-full py-3 px-4 rounded-xl font-medium transition-all ${currentTier === 'rebel_plan' ? 'bg-white/5 text-white/40 cursor-not-allowed' :
                        'bg-cream-100 hover:bg-cream-200 text-rust-900 shadow-[0_0_20px_rgba(245,230,211,0.3)] hover:shadow-[0_0_25px_rgba(245,230,211,0.5)]'
                        }`
                }, loading ? 'Processing...' : currentTier === 'rebel_plan' ? 'Active' : 'Upgrade to Rebel Plan')
            )
        )
    );
};
