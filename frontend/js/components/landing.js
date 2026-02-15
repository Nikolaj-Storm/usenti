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
        h('div', { className: "flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 pb-8" },
          h('button', {
            onClick: () => onNavigate('signup'),
            className: "w-full sm:w-auto px-8 py-4 bg-cream-100 text-rust-900 text-lg rounded-full hover:bg-cream-200 transition-all hover:-translate-y-1 font-medium"
          }, 'Get Started for Free')
        ),
        h('div', { className: "flex flex-col md:flex-row items-center gap-8 md:gap-12 py-8" },
          // Text Container (Left on desktop/Left generally) - Wait, user said "to the left of this quote please place the image" -> So Image Left, Quote Right.
          h('div', { className: "w-full md:w-1/2 order-1" },
            h('img', {
              src: "visuals/steve.png",
              alt: "Steve Jobs",
              className: "w-full rounded-2xl shadow-2xl glass-card object-cover"
            })
          ),
          h('div', { className: "w-full md:w-1/2 order-2 text-left space-y-6" },
            h('p', { className: "font-serif text-2xl md:text-3xl leading-relaxed text-white italic" },
              h('span', { className: "text-5xl md:text-7xl leading-none block mb-4" }, '"For years,'),
              'Steve Jobs courted biographer Walter Isaacson to write the definitive story of his life… And he called me up. I hadn’t really felt that I was the right person at first… I turned Jobs down a number of times, but finally accepted when I found out Jobs might not have long to live."'
            ),
            h('p', { className: "text-lg text-cream-100 font-medium" },
              '- npr interview of Walter Isaacson'
            )
          )
        ),
      )
    ),
    h('section', { className: "py-24 glass-header" },
      h('div', { className: "max-w-7xl mx-auto px-6" },
        h('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-12" },
          h('div', { className: "space-y-4 p-6 rounded-2xl glass-card hover:bg-white/10 transition-colors group" },
            h('div', { className: "w-12 h-12 bg-white/10 rounded-xl border border-white/10 flex items-center justify-center text-cream-100 group-hover:scale-110 transition-transform duration-300" },
              h(Icons.Zap, { size: 24 })
            ),
            h('h3', { className: "font-serif text-2xl text-white" }, 'Visual Flow Builder'),
            h('p', { className: "text-white/60 leading-relaxed" },
              'Automate your perfect sales process. Nurture leads, handle objections, and book meetings on autopilot—24/7.'
            )
          ),
          h('div', { className: "space-y-4 p-6 rounded-2xl glass-card hover:bg-white/10 transition-colors group" },
            h('div', { className: "w-12 h-12 bg-white/10 rounded-xl border border-white/10 flex items-center justify-center text-cream-100 group-hover:scale-110 transition-transform duration-300" },
              h(Icons.Inbox, { size: 24 })
            ),
            h('h3', { className: "font-serif text-2xl text-white" }, 'Unified Neural Inbox'),
            h('p', { className: "text-white/60 leading-relaxed" },
              'Clear your pipeline in minutes. Instantly spot interested leads among thousands of replies and never let a deal slip through the cracks.'
            )
          ),
          h('div', { className: "space-y-4 p-6 rounded-2xl glass-card hover:bg-white/10 transition-colors group" },
            h('div', { className: "w-12 h-12 bg-white/10 rounded-xl border border-white/10 flex items-center justify-center text-cream-100 group-hover:scale-110 transition-transform duration-300" },
              h(Icons.Shield, { size: 24 })
            ),
            h('h3', { className: "font-serif text-2xl text-white" }, 'Bulletproof Infrastructure'),
            h('p', { className: "text-white/60 leading-relaxed" },
              'Scale revenue, not headaches. Send millions of emails with confidence, knowing your message lands in the primary inbox every single time.'
            )
          ),
          h('div', { className: "space-y-4 p-6 rounded-2xl glass-card hover:bg-white/10 transition-colors group" },
            h('div', { className: "w-12 h-12 bg-white/10 rounded-xl border border-white/10 flex items-center justify-center text-cream-100 group-hover:scale-110 transition-transform duration-300" },
              h(Icons.Server, { size: 24 })
            ),
            h('h3', { className: "font-serif text-2xl text-white" }, 'Sovereign Infrastructure'),
            h('p', { className: "text-white/60 leading-relaxed" },
              'Own your reputation. Hybrid sending architecture ensures your emails hit the primary inbox, not spam.'
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
