// Mr. Snowman - Landing Page Component

const LandingPage = ({ onNavigate }) => {
  return h('div', { className: "min-h-screen text-white font-sans selection:bg-cream-100 selection:text-rust-900" },
    h('nav', { className: "px-6 py-6 glass-header sticky top-0 z-50" },
      h('div', { className: "max-w-7xl mx-auto flex justify-between items-center" },
        h('div', { className: "flex items-center gap-3" },
          h('div', { className: "w-8 h-8 bg-cream-100 rounded-sm rotate-45 flex items-center justify-center shadow-lg" },
            h('div', { className: "w-4 h-4 bg-rust-900 -rotate-45" })
          ),
          h('h1', { className: "font-serif text-2xl tracking-tight font-medium" },
            'Mr. ',
            h('span', { className: "text-cream-100 font-normal" }, 'Snowman')
          )
        ),
        h('div', { className: "flex items-center gap-6" },
          h('button', {
            onClick: () => onNavigate('login'),
            className: "text-white/60 hover:text-white font-medium transition-colors hidden sm:block"
          }, 'Sign In'),
          h('button', {
            onClick: () => onNavigate('signup'),
            className: "px-5 py-2.5 bg-cream-100 text-rust-900 rounded-full hover:bg-cream-200 transition-all flex items-center gap-2 font-medium"
          },
            'Start Free Trial ',
            h(Icons.ArrowRight, { size: 16 })
          )
        )
      )
    ),
    h('section', { className: "pt-24 pb-32 px-6" },
      h('div', { className: "max-w-4xl mx-auto text-center space-y-8 animate-fade-in" },
        h('div', { className: "inline-flex items-center gap-2 px-3 py-1 rounded-full glass-card text-white text-sm font-medium mb-4" },
          h('span', { className: "w-2 h-2 rounded-full bg-cream-100 animate-pulse" }),
          'v2.0 is now live'
        ),
        h('h1', { className: "font-serif text-5xl md:text-7xl leading-[1.1] text-white" },
          'The art of ',
          h('span', { className: "italic text-cream-100" }, 'outreach'),
          ',',
          h('br'),
          'refined for closers.'
        ),
        h('p', { className: "text-xl text-white/60 max-w-2xl mx-auto font-light leading-relaxed" },
          'Mr. Snowman combines minimalist design with brutal efficiency. Automate your campaigns, warm up your infrastructure, and scale your revenue without the noise.'
        ),
        h('div', { className: "flex flex-col sm:flex-row items-center justify-center gap-4 pt-6" },
          h('button', {
            onClick: () => onNavigate('signup'),
            className: "w-full sm:w-auto px-8 py-4 bg-cream-100 text-rust-900 text-lg rounded-full hover:bg-cream-200 transition-all hover:-translate-y-1 font-medium"
          }, 'Get Started for Free'),
          h('button', { className: "w-full sm:w-auto px-8 py-4 glass-card text-white text-lg rounded-full hover:bg-white/15 transition-all flex items-center justify-center gap-2 group" },
            'View Demo ',
            h('div', { className: "bg-white/10 rounded-full p-1 group-hover:bg-white/20" },
              h(Icons.ChevronRight, { size: 16 })
            )
          )
        ),
        h('div', { className: "pt-12 flex items-center justify-center gap-8 text-white/30 grayscale" },
          h('div', { className: "font-serif font-bold text-xl" }, 'ACME Corp'),
          h('div', { className: "font-sans font-bold text-xl tracking-tighter" }, 'StarkIndustries'),
          h('div', { className: "font-serif italic text-xl" }, 'Globex'),
          h('div', { className: "font-mono text-xl" }, 'Massive Dynamic')
        )
      )
    ),
    h('section', { className: "py-24 glass-header" },
      h('div', { className: "max-w-7xl mx-auto px-6" },
        h('div', { className: "grid grid-cols-1 md:grid-cols-3 gap-12" },
          h('div', { className: "space-y-4 p-6 rounded-2xl glass-card hover:bg-white/10 transition-colors group" },
            h('div', { className: "w-12 h-12 bg-white/10 rounded-xl border border-white/10 flex items-center justify-center text-cream-100 group-hover:scale-110 transition-transform duration-300" },
              h(Icons.Shield, { size: 24 })
            ),
            h('h3', { className: "font-serif text-2xl text-white" }, 'Bulletproof Infrastructure'),
            h('p', { className: "text-white/60 leading-relaxed" },
              'Hybrid sending via AWS WorkMail and custom Stalwart SMTP relays ensures your domain reputation remains pristine.'
            )
          ),
          h('div', { className: "space-y-4 p-6 rounded-2xl glass-card hover:bg-white/10 transition-colors group" },
            h('div', { className: "w-12 h-12 bg-white/10 rounded-xl border border-white/10 flex items-center justify-center text-cream-100 group-hover:scale-110 transition-transform duration-300" },
              h(Icons.Zap, { size: 24 })
            ),
            h('h3', { className: "font-serif text-2xl text-white" }, 'Intelligent Warm-up'),
            h('p', { className: "text-white/60 leading-relaxed" },
              'Our AI-driven warm-up engine generates natural conversations to gradually ramp up your sending limits.'
            )
          ),
          h('div', { className: "space-y-4 p-6 rounded-2xl glass-card hover:bg-white/10 transition-colors group" },
            h('div', { className: "w-12 h-12 bg-white/10 rounded-xl border border-white/10 flex items-center justify-center text-cream-100 group-hover:scale-110 transition-transform duration-300" },
              h(Icons.BarChart, { size: 24 })
            ),
            h('h3', { className: "font-serif text-2xl text-white" }, 'Precision Analytics'),
            h('p', { className: "text-white/60 leading-relaxed" },
              'Track opens, clicks, and replies in real-time. Visualize your funnel and optimize for conversion.'
            )
          )
        )
      )
    ),
    h('footer', { className: "glass-sidebar text-white py-12 px-6" },
      h('div', { className: "max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6" },
        h('div', { className: "text-sm text-white/40" },
          '© 2024 Mr. Snowman Inc. All rights reserved.'
        ),
        h('div', { className: "flex gap-8 text-sm font-medium" },
          h('a', { href: "#", className: "text-white/60 hover:text-cream-100 transition-colors" }, 'Privacy'),
          h('a', { href: "#", className: "text-white/60 hover:text-cream-100 transition-colors" }, 'Terms'),
          h('a', { href: "#", className: "text-white/60 hover:text-cream-100 transition-colors" }, 'Contact')
        )
      )
    )
  );
};
