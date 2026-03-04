// Usenti - Dashboard Component

const Card = ({ children, className = '', title, subtitle, action }) => {
  return h('div', { className: `glass-card overflow-hidden transition-all duration-300 hover:bg-white/10 ${className}` },
    (title || action) && h('div', { className: "px-6 py-5 border-b border-white/10 flex justify-between items-center" },
      h('div', null,
        title && h('h3', { className: "font-serif text-xl font-medium text-white" }, title),
        subtitle && h('p', { className: "text-sm text-white/60 mt-1" }, subtitle)
      ),
      action && h('div', null, action)
    ),
    h('div', { className: "p-6" }, children)
  );
};

const Dashboard = () => {
  console.log('🚀 [Dashboard] Component mounting...');

  const { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip: RechartsTooltip, ResponsiveContainer } = window.Recharts;

  const [dashboardData, setDashboardData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    console.log('🚀 [Dashboard] Initializing dashboard data load...');
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    console.log('📊 [Dashboard] Loading dashboard stats...');
    try {
      const [data, subData] = await Promise.all([
        api.getDashboardStats(),
        api.get('/api/stripe/status').catch(() => ({ planTier: 'free', usage: { sent: 0, limit: 200 } }))
      ]);
      console.log('✅ [Dashboard] Dashboard data loaded successfully:', data);

      // Inject subscription data into dashboard metrics
      setDashboardData({
        ...data,
        subscription: subData
      });
    } catch (err) {
      console.error('❌ [Dashboard] Failed to load dashboard data:', err);
      console.error('💥 [Dashboard] Error details:', {
        message: err.message,
        stack: err.stack
      });
      setError(err.message);

      // Check if this is an auth-related error that might cause a redirect
      if (err.message?.includes('401') || err.message?.includes('unauthorized')) {
        console.warn('⚠️ [Dashboard] Unauthorized error detected. This might trigger a redirect.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return h('div', { className: "flex items-center justify-center h-96 animate-fade-in" },
      h(Icons.Loader2, { size: 48, className: "text-cream-100 animate-spin" })
    );
  }

  if (error) {
    return h('div', { className: "flex flex-col items-center justify-center h-96 text-center animate-fade-in" },
      h(Icons.AlertCircle, { size: 64, className: "text-red-400/60 mb-4" }),
      h('h3', { className: "font-serif text-2xl text-white mb-2" }, 'Failed to Load Dashboard'),
      h('p', { className: "text-white/60 mb-6" }, error),
      h('button', {
        onClick: loadDashboardData,
        className: "px-6 py-3 bg-cream-100 text-rust-900 rounded-full hover:bg-cream-200 transition-colors font-medium"
      }, 'Retry')
    );
  }

  // Use actual data or fallback to empty arrays
  const data = dashboardData?.activity || [];

  const subTier = dashboardData?.subscription?.planTier || 'free';
  const sentCycle = dashboardData?.subscription?.usage?.sent || 0;
  const limitCycle = dashboardData?.subscription?.usage?.limit || 200;

  const baseMetrics = dashboardData?.metrics || [
    { label: 'Total Sent', value: '0', change: '+0%', icon: Icons.Mail, color: 'text-blue-600' },
    { label: 'Open Rate', value: '0%', change: '+0%', icon: Icons.ArrowUpRight, color: 'text-emerald-600' },
    { label: 'Reply Rate', value: '0%', change: '+0%', icon: Icons.MessageSquare, color: 'text-jaguar-900' },
  ];

  const metrics = baseMetrics;

  return h('div', { className: "space-y-8 animate-fade-in" },
    h('div', { className: "flex justify-between items-end" },
      h('div', null,
        h('h2', { className: "font-serif text-3xl text-white" }, 'Overview'),
        h('p', { className: "text-white/60 mt-2 font-light" }, 'Your campaign performance at a glance.')
      ),
      h('div', { className: "flex gap-3" },
        h('span', { className: "glass-card px-4 py-2 text-sm flex items-center gap-2 text-white" },
          h('span', { className: "w-2 h-2 bg-green-400 rounded-full animate-pulse" }),
          'System Operational'
        )
      )
    ),
    h('div', { className: "grid grid-cols-1 md:grid-cols-3 gap-6" },
      ...metrics.map((metric, index) =>
        h('div', {
          key: index,
          className: `glass-card p-6 transition-all hover:bg-white/10 ${index === 2 ? 'metric-highlight' : ''}`
        },
          h('div', { className: "flex justify-between items-start" },
            h('div', null,
              h('p', { className: "text-sm font-medium text-white/60 uppercase tracking-wide" }, metric.label),
              h('h3', { className: "text-3xl font-serif text-white mt-2" }, metric.value)
            ),
            h('div', { className: "p-2 bg-white/10 rounded-lg text-cream-100" },
              h(metric.icon, { size: 20 })
            )
          ),
          h('div', { className: "mt-4 flex items-center text-sm" },
            h('span', { className: metric.change.startsWith('+') ? 'text-green-400' : 'text-red-400' },
              metric.change
            ),
            h('span', { className: "text-white/40 ml-2" }, 'vs last week')
          )
        )
      )
    ),
    h('div', { className: "grid grid-cols-1 gap-8" },
      h(Card, { title: "Activity Volume", className: "w-full" },
        h('div', { className: "h-[300px] w-full", style: { minHeight: '300px', minWidth: '100%' } },
          data.length > 0 ? h(ResponsiveContainer, { width: "100%", height: "100%" },
            h(AreaChart, { data: data, margin: { top: 10, right: 30, left: 0, bottom: 0 } },
              h('defs', null,
                h('linearGradient', { id: "colorSent", x1: "0", y1: "0", x2: "0", y2: "1" },
                  h('stop', { offset: "5%", stopColor: "#FFFFFF", stopOpacity: 0.3 }),
                  h('stop', { offset: "95%", stopColor: "#FFFFFF", stopOpacity: 0 })
                ),
                h('linearGradient', { id: "colorOpened", x1: "0", y1: "0", x2: "0", y2: "1" },
                  h('stop', { offset: "5%", stopColor: "#F5E6D3", stopOpacity: 0.3 }),
                  h('stop', { offset: "95%", stopColor: "#F5E6D3", stopOpacity: 0 })
                ),
                h('linearGradient', { id: "colorReplied", x1: "0", y1: "0", x2: "0", y2: "1" },
                  h('stop', { offset: "5%", stopColor: "#34d399", stopOpacity: 0.3 }),
                  h('stop', { offset: "95%", stopColor: "#34d399", stopOpacity: 0 })
                )
              ),
              h(XAxis, { dataKey: "name", axisLine: false, tickLine: false, tick: { fill: 'rgba(255,255,255,0.5)' } }),
              h(YAxis, { axisLine: false, tickLine: false, tick: { fill: 'rgba(255,255,255,0.5)' } }),
              h(CartesianGrid, { vertical: false, stroke: "rgba(255,255,255,0.1)", strokeDasharray: "3 3" }),
              h(RechartsTooltip, {
                contentStyle: { backgroundColor: 'rgba(45,24,16,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontFamily: 'Inter', color: '#FFF' },
                labelStyle: { color: 'rgba(255,255,255,0.7)' },
                itemStyle: { color: '#FFF' }
              }),
              h(Area, { type: "monotone", dataKey: "sent", stroke: "#FFFFFF", strokeWidth: 2, fillOpacity: 1, fill: "url(#colorSent)", name: "Sent" }),
              h(Area, { type: "monotone", dataKey: "opened", stroke: "#F5E6D3", strokeWidth: 2, fillOpacity: 1, fill: "url(#colorOpened)", name: "Opened" }),
              h(Area, { type: "monotone", dataKey: "replied", stroke: "#34d399", strokeWidth: 2, fillOpacity: 1, fill: "url(#colorReplied)", name: "Replied" })
            )
          ) : h('div', { className: "h-full flex items-center justify-center text-white/40" },
            h('div', { className: "text-center" },
              h(Icons.BarChart3, { size: 48, className: "mx-auto mb-2 opacity-30" }),
              h('p', null, 'No activity data yet'),
              h('p', { className: "text-sm" }, 'Start a campaign to see metrics here')
            )
          )
        )
      )
    )
  );
};
