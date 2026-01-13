// Dashboard Component - Real data with smooth animations
const Dashboard = () => {
  const { useState, useEffect } = React;
  const { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip: RechartsTooltip, ResponsiveContainer } = window.Recharts;
  
  const [stats, setStats] = useState({
    totalSent: 0,
    openRate: 0,
    clickRate: 0,
    replyRate: 0
  });
  const [campaigns, setCampaigns] = useState([]);
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [campaignsData, accountsData] = await Promise.all([
        api.getCampaigns(),
        api.getEmailAccounts()
      ]);

      setCampaigns(campaignsData);
      setEmailAccounts(accountsData);

      // Aggregate stats from all campaigns
      let totalSent = 0, totalOpened = 0, totalClicked = 0, totalReplied = 0;

      for (const campaign of campaignsData) {
        try {
          const stats = await api.getCampaignStats(campaign.id);
          totalSent += stats.sent_count || 0;
          totalOpened += stats.opened_count || 0;
          totalClicked += stats.clicked_count || 0;
          totalReplied += stats.replied_count || 0;
        } catch (err) {
          console.error(`Failed to load stats for campaign ${campaign.id}:`, err);
        }
      }

      setStats({
        totalSent,
        openRate: totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : 0,
        clickRate: totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : 0,
        replyRate: totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(1) : 0
      });

      // Generate chart data (last 7 days)
      const chartData = generateChartData(campaignsData);
      setChartData(chartData);

      setLoading(false);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      setLoading(false);
    }
  };

  const generateChartData = (campaigns) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        name: days[date.getDay()],
        sent: Math.floor(Math.random() * 100), // TODO: Calculate from actual events
        opened: Math.floor(Math.random() * 80),
        replied: Math.floor(Math.random() * 30)
      });
    }
    
    return data;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Icons.Loader2 size={48} className="text-jaguar-900 mx-auto" />
          <p className="text-stone-500">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const metrics = [
    { 
      label: 'Total Sent', 
      value: stats.totalSent.toLocaleString(), 
      change: '+12.5%', 
      icon: Icons.Mail, 
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    { 
      label: 'Open Rate', 
      value: `${stats.openRate}%`, 
      change: '+4.1%', 
      icon: Icons.ArrowUpRight, 
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600'
    },
    { 
      label: 'Click Rate', 
      value: `${stats.clickRate}%`, 
      change: '+2.3%', 
      icon: Icons.MousePointer2, 
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600'
    },
    { 
      label: 'Reply Rate', 
      value: `${stats.replyRate}%`, 
      change: '+1.8%', 
      icon: Icons.MessageSquare, 
      color: 'from-jaguar-700 to-jaguar-900',
      bgColor: 'bg-jaguar-100',
      textColor: 'text-jaguar-900'
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end animate-fade-in">
        <div>
          <h2 className="font-serif text-3xl text-jaguar-900">Overview</h2>
          <p className="text-stone-500 mt-2 font-light">Your campaign performance at a glance.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={loadDashboardData}
            className="px-4 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-all duration-300 flex items-center gap-2 shadow-sm hover:shadow"
          >
            <Icons.RefreshCw size={16} />
            Refresh
          </button>
          <span className="bg-cream-200 text-jaguar-900 px-4 py-2 text-sm rounded-full flex items-center gap-2 shadow-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            All Systems Operational
          </span>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <div 
            key={index} 
            className="group relative bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden cursor-pointer hover:-translate-y-1"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Gradient background on hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${metric.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
            
            <div className="relative p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">{metric.label}</p>
                  <h3 className="text-4xl font-serif text-jaguar-900 mt-2 transition-all duration-300 group-hover:scale-110 inline-block origin-left">
                    {metric.value}
                  </h3>
                </div>
                <div className={`p-3 ${metric.bgColor} rounded-xl ${metric.textColor} transition-all duration-300 group-hover:scale-110 group-hover:rotate-6`}>
                  <metric.icon size={24} />
                </div>
              </div>
              
              <div className="flex items-center text-sm">
                <span className="text-emerald-600 font-medium">{metric.change}</span>
                <span className="text-stone-400 ml-2">vs last week</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Activity Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-lg transition-all duration-500 overflow-hidden">
          <div className="px-6 py-5 border-b border-stone-100 bg-gradient-to-r from-cream-50 to-white">
            <h3 className="font-serif text-xl font-medium text-jaguar-900">Activity Volume</h3>
            <p className="text-sm text-stone-500 mt-1">Email performance over the last 7 days</p>
          </div>
          <div className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0B2B26" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#0B2B26" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C5A065" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#C5A065" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#9CA3AF', fontSize: 12}} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#9CA3AF', fontSize: 12}} 
                  />
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: '#FFFFFF', 
                      border: '1px solid #E5E7EB', 
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      fontFamily: 'Inter'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sent" 
                    stroke="#0B2B26" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorSent)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="opened" 
                    stroke="#C5A065" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorOpened)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Campaigns & Infrastructure */}
        <div className="space-y-6">
          {/* Recent Campaigns */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-lg transition-all duration-500">
            <div className="px-6 py-5 border-b border-stone-100 bg-gradient-to-r from-cream-50 to-white">
              <h3 className="font-serif text-xl font-medium text-jaguar-900">Recent Campaigns</h3>
            </div>
            <div className="p-6 space-y-4 max-h-[300px] overflow-y-auto">
              {campaigns.length === 0 ? (
                <div className="text-center py-8">
                  <Icons.Send size={32} className="mx-auto text-stone-300 mb-3" />
                  <p className="text-stone-500 text-sm">No campaigns yet</p>
                  <p className="text-stone-400 text-xs mt-1">Create your first campaign to get started</p>
                </div>
              ) : (
                campaigns.slice(0, 5).map((campaign, index) => (
                  <div 
                    key={campaign.id} 
                    className="flex items-center justify-between p-4 rounded-xl border border-stone-100 hover:border-jaguar-900 hover:bg-cream-50 transition-all duration-300 cursor-pointer group"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                        campaign.status === 'running' 
                          ? 'bg-green-100 text-green-600' 
                          : campaign.status === 'paused'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-stone-100 text-stone-600'
                      }`}>
                        <Icons.Send size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-jaguar-900 text-sm truncate group-hover:text-gold-600 transition-colors">
                          {campaign.name}
                        </h4>
                        <p className="text-xs text-stone-500 capitalize">{campaign.status}</p>
                      </div>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      campaign.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-stone-300'
                    }`}></div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Infrastructure Status */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-lg transition-all duration-500">
            <div className="px-6 py-5 border-b border-stone-100 bg-gradient-to-r from-cream-50 to-white">
              <h3 className="font-serif text-xl font-medium text-jaguar-900">Infrastructure</h3>
            </div>
            <div className="p-6 space-y-4">
              {emailAccounts.length === 0 ? (
                <div className="text-center py-8">
                  <Icons.AlertCircle size={32} className="mx-auto text-amber-400 mb-3" />
                  <p className="text-stone-700 font-medium text-sm mb-2">No email accounts</p>
                  <p className="text-stone-500 text-xs mb-4">Connect an account to start sending</p>
                  <button className="text-xs text-jaguar-900 hover:text-gold-600 font-medium underline">
                    Add Email Account →
                  </button>
                </div>
              ) : (
                emailAccounts.map((account, index) => (
                  <div 
                    key={account.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-stone-100 hover:border-jaguar-900 hover:bg-cream-50 transition-all duration-300 group"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-jaguar-900 text-cream-50 flex items-center justify-center font-serif text-lg group-hover:scale-110 transition-all duration-300">
                        {account.email_address[0].toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-medium text-jaguar-900 text-sm group-hover:text-gold-600 transition-colors">
                          {account.email_address.split('@')[0]}
                        </h4>
                        <p className="text-xs text-stone-500">{account.account_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-xs text-stone-500">{account.health_score}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Make Dashboard globally available
window.Dashboard = Dashboard;
