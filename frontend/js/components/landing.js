// Usenti - Landing Page Component

const LandingPage = ({ onNavigate }) => {
  const [isLoaded, setIsLoaded] = React.useState(false);

  const handleIframeLoad = () => {
    // Add a small delay to allow WebGL to render the first frame after HTML load
    setTimeout(() => {
      setIsLoaded(true);
    }, 500);
  };

  return h('div', { className: "min-h-screen text-white font-sans selection:bg-cream-100 selection:text-rust-900 relative" },
    // Spline 3D Background (scaled up so watermark is cropped off by overflow:hidden)
    h('div', {
      style: {
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        overflow: 'hidden',
        backgroundColor: '#2D1810', // Fallback color while loading
        transition: 'opacity 1s ease-in-out',
        opacity: isLoaded ? 1 : 0
      }
    },
      h('iframe', {
        src: 'https://my.spline.design/dunes-Eg8W4XwLhNxC7F62n6SDsvks/',
        frameBorder: '0',
        onLoad: handleIframeLoad,
        style: {
          border: 'none',
          display: 'block',
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '125%',
          height: '125%'
        }
      })
    ),
    h('nav', { className: "px-6 py-6 glass-header sticky top-0 z-50" },
      h('div', { className: "max-w-7xl mx-auto flex justify-between items-center" },
        h('div', { className: "flex items-center gap-3" },
          h('img', { src: 'visuals/logo_white.png', alt: 'Usenti Logo', style: { height: '28px', width: 'auto' } }),
          h('h1', { className: "font-serif text-2xl tracking-tight font-medium" },
            'Usenti'
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
            'Try Now ',
            h(Icons.ArrowRight, { size: 16 })
          )
        )
      )
    ),
    h('section', { style: { minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }, className: "px-6" },
      h('div', { className: "max-w-4xl mx-auto text-center space-y-8 animate-fade-in" },
        h('div', { className: "inline-flex items-center gap-2 px-3 py-1 rounded-full glass-card text-white text-sm font-medium mb-4" },
          h('span', { className: "w-2 h-2 rounded-full bg-cream-100 animate-pulse" }),
          'v2.0 is now live'
        ),
        h('div', { className: "max-w-5xl mx-auto flex flex-col items-center justify-center space-y-10" },
          h('h2', { className: "font-serif text-6xl md:text-8xl text-center leading-tight tracking-tight text-white mb-4" },
            'Fortune favors the bold.'
          ),
          h('button', {
            onClick: () => onNavigate('signup'),
            className: "w-full sm:w-auto px-10 py-5 bg-cream-100 text-rust-900 text-xl shadow-[0_0_40px_-10px_rgba(245,230,211,0.5)] rounded-full hover:bg-cream-200 transition-all hover:scale-105 font-bold"
          }, 'Get Started Now')
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
            h('h3', { className: "font-serif text-2xl text-white" }, 'Automate Campaigns'),
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
              'look through all your email inboxes in one unified inbox - optimized for closers'
            )
          ),
          h('div', { className: "space-y-4 p-6 rounded-2xl glass-card hover:bg-white/10 transition-colors group" },
            h('div', { className: "w-12 h-12 bg-white/10 rounded-xl border border-white/10 flex items-center justify-center text-cream-100 group-hover:scale-110 transition-transform duration-300" },
              h(Icons.Shield, { size: 24 })
            ),
            h('h3', { className: "font-serif text-2xl text-white" }, 'Bulletproof Infrastructure'),
            h('p', { className: "text-white/60 leading-relaxed" },
              'Scale revenue, not headaches. Send tons of emails with confidence, knowing you\'re using a system that will scale securely with your business.'
            )
          ),
          h('div', { className: "space-y-4 p-6 rounded-2xl glass-card hover:bg-white/10 transition-colors group" },
            h('div', { className: "w-12 h-12 bg-white/10 rounded-xl border border-white/10 flex items-center justify-center text-cream-100 group-hover:scale-110 transition-transform duration-300" },
              h(Icons.Server, { size: 24 })
            ),
            h('h3', { className: "font-serif text-2xl text-white" }, 'Sovereign Infrastructure'),
            h('p', { className: "text-white/60 leading-relaxed" },
              'Own your reputation. Our hybrid sending architecture allows you to use your own accounts, protecting your domain reputation and avoiding spam.'
            )
          )
        )
      )
    ),
    h('footer', { className: "glass-sidebar text-white py-12 px-6" },
      h('div', { className: "max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6" },
        h('div', { className: "text-sm text-white/40" },
          '© 2024 Usenti Inc. All rights reserved.'
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
