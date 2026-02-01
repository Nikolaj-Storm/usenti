// Mr. Snowman - Campaign Builder (n8n-style Visual Workflow)

// --- 1. Data Sanitizers ---

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

  // Parse condition_branches - could be string (from DB) or array
  let branches = [];
  if (s.condition_branches) {
    if (typeof s.condition_branches === 'string') {
      try { branches = JSON.parse(s.condition_branches); } catch(e) { branches = []; }
    } else if (Array.isArray(s.condition_branches)) {
      branches = s.condition_branches;
    }
  }

  return {
    id: String(s.id || Math.random()),
    step_type: String(s.step_type || 'email'),
    step_order: Number(s.step_order || 0),
    subject: String(s.subject || ''),
    body: String(s.body || ''),
    wait_days: Number(s.wait_days || 0),
    wait_hours: Number(s.wait_hours || 0),
    wait_minutes: Number(s.wait_minutes || 0),
    condition_type: String(s.condition_type || 'if_opened'),
    condition_branches: branches,
    // For branch support: which branch this step belongs to (null = main flow)
    parent_branch_id: s.parent_branch_id || null,
    branch_index: s.branch_index !== undefined ? Number(s.branch_index) : null
  };
};

// --- 2. Constants ---

const CONDITION_OPTIONS = [
  { value: 'if_opened', label: 'If Opened', color: 'bg-blue-500' },
  { value: 'if_not_opened', label: 'If NOT Opened', color: 'bg-orange-500' },
  { value: 'if_clicked', label: 'If Clicked', color: 'bg-green-500' },
  { value: 'if_not_clicked', label: 'If NOT Clicked', color: 'bg-red-500' },
  { value: 'if_replied', label: 'If Replied', color: 'bg-purple-500' },
  { value: 'if_not_replied', label: 'If NOT Replied', color: 'bg-pink-500' }
];

const BRANCH_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-400', accent: 'bg-blue-500', text: 'text-blue-700' },
  { bg: 'bg-green-100', border: 'border-green-400', accent: 'bg-green-500', text: 'text-green-700' },
  { bg: 'bg-orange-100', border: 'border-orange-400', accent: 'bg-orange-500', text: 'text-orange-700' },
  { bg: 'bg-purple-100', border: 'border-purple-400', accent: 'bg-purple-500', text: 'text-purple-700' },
  { bg: 'bg-pink-100', border: 'border-pink-400', accent: 'bg-pink-500', text: 'text-pink-700' },
  { bg: 'bg-teal-100', border: 'border-teal-400', accent: 'bg-teal-500', text: 'text-teal-700' }
];

const formatConditionLabel = (condition) => {
  const opt = CONDITION_OPTIONS.find(o => o.value === condition);
  return opt ? opt.label : condition;
};

const formatWaitDuration = (step) => {
  const parts = [];
  if (step.wait_days > 0) parts.push(`${step.wait_days}d`);
  if (step.wait_hours > 0) parts.push(`${step.wait_hours}h`);
  if (step.wait_minutes > 0) parts.push(`${step.wait_minutes}m`);
  return parts.length > 0 ? parts.join(' ') : '1h';
};

// --- 3. Main Component ---

