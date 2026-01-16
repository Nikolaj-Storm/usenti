// Mr. Snowman - Landing Page Component

const LandingPage = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-[#FDFBF7] text-jaguar-900 font-sans selection:bg-gold-500 selection:text-white">
      <nav className="px-6 py-6 border-b border-stone-100/50 backdrop-blur-sm sticky top-0 z-50 bg-[#FDFBF7]/90">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gold-600 rounded-sm rotate-45 flex items-center justify-center shadow-lg shadow-gold-600/20">
              <div className="w-4 h-4 bg-jaguar-900 -rotate-45"></div>
            </div>
            <h1 className="font-serif text-2xl tracking-tight font-medium">Mr. <span className="text-gold-600 font-normal">Snowman</span></h1>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => onNavigate('login')}
              className="text-stone-600 hover:text-jaguar-900 font-medium transition-colors hidden sm:block"
            >
              Sign In
            </button>
            <button
              onClick={() => onNavigate('signup')}
              className="px-5 py-2.5 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 transition-all shadow-xl shadow-jaguar-900/10 hover:shadow-jaguar-900/20 flex items-center gap-2"
            >
              Start Free Trial <Icons.ArrowRight size={16} />
            </button>
          </div>
        </div>
      </nav>

      <section className="pt-24 pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cream-200 text-jaguar-900 text-sm font-medium mb-4">
            <span className="w-2 h-2 rounded-full bg-gold-500 animate-pulse"></span>
            v2.0 is now live
          </div>
          <h1 className="font-serif text-5xl md:text-7xl leading-[1.1] text-jaguar-900">
            The art of <span className="italic text-gold-600">outreach</span>,<br />
            refined for closers.
          </h1>
          <p className="text-xl text-stone-500 max-w-2xl mx-auto font-light leading-relaxed">
            Mr. Snowman combines minimalist design with brutal efficiency.
            Automate your campaigns, warm up your infrastructure, and scale your revenue without the noise.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <button
              onClick={() => onNavigate('signup')}
              className="w-full sm:w-auto px-8 py-4 bg-jaguar-900 text-cream-50 text-lg rounded-lg hover:bg-jaguar-800 transition-all shadow-xl shadow-jaguar-900/20 hover:-translate-y-1"
            >
              Get Started for Free
            </button>
            <button className="w-full sm:w-auto px-8 py-4 bg-white border border-stone-200 text-jaguar-900 text-lg rounded-lg hover:bg-stone-50 transition-all flex items-center justify-center gap-2 group">
              View Demo <div className="bg-stone-100 rounded-full p-1 group-hover:bg-stone-200"><Icons.ChevronRight size={16}/></div>
            </button>
          </div>

          <div className="pt-12 flex items-center justify-center gap-8 text-stone-400 grayscale opacity-60">
            <div className="font-serif font-bold text-xl">ACME Corp</div>
            <div className="font-sans font-bold text-xl tracking-tighter">StarkIndustries</div>
            <div className="font-serif italic text-xl">Globex</div>
            <div className="font-mono text-xl">Massive Dynamic</div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-white border-t border-stone-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">

            <div className="space-y-4 p-6 rounded-2xl bg-cream-50 border border-stone-100 hover:border-gold-500/30 transition-colors group">
              <div className="w-12 h-12 bg-white rounded-xl border border-stone-200 flex items-center justify-center text-gold-600 group-hover:scale-110 transition-transform duration-300">
                <Icons.Shield size={24} />
              </div>
              <h3 className="font-serif text-2xl text-jaguar-900">Bulletproof Infrastructure</h3>
              <p className="text-stone-500 leading-relaxed">
                Hybrid sending via AWS WorkMail and custom Stalwart SMTP relays ensures your domain reputation remains pristine.
              </p>
            </div>

            <div className="space-y-4 p-6 rounded-2xl bg-cream-50 border border-stone-100 hover:border-gold-500/30 transition-colors group">
              <div className="w-12 h-12 bg-white rounded-xl border border-stone-200 flex items-center justify-center text-gold-600 group-hover:scale-110 transition-transform duration-300">
                <Icons.Zap size={24} />
              </div>
              <h3 className="font-serif text-2xl text-jaguar-900">Intelligent Warm-up</h3>
              <p className="text-stone-500 leading-relaxed">
                Our AI-driven warm-up engine generates natural conversations to gradually ramp up your sending limits.
              </p>
            </div>

            <div className="space-y-4 p-6 rounded-2xl bg-cream-50 border border-stone-100 hover:border-gold-500/30 transition-colors group">
              <div className="w-12 h-12 bg-white rounded-xl border border-stone-200 flex items-center justify-center text-gold-600 group-hover:scale-110 transition-transform duration-300">
                <Icons.BarChart size={24} />
              </div>
              <h3 className="font-serif text-2xl text-jaguar-900">Precision Analytics</h3>
              <p className="text-stone-500 leading-relaxed">
                Track opens, clicks, and replies in real-time. Visualize your funnel and optimize for conversion.
              </p>
            </div>

          </div>
        </div>
      </section>

      <footer className="bg-jaguar-900 text-cream-200 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-sm opacity-60">
            © 2024 Mr. Snowman Inc. All rights reserved.
          </div>
          <div className="flex gap-8 text-sm font-medium">
            <a href="#" className="hover:text-gold-500 transition-colors">Privacy</a>
            <a href="#" className="hover:text-gold-500 transition-colors">Terms</a>
            <a href="#" className="hover:text-gold-500 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
