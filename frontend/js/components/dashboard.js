// Mr. Snowman - Dashboard Component

const Card = ({ children, className = '', title, subtitle, action }) => {
  return (
    <div className={`bg-white border border-stone-200 shadow-sm rounded-lg overflow-hidden transition-all duration-300 hover:shadow-md ${className}`}>
      {(title || action) && (
        <div className="px-6 py-5 border-b border-stone-100 flex justify-between items-center bg-cream-50">
          <div>
            {title && <h3 className="font-serif text-xl font-medium text-jaguar-900">{title}</h3>}
            {subtitle && <p className="text-sm text-stone-500 mt-1">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip: RechartsTooltip, ResponsiveContainer } = window.Recharts;

  const data = [
    { name: 'Mon', sent: 400, opened: 240, replied: 80 },
    { name: 'Tue', sent: 300, opened: 139, replied: 50 },
    { name: 'Wed', sent: 200, opened: 980, replied: 200 },
    { name: 'Thu', sent: 278, opened: 390, replied: 110 },
    { name: 'Fri', sent: 189, opened: 480, replied: 140 },
    { name: 'Sat', sent: 239, opened: 380, replied: 130 },
    { name: 'Sun', sent: 349, opened: 430, replied: 120 },
  ];

  const metrics = [
    { label: 'Total Sent', value: '12,450', change: '+12.5%', icon: Icons.Mail, color: 'text-blue-600' },
    { label: 'Open Rate', value: '68.2%', change: '+4.1%', icon: Icons.ArrowUpRight, color: 'text-emerald-600' },
    { label: 'Click Rate', value: '12.5%', change: '-0.4%', icon: Icons.MousePointer2, color: 'text-amber-600' },
    { label: 'Reply Rate', value: '8.4%', change: '+2.1%', icon: Icons.MessageSquare, color: 'text-jaguar-900' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-serif text-3xl text-jaguar-900">Overview</h2>
          <p className="text-stone-500 mt-2 font-light">Your campaign performance at a glance.</p>
        </div>
        <div className="flex gap-3">
          <span className="bg-cream-200 text-jaguar-900 px-3 py-1 text-sm rounded-full flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            System Operational
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white p-6 rounded-lg border border-stone-200 shadow-sm hover:border-jaguar-900/20 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-stone-500 uppercase tracking-wide">{metric.label}</p>
                <h3 className="text-3xl font-serif text-jaguar-900 mt-2">{metric.value}</h3>
              </div>
              <div className={`p-2 bg-cream-100 rounded-lg ${metric.color}`}>
                <metric.icon size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className={metric.change.startsWith('+') ? 'text-green-600' : 'text-red-500'}>
                {metric.change}
              </span>
              <span className="text-stone-400 ml-2">vs last week</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card title="Activity Volume" className="lg:col-span-2">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0B2B26" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#0B2B26" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C5A065" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#C5A065" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF'}} />
                <CartesianGrid vertical={false} stroke="#E5E7EB" strokeDasharray="3 3" />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', fontFamily: 'Inter' }}
                />
                <Area type="monotone" dataKey="sent" stroke="#0B2B26" strokeWidth={2} fillOpacity={1} fill="url(#colorSent)" />
                <Area type="monotone" dataKey="opened" stroke="#C5A065" strokeWidth={2} fillOpacity={1} fill="url(#colorOpened)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Infrastructure Health">
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 border border-stone-100 rounded-lg bg-cream-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-jaguar-100 flex items-center justify-center text-jaguar-900">
                  <span className="font-bold text-sm">AWS</span>
                </div>
                <div>
                  <h4 className="font-medium text-jaguar-900">WorkMail IMAP</h4>
                  <p className="text-xs text-stone-500">Listening • 45ms latency</p>
                </div>
              </div>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
            </div>

            <div className="flex items-center justify-between p-4 border border-stone-100 rounded-lg bg-cream-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-jaguar-100 flex items-center justify-center text-jaguar-900">
                  <span className="font-bold text-sm">ST</span>
                </div>
                <div>
                  <h4 className="font-medium text-jaguar-900">Stalwart SMTP</h4>
                  <p className="text-xs text-stone-500">Relaying • 99.9% Uptime</p>
                </div>
              </div>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
            </div>

            <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-100 flex gap-3">
              <Icons.AlertCircle className="text-amber-600 shrink-0" size={20} />
              <div>
                <h5 className="text-sm font-medium text-amber-800">Warm-up Recommendation</h5>
                <p className="text-xs text-amber-700 mt-1">Account <em>marketing@domain.com</em> is ready to increase daily volume to 250.</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