const CampaignBuilder = () => {
  const [campaigns, setCampaigns] = React.useState([]);
  const [selectedCampaign, setSelectedCampaign] = React.useState(null);
  const [steps, setSteps] = React.useState([]);
  const [activeStep, setActiveStep] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [showNewCampaignModal, setShowNewCampaignModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [isDemo, setIsDemo] = React.useState(false);
  const [stats, setStats] = React.useState(null);
  const [loadingStats, setLoadingStats] = React.useState(false);

  React.useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const data = await api.getCampaigns();
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
    setSelectedCampaign(campaign);
    setLoading(true);
    setIsDemo(false);
    setStats(null);
    try {
      const data = await api.get(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${campaign.id}/steps`);
      const rawSteps = Array.isArray(data) ? data : [];
      const cleanSteps = rawSteps.map(sanitizeStep).filter(Boolean);
      setSteps(cleanSteps);
      if (cleanSteps.length > 0) setActiveStep(cleanSteps[0].id);
      else setActiveStep(null);
      loadCampaignStats(campaign.id);
    } catch (error) {
      console.error('Failed to load steps:', error);
      setSteps([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignStats = async (campaignId) => {
    setLoadingStats(true);
    try {
      const data = await api.getCampaignStats(campaignId);
      setStats(data);
    } catch (error) {
      console.error('Failed to load campaign stats:', error);
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (isDemo || !selectedCampaign) return;
    if (!confirm(`Delete campaign "${selectedCampaign.name}"? This action cannot be undone.`)) return;

    try {
      await api.deleteCampaign(selectedCampaign.id);
      const remaining = campaigns.filter(c => c.id !== selectedCampaign.id);
      setCampaigns(remaining);
      if (remaining.length > 0) {
        handleSelectCampaign(remaining[0]);
      } else {
        setSelectedCampaign(null);
        setSteps([]);
        setStats(null);
      }
      alert('Campaign deleted successfully');
    } catch (error) {
      alert('Error deleting campaign: ' + error.message);
    }
  };

  const loadDemoMode = () => {
    const demoCampaign = sanitizeCampaign({ id: 'demo', name: 'Demo Campaign (Visual)', status: 'draft' });
    const demoSteps = [
      { id: 's1', step_type: 'email', subject: 'Initial Outreach', body: 'Hi {{first_name}}, I wanted to reach out about...', step_order: 1 },
      { id: 's2', step_type: 'wait', wait_days: 2, wait_hours: 0, wait_minutes: 0, step_order: 2 },
      {
        id: 's3',
        step_type: 'condition',
        step_order: 3,
        condition_branches: [
          { condition: 'if_opened', next_step_id: null, branch_steps: [
            { id: 'b1s1', step_type: 'email', subject: 'Thanks for opening!', body: 'Since you showed interest...', step_order: 1, parent_branch_id: 's3', branch_index: 0 },
            { id: 'b1s2', step_type: 'wait', wait_days: 1, wait_hours: 0, wait_minutes: 0, step_order: 2, parent_branch_id: 's3', branch_index: 0 }
          ]},
          { condition: 'if_not_opened', next_step_id: null, branch_steps: [
            { id: 'b2s1', step_type: 'email', subject: 'Did you miss my email?', body: 'Just wanted to follow up...', step_order: 1, parent_branch_id: 's3', branch_index: 1 }
          ]}
        ]
      }
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

  const handleStartCampaign = async () => {
    if (isDemo || !selectedCampaign) return;
    if (!confirm('Start this campaign? Emails will be sent to all contacts in the selected list.')) return;

    try {
      await api.startCampaign(selectedCampaign.id);
      const updatedCampaign = { ...selectedCampaign, status: 'running' };
      setSelectedCampaign(updatedCampaign);
      setCampaigns(campaigns.map(c => c.id === selectedCampaign.id ? updatedCampaign : c));
      alert('Campaign started successfully!');
    } catch (error) {
      alert('Error starting campaign: ' + error.message);
    }
  };

  const handlePauseCampaign = async () => {
    if (isDemo || !selectedCampaign) return;
    try {
      await api.post(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/pause`);
      const updatedCampaign = { ...selectedCampaign, status: 'paused' };
      setSelectedCampaign(updatedCampaign);
      setCampaigns(campaigns.map(c => c.id === selectedCampaign.id ? updatedCampaign : c));
      alert('Campaign paused successfully!');
    } catch (error) {
      alert('Error pausing campaign: ' + error.message);
    }
  };

  // Add step to main flow or to a specific branch
  const handleAddStep = async (stepType, parentBranchId = null, branchIndex = null) => {
    if (isDemo || !selectedCampaign) {
      // Demo mode: add locally
      if (parentBranchId !== null && branchIndex !== null) {
        // Adding to a branch
        setSteps(prevSteps => {
          return prevSteps.map(step => {
            if (step.id === parentBranchId && step.step_type === 'condition') {
              const newBranches = [...step.condition_branches];
              const branch = newBranches[branchIndex];
              const branchSteps = branch.branch_steps || [];
              const newStep = {
                id: 'temp-' + Date.now(),
                step_type: stepType,
                step_order: branchSteps.length + 1,
                subject: stepType === 'email' ? 'New Email' : '',
                body: '',
                wait_days: 0,
                wait_hours: stepType === 'wait' ? 1 : 0,
                wait_minutes: 0,
                condition_type: 'if_opened',
                condition_branches: stepType === 'condition' ? [{ condition: 'if_opened', branch_steps: [] }] : [],
                parent_branch_id: parentBranchId,
                branch_index: branchIndex
              };
              newBranches[branchIndex] = { ...branch, branch_steps: [...branchSteps, newStep] };
              return { ...step, condition_branches: newBranches };
            }
            return step;
          });
        });
        return;
      }

      // Adding to main flow
      const newStep = sanitizeStep({
        id: 'temp-' + Date.now(),
        step_type: stepType,
        step_order: steps.length + 1,
        subject: stepType === 'email' ? 'New Email' : '',
        body: '',
        wait_days: 0,
        wait_hours: stepType === 'wait' ? 1 : 0,
        wait_minutes: 0,
        condition_branches: stepType === 'condition' ? [{ condition: 'if_opened', branch_steps: [] }, { condition: 'if_not_opened', branch_steps: [] }] : []
      });
      setSteps([...steps, newStep]);
      setActiveStep(newStep.id);
      return;
    }

    // Real mode: API call
    const tempId = 'temp-' + Date.now();
    const newStepRaw = {
      id: tempId,
      step_type: stepType,
      step_order: steps.length + 1,
      subject: stepType === 'email' ? 'New Email' : '',
      body: '',
      wait_days: 0,
      wait_hours: stepType === 'wait' ? 1 : 0,
      wait_minutes: 0,
      condition_type: 'if_opened',
      condition_branches: stepType === 'condition' ? [
        { condition: 'if_opened', branch_steps: [] },
        { condition: 'if_not_opened', branch_steps: [] }
      ] : [],
      parent_branch_id: parentBranchId,
      branch_index: branchIndex
    };

    const cleanStep = sanitizeStep(newStepRaw);
    setSteps([...steps, cleanStep]);
    setActiveStep(tempId);

    try {
      const serverStep = await api.post(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps`, newStepRaw);
      const realStep = sanitizeStep(serverStep);
      setSteps(prev => prev.map(s => s.id === tempId ? realStep : s));
      setActiveStep(realStep.id);
    } catch(e) {
      console.error(e);
      setSteps(prev => prev.filter(s => s.id !== tempId));
    }
  };

  const handleUpdateStep = async (stepId, updates, parentBranchId = null, branchIndex = null) => {
    setSaving(true);

    if (parentBranchId !== null && branchIndex !== null) {
      // Updating a step inside a branch
      setSteps(prevSteps => {
        return prevSteps.map(step => {
          if (step.id === parentBranchId && step.step_type === 'condition') {
            const newBranches = [...step.condition_branches];
            const branch = newBranches[branchIndex];
            const branchSteps = (branch.branch_steps || []).map(bs =>
              bs.id === stepId ? { ...bs, ...updates } : bs
            );
            newBranches[branchIndex] = { ...branch, branch_steps: branchSteps };
            return { ...step, condition_branches: newBranches };
          }
          return step;
        });
      });
    } else {
      // Updating a main flow step
      setSteps(steps.map(s => s.id === stepId ? { ...s, ...updates } : s));
    }

    if (!isDemo) {
      try {
        await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${stepId}`, updates);
      } catch (error) {
        console.error('Update failed', error);
      }
    }

    setTimeout(() => setSaving(false), 500);
  };

  const handleDeleteStep = async (stepId, e, parentBranchId = null, branchIndex = null) => {
    if (e) e.stopPropagation();

    if (parentBranchId !== null && branchIndex !== null) {
      // Deleting from a branch
      setSteps(prevSteps => {
        return prevSteps.map(step => {
          if (step.id === parentBranchId && step.step_type === 'condition') {
            const newBranches = [...step.condition_branches];
            const branch = newBranches[branchIndex];
            const branchSteps = (branch.branch_steps || []).filter(bs => bs.id !== stepId);
            newBranches[branchIndex] = { ...branch, branch_steps: branchSteps };
            return { ...step, condition_branches: newBranches };
          }
          return step;
        });
      });
      return;
    }

    if (!isDemo && !confirm('Delete this step?')) return;

    if (isDemo) {
      setSteps(steps.filter(s => s.id !== stepId));
      if (activeStep === stepId) {
        const remaining = steps.filter(s => s.id !== stepId);
        setActiveStep(remaining.length > 0 ? remaining[0].id : null);
      }
      return;
    }

    try {
      await api.delete(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${stepId}`);
      const remaining = steps.filter(s => s.id !== stepId);
      setSteps(remaining);
      if (activeStep === stepId) setActiveStep(remaining.length > 0 ? remaining[0].id : null);
    } catch(err) {
      alert(err.message);
    }
  };

  // Add a new branch to a condition step
  const handleAddBranch = (conditionStepId) => {
    setSteps(prevSteps => {
      return prevSteps.map(step => {
        if (step.id === conditionStepId && step.step_type === 'condition') {
          const usedConditions = step.condition_branches.map(b => b.condition);
          const available = CONDITION_OPTIONS.find(opt => !usedConditions.includes(opt.value));
          if (available) {
            return {
              ...step,
              condition_branches: [...step.condition_branches, { condition: available.value, branch_steps: [] }]
            };
          }
        }
        return step;
      });
    });
  };

  // Remove a branch from a condition step
  const handleRemoveBranch = (conditionStepId, branchIndex) => {
    setSteps(prevSteps => {
      return prevSteps.map(step => {
        if (step.id === conditionStepId && step.step_type === 'condition') {
          if (step.condition_branches.length > 1) {
            const newBranches = step.condition_branches.filter((_, i) => i !== branchIndex);
            return { ...step, condition_branches: newBranches };
          }
        }
        return step;
      });
    });
  };

  // Update branch condition
  const handleUpdateBranchCondition = (conditionStepId, branchIndex, newCondition) => {
    setSteps(prevSteps => {
      return prevSteps.map(step => {
        if (step.id === conditionStepId && step.step_type === 'condition') {
          const newBranches = [...step.condition_branches];
          newBranches[branchIndex] = { ...newBranches[branchIndex], condition: newCondition };
          return { ...step, condition_branches: newBranches };
        }
        return step;
      });
    });
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
      ),
      showNewCampaignModal && h(NewCampaignModal, { onClose: () => setShowNewCampaignModal(false), onCreate: handleCreateCampaign })
    );
  }

  // Get the active step data (could be in main flow or in a branch)
  const getActiveStepData = () => {
    // Check main flow
    const mainStep = steps.find(s => s.id === activeStep);
    if (mainStep) return { step: mainStep, parentBranchId: null, branchIndex: null };

    // Check branches
    for (const step of steps) {
      if (step.step_type === 'condition' && step.condition_branches) {
        for (let bi = 0; bi < step.condition_branches.length; bi++) {
          const branch = step.condition_branches[bi];
          if (branch.branch_steps) {
            const branchStep = branch.branch_steps.find(bs => bs.id === activeStep);
            if (branchStep) return { step: branchStep, parentBranchId: step.id, branchIndex: bi };
          }
        }
      }
    }
    return null;
  };

  const activeStepData = getActiveStepData();

  // Helper to get email accounts display for a campaign
  const getCampaignEmailAccounts = (campaign) => {
    if (!campaign) return [];
    // Check for multi-account setup first
    if (campaign.campaign_email_accounts && campaign.campaign_email_accounts.length > 0) {
      return campaign.campaign_email_accounts
        .filter(cea => cea.is_active && cea.email_accounts)
        .map(cea => cea.email_accounts.email_address);
    }
    // Fall back to legacy single account
    if (campaign.email_accounts?.email_address) {
      return [campaign.email_accounts.email_address];
    }
    return [];
  };

  const campaignEmails = getCampaignEmailAccounts(selectedCampaign);

  // Builder View
  return h('div', { className: "h-[calc(100vh-120px)] flex flex-col animate-fade-in" },
    // Header
    h('div', { className: "flex justify-between items-start mb-4 pb-4 border-b border-stone-200" },
      h('div', null,
        h('h1', { className: "font-serif text-3xl text-jaguar-900 mb-2" }, selectedCampaign?.name),
        h('div', { className: "flex items-center gap-2 text-sm text-stone-500" },
          h('span', { className: `w-2 h-2 rounded-full ${selectedCampaign?.status === 'running' ? 'bg-green-500 animate-pulse' : selectedCampaign?.status === 'paused' ? 'bg-yellow-500' : 'bg-stone-300'}` }),
          h('span', { className: "capitalize" }, selectedCampaign?.status),
          h('span', null, '•'),
          isDemo ? h('span', { className: "text-gold-600" }, "Demo Mode") : h('span', null, "Auto-saved")
        ),
        // Display email accounts
        !isDemo && campaignEmails.length > 0 && h('div', { className: "flex items-center gap-2 mt-2 text-xs text-stone-500" },
          h(Icons.Mail, { size: 14 }),
          campaignEmails.length === 1
            ? h('span', null, campaignEmails[0])
            : h('span', { title: campaignEmails.join('\n') },
                `${campaignEmails.length} accounts (rotation enabled)`
              )
        )
      ),
      h('div', { className: "flex gap-3" },
        !isDemo && selectedCampaign && h('button', {
          onClick: handleDeleteCampaign,
          className: "p-2 border border-red-200 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-700",
          title: "Delete Campaign"
        }, h(Icons.Trash2, { size: 20 })),
        !isDemo && selectedCampaign && (
          selectedCampaign.status === 'running'
            ? h('button', {
                onClick: handlePauseCampaign,
                className: "px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2"
              }, h(Icons.Pause, { size: 16 }), 'Pause Campaign')
            : h('button', {
                onClick: handleStartCampaign,
                className: "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              }, h(Icons.Play, { size: 16 }), selectedCampaign.status === 'paused' ? 'Resume Campaign' : 'Start Campaign')
        ),
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

    // Stats Bar
    !isDemo && stats && h('div', { className: "flex gap-4 mb-4 p-4 bg-cream-50 rounded-lg border border-stone-200" },
      h(StatCard, { label: "Contacts", value: stats.total_contacts, icon: Icons.Users }),
      h(StatCard, { label: "Sent", value: stats.sent_count, icon: Icons.Send }),
      h(StatCard, { label: "Opened", value: stats.opened_count, rate: stats.open_rate, icon: Icons.Eye }),
      h(StatCard, { label: "Clicked", value: stats.clicked_count, rate: stats.click_rate, icon: Icons.MousePointer2 }),
      h(StatCard, { label: "Replied", value: stats.replied_count, rate: stats.reply_rate, icon: Icons.Reply })
    ),

    !isDemo && loadingStats && !stats && h('div', { className: "flex items-center gap-2 mb-4 p-4 bg-cream-50 rounded-lg border border-stone-200 text-stone-500" },
      h(Icons.Loader2, { size: 16, className: "animate-spin" }),
      h('span', { className: "text-sm" }, "Loading campaign stats...")
    ),

    // Main Layout - Visual Workflow Canvas + Editor
    h('div', { className: "flex gap-6 flex-1 overflow-hidden" },
      // Workflow Canvas (Left)
      h('div', { className: "w-2/3 overflow-auto pr-2 pb-10 custom-scrollbar bg-stone-50 rounded-lg border border-stone-200" },
        h(WorkflowCanvas, {
          steps,
          activeStep,
          setActiveStep,
          onAddStep: handleAddStep,
          onDeleteStep: handleDeleteStep,
          onAddBranch: handleAddBranch,
          onRemoveBranch: handleRemoveBranch,
          onUpdateBranchCondition: handleUpdateBranchCondition
        })
      ),

      // Editor (Right)
      h('div', { className: "w-1/3 bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden" },
        activeStepData
          ? h(StepEditor, {
              step: activeStepData.step,
              onUpdate: (stepId, updates) => handleUpdateStep(stepId, updates, activeStepData.parentBranchId, activeStepData.branchIndex),
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

// --- 4. Workflow Canvas Component (n8n-style) ---

const WorkflowCanvas = ({ steps, activeStep, setActiveStep, onAddStep, onDeleteStep, onAddBranch, onRemoveBranch, onUpdateBranchCondition }) => {

  // Start node
  const StartNode = () => h('div', { className: "flex flex-col items-center" },
    h('div', { className: "w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg" },
      h(Icons.Play, { size: 24, className: "text-white" })
    ),
    h('span', { className: "mt-2 text-xs font-semibold text-stone-600" }, "START")
  );

  // Connector line
  const Connector = ({ vertical = true, length = 40 }) => h('div', {
    className: `${vertical ? 'w-0.5 bg-stone-300' : 'h-0.5 bg-stone-300'}`,
    style: vertical ? { height: length } : { width: length }
  });

  // Add step button (inline)
  const AddStepInline = ({ onAdd, small = false }) => h('div', { className: "flex flex-col items-center" },
    h(Connector, { length: 20 }),
    h('div', { className: `flex gap-2 p-2 bg-white border-2 border-dashed border-stone-300 rounded-lg hover:border-jaguar-900 transition-colors ${small ? 'scale-90' : ''}` },
      h('button', {
        onClick: () => onAdd('email'),
        className: "p-2 hover:bg-cream-50 rounded transition-colors",
        title: "Add Email"
      }, h(Icons.Mail, { size: small ? 16 : 18, className: "text-stone-500 hover:text-jaguar-900" })),
      h('button', {
        onClick: () => onAdd('wait'),
        className: "p-2 hover:bg-cream-50 rounded transition-colors",
        title: "Add Wait"
      }, h(Icons.Clock, { size: small ? 16 : 18, className: "text-stone-500 hover:text-jaguar-900" })),
      h('button', {
        onClick: () => onAdd('condition'),
        className: "p-2 hover:bg-cream-50 rounded transition-colors",
        title: "Add Condition"
      }, h(Icons.Split, { size: small ? 16 : 18, className: "text-stone-500 hover:text-jaguar-900" }))
    ),
    h(Connector, { length: 20 })
  );

  // Render a step node
  const StepNode = ({ step, isActive, onClick, onDelete, index }) => {
    const isEmail = step.step_type === 'email';
    const isWait = step.step_type === 'wait';
    const isCondition = step.step_type === 'condition';

    return h('div', {
      onClick,
      className: `relative cursor-pointer transition-all ${isActive ? 'scale-105' : 'hover:scale-102'}`
    },
      h('div', {
        className: `relative min-w-[200px] p-4 rounded-xl border-2 shadow-md transition-all
          ${isActive ? 'border-jaguar-900 bg-white ring-2 ring-jaguar-900/20' : 'border-stone-200 bg-white hover:border-stone-300'}
          ${isCondition ? 'bg-gradient-to-br from-gold-50 to-amber-50' : ''}
        `
      },
        // Step type icon badge
        h('div', {
          className: `absolute -top-3 -left-3 w-10 h-10 rounded-full flex items-center justify-center shadow-md
            ${isEmail ? 'bg-blue-500' : isWait ? 'bg-purple-500' : 'bg-gold-500'}
          `
        },
          isEmail && h(Icons.Mail, { size: 18, className: "text-white" }),
          isWait && h(Icons.Clock, { size: 18, className: "text-white" }),
          isCondition && h(Icons.Split, { size: 18, className: "text-white" })
        ),

        // Delete button
        h('button', {
          onClick: (e) => { e.stopPropagation(); onDelete(e); },
          className: "absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity shadow"
        }, h(Icons.X, { size: 12 })),

        // Content
        h('div', { className: "pt-2" },
          h('span', { className: "text-xs font-bold uppercase tracking-wider text-stone-400" },
            `Step ${index + 1}`
          ),

          isEmail && h('div', { className: "mt-1" },
            h('h4', { className: "font-semibold text-jaguar-900 truncate max-w-[180px]" }, step.subject || 'New Email'),
            h('p', { className: "text-xs text-stone-500 truncate max-w-[180px]" }, (step.body || '').substring(0, 40) + '...')
          ),

          isWait && h('div', { className: "mt-1" },
            h('h4', { className: "font-semibold text-jaguar-900" }, `Wait ${formatWaitDuration(step)}`),
            h('p', { className: "text-xs text-stone-500" }, 'Delay before next step')
          ),

          isCondition && h('div', { className: "mt-1" },
            h('h4', { className: "font-semibold text-jaguar-900 flex items-center gap-1" },
              h(Icons.Split, { size: 14 }),
              'Condition'
            ),
            h('p', { className: "text-xs text-stone-500" }, `${step.condition_branches?.length || 0} branches`)
          )
        )
      )
    );
  };

  // Render condition branches
  const ConditionBranches = ({ step, activeStep, setActiveStep, onAddStep, onDeleteStep, onAddBranch, onRemoveBranch, onUpdateBranchCondition }) => {
    const branches = step.condition_branches || [];

    return h('div', { className: "mt-4" },
      // Branch container
      h('div', { className: "flex gap-6 justify-center" },
        branches.map((branch, branchIndex) => {
          const color = BRANCH_COLORS[branchIndex % BRANCH_COLORS.length];
          const branchSteps = branch.branch_steps || [];

          return h('div', {
            key: branchIndex,
            className: `flex flex-col items-center min-w-[220px] relative`
          },
            // Branch header with condition selector
            h('div', { className: `flex items-center gap-2 mb-2` },
              // Color indicator
              h('div', { className: `w-3 h-3 rounded-full ${color.accent}` }),

              // Condition dropdown
              h('select', {
                className: `text-sm px-2 py-1 rounded border ${color.border} ${color.bg} ${color.text} font-medium`,
                value: branch.condition,
                onChange: (e) => onUpdateBranchCondition(step.id, branchIndex, e.target.value),
                onClick: (e) => e.stopPropagation()
              },
                CONDITION_OPTIONS.map(opt =>
                  h('option', { key: opt.value, value: opt.value }, opt.label)
                )
              ),

              // Remove branch button
              branches.length > 1 && h('button', {
                onClick: (e) => { e.stopPropagation(); onRemoveBranch(step.id, branchIndex); },
                className: "p-1 text-stone-400 hover:text-red-500 transition-colors",
                title: "Remove branch"
              }, h(Icons.X, { size: 14 }))
            ),

            // Connector from condition
            h('div', { className: `w-0.5 h-8 ${color.accent}` }),

            // Branch container
            h('div', { className: `p-3 rounded-lg border-2 ${color.border} ${color.bg} min-h-[100px]` },
              // Branch steps
              branchSteps.length > 0 ? h('div', { className: "space-y-3" },
                branchSteps.map((branchStep, bsIndex) =>
                  h('div', { key: branchStep.id, className: "flex flex-col items-center" },
                    h(BranchStepNode, {
                      step: branchStep,
                      isActive: activeStep === branchStep.id,
                      onClick: () => setActiveStep(branchStep.id),
                      onDelete: (e) => onDeleteStep(branchStep.id, e, step.id, branchIndex),
                      color
                    }),
                    bsIndex < branchSteps.length - 1 && h('div', { className: `w-0.5 h-4 ${color.accent} opacity-50` })
                  )
                )
              ) : h('div', { className: "text-xs text-stone-500 text-center py-4" },
                  'No steps yet'
                ),

              // Add step to branch button
              h('div', { className: "mt-3 flex justify-center" },
                h('div', { className: "flex gap-1 p-1 bg-white/50 rounded border border-dashed border-stone-300" },
                  h('button', {
                    onClick: (e) => { e.stopPropagation(); onAddStep('email', step.id, branchIndex); },
                    className: "p-1.5 hover:bg-white rounded",
                    title: "Add Email"
                  }, h(Icons.Mail, { size: 14, className: "text-stone-500" })),
                  h('button', {
                    onClick: (e) => { e.stopPropagation(); onAddStep('wait', step.id, branchIndex); },
                    className: "p-1.5 hover:bg-white rounded",
                    title: "Add Wait"
                  }, h(Icons.Clock, { size: 14, className: "text-stone-500" }))
                )
              )
            )
          );
        }),

        // Add branch button
        branches.length < CONDITION_OPTIONS.length && h('div', { className: "flex flex-col items-center justify-center" },
          h('button', {
            onClick: (e) => { e.stopPropagation(); onAddBranch(step.id); },
            className: "w-12 h-12 rounded-full border-2 border-dashed border-stone-300 flex items-center justify-center hover:border-jaguar-900 hover:bg-cream-50 transition-colors",
            title: "Add another branch"
          }, h(Icons.Plus, { size: 20, className: "text-stone-400" }))
        )
      )
    );
  };

  // Branch step node (smaller version)
  const BranchStepNode = ({ step, isActive, onClick, onDelete, color }) => {
    const isEmail = step.step_type === 'email';
    const isWait = step.step_type === 'wait';

    return h('div', {
      onClick,
      className: `relative cursor-pointer transition-all group ${isActive ? 'scale-105' : 'hover:scale-102'}`
    },
      h('div', {
        className: `relative p-3 rounded-lg border shadow-sm transition-all bg-white
          ${isActive ? `border-jaguar-900 ring-1 ring-jaguar-900/20` : `border-stone-200 hover:border-stone-300`}
        `
      },
        // Icon badge
        h('div', {
          className: `absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center shadow
            ${isEmail ? 'bg-blue-500' : 'bg-purple-500'}
          `
        },
          isEmail && h(Icons.Mail, { size: 12, className: "text-white" }),
          isWait && h(Icons.Clock, { size: 12, className: "text-white" })
        ),

        // Delete button
        h('button', {
          onClick: (e) => { e.stopPropagation(); onDelete(e); },
          className: "absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity shadow"
        }, h(Icons.X, { size: 10 })),

        // Content
        isEmail && h('div', null,
          h('span', { className: "text-xs font-semibold text-jaguar-900 block truncate max-w-[150px]" },
            step.subject || 'New Email'
          )
        ),

        isWait && h('span', { className: "text-xs font-semibold text-jaguar-900" },
          `Wait ${formatWaitDuration(step)}`
        )
      )
    );
  };

  // Main render
  return h('div', { className: "p-8 min-h-full" },
    h('div', { className: "flex flex-col items-center" },
      // Start node
      h(StartNode),

      // Main flow
      steps.length === 0
        ? h(AddStepInline, { onAdd: (type) => onAddStep(type) })
        : h('div', { className: "flex flex-col items-center" },
            steps.map((step, index) =>
              h('div', { key: step.id, className: "flex flex-col items-center group" },
                // Connector
                h(Connector, { length: 30 }),

                // Step node
                h(StepNode, {
                  step,
                  index,
                  isActive: activeStep === step.id,
                  onClick: () => setActiveStep(step.id),
                  onDelete: (e) => onDeleteStep(step.id, e)
                }),

                // If condition, show branches
                step.step_type === 'condition' && h(ConditionBranches, {
                  step,
                  activeStep,
                  setActiveStep,
                  onAddStep,
                  onDeleteStep,
                  onAddBranch,
                  onRemoveBranch,
                  onUpdateBranchCondition
                }),

                // Add step button after each step (except last one shows always)
                index === steps.length - 1 && h(AddStepInline, { onAdd: (type) => onAddStep(type) })
              )
            )
          ),

      // End node
      h('div', { className: "flex flex-col items-center mt-4" },
        h(Connector, { length: 30 }),
        h('div', { className: "w-12 h-12 rounded-full bg-stone-400 flex items-center justify-center shadow" },
          h(Icons.Check, { size: 18, className: "text-white" })
        ),
        h('span', { className: "mt-2 text-xs font-semibold text-stone-500" }, "END")
      )
    )
  );
};

// --- 5. Sub-Components ---

const StatCard = ({ label, value, rate, icon: IconComponent }) => {
  return h('div', { className: "flex-1 flex items-center gap-3" },
    h('div', { className: "p-2 bg-white rounded-lg border border-stone-200" },
      h(IconComponent, { size: 18, className: "text-jaguar-900" })
    ),
    h('div', null,
      h('div', { className: "flex items-baseline gap-1" },
        h('span', { className: "text-xl font-semibold text-jaguar-900" }, value || 0),
        rate !== undefined && rate > 0 && h('span', { className: "text-xs text-stone-500" }, `(${rate}%)`)
      ),
      h('span', { className: "text-xs text-stone-500" }, label)
    )
  );
};

const StepEditor = ({ step, onUpdate, saving }) => {
  const [data, setData] = React.useState(step);
  React.useEffect(() => { setData(step); }, [step.id]);

  const handleChange = (key, val) => setData({...data, [key]: val});
  const handleBlur = () => onUpdate(step.id, data);

  const personalizationVars = [
    { var: '{{first_name}}', label: 'First Name' },
    { var: '{{last_name}}', label: 'Last Name' },
    { var: '{{email}}', label: 'Email' },
    { var: '{{company}}', label: 'Company' },
    { var: '{{unsubscribe_link}}', label: 'Unsubscribe' }
  ];

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

  return h('div', { className: "p-6 h-full overflow-y-auto animate-fade-in" },
    h('div', { className: "flex justify-between items-center mb-4" },
      h('h3', { className: "font-serif text-xl text-jaguar-900" },
        step.step_type === 'email' ? 'Email Content' :
        step.step_type === 'wait' ? 'Wait Delay' : 'Condition Settings'
      ),
      saving && h('span', { className: "text-xs text-stone-400 flex items-center gap-1" },
        h(Icons.Loader2, { size: 12, className: "animate-spin" }), "Saving..."
      )
    ),

    step.step_type === 'email' && h('div', { className: "space-y-4" },
      h('div', null,
        h('label', { className: "block text-sm font-medium text-stone-700 mb-1" }, "Subject"),
        h('input', {
          className: "w-full px-3 py-2 border border-stone-200 rounded-md text-sm",
          value: data.subject,
          onChange: e => handleChange('subject', e.target.value),
          onBlur: handleBlur,
          placeholder: "Email subject line..."
        })
      ),
      h('div', null,
        h('div', { className: "flex justify-between items-center mb-1" },
          h('label', { className: "block text-sm font-medium text-stone-700" }, "Body"),
          h('div', { className: "flex flex-wrap gap-1" },
            personalizationVars.map(v => h('button', {
              key: v.var,
              onClick: () => insertVar(v.var),
              className: "text-xs bg-stone-100 px-1.5 py-0.5 rounded hover:bg-jaguar-900 hover:text-white transition-colors"
            }, v.var))
          )
        ),
        h('textarea', {
          id: "emailBody",
          className: "w-full px-3 py-2 border border-stone-200 rounded-md h-48 font-mono text-sm",
          value: data.body,
          onChange: e => handleChange('body', e.target.value),
          onBlur: handleBlur,
          placeholder: "Write your email here..."
        })
      )
    ),

    step.step_type === 'wait' && h(WaitStepEditor, { data, handleChange, onUpdate, step }),

    step.step_type === 'condition' && h('div', { className: "space-y-4" },
      h('div', { className: "p-4 bg-amber-50 rounded-lg border border-amber-200" },
        h('div', { className: "flex items-center gap-2 mb-2" },
          h(Icons.Split, { size: 20, className: "text-amber-600" }),
          h('span', { className: "font-semibold text-amber-900" }, "Condition Branches")
        ),
        h('p', { className: "text-sm text-amber-700" },
          "Each branch evaluates a condition. The first matching condition determines the path. Add steps to each branch in the canvas view."
        )
      ),
      h('div', { className: "text-sm text-stone-600" },
        h('p', null, `This condition has ${step.condition_branches?.length || 0} branches configured.`),
        h('p', { className: "mt-2 text-stone-500" },
          "Use the canvas on the left to add/remove branches and manage steps within each branch."
        )
      )
    )
  );
};

const WaitStepEditor = ({ data, handleChange, onUpdate, step }) => {
  const updateWait = (field, value) => {
    const v = Math.max(0, parseInt(value) || 0);
    handleChange(field, v);
    onUpdate(step.id, { [field]: v });
  };

  return h('div', { className: "text-center py-4" },
    h(Icons.Clock, { size: 40, className: "mx-auto text-purple-500 mb-4" }),
    h('div', { className: "flex justify-center gap-4" },
      // Days
      h('div', { className: "flex flex-col items-center" },
        h('div', { className: "flex items-center gap-1" },
          h('button', {
            onClick: () => updateWait('wait_days', (data.wait_days || 0) - 1),
            className: "w-7 h-7 border rounded-full hover:bg-stone-100 text-sm"
          }, "-"),
          h('input', {
            type: "number",
            min: "0",
            value: data.wait_days || 0,
            onChange: e => updateWait('wait_days', e.target.value),
            className: "w-12 text-center text-lg font-semibold border-b border-stone-300 outline-none"
          }),
          h('button', {
            onClick: () => updateWait('wait_days', (data.wait_days || 0) + 1),
            className: "w-7 h-7 border rounded-full hover:bg-stone-100 text-sm"
          }, "+")
        ),
        h('span', { className: "text-xs text-stone-500 mt-1" }, "Days")
      ),
      // Hours
      h('div', { className: "flex flex-col items-center" },
        h('div', { className: "flex items-center gap-1" },
          h('button', {
            onClick: () => updateWait('wait_hours', (data.wait_hours || 0) - 1),
            className: "w-7 h-7 border rounded-full hover:bg-stone-100 text-sm"
          }, "-"),
          h('input', {
            type: "number",
            min: "0",
            max: "23",
            value: data.wait_hours || 0,
            onChange: e => updateWait('wait_hours', Math.min(23, e.target.value)),
            className: "w-12 text-center text-lg font-semibold border-b border-stone-300 outline-none"
          }),
          h('button', {
            onClick: () => updateWait('wait_hours', Math.min(23, (data.wait_hours || 0) + 1)),
            className: "w-7 h-7 border rounded-full hover:bg-stone-100 text-sm"
          }, "+")
        ),
        h('span', { className: "text-xs text-stone-500 mt-1" }, "Hours")
      ),
      // Minutes
      h('div', { className: "flex flex-col items-center" },
        h('div', { className: "flex items-center gap-1" },
          h('button', {
            onClick: () => updateWait('wait_minutes', (data.wait_minutes || 0) - 5),
            className: "w-7 h-7 border rounded-full hover:bg-stone-100 text-sm"
          }, "-"),
          h('input', {
            type: "number",
            min: "0",
            max: "59",
            value: data.wait_minutes || 0,
            onChange: e => updateWait('wait_minutes', Math.min(59, e.target.value)),
            className: "w-12 text-center text-lg font-semibold border-b border-stone-300 outline-none"
          }),
          h('button', {
            onClick: () => updateWait('wait_minutes', Math.min(59, (data.wait_minutes || 0) + 5)),
            className: "w-7 h-7 border rounded-full hover:bg-stone-100 text-sm"
          }, "+")
        ),
        h('span', { className: "text-xs text-stone-500 mt-1" }, "Minutes")
      )
    ),
    h('p', { className: "text-stone-500 mt-4 text-sm" },
      `Total: ${formatWaitDuration(data)}`
    )
  );
};

const NewCampaignModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = React.useState({
    name: '',
    email_account_ids: [], // Changed to array for multi-select
    contact_list_id: '',
    send_schedule: {
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      start_hour: 9,
      end_hour: 17
    },
    send_immediately: false
  });
  const [emailAccounts, setEmailAccounts] = React.useState([]);
  const [contactLists, setContactLists] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const allDays = [
    { key: 'mon', label: 'Mon' },
    { key: 'tue', label: 'Tue' },
    { key: 'wed', label: 'Wed' },
    { key: 'thu', label: 'Thu' },
    { key: 'fri', label: 'Fri' },
    { key: 'sat', label: 'Sat' },
    { key: 'sun', label: 'Sun' }
  ];

  React.useEffect(() => {
    Promise.all([api.getEmailAccounts(), api.getContactLists()])
      .then(([accs, lists]) => {
        setEmailAccounts(Array.isArray(accs) ? accs : []);
        setContactLists(Array.isArray(lists) ? lists : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleDay = (day) => {
    const currentDays = formData.send_schedule.days;
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    setFormData({
      ...formData,
      send_schedule: { ...formData.send_schedule, days: newDays }
    });
  };

  // Toggle email account selection
  const toggleEmailAccount = (accountId) => {
    const current = formData.email_account_ids;
    const newSelection = current.includes(accountId)
      ? current.filter(id => id !== accountId)
      : [...current, accountId];
    setFormData({ ...formData, email_account_ids: newSelection });
  };

  // Select/deselect all email accounts
  const toggleAllAccounts = () => {
    if (formData.email_account_ids.length === emailAccounts.length) {
      setFormData({ ...formData, email_account_ids: [] });
    } else {
      setFormData({ ...formData, email_account_ids: emailAccounts.map(a => a.id) });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.email_account_ids.length === 0) {
      alert('Please select at least one email account');
      return;
    }
    if (!formData.contact_list_id) {
      alert('Please select a contact list');
      return;
    }
    // Send both email_account_id (legacy) and email_account_ids (new) for backward compatibility
    const payload = {
      ...formData,
      email_account_id: formData.email_account_ids[0]
    };
    onCreate(payload);
  };

  return h('div', { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in", onClick: onClose },
    h('div', { className: "bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto", onClick: e => e.stopPropagation() },
      h('h3', { className: "font-serif text-2xl text-jaguar-900 mb-4" }, "New Campaign"),
      loading ? h(Icons.Loader2, { className: "animate-spin mx-auto" }) :
      h('form', { onSubmit: handleSubmit, className: "space-y-4" },
        h('div', null,
          h('label', { className: "block text-sm text-stone-700 mb-1" }, "Name"),
          h('input', { required: true, className: "w-full border p-2 rounded text-sm", value: formData.name, onChange: e => setFormData({...formData, name: e.target.value}) })
        ),
        // Multi-select email accounts
        h('div', null,
          h('div', { className: "flex items-center justify-between mb-1" },
            h('label', { className: "block text-sm text-stone-700" }, "Send From"),
            emailAccounts.length > 1 && h('button', {
              type: "button",
              onClick: toggleAllAccounts,
              className: "text-xs text-jaguar-900 hover:underline"
            }, formData.email_account_ids.length === emailAccounts.length ? "Deselect All" : "Select All")
          ),
          emailAccounts.length > 1 && h('p', { className: "text-xs text-stone-500 mb-2" },
            "Select multiple accounts to rotate sending across them"
          ),
          h('div', { className: "border rounded-lg max-h-40 overflow-y-auto" },
            emailAccounts.length === 0 ?
              h('div', { className: "p-3 text-center text-stone-500 text-sm" }, "No email accounts found") :
              emailAccounts.map(account =>
                h('label', {
                  key: account.id,
                  className: `flex items-center gap-2 p-2 hover:bg-stone-50 cursor-pointer border-b last:border-b-0 ${
                    formData.email_account_ids.includes(account.id) ? 'bg-cream-50' : ''
                  }`
                },
                  h('input', {
                    type: "checkbox",
                    checked: formData.email_account_ids.includes(account.id),
                    onChange: () => toggleEmailAccount(account.id),
                    className: "w-4 h-4 rounded border-stone-300"
                  }),
                  h('span', { className: "text-sm text-stone-700 truncate" }, account.email_address)
                )
              )
          ),
          formData.email_account_ids.length > 0 && h('p', { className: "text-xs text-stone-600 mt-1" },
            `${formData.email_account_ids.length} account${formData.email_account_ids.length > 1 ? 's' : ''} selected`,
            formData.email_account_ids.length > 1 && " - emails will rotate across accounts"
          )
        ),
        h('div', null,
          h('label', { className: "block text-sm text-stone-700 mb-1" }, "Target List"),
          h('select', { required: true, className: "w-full border p-2 rounded bg-white text-sm", value: formData.contact_list_id, onChange: e => setFormData({...formData, contact_list_id: e.target.value}) },
            h('option', { value: "" }, "Select..."),
            contactLists.map(l => h('option', { key: l.id, value: l.id }, String(l.name)))
          )
        ),
        h('div', { className: "flex items-center gap-2 p-3 bg-cream-50 rounded-lg border border-stone-200" },
          h('input', {
            type: "checkbox",
            id: "send_immediately",
            checked: formData.send_immediately,
            onChange: e => setFormData({...formData, send_immediately: e.target.checked}),
            className: "w-4 h-4"
          }),
          h('label', { htmlFor: "send_immediately", className: "text-sm text-stone-700" },
            "Send first email immediately"
          )
        ),
        h('button', {
          type: "button",
          onClick: () => setShowAdvanced(!showAdvanced),
          className: "text-sm text-jaguar-900 hover:underline flex items-center gap-1"
        },
          h(showAdvanced ? Icons.ChevronUp : Icons.ChevronDown, { size: 16 }),
          showAdvanced ? "Hide Schedule" : "Show Schedule"
        ),
        showAdvanced && h('div', { className: "space-y-3 p-3 bg-stone-50 rounded-lg border border-stone-200" },
          h('div', null,
            h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, "Send Days"),
            h('div', { className: "flex flex-wrap gap-1" },
              allDays.map(day =>
                h('button', {
                  key: day.key,
                  type: "button",
                  onClick: () => toggleDay(day.key),
                  className: `px-2 py-1 rounded text-xs font-medium transition-colors ${
                    formData.send_schedule.days.includes(day.key)
                      ? 'bg-jaguar-900 text-white'
                      : 'bg-white border border-stone-300 text-stone-600'
                  }`
                }, day.label)
              )
            )
          ),
          h('div', { className: "grid grid-cols-2 gap-3" },
            h('div', null,
              h('label', { className: "block text-xs text-stone-700 mb-1" }, "Start Hour"),
              h('select', {
                className: "w-full border p-1.5 rounded bg-white text-sm",
                value: formData.send_schedule.start_hour,
                onChange: e => setFormData({
                  ...formData,
                  send_schedule: { ...formData.send_schedule, start_hour: parseInt(e.target.value) }
                })
              },
                Array.from({ length: 24 }, (_, i) =>
                  h('option', { key: i, value: i }, `${i.toString().padStart(2, '0')}:00`)
                )
              )
            ),
            h('div', null,
              h('label', { className: "block text-xs text-stone-700 mb-1" }, "End Hour"),
              h('select', {
                className: "w-full border p-1.5 rounded bg-white text-sm",
                value: formData.send_schedule.end_hour,
                onChange: e => setFormData({
                  ...formData,
                  send_schedule: { ...formData.send_schedule, end_hour: parseInt(e.target.value) }
                })
              },
                Array.from({ length: 25 }, (_, i) =>
                  h('option', { key: i, value: i }, i === 24 ? '24:00' : `${i.toString().padStart(2, '0')}:00`)
                )
              )
            )
          )
        ),
        h('button', { type: "submit", className: "w-full bg-jaguar-900 text-white p-2 rounded hover:bg-jaguar-800" }, "Create Campaign")
      )
    )
  );
};
