// Mr. Snowman - Campaign Builder (Sanitized & Stable Version)

// --- 1. Data Sanitizers (The firewall against crashes) ---
// These ensure ONLY strings/numbers enter the state. No Objects allowed.

const sanitizeCampaign = (c) => {
  if (!c || typeof c !== 'object') return null;
  return {
    id: String(c.id || ''),
    name: String(c.name || 'Untitled Campaign'),
    status: String(c.status || 'draft'),
    updated_at: c.updated_at ? String(c.updated_at) : null
  };
};

const sanitizeStep = (s) => {
  if (!s || typeof s !== 'object') return null;
  return {
    id: String(s.id || Math.random()), // Ensure ID exists
    step_type: String(s.step_type || 'email'),
    step_order: Number(s.step_order || 0),
    subject: String(s.subject || ''),
    body: String(s.body || ''),
    wait_days: Number(s.wait_days || 1),
    condition_type: String(s.condition_type || 'if_opened')
  };
};

// --- 2. Main Component ---

const CampaignBuilder = () => {
  const [campaigns, setCampaigns] = React.useState([]);
  const [selectedCampaign, setSelectedCampaign] = React.useState(null);
  const [steps, setSteps] = React.useState([]);
  const [activeStep, setActiveStep] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [showNewCampaignModal, setShowNewCampaignModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [isDemo, setIsDemo] = React.useState(false);

  React.useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const data = await api.getCampaigns();
      // Sanitize incoming array
      const rawList = Array.isArray(data) ? data : [];
      const cleanList = rawList.map(sanitizeCampaign).filter(Boolean);
      
      setCampaigns(cleanList);
      
      if (cleanList.length > 0 && !selectedCampaign) {
        handleSelectCampaign(cleanList[0]);
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCampaign = async (campaign) => {
    // Campaign is already sanitized
    setSelectedCampaign(campaign);
    setLoading(true);
    setIsDemo(false);
    try {
      const data = await api.get(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${campaign.id}/steps`);
      
      // Sanitize Steps
      const rawSteps = Array.isArray(data) ? data : [];
      const cleanSteps = rawSteps.map(sanitizeStep).filter(Boolean);
      
      setSteps(cleanSteps);
      
      if (cleanSteps.length > 0) setActiveStep(cleanSteps[0].id);
      else setActiveStep(null);

    } catch (error) {
      console.error('Failed to load steps:', error);
      setSteps([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDemoMode = () => {
    const demoCampaign = sanitizeCampaign({ id: 'demo', name: 'Demo Campaign (Visual)', status: 'draft' });
    const demoSteps = [
        { id: 's1', step_type: 'email', subject: 'Partnership Opportunity', body: 'Hi {{first_name}}...', step_order: 1 },
        { id: 's2', step_type: 'wait', wait_days: 2, step_order: 2 },
        { id: 's3', step_type: 'condition', condition_type: 'if_opened', step_order: 3 }
    ].map(sanitizeStep);

    setIsDemo(true);
    setSelectedCampaign(demoCampaign);
    setSteps(demoSteps);
    setActiveStep('s1');
  };

  const handleCreateCampaign = async (formData) => {
    try {
      const res = await api.createCampaign(formData);
      const newCamp = sanitizeCampaign(res);
      if (newCamp) {
        setCampaigns([newCamp, ...campaigns]);
        setShowNewCampaignModal(false);
        handleSelectCampaign(newCamp);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleAddStep = async (stepType) => {
    if (isDemo || !selectedCampaign) return;
    
    // Optimistic Update
    const tempId = 'temp-' + Date.now();
    const newStepRaw = {
      id: tempId,
      step_type: stepType,
      step_order: steps.length + 1,
      subject: stepType === 'email' ? 'New Email' : '',
      body: '',
      wait_days: 2,
      condition_type: 'if_opened'
    };
    
    // Add to UI immediately
    const cleanStep = sanitizeStep(newStepRaw);
    setSteps([...steps, cleanStep]);
    setActiveStep(tempId);

    try {
        const serverStep = await api.post(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps`, newStepRaw);
        // Replace temp step with real one from server
        const realStep = sanitizeStep(serverStep);
        setSteps(prev => prev.map(s => s.id === tempId ? realStep : s));
        setActiveStep(realStep.id);
    } catch(e) {
        console.error(e);
        // Revert on failure
        setSteps(prev => prev.filter(s => s.id !== tempId));
    }
  };

  const handleUpdateStep = async (stepId, updates) => {
    if (isDemo) return;
    setSaving(true);
    
    // Optimistic Update
    setSteps(steps.map(s => s.id === stepId ? { ...s, ...updates } : s));

    try {
      await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${stepId}`, updates);
    } catch (error) {
      console.error('Update failed', error);
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
        const remaining = steps.filter(s => s.id !== stepId);
        setSteps(remaining);
        if (activeStep === stepId) setActiveStep(remaining.length > 0 ? remaining[0].id : null);
    } catch(err) {
        alert(err.message);
    }
  };

  // --- Views ---

  if (loading) {
    return h('div', { className: "flex items-center justify-center h-96" },
      h(Icons.Loader2, { className: "animate-spin text-jaguar-900", size: 48 })
    );
  }

  // Empty State
  if (!selectedCampaign && campaigns.length === 0) {
    return h('div', { className: "flex flex-col items-center justify-center h-96 text-center animate-fade-in" },
      h(Icons.Send, { size: 64, className: "text-stone-300 mb-4" }),
      h('h3', { className: "font-serif text-2xl text-jaguar-900 mb-2" }, 'No Campaigns Yet'),
      h('p', { className: "text-stone-500 mb-6 max-w-md" }, 'Create your first email campaign to start reaching out.'),
      h('div', { className: "flex gap-3" },
        h('button', {
            onClick: () => setShowNewCampaignModal(true),
            className: "px-6 py-3 bg-jaguar-900 text-cream-50 rounded-lg hover:bg-jaguar-800 flex items-center gap-2 text-white"
        }, h(Icons.Plus, { size: 20 }), 'Create Campaign'),
        h('button', {
            onClick: loadDemoMode,
            className: "px-6 py-3 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 flex items-center gap-2 text-stone-600"
        }, h(Icons.Eye, { size: 20 }), 'Preview UI')
      ),
      showNewCampaignModal && h(NewCampaignModal, { onClose: () => setShowNewCampaignModal(false), onCreate: handleCreateCampaign })
    );
  }

  // Builder View
  return h('div', { className: "h-[calc(100vh-120px)] flex flex-col animate-fade-in" },
    // Header
    h('div', { className: "flex justify-between items-start mb-6 pb-6 border-b border-stone-200" },
      h('div', null,
        h('h1', { className: "font-serif text-3xl text-jaguar-900 mb-2" }, selectedCampaign?.name),
        h('div', { className: "flex items-center gap-2 text-sm text-stone-500" },
          h('span', { className: `w-2 h-2 rounded-full ${selectedCampaign?.status === 'running' ? 'bg-green-500' : 'bg-stone-300'}` }),
          h('span', { className: "capitalize" }, selectedCampaign?.status),
          h('span', null, '•'),
          isDemo ? h('span', { className: "text-gold-600" }, "Demo Mode") : h('span', null, "Auto-saved")
        )
      ),
      h('div', { className: "flex gap-3" },
        !isDemo && h('select', {
            className: "px-4 py-2 border border-stone-200 rounded-lg bg-white",
            value: selectedCampaign?.id,
            onChange: e => {
                const c = campaigns.find(x => x.id === e.target.value);
                if(c) handleSelectCampaign(c);
            }
        }, campaigns.map(c => h('option', { key: c.id, value: c.id }, c.name))),
        h('button', { onClick: () => setShowNewCampaignModal(true), className: "p-2 border rounded-lg hover:bg-stone-50" }, h(Icons.Plus, { size: 20 }))
      )
    ),

    // Main Layout
    h('div', { className: "flex gap-6 flex-1 overflow-hidden" },
      // Timeline (Left)
      h('div', { className: "w-1/3 overflow-y-auto pr-2 pb-10 custom-scrollbar" },
        h('div', { className: "relative min-h-[400px]" },
          h('div', { className: "absolute left-6 top-4 bottom-20 w-0.5 bg-stone-200" }),
          
          // CRITICAL FIX: Pass children as an array, DO NOT spread (...)
          h('div', { className: "space-y-6" },
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

          // Add Step Button
          h('div', { className: "relative pl-16 mt-6" },
             h('div', { className: "p-4 border-2 border-dashed border-stone-300 rounded-lg hover:border-jaguar-900 hover:bg-cream-50 transition-colors group cursor-pointer" },
                h('p', { className: "text-center text-stone-500 font-medium mb-3" }, "Add Next Step"),
                h('div', { className: "flex justify-center gap-4" },
                    h('button', { onClick: () => handleAddStep('email'), className: "p-2 bg-white border border-stone-200 rounded hover:text-jaguar-900" }, h(Icons.Mail, { size: 20 })),
                    h('button', { onClick: () => handleAddStep('wait'), className: "p-2 bg-white border border-stone-200 rounded hover:text-jaguar-900" }, h(Icons.Clock, { size: 20 })),
                    h('button', { onClick: () => handleAddStep('condition'), className: "p-2 bg-white border border-stone-200 rounded hover:text-jaguar-900" }, h(Icons.Split, { size: 20 }))
                )
             )
          )
        )
      ),
      
      // Editor (Right)
      h('div', { className: "flex-1 bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden" },
        activeStep && steps.find(s => s.id === activeStep)
            ? h(StepEditor, { 
                step: steps.find(s => s.id === activeStep), 
                onUpdate: handleUpdateStep, 
                saving: saving 
              })
            : h('div', { className: "h-full flex flex-col items-center justify-center text-stone-400" },
                h(Icons.Edit3, { size: 48, className: "opacity-20 mb-4" }),
                h('p', null, "Select a step to edit")
              )
      )
    ),

    showNewCampaignModal && h(NewCampaignModal, { onClose: () => setShowNewCampaignModal(false), onCreate: handleCreateCampaign })
  );
};

// --- Sub-Components ---

const TimelineStep = ({ step, index, isActive, onClick, onDelete }) => {
    // Note: step is guaranteed sanitized here
    const isEmail = step.step_type === 'email';
    const isWait = step.step_type === 'wait';
    const isCondition = step.step_type === 'condition';

    return h('div', { 
        onClick: onClick,
        className: `relative pl-16 group cursor-pointer transition-all ${isActive ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`
    },
        h('div', { className: "absolute left-0 top-0 w-12 h-12 rounded-full border-4 border-[#FDFBF7] bg-white flex items-center justify-center z-10 shadow-sm text-jaguar-900" },
            isEmail && h(Icons.Mail, { size: 20 }),
            isWait && h(Icons.Clock, { size: 20 }),
            isCondition && h(Icons.Split, { size: 20 })
        ),
        h('div', { className: `p-5 rounded-lg border transition-all ${isActive ? 'bg-white border-jaguar-900 ring-1 ring-jaguar-900/20' : 'bg-cream-50 border-stone-200'}` },
            h('div', { className: "flex justify-between items-start mb-2" },
                h('span', { className: "text-xs font-bold uppercase tracking-wider text-stone-400" }, `STEP ${index + 1}`),
                h('button', { onClick: onDelete, className: "text-stone-300 hover:text-red-500" }, h(Icons.Trash2, { size: 14 }))
            ),
            isEmail && h('div', null,
                h('h4', { className: "font-serif font-semibold text-jaguar-900" }, step.subject || 'New Email'),
                h('p', { className: "text-sm text-stone-500 line-clamp-2" }, (step.body || '').substring(0, 50) + '...')
            ),
            isWait && h('h4', { className: "font-semibold text-jaguar-900" }, `Wait ${step.wait_days} Days`),
            isCondition && h('div', null,
                h('span', { className: "text-sm font-semibold text-jaguar-900 block" }, 'Condition:'),
                h('span', { className: "text-sm text-stone-600" }, step.condition_type.replace('if_', 'If ').replace('_', ' '))
            )
        )
    );
};

const StepEditor = ({ step, onUpdate, saving }) => {
    // step is guaranteed sanitized here
    const [data, setData] = React.useState(step);
    React.useEffect(() => { setData(step); }, [step.id]);

    const handleChange = (key, val) => setData({...data, [key]: val});
    const handleBlur = () => onUpdate(step.id, data);

    const insertVar = (variable) => {
        const textarea = document.getElementById('emailBody');
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = data.body;
            const newText = text.substring(0, start) + variable + text.substring(end);
            setData({ ...data, body: newText });
            setTimeout(() => { textarea.focus(); onUpdate(step.id, { ...data, body: newText }); }, 0);
        }
    };

    return h('div', { className: "p-8 h-full overflow-y-auto animate-fade-in" },
        h('div', { className: "flex justify-between items-center mb-6" },
            h('h3', { className: "font-serif text-2xl text-jaguar-900" }, 
                step.step_type === 'email' ? 'Email Content' : 
                step.step_type === 'wait' ? 'Wait Delay' : 'Condition'
            ),
            saving && h('span', { className: "text-xs text-stone-400 flex items-center gap-1" }, h(Icons.Loader2, { size: 12 }), "Saving...")
        ),
        
        step.step_type === 'email' && h('div', { className: "space-y-4" },
            h('div', null,
                h('label', { className: "block text-sm font-medium text-stone-700 mb-1" }, "Subject"),
                h('input', { 
                    className: "w-full px-4 py-2 border border-stone-200 rounded-md",
                    value: data.subject,
                    onChange: e => handleChange('subject', e.target.value),
                    onBlur: handleBlur
                })
            ),
            h('div', null,
                h('div', { className: "flex justify-between items-center mb-2" },
                    h('label', { className: "block text-sm font-medium text-stone-700" }, "Body"),
                    h('div', { className: "flex gap-2" },
                        ['{{first_name}}', '{{company}}'].map(v => h('button', { key: v, onClick: () => insertVar(v), className: "text-xs bg-stone-100 px-2 py-1 rounded" }, v))
                    )
                ),
                h('textarea', { 
                    id: "emailBody",
                    className: "w-full px-4 py-2 border border-stone-200 rounded-md h-64 font-mono text-sm",
                    value: data.body,
                    onChange: e => handleChange('body', e.target.value),
                    onBlur: handleBlur
                })
            )
        ),

        step.step_type === 'wait' && h('div', { className: "text-center py-10" },
            h(Icons.Clock, { size: 48, className: "mx-auto text-gold-600 mb-4" }),
            h('div', { className: "flex items-center justify-center gap-4" },
                h('button', { onClick: () => { const v = Math.max(1, data.wait_days-1); handleChange('wait_days', v); onUpdate(step.id, {wait_days: v}); }, className: "w-10 h-10 border rounded-full" }, "-"),
                h('span', { className: "text-4xl font-serif text-jaguar-900" }, data.wait_days),
                h('button', { onClick: () => { const v = data.wait_days+1; handleChange('wait_days', v); onUpdate(step.id, {wait_days: v}); }, className: "w-10 h-10 border rounded-full" }, "+")
            ),
            h('p', { className: "text-stone-500 mt-2" }, "Days Delay")
        ),

        step.step_type === 'condition' && h('div', { className: "p-6 bg-cream-50 rounded-lg border border-stone-200" },
            h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, "Condition Type"),
            h('select', { 
                className: "w-full px-4 py-2 border border-stone-200 rounded-md bg-white",
                value: data.condition_type,
                onChange: e => { handleChange('condition_type', e.target.value); onUpdate(step.id, {condition_type: e.target.value}); }
            },
                h('option', { value: "if_opened" }, "If Opened"),
                h('option', { value: "if_clicked" }, "If Clicked"),
                h('option', { value: "if_replied" }, "If Replied")
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
        .then(([accs, lists]) => {
            setEmailAccounts(Array.isArray(accs) ? accs : []);
            setContactLists(Array.isArray(lists) ? lists : []);
        })
        .finally(() => setLoading(false));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData);
  };

  return h('div', { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in", onClick: onClose },
    h('div', { className: "bg-white rounded-lg p-8 max-w-md w-full mx-4", onClick: e => e.stopPropagation() },
        h('h3', { className: "font-serif text-2xl text-jaguar-900 mb-6" }, "New Campaign"),
        loading ? h(Icons.Loader2, { className: "animate-spin mx-auto" }) :
        h('form', { onSubmit: handleSubmit, className: "space-y-4" },
            h('div', null,
                h('label', { className: "block text-sm text-stone-700 mb-1" }, "Name"),
                h('input', { required: true, className: "w-full border p-2 rounded", value: formData.name, onChange: e => setFormData({...formData, name: e.target.value}) })
            ),
            h('div', null,
                h('label', { className: "block text-sm text-stone-700 mb-1" }, "Send From"),
                h('select', { required: true, className: "w-full border p-2 rounded bg-white", value: formData.email_account_id, onChange: e => setFormData({...formData, email_account_id: e.target.value}) },
                    h('option', { value: "" }, "Select..."),
                    emailAccounts.map(a => h('option', { key: a.id, value: a.id }, String(a.email_address)))
                )
            ),
            h('div', null,
                h('label', { className: "block text-sm text-stone-700 mb-1" }, "Target List"),
                h('select', { required: true, className: "w-full border p-2 rounded bg-white", value: formData.contact_list_id, onChange: e => setFormData({...formData, contact_list_id: e.target.value}) },
                    h('option', { value: "" }, "Select..."),
                    contactLists.map(l => h('option', { key: l.id, value: l.id }, String(l.name)))
                )
            ),
            h('button', { type: "submit", className: "w-full bg-jaguar-900 text-white p-2 rounded hover:bg-jaguar-800" }, "Create")
        )
    )
  );
};
