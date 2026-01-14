// ============================================================================
// Mr. Snowman - Landing Page
// ============================================================================

const LandingPage = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-jaguar-900 via-jaguar-800 to-jaguar-900">
      <nav className="bg-jaguar-900/50 backdrop-blur-sm border-b border-jaguar-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gold-600 rounded-xl rotate-45 flex items-center justify-center shadow-xl shadow-gold-600/30">
                <div className="w-5 h-5 bg-jaguar-900 -rotate-45 rounded-lg"></div>
              </div>
              <div>
                <h1 className="font-serif text-xl text-cream-50">
                  Mr. <span className="text-gold-500">Snowman</span>
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => onNavigate('login')} className="px-6 py-2 text-cream-50 hover:text-gold-500 transition-colors font-medium">
                Sign In
              </button>
              <button onClick={() => onNavigate('signup')} className="px-6 py-2 bg-gold-600 hover:bg-gold-500 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300">
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <h1 className="font-serif text-5xl md:text-7xl text-cream-50 leading-tight">
              Email Outreach,<br /><span className="text-gold-500">Automated</span>
            </h1>
            <p className="text-xl md:text-2xl text-cream-100/80 max-w-3xl mx-auto">
              Build multi-step campaigns, warm up your domains, and track every interaction.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <button onClick={() => onNavigate('signup')} className="px-8 py-4 bg-gold-600 hover:bg-gold-500 text-white rounded-xl font-medium text-lg shadow-2xl hover:shadow-gold-600/50 transition-all duration-300 transform hover:scale-105">
              Start Free Trial
            </button>
          </div>
        </div>
      </div>
      
      <footer className="border-t border-jaguar-700 mt-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center text-cream-100/60 text-sm">
            © 2024 Mr. Snowman. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

// Export LandingPage globally
window.LandingPage = LandingPage;
