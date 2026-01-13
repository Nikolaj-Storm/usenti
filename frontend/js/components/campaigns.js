// Campaigns Component - The most advanced component with drag-drop builder
const CampaignBuilder = () => {
  const { useState, useEffect } = React;
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [steps, setSteps] = useState([]);
  const [activeStep, setActiveStep] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaign) {
      loadCampaignSteps();
      loadCampaignStats();
    }
  }, [selectedCampaign]);

  const loadCampaigns = async () => {
    try {
      const data = await api.getCampaigns();
      setCampaigns(data);
      if (data.length > 0 && !selectedCampaign) {
        setSelectedCampaign(data[0]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      setLoading(false);
    }
  };

  const loadCampaignSteps = async () => {
    try {
      const data = await api.getCampaignSteps(selectedCampaign.id);
      setSteps(data);
      if (data.length > 0 && !activeStep) {
        setActiveStep(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load steps:', error);
    }
  };

  const loadCampaignStats = async () => {
    try {
      const data = await api.getCampaignStats(selectedCampaign.id);
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleAddStep = async (stepType) => {
    if (!selectedCampaign) return;
    
    const stepData = {
      step_order: steps.length + 1,
      step_type: stepType,
      subject: stepType === 'email' ? 'New Email' : null,
      body: stepType === 'email' ? '<p>Write your email here...</p>' : null,
      wait_days: stepType === 'wait' ? 3 : null
    };

    try {
      const newStep = await api.addCampaignStep(selectedCampaign.id, stepData);
      setSteps([...steps, newStep]);
      setActiveStep(newStep.id);
    } catch (error) {
      alert('Failed to add step: ' + error.message);
    }
  };

  const handleUpdateStep = async (stepId, updates) => {
    try {
      await api.updateCampaignStep(selectedCampaign.id, stepId, updates);
      setSteps(steps.map(s => s.id === stepId ? {...s, ...updates} : s));
    } catch (error) {
      alert('Failed to update step: ' + error.message);
    }
  };

  const handleDeleteStep = async (stepId) => {
    if (!confirm('Are you sure you want to delete this step?')) return;
    
    try {
      await api.deleteCampaignStep(selectedCampaign.id, stepId);
      setSteps(steps.filter(s => s.id !== stepId));
      if (activeStep === stepId) {
        setActiveStep(steps[0]?.id || null);
      }
    } catch (error) {
      alert('Failed to delete step: ' + error.message);
    }
  };

  const handleStartCampaign = async () => {
    if (!confirm(`Start campaign "${selectedCampaign.name}"? Emails will begin sending within 5 minutes.`)) return;
    
    try {
      await api.startCampaign(selectedCampaign.id);
      await loadCampaigns();
      alert('Campaign started successfully! Emails will begin sending shortly.');
    } catch (error) {
      alert('Failed to start campaign: ' + error.message);
    }
  };

  const handlePauseCampaign = async () => {
    try {
      await api.pauseCampaign(selectedCampaign.id);
      await loadCampaigns();
    } catch (error) {
      alert('Failed to pause campaign: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Icons.Loader2 size={48} className="text-jaguar-900 mx-auto" />
          <p className="text-stone-500">Loading your campaigns...</p>
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center animate-fade-in">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-jaguar-900 to-jaguar-700 mx-auto mb-6 flex items-center justify-center shadow-2xl">
          <Icons.Send size={40} className="text-cream-50" />
        </div>
        <h3 className="font-serif text-3xl text-jaguar-900 mb-2">No Campaigns Yet</h3>
        <p className="text-stone-500 mb-8 max-w-md">Create your first email campaign to start reaching out to prospects with multi-step sequences.</p>
        <button 
          onClick={() => setShowNewCampaignModal(true)}
          className="px-8 py-4 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-xl font-medium hover:shadow-2xl transition-all duration-300 flex items-center gap-2 hover:scale-105"
        >
          <Icons.Plus size={20} />
          Create Your First Campaign
        </button>
      </div>
    );
  }

  const activeStepData = steps.find(s => s.id === activeStep);

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <select
            value={selectedCampaign?.id || ''}
            onChange={(e) => {
              const campaign = campaigns.find(c => c.id === e.target.value);
              setSelectedCampaign(campaign);
            }}
            className="px-4 py-3 bg-white border-2 border-stone-200 rounded-xl focus:outline-none focus:border-jaguar-900 transition-all font-medium text-jaguar-900 min-w-[250px]"
          >
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              selectedCampaign?.status === 'running' 
                ? 'bg-green-500 animate-pulse' 
                : selectedCampaign?.status === 'paused'
                ? 'bg-amber-500'
                : 'bg-stone-300'
            }`}></div>
            <span className="text-sm text-stone-600 capitalize font-medium">{selectedCampaign?.status || 'draft'}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => setShowNewCampaignModal(true)}
            className="px-4 py-2 bg-white border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition-all duration-300 font-medium flex items-center gap-2 shadow-sm hover:shadow"
          >
            <Icons.Plus size={18} /> New Campaign
          </button>
          
          {selectedCampaign?.status === 'draft' && (
            <button 
              onClick={handleStartCampaign}
              disabled={steps.length === 0}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl hover:shadow-xl transition-all duration-300 font-medium flex items-center gap-2 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Icons.Play size={18} /> Launch Campaign
            </button>
          )}
          
          {selectedCampaign?.status === 'running' && (
            <button 
              onClick={handlePauseCampaign}
              className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-xl hover:shadow-xl transition-all duration-300 font-medium flex items-center gap-2"
            >
              <Icons.Pause size={18} /> Pause
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      {stats && selectedCampaign?.status !== 'draft' && (
        <div className="grid grid-cols-5 gap-4 mb-6 animate-fade-in">
          <div className="bg-white rounded-xl border border-stone-200 p-4 hover:shadow-lg transition-all duration-300">
            <div className="text-xs text-stone-500 uppercase tracking-wider mb-1">Contacts</div>
            <div className="text-2xl font-serif text-jaguar-900">{stats.total_contacts}</div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-4 hover:shadow-lg transition-all duration-300">
            <div className="text-xs text-stone-500 uppercase tracking-wider mb-1">Sent</div>
            <div className="text-2xl font-serif text-jaguar-900">{stats.sent_count}</div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-4 hover:shadow-lg transition-all duration-300">
            <div className="text-xs text-stone-500 uppercase tracking-wider mb-1">Opens</div>
            <div className="text-2xl font-serif text-green-600">{stats.open_rate}%</div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-4 hover:shadow-lg transition-all duration-300">
            <div className="text-xs text-stone-500 uppercase tracking-wider mb-1">Clicks</div>
            <div className="text-2xl font-serif text-blue-600">{stats.click_rate}%</div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-4 hover:shadow-lg transition-all duration-300">
            <div className="text-xs text-stone-500 uppercase tracking-wider mb-1">Replies</div>
            <div className="text-2xl font-serif text-jaguar-900">{stats.reply_rate}%</div>
          </div>
        </div>
      )}

      {/* Campaign Builder */}
      <div className="flex gap-6 flex-1 overflow-hidden">
        {/* Steps Timeline */}
        <div className="w-1/3 overflow-y-auto pr-2 pb-10">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 top-4 bottom-0 w-0.5 bg-gradient-to-b from-jaguar-900 via-stone-300 to-transparent"></div>

            <div className="space-y-6">
              {steps.map((step, index) => (
                <StepCard 
                  key={step.id}
                  step={step}
                  index={index}
                  isActive={activeStep === step.id}
                  onClick={() => setActiveStep(step.id)}
                  onDelete={() => handleDeleteStep(step.id)}
                />
              ))}

              {/* Add Step Buttons */}
              <div className="relative pl-16">
                <div className="absolute left-0 top-0 w-12 h-12 rounded-full border-4 border-[#FDFBF7] bg-cream-100 text-stone-400 flex items-center justify-center z-10 shadow-sm">
                  <Icons.Plus size={20} />
                </div>
                <div className="space-y-3">
                  <button 
                    onClick={() => handleAddStep('email')}
                    className="w-full p-4 border-2 border-dashed border-stone-200 rounded-xl text-stone-600 font-medium hover:border-jaguar-900 hover:bg-cream-50 hover:text-jaguar-900 transition-all duration-300 text-left flex items-center gap-3 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-stone-100 group-hover:bg-jaguar-900 flex items-center justify-center transition-all duration-300">
                      <Icons.Mail size={18} className="text-stone-500 group-hover:text-cream-50 transition-colors" />
                    </div>
                    <div>
                      <div className="font-medium">Add Email</div>
                      <div className="text-xs text-stone-500">Send a personalized email</div>
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => handleAddStep('wait')}
                    className="w-full p-4 border-2 border-dashed border-stone-200 rounded-xl text-stone-600 font-medium hover:border-jaguar-900 hover:bg-cream-50 hover:text-jaguar-900 transition-all duration-300 text-left flex items-center gap-3 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-stone-100 group-hover:bg-jaguar-900 flex items-center justify-center transition-all duration-300">
                      <Icons.Clock size={18} className="text-stone-500 group-hover:text-cream-50 transition-colors" />
                    </div>
                    <div>
                      <div className="font-medium">Add Wait</div>
                      <div className="text-xs text-stone-500">Wait before next step</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step Editor */}
        <div className="w-2/3 bg-white border border-stone-200 rounded-2xl shadow-lg overflow-hidden flex flex-col">
          {activeStepData ? (
            <StepEditor 
              step={activeStepData}
              onUpdate={(updates) => handleUpdateStep(activeStepData.id, updates)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-stone-400">
              <Icons.Edit3 size={64} className="mb-4 opacity-20" />
              <p className="text-lg">Select a step from the timeline to edit</p>
            </div>
          )}
        </div>
      </div>

      {/* New Campaign Modal */}
      {showNewCampaignModal && (
        <NewCampaignModal 
          onClose={() => setShowNewCampaignModal(false)}
          onCreate={async (data) => {
            await loadCampaigns();
            setShowNewCampaignModal(false);
          }}
        />
      )}
    </div>
  );
};

// Step Card Component
const StepCard = ({ step, index, isActive, onClick, onDelete }) => {
  const getStepIcon = () => {
    switch (step.step_type) {
      case 'email': return Icons.Mail;
      case 'wait': return Icons.Clock;
      case 'condition': return Icons.Split;
      default: return Icons.Mail;
    }
  };

  const StepIcon = getStepIcon();

  return (
    <div 
      onClick={onClick}
      className={`relative pl-16 group cursor-pointer transition-all duration-300 ${
        isActive ? 'opacity-100 scale-[1.02]' : 'opacity-80 hover:opacity-100'
      }`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Step Number Circle */}
      <div className={`absolute left-0 top-0 w-12 h-12 rounded-full border-4 border-[#FDFBF7] flex items-center justify-center z-10 shadow-lg transition-all duration-300 ${
        isActive 
          ? 'bg-gradient-to-br from-jaguar-900 to-jaguar-700 text-cream-50 scale-110' 
          : 'bg-white text-stone-400 group-hover:text-jaguar-900 group-hover:border-jaguar-900/20'
      }`}>
        <StepIcon size={20} />
      </div>

      {/* Step Content Card */}
      <div className={`p-5 rounded-xl border-2 transition-all duration-300 ${
        isActive 
          ? 'bg-gradient-to-br from-white to-cream-50 border-jaguar-900 shadow-xl' 
          : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-lg'
      }`}>
        <div className="flex justify-between items-start mb-3">
          <span className={`text-xs font-bold uppercase tracking-wider ${
            isActive ? 'text-jaguar-900' : 'text-stone-400'
          }`}>
            Step {index + 1}
          </span>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); /* edit */ }}
              className="text-stone-400 hover:text-jaguar-900 transition-colors"
            >
              <Icons.Edit3 size={14}/>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-stone-400 hover:text-red-500 transition-colors"
            >
              <Icons.Trash2 size={14}/>
            </button>
          </div>
        </div>
        
        {step.step_type === 'email' && (
          <div>
            <h4 className={`font-serif font-medium mb-2 ${
              isActive ? 'text-jaguar-900' : 'text-stone-700'
            }`}>
              {step.subject || 'No Subject'}
            </h4>
            <p className="text-xs text-stone-500 line-clamp-2">{step.body?.replace(/<[^>]*>/g, '') || 'No content'}</p>
          </div>
        )}
        
        {step.step_type === 'wait' && (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <h4 className="font-medium text-stone-700">Wait Period</h4>
              <p className="text-2xl font-serif text-jaguar-900">{step.wait_days} Days</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
              <Icons.Clock size={20} className="text-amber-600" />
            </div>
          </div>
        )}
        
        {step.step_type === 'condition' && (
          <div className="bg-cream-100 p-3 rounded-lg border border-stone-200">
            <span className="text-sm font-medium text-jaguar-900 block mb-1">Conditional Step</span>
            <span className="text-xs text-stone-600">If {step.condition_type?.replace('if_', '') || 'condition'}...</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Step Editor Component
const StepEditor = ({ step, onUpdate }) => {
  const { useState, useEffect } = React;
  const [formData, setFormData] = useState({
    subject: step.subject || '',
    body: step.body || '',
    wait_days: step.wait_days || 3
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData({
      subject: step.subject || '',
      body: step.body || '',
      wait_days: step.wait_days || 3
    });
  }, [step.id]);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(formData);
    setSaving(false);
  };

  return (
    <>
      <div className="sticky top-0 bg-gradient-to-r from-cream-50 to-white p-6 border-b border-stone-200 z-10">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-serif text-xl text-jaguar-900">
              {step.step_type === 'email' ? 'Email Step' : step.step_type === 'wait' ? 'Wait Step' : 'Condition Step'}
            </h3>
            <p className="text-sm text-stone-500 mt-1">Configure this step in your campaign sequence</p>
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-xl hover:shadow-xl transition-all duration-300 font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <><Icons.Loader2 size={16} /> Saving...</> : <><Icons.Save size={16} /> Save Changes</>}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {step.step_type === 'email' && (
          <div className="space-y-6 animate-fade-in max-w-3xl">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Subject Line</label>
              <input 
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all font-serif text-lg"
                placeholder="Enter email subject..."
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-stone-700">Email Body</label>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-cream-100 border border-stone-200 rounded-lg text-xs font-medium text-gold-600 hover:bg-gold-50 transition-colors">
                    {'{{first_name}}'}
                  </button>
                  <button className="px-3 py-1 bg-cream-100 border border-stone-200 rounded-lg text-xs font-medium text-gold-600 hover:bg-gold-50 transition-colors">
                    {'{{company}}'}
                  </button>
                  <button className="px-3 py-1 bg-cream-100 border border-stone-200 rounded-lg text-xs font-medium text-gold-600 hover:bg-gold-50 transition-colors">
                    {'{{email}}'}
                  </button>
                </div>
              </div>
              <div className="border-2 border-stone-200 rounded-xl overflow-hidden focus-within:border-jaguar-900 transition-all">
                <textarea 
                  value={formData.body}
                  onChange={(e) => setFormData({...formData, body: e.target.value})}
                  rows={14}
                  className="w-full p-4 focus:outline-none resize-none font-sans leading-relaxed"
                  placeholder="Hi {{first_name}},&#10;&#10;I noticed..."
                />
              </div>
              <p className="text-xs text-stone-500 mt-2">
                Use variables like {'{{first_name}}'}, {'{{company}}'} to personalize your emails
              </p>
            </div>
            
            <div className="p-4 bg-cream-50 border border-stone-200 rounded-xl">
              <h4 className="text-sm font-medium text-jaguar-900 mb-3 flex items-center gap-2">
                <Icons.BarChart3 size={16} />
                Tracking Options
              </h4>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-stone-300 text-jaguar-900 focus:ring-jaguar-900/20" />
                  Track Opens
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-stone-300 text-jaguar-900 focus:ring-jaguar-900/20" />
                  Track Clicks
                </label>
              </div>
            </div>
          </div>
        )}

        {step.step_type === 'wait' && (
          <div className="flex flex-col items-center justify-center h-full animate-fade-in">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center mb-8 shadow-xl">
              <Icons.Clock size={40} className="text-amber-600" />
            </div>
            <h3 className="text-2xl font-serif text-jaguar-900 mb-8">Delay Duration</h3>
            <div className="flex items-center gap-6 mb-4">
              <button 
                onClick={() => setFormData({...formData, wait_days: Math.max(1, formData.wait_days - 1)})}
                className="w-14 h-14 rounded-full bg-white border-2 border-stone-200 flex items-center justify-center hover:bg-stone-50 hover:border-jaguar-900 transition-all duration-300 text-2xl font-bold text-stone-700 hover:text-jaguar-900"
              >
                −
              </button>
              <div className="text-6xl font-serif text-jaguar-900 w-32 text-center">{formData.wait_days}</div>
              <button 
                onClick={() => setFormData({...formData, wait_days: formData.wait_days + 1})}
                className="w-14 h-14 rounded-full bg-white border-2 border-stone-200 flex items-center justify-center hover:bg-stone-50 hover:border-jaguar-900 transition-all duration-300 text-2xl font-bold text-stone-700 hover:text-jaguar-900"
              >
                +
              </button>
            </div>
            <p className="text-lg text-stone-500 uppercase tracking-widest">Days</p>
            <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-xl max-w-md">
              <p className="text-sm text-blue-900">
                <Icons.AlertCircle size={16} className="inline mr-2" />
                The next step will execute {formData.wait_days} day{formData.wait_days !== 1 ? 's' : ''} after this one completes
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// New Campaign Modal
const NewCampaignModal = ({ onClose, onCreate }) => {
  const { useState, useEffect } = React;
  const [loading, setLoading] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [contactLists, setContactLists] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    email_account_id: '',
    contact_list_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [accounts, lists] = await Promise.all([
        api.getEmailAccounts(),
        api.getContactLists()
      ]);
      setEmailAccounts(accounts);
      setContactLists(lists);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await api.createCampaign(formData);
      onCreate();
    } catch (error) {
      alert('Failed to create campaign: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-stone-100 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-t-2xl">
          <h3 className="font-serif text-2xl">Create New Campaign</h3>
          <p className="text-sm text-jaguar-100 mt-1">Set up a multi-step email sequence</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Campaign Name</label>
            <input 
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all"
              placeholder="e.g., Q1 Outreach Campaign"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Sending Email Account</label>
            <select 
              required
              value={formData.email_account_id}
              onChange={(e) => setFormData({...formData, email_account_id: e.target.value})}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all"
            >
              <option value="">Select email account...</option>
              {emailAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.email_address}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Contact List</label>
            <select 
              required
              value={formData.contact_list_id}
              onChange={(e) => setFormData({...formData, contact_list_id: e.target.value})}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all"
            >
              <option value="">Select contact list...</option>
              {contactLists.map(list => (
                <option key={list.id} value={list.id}>{list.name} ({list.total_contacts} contacts)</option>
              ))}
            </select>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-white border-2 border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition-all duration-300 font-medium"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-xl hover:shadow-xl transition-all duration-300 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {loading ? <><Icons.Loader2 size={18} /> Creating...</> : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Make CampaignBuilder globally available
window.CampaignBuilder = CampaignBuilder;
