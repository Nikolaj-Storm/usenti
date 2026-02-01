// Mr. Snowman - Dashboard Component

const Card = ({ children, className = '', title, subtitle, action }) => {
  return h('div', { className: `bg-white border border-stone-200 shadow-sm rounded-lg overflow-hidden transition-all duration-300 hover:shadow-md ${className}` },
    (title || action) && h('div', { className: "px-6 py-5 border-b border-stone-100 flex justify-between items-center bg-cream-50" },
      h('div', null,
        title && h('h3', { className: "font-serif text-xl font-medium text-jaguar-900" }, title),
        subtitle && h('p', { className: "text-sm text-stone-500 mt-1" }, subtitle)
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
      const data = await api.getDashboardStats();
      console.log('✅ [Dashboard] Dashboard data loaded successfully:', data);
      setDashboardData(data);
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
      h(Icons.Loader2, { size: 48, className: "text-jaguar-900 animate-spin" })
    );
  }

  if (error) {
    return h('div', { className: "flex flex-col items-center justify-center h-96 text-center animate-fade-in" },
      h(Icons.AlertCircle, { size: 64, className: "text-red-300 mb-4" }),
      h('h3', { className: "font-serif text-2xl text-jaguar-900 mb-2" }, 'Failed to Load Dashboard'),
      h('p', { className: "text-stone-500 mb-6" }, error),
      h('button', {
        onClick: loadDashboardData,
        className: "px-6 py-3 bg-jaguar-900 text-cream-50 rounded-lg hover:bg-jaguar-800 transition-colors"
      }, 'Retry')
    );
  }

  // Use actual data or fallback to empty arrays
  const data = dashboardData?.activity || [];
  const metrics = dashboardData?.metrics || [
    { label: 'Total Sent', value: '0', change: '+0%', icon: Icons.Mail, color: 'text-blue-600' },
    { label: 'Open Rate', value: '0%', change: '+0%', icon: Icons.ArrowUpRight, color: 'text-emerald-600' },
    { label: 'Click Rate', value: '0%', change: '+0%', icon: Icons.MousePointer2, color: 'text-amber-600' },
    { label: 'Reply Rate', value: '0%', change: '+0%', icon: Icons.MessageSquare, color: 'text-jaguar-900' },
  ];

  return h('div', { className: "space-y-8 animate-fade-in" },
    h('div', { className: "flex justify-between items-end" },
      h('div', null,
        h('h2', { className: "font-serif text-3xl text-jaguar-900" }, 'Overview'),
        h('p', { className: "text-stone-500 mt-2 font-light" }, 'Your campaign performance at a glance.')
      ),
      h('div', { className: "flex gap-3" },
        h('span', { className: "bg-cream-200 text-jaguar-900 px-3 py-1 text-sm rounded-full flex items-center gap-2" },
          h('span', { className: "w-2 h-2 bg-green-500 rounded-full animate-pulse" }),
          'System Operational'
        )
      )
    ),
    h('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" },
      ...metrics.map((metric, index) =>
        h('div', { key: index, className: "bg-white p-6 rounded-lg border border-stone-200 shadow-sm hover:border-jaguar-900/20 transition-colors" },
          h('div', { className: "flex justify-between items-start" },
            h('div', null,
              h('p', { className: "text-sm font-medium text-stone-500 uppercase tracking-wide" }, metric.label),
              h('h3', { className: "text-3xl font-serif text-jaguar-900 mt-2" }, metric.value)
            ),
            h('div', { className: `p-2 bg-cream-100 rounded-lg ${metric.color}` },
              h(metric.icon, { size: 20 })
            )
          ),
          h('div', { className: "mt-4 flex items-center text-sm" },
            h('span', { className: metric.change.startsWith('+') ? 'text-green-600' : 'text-red-500' },
              metric.change
            ),
            h('span', { className: "text-stone-400 ml-2" }, 'vs last week')
          )
        )
      )
    ),
    h('div', { className: "grid grid-cols-1 gap-8" },
      h(Card, { title: "Activity Volume", className: "w-full" },
        h('div', { className: "h-[300px] w-full" },
          h(ResponsiveContainer, { width: "100%", height: "100%" },
            h(AreaChart, { data: data, margin: { top: 10, right: 30, left: 0, bottom: 0 } },
              h('defs', null,
                h('linearGradient', { id: "colorSent", x1: "0", y1: "0", x2: "0", y2: "1" },
                  h('stop', { offset: "5%", stopColor: "#0B2B26", stopOpacity: 0.1 }),
                  h('stop', { offset: "95%", stopColor: "#0B2B26", stopOpacity: 0 })
                ),
                h('linearGradient', { id: "colorOpened", x1: "0", y1: "0", x2: "0", y2: "1" },
                  h('stop', { offset: "5%", stopColor: "#C5A065", stopOpacity: 0.1 }),
                  h('stop', { offset: "95%", stopColor: "#C5A065", stopOpacity: 0 })
                )
              ),
              h(XAxis, { dataKey: "name", axisLine: false, tickLine: false, tick: { fill: '#9CA3AF' } }),
              h(YAxis, { axisLine: false, tickLine: false, tick: { fill: '#9CA3AF' } }),
              h(CartesianGrid, { vertical: false, stroke: "#E5E7EB", strokeDasharray: "3 3" }),
              h(RechartsTooltip, {
                contentStyle: { backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', fontFamily: 'Inter' }
              }),
              h(Area, { type: "monotone", dataKey: "sent", stroke: "#0B2B26", strokeWidth: 2, fillOpacity: 1, fill: "url(#colorSent)" }),
              h(Area, { type: "monotone", dataKey: "opened", stroke: "#C5A065", strokeWidth: 2, fillOpacity: 1, fill: "url(#colorOpened)" })
            )
          )
        )
      )
    )
  );
};
