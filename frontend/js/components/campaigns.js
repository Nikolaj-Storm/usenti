// frontend/js/components/campaigns.js

const CampaignBuilder = () => {
  const [campaigns, setCampaigns] = React.useState([]);
  const [selectedCampaign, setSelectedCampaign] = React.useState(null);
  const [steps, setSteps] = React.useState([]);
  const [activeStep, setActiveStep] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [showNewCampaignModal, setShowNewCampaignModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [lastSaved, setLastSaved] = React.useState(null);
  const [isDemo, setIsDemo] = React.useState(false); // Preserved Demo State

  React.useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const data = await api.getCampaigns();
      const campaignList = Array.isArray(data) ? data : [];
      setCampaigns(campaignList);
      if (campaignList.length > 0 && !selectedCampaign) {
        handleSelectCampaign(campaignList[0]);
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCampaign = async (campaign) => {
    setSelectedCampaign(campaign);
    setLoading(true);
    setIsDemo(false);
    try {
      const stepsData = await api.get(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${campaign.id}/steps`);
      const safeSteps = Array.isArray(stepsData) ? stepsData : [];
      setSteps(safeSteps);
      if (safeSteps.length > 0) setActiveStep(safeSteps[0].id);
      else setActiveStep(null);
    } catch (error) {
      console.error('Failed to load steps:', error);
      setSteps([]);
    } finally {
      setLoading(false);
    }
  };

  // --- Demo Mode (Preserved) ---
  const loadDemoMode = () => {
    const demoCampaign = { id: 'demo', name: 'Demo Campaign (Visual)', status: 'draft' };
    const demoSteps = [
        { id: 's1', step_type: 'email', subject: 'Partnership Opportunity', body: 'Hi {{first_name}},\n\nI noticed your work at {{company}}...', step_order: 1 },
        { id: 's2', step_type: 'wait', wait_days: 2, step_order: 2 },
        { id: 's3', step_type: 'condition', condition_type: 'if_opened', step_order: 3 }
    ];
    setIsDemo(true);
    setSelectedCampaign(demoCampaign);
    setSteps(demoSteps);
    setActiveStep('s1');
  };

  const handleCreateCampaign = async (campaignData) => {
    try {
      const newCampaign = await api.createCampaign(campaignData);
      setCampaigns([newCampaign, ...campaigns]);
      setShowNewCampaignModal(false);
      handleSelectCampaign(newCampaign);
    } catch (error) {
      alert('Failed to create campaign: ' + error.message);
    }
  };

  const handleAddStep = async (stepType) => {
    if (isDemo) { alert("This is a demo. Create a real campaign to save data."); return; }
    if (!selectedCampaign) return;

    const stepData = {
      step_order: steps.length + 1,
      step_type: stepType,
      subject: stepType === 'email' ? 'New Email' : null,
      body: stepType === 'email' ? 'Hi {{first_name}},' : null,
      wait_days: stepType === 'wait' ? 2 : null,
      condition_type: stepType === 'condition' ? 'if_opened' : null
    };

    try {
      const newStep = await api.post(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps`, stepData);
      const updatedSteps = [...steps, newStep];
      setSteps(updatedSteps);
      setActiveStep(newStep.id);
    } catch (error) {
      console.error('Failed to add step:', error);
    }
  };

  const handleUpdateStep = async (stepId, updates) => {
    if (isDemo) return;
    setSaving(true);
    try {
      const updatedStep = await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${stepId}`, updates);
      setSteps(steps.map(s => s.id === stepId ? updatedStep : s));
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to update step:', error);
    } finally {
      setTimeout(() => setSaving(false), 500);
    }
  };

  const handleDeleteStep = async (stepId, e) => {
    e.stopPropagation();
    if (isDemo) {
        setSteps(steps.filter(s => s.id !== stepId));
        return;
    }
    if (!confirm('Delete this step?')) return;
    try {
      await api.delete(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${stepId}`);
      const updatedSteps = steps.filter(s => s.id !== stepId);
      setSteps(updatedSteps);
      if (activeStep === stepId) setActiveStep(updatedSteps.length > 0 ? updatedSteps[0].id : null);
    } catch (error) {
      console.error('Failed to delete step:', error);
    }
  };

  // --- Helper: Prevents Object Rendering Crashes ---
  const safeText = (text, fallback = '') => {
    if (text === null || text === undefined) return fallback;
    if (typeof text === 'object') return ''; // Silently swallow objects
    return String(text);
  };

  // --- Views ---

  if (loading) {
    return h('div', { className: "flex items-center justify-center h-[80vh] animate-fade-in" },
      h(Icons.Loader2, { className: "animate-spin text-jaguar-900", size: 48 })
    );
  }

  // Empty State
  if (!selectedCampaign && campaigns.length === 0) {
    return h('div', { className: "flex flex-col items-center justify-center h-[80vh] text-center animate-fade-in" },
      h('div', { className: "w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-6" },
        h(Icons.Send, { size: 32, className: "text-stone-400 ml-1" })
      ),
      h('h3', { className: "font-serif text-3xl text-jaguar-900 mb-3" }, 'No Campaigns Yet'),
      h('p', { className: "text-stone-500 mb-8 max-w-md text-lg font-light" }, 
        'Create your first email campaign to start reaching out to prospects.'
      ),
      h('div', { className: "flex gap-4" },
        h('button', {
          onClick: () => setShowNewCampaignModal(true),
          className: "px-8 py-4 bg-jaguar-900 text-cream-50 rounded-lg hover:bg-jaguar-800 flex items-center gap-3 transition-all shadow-xl shadow-jaguar-900/10 hover:-translate-y-1"
        }, h(Icons.Plus, { size: 20 }), 'Create Campaign'),
        
        h('button', {
            onClick: loadDemoMode,
            className: "px-8 py-4 bg-white border border-stone-200 text-stone-600 rounded-lg hover:bg-stone-50 flex items-center gap-3 transition-all"
          }, h(Icons.Eye, { size: 20 }), 'Preview UI')
      ),
      showNewCampaignModal && h(NewCampaignModal, {
        onClose: () => setShowNewCampaignModal(false),
        onCreate: handleCreateCampaign
      })
    );
  }

  // Builder View
  return h('div', { className: "h-[calc(100vh-100px)] flex flex-col animate-fade-in" },
    // Header
    h('div', { className: "flex justify-between items-center mb-6 pb-6 border-b border-stone-200" },
      h('div', null,
        h('h1', { className: "font-serif text-3xl text-jaguar-900 mb-2" }, safeText(selectedCampaign?.name, 'Untitled Campaign')),
        h('div', { className: "flex items-center gap-3 text-sm text-stone-500" },
          h('span', { className: "flex items-center gap-1.5" },
            h('span', { className: `w-2 h-2 rounded-full ${selectedCampaign?.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-stone-300'}` }),
            safeText(selectedCampaign?.status, 'Draft')
          ),
          h('span', null, '•'),
          isDemo ? h('span', { className: "text-gold-500 font-medium" }, "Demo Mode (Not Saved)") :
          h('span', null, lastSaved ? `Last saved ${lastSaved.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Unsaved changes')
        )
      ),
      h('div', { className: "flex gap-3" },
        !isDemo && h('select', {
          className: "px-4 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-jaguar-900/20",
          onChange: (e) => {
            const camp = campaigns.find(c => c.id === e.target.value);
            if(camp) handleSelectCampaign(camp);
          },
          value: safeText(selectedCampaign?.id)
        }, campaigns.map(c => h('option', { key: c.id, value: c.id }, safeText(c.name)))),
        
        h('button', {
            onClick: () => setShowNewCampaignModal(true),
            className: "p-2 text-stone-400 hover:text-jaguar-900 border border-stone-200 rounded-lg"
        }, h(Icons.Plus, { size: 20 })),

        h('div', { className: "w-px h-10 bg-stone-200 mx-2" }),

        h('button', {
          className: "px-6 py-2.5 bg-white border border-stone-200 text-jaguar-900 rounded-lg font-medium hover:bg-stone-50 transition-colors flex items-center gap-2"
        }, h(Icons.Save, { size: 18 }), 'Save Draft'),
        
        h('button', {
          className: "px-6 py-2.5 bg-jaguar-900 text-cream-50 rounded-lg font-medium hover:bg-jaguar-800 shadow-lg shadow-jaguar-900/10 transition-all flex items-center gap-2"
        }, h(Icons.Play, { size: 18 }), 'Launch')
      )
    ),

    // Main Layout
    h('div', { className: "flex gap-8 flex-1 overflow-hidden" },
      
      // Timeline
      h('div', { className: "w-1/3 overflow-y-auto pr-4 pb-20 custom-scrollbar" },
        h('div', { className: "relative min-h-[500px]" },
          h('div', { className: "absolute left-[26px] top-6 bottom-0 w-0.5 bg-stone-200 -z-10" }),

          // Steps List (Passed as Array child, not spread)
          h('div', { className: "space-y-8" },
            steps.map((step, index) => 
              h(TimelineStep, {
                key: step.id,
                step: step,
                index: index,
                isActive: activeStep === step.id,
                onClick: () => setActiveStep(step.id),
                onDelete: (e) => handleDeleteStep(step.id, e)
              })
            )
          ),

          // Add Step
          h('div', { className: "mt-8 pl-14" },
            h('div', { className: "relative group" },
               h('button', {
                 className: "flex items-center gap-2 px-4 py-3 bg-white border border-dashed border-stone-300 text-stone-500 rounded-lg hover:border-jaguar-900 hover:text-jaguar-900 transition-all w-full justify-center group-hover:shadow-md"
               }, h(Icons.Plus, { size: 18 }), 'Add Next Step'),
               
               h('div', { className: "hidden group-hover:block absolute top-full left-0 w-full pt-2 z-20" },
                 h('div', { className: "bg-white border border-stone-200 shadow-xl rounded-lg overflow-hidden p-1" },
                   h('button', { onClick: () => handleAddStep('email'), className: "w-full text-left px-4 py-3 hover:bg-cream-50 flex items-center gap-3 text-sm text-jaguar-900" },
                     h(Icons.Mail, { size: 16 }), 'Email'
                   ),
                   h('button', { onClick: () => handleAddStep('wait'), className: "w-full text-left px-4 py-3 hover:bg-cream-50 flex items-center gap-3 text-sm text-jaguar-900" },
                     h(Icons.Clock, { size: 16 }), 'Wait Delay'
                   ),
                   h('button', { onClick: () => handleAddStep('condition'), className: "w-full text-left px-4 py-3 hover:bg-cream-50 flex items-center gap-3 text-sm text-jaguar-900" },
                     h(Icons.Split, { size: 16 }), 'Condition'
                   )
                 )
               )
            )
          )
        )
      ),

      // Editor
      h('div', { className: "flex-1 bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden flex flex-col" },
        activeStep 
          ? h(StepEditor, {
              step: steps.find(s => s.id === activeStep),
              onUpdate: handleUpdateStep,
              saving: saving
            })
          : h('div', { className: "flex-1 flex flex-col items-center justify-center text-stone-400" },
              h(Icons.Edit3, { size: 48, className: "mb-4 opacity-20" }),
              h('p', null, 'Select a step from the timeline to edit')
            )
      )
    ),

    showNewCampaignModal && h(NewCampaignModal, {
        onClose: () => setShowNewCampaignModal(false),
        onCreate: handleCreateCampaign
    })
  );
};

// --- Sub-components ---

const TimelineStep = ({ step, index, isActive, onClick, onDelete }) => {
    if (!step) return null; // Safety check
    
    let StepIcon = Icons.Mail;
    let iconBg = "bg-white border-stone-200 text-jaguar-900";
    if (step.step_type === 'wait') { StepIcon = Icons.Clock; iconBg = "bg-cream-100 border-stone-200 text-stone-600"; }
    if (step.step_type === 'condition') { StepIcon = Icons.Split; iconBg = "bg-jaguar-900 border-jaguar-900 text-cream-50"; }

    // Safe Text Helpers
    const safeSubject = step.subject ? String(step.subject) : 'New Email';
    const safeBody = step.body ? String(step.body) : '';
    const safeCondition = step.condition_type ? String(step.condition_type).replace('if_', '').replace('_', ' ') : '';

    return h('div', { 
      onClick: onClick,
      className: `relative pl-14 group cursor-pointer transition-all duration-200 ${isActive ? 'scale-[1.02]' : 'hover:scale-[1.01]'}`
    },
      h('div', { 
        className: `absolute left-0 top-0 w-14 h-14 rounded-full border-4 border-[#FDFBF7] flex items-center justify-center z-10 ${iconBg} shadow-sm`
      }, h(StepIcon, { size: 20 })),

      h('div', { 
        className: `p-5 rounded-xl border transition-all ${
            isActive 
            ? 'bg-white border-jaguar-900 ring-1 ring-jaguar-900/20 shadow-lg' 
            : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-md'
        }`
      },
        h('div', { className: "flex justify-between items-start mb-2" },
          h('span', { className: "text-xs font-bold uppercase tracking-wider text-stone-400" }, `STEP ${index + 1}`),
          h('button', { 
            onClick: onDelete,
            className: "text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1" 
          }, h(Icons.Trash2, { size: 14 }))
        ),

        step.step_type === 'email' && h('div', null,
          h('h4', { className: "font-serif text-lg text-jaguar-900 mb-1 leading-tight" }, safeSubject),
          h('p', { className: "text-sm text-stone-500 line-clamp-2" }, safeBody || 'No content...')
        ),
        
        step.step_type === 'wait' && h('div', null,
            h('h4', { className: "font-medium text-lg text-stone-700" }, `Wait ${step.wait_days || 1} Days`)
        ),

        step.step_type === 'condition' && h('div', null,
            h('h4', { className: "font-medium text-base text-jaguar-900 mb-2" }, `Condition: ${safeCondition}`),
            h('div', { className: "flex gap-2 text-xs" },
                h('span', { className: "px-2 py-1 bg-green-50 text-green-700 rounded border border-green-100" }, "Yes → Next"),
                h('span', { className: "px-2 py-1 bg-red-50 text-red-700 rounded border border-red-100" }, "No → Exit")
            )
        )
      )
    );
};

const StepEditor = ({ step, onUpdate, saving }) => {
  if (!step) return null;
  const [data, setData] = React.useState(step);
  React.useEffect(() => { setData(step); }, [step.id]);

  const handleChange = (field, value) => {
    setData({ ...data, [field]: value });
  };

  const handleBlur = () => {
    onUpdate(step.id, data);
  };

  const insertVar = (variable) => {
    const textarea = document.getElementById('emailBody');
    if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = data.body || '';
        const newText = text.substring(0, start) + variable + text.substring(end);
        setData({ ...data, body: newText });
        setTimeout(() => {
            textarea.focus();
            onUpdate(step.id, { ...data, body: newText });
        }, 0);
    }
  };

  const safeVal = (v) => v === null || v === undefined ? '' : String(v);

  return h('div', { className: "flex flex-col h-full animate-fade-in" },
    h('div', { className: "px-8 py-6 border-b border-stone-100 bg-cream-50/50 flex justify-between items-center" },
       h('h3', { className: "font-serif text-xl text-jaguar-900" }, 
         step.step_type === 'email' ? 'Edit Email Content' : 
         step.step_type === 'wait' ? 'Configure Delay' : 'Logic Condition'
       ),
       saving && h('span', { className: "text-xs text-stone-400 flex items-center gap-1" },
         h(Icons.Loader2, { size: 12 }), 'Saving...'
       )
    ),

    h('div', { className: "p-8 overflow-y-auto flex-1" },
        
        step.step_type === 'email' && h('div', { className: "space-y-6 max-w-3xl" },
            h('div', null,
                h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, "Subject Line"),
                h('input', {
                    type: "text",
                    value: safeVal(data.subject),
                    onChange: (e) => handleChange('subject', e.target.value),
                    onBlur: handleBlur,
                    className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 font-medium",
                    placeholder: "e.g. Collaboration Opportunity"
                })
            ),
            h('div', null,
                h('div', { className: "flex justify-between items-center mb-2" },
                    h('label', { className: "block text-sm font-medium text-stone-700" }, "Email Body"),
                    h('div', { className: "flex gap-2" },
                        ['{{first_name}}', '{{company}}'].map(v => 
                            h('button', { 
                                key: v, 
                                onClick: () => insertVar(v),
                                className: "text-xs px-2 py-1 bg-stone-100 hover:bg-stone-200 rounded text-stone-600 font-mono transition-colors"
                            }, v)
                        )
                    )
                ),
                h('textarea', {
                    id: "emailBody",
                    value: safeVal(data.body),
                    onChange: (e) => handleChange('body', e.target.value),
                    onBlur: handleBlur,
                    className: "w-full h-96 p-6 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 leading-relaxed resize-none",
                    placeholder: "Write your email content here..."
                })
            )
        ),

        step.step_type === 'wait' && h('div', { className: "flex flex-col items-center justify-center h-full pb-20" },
            h(Icons.Clock, { size: 64, className: "text-stone-200 mb-6" }),
            h('h3', { className: "text-2xl font-serif text-jaguar-900 mb-8" }, "Wait Duration"),
            h('div', { className: "flex items-center gap-6" },
                h('button', { 
                    onClick: () => { 
                        const val = Math.max(1, (data.wait_days || 0) - 1);
                        handleChange('wait_days', val);
                        onUpdate(step.id, { wait_days: val });
                    },
                    className: "w-12 h-12 rounded-full border border-stone-200 flex items-center justify-center hover:bg-stone-100 text-xl"
                }, "-"),
                h('div', { className: "text-center" },
                    h('span', { className: "text-6xl font-serif text-jaguar-900 block" }, data.wait_days || 1),
                    h('span', { className: "text-stone-500 uppercase tracking-widest text-sm" }, "Days")
                ),
                h('button', { 
                    onClick: () => { 
                        const val = (data.wait_days || 0) + 1;
                        handleChange('wait_days', val);
                        onUpdate(step.id, { wait_days: val });
                    },
                    className: "w-12 h-12 rounded-full border border-stone-200 flex items-center justify-center hover:bg-stone-100 text-xl"
                }, "+")
            )
        ),

        step.step_type === 'condition' && h('div', { className: "max-w-xl mx-auto pt-10" },
            h('div', { className: "bg-cream-50 border border-stone-200 rounded-xl p-8 text-center" },
                h(Icons.Split, { size: 48, className: "mx-auto text-gold-600 mb-4" }),
                h('h3', { className: "text-xl font-serif text-jaguar-900 mb-6" }, "Condition Logic"),
                h('select', {
                    value: data.condition_type || 'if_opened',
                    onChange: (e) => {
                        handleChange('condition_type', e.target.value);
                        onUpdate(step.id, { condition_type: e.target.value });
                    },
                    className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-lg text-lg mb-6"
                },
                    h('option', { value: "if_opened" }, "If previous email was opened"),
                    h('option', { value: "if_clicked" }, "If link was clicked"),
                    h('option', { value: "if_replied" }, "If recipient replied")
                ),
                h('p', { className: "text-stone-500" }, "The workflow will branch based on this outcome.")
            )
        )
    )
  );
};

const NewCampaignModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = React.useState({ name: '', email_account_id: '', contact_list_id: '' });
  const [emailAccounts, setEmailAccounts] = React.useState([]);
  const [contactLists, setContactLists] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([api.getEmailAccounts(), api.getContactLists()])
      .then(([accounts, lists]) => {
        setEmailAccounts(Array.isArray(accounts) ? accounts : []);
        setContactLists(Array.isArray(lists) ? lists : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData);
  };

  const safeName = (obj) => obj && obj.name ? String(obj.name) : 'Unknown';

  return h('div', { className: "fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in", onClick: onClose },
    h('div', { className: "bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl", onClick: e => e.stopPropagation() },
      h('h3', { className: "font-serif text-2xl text-jaguar-900 mb-6" }, "Start New Campaign"),
      loading ? h(Icons.Loader2, { className: "animate-spin mx-auto" }) :
      h('form', { onSubmit: handleSubmit, className: "space-y-5" },
        h('div', null,
            h('label', { className: "block text-sm font-medium text-stone-700 mb-1" }, "Campaign Name"),
            h('input', { 
                required: true,
                className: "w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-jaguar-900/20 outline-none",
                placeholder: "e.g. Q1 Outreach",
                value: formData.name,
                onChange: e => setFormData({...formData, name: e.target.value})
            })
        ),
        h('div', null,
            h('label', { className: "block text-sm font-medium text-stone-700 mb-1" }, "Send From"),
            h('select', { 
                required: true,
                className: "w-full px-4 py-2 border border-stone-200 rounded-lg outline-none bg-white",
                value: formData.email_account_id,
                onChange: e => setFormData({...formData, email_account_id: e.target.value})
            },
                h('option', { value: "" }, "Select email account..."),
                emailAccounts.map(a => h('option', { key: a.id, value: a.id }, String(a.email_address)))
            )
        ),
        h('div', null,
            h('label', { className: "block text-sm font-medium text-stone-700 mb-1" }, "Target List"),
            h('select', { 
                required: true,
                className: "w-full px-4 py-2 border border-stone-200 rounded-lg outline-none bg-white",
                value: formData.contact_list_id,
                onChange: e => setFormData({...formData, contact_list_id: e.target.value})
            },
                h('option', { value: "" }, "Select contact list..."),
                contactLists.map(l => h('option', { key: l.id, value: l.id }, safeName(l)))
            )
        ),
        h('div', { className: "flex gap-3 pt-4" },
            h('button', { type: "button", onClick: onClose, className: "flex-1 py-2.5 border border-stone-200 rounded-lg hover:bg-stone-50" }, "Cancel"),
            h('button', { type: "submit", className: "flex-1 py-2.5 bg-jaguar-900 text-white rounded-lg hover:bg-jaguar-800" }, "Create Campaign")
        )
      )
    )
  );
};
