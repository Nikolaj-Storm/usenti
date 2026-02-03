// Mr. Snowman - Campaign Builder (Canvas-Based Visual Workflow)
// n8n meets Scratch meets Miro style interface

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

const sanitizeStep = (s, index = 0) => {
  if (!s || typeof s !== 'object') return null;

  let branches = [];
  if (s.condition_branches) {
    if (typeof s.condition_branches === 'string') {
      try { branches = JSON.parse(s.condition_branches); } catch(e) { branches = []; }
    } else if (Array.isArray(s.condition_branches)) {
      branches = s.condition_branches;
    }
  }

  // Default positions - arrange vertically if not set
  const defaultX = 400;
  const defaultY = 150 + (index * 180);

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
    parent_branch_id: s.parent_branch_id || null,
    branch_index: s.branch_index !== undefined ? Number(s.branch_index) : null,
    // Canvas position
    x: Number(s.x || s.position_x || defaultX),
    y: Number(s.y || s.position_y || defaultY)
  };
};

// --- 2. Constants ---

const CONDITION_OPTIONS = [
  { value: 'if_opened', label: 'If Opened', color: 'bg-blue-500', shortLabel: 'Opened' },
  { value: 'if_not_opened', label: 'If NOT Opened', color: 'bg-orange-500', hasWait: true, shortLabel: 'Not Opened' },
  { value: 'if_replied', label: 'If Replied', color: 'bg-purple-500', shortLabel: 'Replied' },
  { value: 'if_not_replied', label: 'If NOT Replied', color: 'bg-pink-500', hasWait: true, shortLabel: 'Not Replied' }
];

const NODE_TYPES = {
  start: { icon: 'Play', color: '#10b981', label: 'Start', bgClass: 'start' },
  email: { icon: 'Mail', color: '#3b82f6', label: 'Email', bgClass: 'email' },
  wait: { icon: 'Clock', color: '#8b5cf6', label: 'Wait', bgClass: 'wait' },
  condition: { icon: 'Split', color: '#f59e0b', label: 'Condition', bgClass: 'condition' },
  end: { icon: 'Check', color: '#ef4444', label: 'End', bgClass: 'end' }
};

const formatWaitDuration = (step) => {
  const parts = [];
  if (step.wait_days > 0) parts.push(`${step.wait_days}d`);
  if (step.wait_hours > 0) parts.push(`${step.wait_hours}h`);
  if (step.wait_minutes > 0) parts.push(`${step.wait_minutes}m`);
  return parts.length > 0 ? parts.join(' ') : 'Immediately';
};

// --- 3. Canvas State Management Hook ---

const useCanvasState = (initialZoom = 1, initialPan = { x: 0, y: 0 }) => {
  const [zoom, setZoom] = React.useState(initialZoom);
  const [pan, setPan] = React.useState(initialPan);
  const [isPanning, setIsPanning] = React.useState(false);
  const [tool, setTool] = React.useState('select'); // 'select', 'pan'

  const zoomIn = () => setZoom(z => Math.min(z * 1.2, 3));
  const zoomOut = () => setZoom(z => Math.max(z / 1.2, 0.25));
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const fitView = (nodes, containerWidth, containerHeight) => {
    if (!nodes || nodes.length === 0) {
      resetView();
      return;
    }
    const padding = 100;
    const minX = Math.min(...nodes.map(n => n.x)) - padding;
    const maxX = Math.max(...nodes.map(n => n.x + 220)) + padding;
    const minY = Math.min(...nodes.map(n => n.y)) - padding;
    const maxY = Math.max(...nodes.map(n => n.y + 120)) + padding;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.25), 1.5);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setPan({
      x: containerWidth / 2 - centerX * newZoom,
      y: containerHeight / 2 - centerY * newZoom
    });
    setZoom(newZoom);
  };

  return { zoom, setZoom, pan, setPan, isPanning, setIsPanning, tool, setTool, zoomIn, zoomOut, resetView, fitView };
};

// --- 4. Main Component ---

const CampaignBuilder = () => {
  const [campaigns, setCampaigns] = React.useState([]);
  const [selectedCampaign, setSelectedCampaign] = React.useState(null);
  const [steps, setSteps] = React.useState([]);
  const [selectedNodes, setSelectedNodes] = React.useState([]);
  const [activeStep, setActiveStep] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [showNewCampaignModal, setShowNewCampaignModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [isDemo, setIsDemo] = React.useState(false);
  const [stats, setStats] = React.useState(null);
  const [loadingStats, setLoadingStats] = React.useState(false);
  const [showEditor, setShowEditor] = React.useState(true);

  const canvasState = useCanvasState();
  const containerRef = React.useRef(null);

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
    setSelectedNodes([]);
    setActiveStep(null);
    try {
      const data = await api.get(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${campaign.id}/steps`);
      const rawSteps = Array.isArray(data) ? data : [];
      const cleanSteps = rawSteps.map((s, i) => sanitizeStep(s, i)).filter(Boolean);
      setSteps(cleanSteps);
      loadCampaignStats(campaign.id);
      // Fit view after loading
      setTimeout(() => {
        if (containerRef.current && cleanSteps.length > 0) {
          const rect = containerRef.current.getBoundingClientRect();
          canvasState.fitView(cleanSteps, rect.width, rect.height);
        }
      }, 100);
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
    } catch (error) {
      alert('Error deleting campaign: ' + error.message);
    }
  };

  const loadDemoMode = () => {
    const demoCampaign = sanitizeCampaign({ id: 'demo', name: 'Demo Campaign (Canvas)', status: 'draft' });
    const demoSteps = [
      { id: 's1', step_type: 'email', subject: 'Initial Outreach', body: 'Hi {{first_name}}, I wanted to reach out...', step_order: 1, x: 400, y: 100 },
      { id: 's2', step_type: 'wait', wait_days: 2, step_order: 2, x: 400, y: 280 },
      { id: 's3', step_type: 'condition', step_order: 3, x: 400, y: 460, condition_branches: [
        { condition: 'if_opened', wait_days: 0, branch_steps: [
          { id: 'b1s1', step_type: 'email', subject: 'Thanks for opening!', body: 'Since you showed interest...', x: 200, y: 640 }
        ]},
        { condition: 'if_not_opened', wait_days: 2, branch_steps: [
          { id: 'b2s1', step_type: 'email', subject: 'Did you miss my email?', body: 'Just wanted to follow up...', x: 600, y: 640 }
        ]}
      ]}
    ].map((s, i) => sanitizeStep(s, i));

    setIsDemo(true);
    setSelectedCampaign(demoCampaign);
    setSteps(demoSteps);
    setSelectedNodes([]);
    setActiveStep(null);
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
    } catch (error) {
      alert('Error pausing campaign: ' + error.message);
    }
  };

  // Add step to canvas
  const handleAddStep = async (stepType, position = null) => {
    const newPos = position || {
      x: 400 + (Math.random() - 0.5) * 100,
      y: 100 + steps.length * 180
    };

    const newStepRaw = {
      id: 'temp-' + Date.now(),
      step_type: stepType,
      step_order: steps.length + 1,
      subject: stepType === 'email' ? 'New Email' : '',
      body: '',
      wait_days: stepType === 'wait' ? 1 : 0,
      wait_hours: 0,
      wait_minutes: 0,
      condition_type: 'if_opened',
      condition_branches: stepType === 'condition' ? [
        { condition: 'if_opened', wait_days: 0, branch_steps: [] },
        { condition: 'if_not_opened', wait_days: 2, branch_steps: [] }
      ] : [],
      x: newPos.x,
      y: newPos.y
    };

    const cleanStep = sanitizeStep(newStepRaw, steps.length);
    setSteps([...steps, cleanStep]);
    setSelectedNodes([cleanStep.id]);
    setActiveStep(cleanStep.id);

    if (!isDemo && selectedCampaign) {
      try {
        const serverStep = await api.post(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps`, newStepRaw);
        const realStep = sanitizeStep(serverStep, steps.length);
        realStep.x = cleanStep.x;
        realStep.y = cleanStep.y;
        setSteps(prev => prev.map(s => s.id === cleanStep.id ? realStep : s));
        setSelectedNodes([realStep.id]);
        setActiveStep(realStep.id);
      } catch(e) {
        console.error(e);
        setSteps(prev => prev.filter(s => s.id !== cleanStep.id));
      }
    }
  };

  // Update step position (drag)
  const handleNodeDrag = (stepId, newX, newY) => {
    setSteps(prev => prev.map(s =>
      s.id === stepId ? { ...s, x: newX, y: newY } : s
    ));
  };

  // Update step position end (save)
  const handleNodeDragEnd = async (stepId, newX, newY) => {
    if (!isDemo && selectedCampaign) {
      try {
        await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${stepId}`, {
          position_x: newX,
          position_y: newY
        });
      } catch (e) {
        console.error('Failed to save position:', e);
      }
    }
  };

  const handleUpdateStep = async (stepId, updates, parentBranchId = null, branchIndex = null) => {
    setSaving(true);

    if (parentBranchId !== null && branchIndex !== null) {
      const conditionStep = steps.find(s => s.id === parentBranchId);
      if (!conditionStep) {
        setSaving(false);
        return;
      }
      const newBranches = [...conditionStep.condition_branches];
      const branch = newBranches[branchIndex];
      const branchSteps = (branch.branch_steps || []).map(bs =>
        bs.id === stepId ? { ...bs, ...updates } : bs
      );
      newBranches[branchIndex] = { ...branch, branch_steps: branchSteps };

      setSteps(prevSteps => prevSteps.map(step => {
        if (step.id === parentBranchId && step.step_type === 'condition') {
          return { ...step, condition_branches: newBranches };
        }
        return step;
      }));

      if (!isDemo && selectedCampaign) {
        try {
          await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${parentBranchId}`, {
            condition_branches: newBranches
          });
        } catch (error) {
          console.error('Error updating branch step:', error);
        }
      }
    } else {
      setSteps(steps.map(s => s.id === stepId ? { ...s, ...updates } : s));
      if (!isDemo && selectedCampaign) {
        try {
          await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${stepId}`, updates);
        } catch (error) {
          console.error('Update failed:', error);
        }
      }
    }
    setTimeout(() => setSaving(false), 500);
  };

  const handleDeleteStep = async (stepId, parentBranchId = null, branchIndex = null) => {
    if (parentBranchId !== null && branchIndex !== null) {
      const conditionStep = steps.find(s => s.id === parentBranchId);
      if (!conditionStep) return;

      const newBranches = [...conditionStep.condition_branches];
      const branch = newBranches[branchIndex];
      const branchSteps = (branch.branch_steps || []).filter(bs => bs.id !== stepId);
      newBranches[branchIndex] = { ...branch, branch_steps: branchSteps };

      setSteps(prevSteps => prevSteps.map(step => {
        if (step.id === parentBranchId && step.step_type === 'condition') {
          return { ...step, condition_branches: newBranches };
        }
        return step;
      }));

      if (activeStep === stepId) setActiveStep(parentBranchId);
      setSelectedNodes(prev => prev.filter(id => id !== stepId));

      if (!isDemo && selectedCampaign) {
        try {
          await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${parentBranchId}`, {
            condition_branches: newBranches
          });
        } catch (error) {
          console.error('Error deleting branch step:', error);
        }
      }
      return;
    }

    if (!isDemo && !confirm('Delete this step?')) return;

    if (isDemo) {
      setSteps(steps.filter(s => s.id !== stepId));
      setSelectedNodes(prev => prev.filter(id => id !== stepId));
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
      setSelectedNodes(prev => prev.filter(id => id !== stepId));
      if (activeStep === stepId) setActiveStep(remaining.length > 0 ? remaining[0].id : null);
    } catch(err) {
      alert(err.message);
    }
  };

  const handleAddBranch = async (conditionStepId) => {
    const conditionStep = steps.find(s => s.id === conditionStepId);
    if (!conditionStep || conditionStep.step_type !== 'condition') return;

    const usedConditions = conditionStep.condition_branches.map(b => b.condition);
    const available = CONDITION_OPTIONS.find(opt => !usedConditions.includes(opt.value));
    if (!available) return;

    const defaultWait = available.hasWait ? { wait_days: 2, wait_hours: 0, wait_minutes: 0 } : { wait_days: 0, wait_hours: 0, wait_minutes: 0 };
    const newBranches = [...conditionStep.condition_branches, { condition: available.value, ...defaultWait, branch_steps: [] }];

    setSteps(prevSteps => prevSteps.map(step => {
      if (step.id === conditionStepId) {
        return { ...step, condition_branches: newBranches };
      }
      return step;
    }));

    if (!isDemo && selectedCampaign) {
      try {
        await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${conditionStepId}`, {
          condition_branches: newBranches
        });
      } catch (e) {
        console.error('Error adding branch:', e);
      }
    }
  };

  const handleRemoveBranch = async (conditionStepId, branchIndex) => {
    const conditionStep = steps.find(s => s.id === conditionStepId);
    if (!conditionStep || conditionStep.step_type !== 'condition') return;
    if (conditionStep.condition_branches.length <= 1) return;

    const newBranches = conditionStep.condition_branches.filter((_, i) => i !== branchIndex);

    setSteps(prevSteps => prevSteps.map(step => {
      if (step.id === conditionStepId) {
        return { ...step, condition_branches: newBranches };
      }
      return step;
    }));

    if (!isDemo && selectedCampaign) {
      try {
        await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${conditionStepId}`, {
          condition_branches: newBranches
        });
      } catch (e) {
        console.error('Error removing branch:', e);
      }
    }
  };

  const handleUpdateBranchCondition = async (conditionStepId, branchIndex, newCondition) => {
    const conditionStep = steps.find(s => s.id === conditionStepId);
    if (!conditionStep || conditionStep.step_type !== 'condition') return;

    const newBranches = [...conditionStep.condition_branches];
    const conditionOpt = CONDITION_OPTIONS.find(o => o.value === newCondition);
    const defaultWait = conditionOpt?.hasWait ? { wait_days: 2, wait_hours: 0, wait_minutes: 0 } : { wait_days: 0, wait_hours: 0, wait_minutes: 0 };
    newBranches[branchIndex] = { ...newBranches[branchIndex], condition: newCondition, ...defaultWait };

    setSteps(prevSteps => prevSteps.map(step => {
      if (step.id === conditionStepId) {
        return { ...step, condition_branches: newBranches };
      }
      return step;
    }));

    if (!isDemo && selectedCampaign) {
      try {
        await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${conditionStepId}`, {
          condition_branches: newBranches
        });
      } catch (e) {
        console.error('Error updating branch condition:', e);
      }
    }
  };

  // Get active step data
  const getActiveStepData = () => {
    const mainStep = steps.find(s => s.id === activeStep);
    if (mainStep) return { step: mainStep, parentBranchId: null, branchIndex: null };

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

  const activeStepData = getActiveStepData();

  // Main Builder View
  return h('div', { className: "h-[calc(100vh-120px)] flex flex-col animate-fade-in" },
    // Header
    h(BuilderHeader, {
      selectedCampaign,
      campaigns,
      isDemo,
      stats,
      loadingStats,
      onSelectCampaign: handleSelectCampaign,
      onDeleteCampaign: handleDeleteCampaign,
      onStartCampaign: handleStartCampaign,
      onPauseCampaign: handlePauseCampaign,
      onNewCampaign: () => setShowNewCampaignModal(true),
      onLoadDemo: loadDemoMode,
      showEditor,
      onToggleEditor: () => setShowEditor(!showEditor)
    }),

    // Main Layout - Canvas + Editor
    h('div', { className: "flex flex-1 overflow-hidden gap-0" },
      // Canvas Area
      h('div', {
        ref: containerRef,
        className: `flex-1 relative rounded-lg overflow-hidden border border-stone-200 ${showEditor ? '' : 'rounded-r-lg'}`
      },
        h(WorkflowCanvas, {
          steps,
          selectedNodes,
          setSelectedNodes,
          activeStep,
          setActiveStep,
          canvasState,
          onAddStep: handleAddStep,
          onDeleteStep: handleDeleteStep,
          onNodeDrag: handleNodeDrag,
          onNodeDragEnd: handleNodeDragEnd,
          onAddBranch: handleAddBranch,
          onRemoveBranch: handleRemoveBranch,
          onUpdateBranchCondition: handleUpdateBranchCondition,
          containerRef
        })
      ),

      // Editor Panel (collapsible)
      showEditor && h('div', { className: "w-80 bg-white border-l border-stone-200 overflow-hidden flex flex-col" },
        activeStepData
          ? h(StepEditor, {
              step: activeStepData.step,
              onUpdate: (stepId, updates) => handleUpdateStep(stepId, updates, activeStepData.parentBranchId, activeStepData.branchIndex),
              onDelete: () => handleDeleteStep(activeStepData.step.id, activeStepData.parentBranchId, activeStepData.branchIndex),
              saving: saving
            })
          : h('div', { className: "h-full flex flex-col items-center justify-center text-stone-400 p-6" },
              h(Icons.MousePointer, { size: 48, className: "opacity-20 mb-4" }),
              h('p', { className: "text-center" }, "Select a node on the canvas to edit its properties")
            )
      )
    ),

    showNewCampaignModal && h(NewCampaignModal, { onClose: () => setShowNewCampaignModal(false), onCreate: handleCreateCampaign })
  );
};

// --- 5. Builder Header Component ---

const BuilderHeader = ({ selectedCampaign, campaigns, isDemo, stats, loadingStats, onSelectCampaign, onDeleteCampaign, onStartCampaign, onPauseCampaign, onNewCampaign, onLoadDemo, showEditor, onToggleEditor }) => {
  return h('div', { className: "flex justify-between items-center mb-3 pb-3 border-b border-stone-200" },
    h('div', { className: "flex items-center gap-4" },
      h('div', null,
        h('h1', { className: "font-serif text-2xl text-jaguar-900" }, selectedCampaign?.name || 'Campaign Builder'),
        h('div', { className: "flex items-center gap-2 text-sm text-stone-500" },
          h('span', { className: `w-2 h-2 rounded-full ${selectedCampaign?.status === 'running' ? 'bg-green-500 animate-pulse' : selectedCampaign?.status === 'paused' ? 'bg-yellow-500' : 'bg-stone-300'}` }),
          h('span', { className: "capitalize" }, selectedCampaign?.status || 'draft'),
          isDemo && h('span', { className: "ml-2 px-2 py-0.5 bg-gold-500 text-white text-xs rounded-full" }, "Demo")
        )
      ),
      // Quick stats
      !isDemo && stats && h('div', { className: "flex gap-4 ml-6 pl-6 border-l border-stone-200" },
        h(MiniStat, { label: "Sent", value: stats.sent_count, icon: Icons.Send }),
        h(MiniStat, { label: "Opened", value: stats.opened_count, rate: stats.open_rate, icon: Icons.Eye }),
        h(MiniStat, { label: "Replied", value: stats.replied_count, rate: stats.reply_rate, icon: Icons.Reply })
      )
    ),
    h('div', { className: "flex items-center gap-2" },
      h('button', {
        onClick: onToggleEditor,
        className: `p-2 rounded-lg border transition-colors ${showEditor ? 'bg-jaguar-900 text-white border-jaguar-900' : 'border-stone-200 hover:bg-stone-50'}`,
        title: showEditor ? "Hide Editor" : "Show Editor"
      }, h(Icons.Edit3, { size: 18 })),

      h('div', { className: "w-px h-6 bg-stone-200 mx-1" }),

      !isDemo && selectedCampaign && h('button', {
        onClick: onDeleteCampaign,
        className: "p-2 border border-red-200 rounded-lg hover:bg-red-50 text-red-500",
        title: "Delete Campaign"
      }, h(Icons.Trash2, { size: 18 })),

      !isDemo && selectedCampaign && (
        selectedCampaign.status === 'running'
          ? h('button', {
              onClick: onPauseCampaign,
              className: "px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2 text-sm"
            }, h(Icons.Pause, { size: 16 }), 'Pause')
          : h('button', {
              onClick: onStartCampaign,
              className: "px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
            }, h(Icons.Play, { size: 16 }), selectedCampaign.status === 'paused' ? 'Resume' : 'Start')
      ),

      !isDemo && h('select', {
        className: "px-3 py-2 border border-stone-200 rounded-lg bg-white text-sm",
        value: selectedCampaign?.id || '',
        onChange: e => {
          const c = campaigns.find(x => x.id === e.target.value);
          if(c) onSelectCampaign(c);
        }
      }, campaigns.map(c => h('option', { key: c.id, value: c.id }, c.name))),

      h('button', {
        onClick: onNewCampaign,
        className: "p-2 bg-jaguar-900 text-white rounded-lg hover:bg-jaguar-800",
        title: "New Campaign"
      }, h(Icons.Plus, { size: 18 }))
    )
  );
};

const MiniStat = ({ label, value, rate, icon: IconComponent }) => {
  return h('div', { className: "flex items-center gap-2" },
    h(IconComponent, { size: 14, className: "text-stone-400" }),
    h('span', { className: "text-sm font-medium text-jaguar-900" }, value || 0),
    rate !== undefined && rate > 0 && h('span', { className: "text-xs text-stone-400" }, `(${rate}%)`),
    h('span', { className: "text-xs text-stone-400" }, label)
  );
};

// --- 6. Canvas Component ---

const WorkflowCanvas = ({ steps, selectedNodes, setSelectedNodes, activeStep, setActiveStep, canvasState, onAddStep, onDeleteStep, onNodeDrag, onNodeDragEnd, onAddBranch, onRemoveBranch, onUpdateBranchCondition, containerRef }) => {
  const { zoom, setZoom, pan, setPan, isPanning, setIsPanning, tool, setTool, zoomIn, zoomOut, resetView, fitView } = canvasState;

  const [draggingNode, setDraggingNode] = React.useState(null);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = React.useState(true);

  const svgRef = React.useRef(null);

  // Handle wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoom * delta, 0.25), 3);

    // Zoom towards mouse position
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newPan = {
      x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
      y: mouseY - (mouseY - pan.y) * (newZoom / zoom)
    };

    setZoom(newZoom);
    setPan(newPan);
  };

  // Handle canvas pan
  const handleCanvasMouseDown = (e) => {
    if (e.target === e.currentTarget || e.target.classList.contains('canvas-grid')) {
      if (e.button === 1 || tool === 'pan' || e.shiftKey) {
        // Middle click or pan tool or shift+click - start panning
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      } else {
        // Click on empty canvas - deselect
        setSelectedNodes([]);
        setActiveStep(null);
      }
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    } else if (draggingNode) {
      const rect = e.currentTarget.getBoundingClientRect();
      const newX = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const newY = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;
      onNodeDrag(draggingNode, Math.round(newX), Math.round(newY));
    }
  };

  const handleCanvasMouseUp = (e) => {
    if (draggingNode) {
      const step = steps.find(s => s.id === draggingNode);
      if (step) {
        onNodeDragEnd(draggingNode, step.x, step.y);
      }
      setDraggingNode(null);
    }
    setIsPanning(false);
  };

  // Handle node mouse down (start drag)
  const handleNodeMouseDown = (e, stepId) => {
    e.stopPropagation();
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    const rect = e.currentTarget.closest('.canvas-container').getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    setDragOffset({ x: mouseX - step.x, y: mouseY - step.y });
    setDraggingNode(stepId);

    // Select node
    if (e.ctrlKey || e.metaKey) {
      setSelectedNodes(prev =>
        prev.includes(stepId) ? prev.filter(id => id !== stepId) : [...prev, stepId]
      );
    } else {
      setSelectedNodes([stepId]);
    }
    setActiveStep(stepId);
  };

  // Drop from palette
  const handleDrop = (e) => {
    e.preventDefault();
    const stepType = e.dataTransfer.getData('stepType');
    if (stepType) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom - 100;
      const y = (e.clientY - rect.top - pan.y) / zoom - 50;
      onAddStep(stepType, { x: Math.round(x), y: Math.round(y) });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Calculate connections
  const getConnections = () => {
    const connections = [];
    const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);

    // Add start node connection to first step
    if (sortedSteps.length > 0) {
      const firstStep = sortedSteps[0];
      connections.push({
        id: 'start-' + firstStep.id,
        from: { x: 100, y: 80 },
        to: { x: firstStep.x + 110, y: firstStep.y },
        type: 'main'
      });
    }

    // Connect sequential steps
    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];
      const nextStep = sortedSteps[i + 1];

      if (step.step_type === 'condition') {
        // Draw branch connections
        const branches = step.condition_branches || [];
        branches.forEach((branch, bi) => {
          const branchSteps = branch.branch_steps || [];
          const offsetX = (bi - (branches.length - 1) / 2) * 200;

          if (branchSteps.length > 0) {
            // Connect condition to first branch step
            connections.push({
              id: `${step.id}-branch-${bi}-0`,
              from: { x: step.x + 110, y: step.y + 100 },
              to: { x: step.x + 110 + offsetX, y: step.y + 180 },
              type: 'branch',
              label: CONDITION_OPTIONS.find(o => o.value === branch.condition)?.shortLabel || branch.condition
            });
          }
        });
      } else if (nextStep) {
        // Regular connection to next step
        connections.push({
          id: step.id + '-' + nextStep.id,
          from: { x: step.x + 110, y: step.y + 100 },
          to: { x: nextStep.x + 110, y: nextStep.y },
          type: 'main'
        });
      }
    }

    // Add end node connection from last step
    if (sortedSteps.length > 0) {
      const lastStep = sortedSteps[sortedSteps.length - 1];
      if (lastStep.step_type !== 'condition') {
        connections.push({
          id: lastStep.id + '-end',
          from: { x: lastStep.x + 110, y: lastStep.y + 100 },
          to: { x: lastStep.x + 110, y: lastStep.y + 200 },
          type: 'end'
        });
      }
    }

    return connections;
  };

  const connections = getConnections();

  // Render SVG path for connection
  const renderConnectionPath = (conn) => {
    const dx = conn.to.x - conn.from.x;
    const dy = conn.to.y - conn.from.y;
    const midY = conn.from.y + dy / 2;

    // Bezier curve
    const path = `M ${conn.from.x} ${conn.from.y} C ${conn.from.x} ${midY}, ${conn.to.x} ${midY}, ${conn.to.x} ${conn.to.y}`;

    return h('g', { key: conn.id },
      h('path', {
        d: path,
        className: `connection-line ${conn.type === 'main' ? 'active' : ''}`,
        strokeDasharray: conn.type === 'branch' ? '5,5' : 'none'
      }),
      // Arrow head
      h('polygon', {
        points: `${conn.to.x},${conn.to.y} ${conn.to.x - 5},${conn.to.y - 8} ${conn.to.x + 5},${conn.to.y - 8}`,
        fill: conn.type === 'main' ? '#0B2B26' : '#9ca3af'
      }),
      // Branch label
      conn.label && h('text', {
        x: (conn.from.x + conn.to.x) / 2,
        y: (conn.from.y + conn.to.y) / 2 - 5,
        textAnchor: 'middle',
        className: 'text-xs fill-stone-500 font-medium'
      }, conn.label)
    );
  };

  return h('div', {
    className: `canvas-container ${isPanning ? 'grabbing' : ''} ${tool === 'pan' ? 'cursor-grab' : ''}`,
    onWheel: handleWheel,
    onMouseDown: handleCanvasMouseDown,
    onMouseMove: handleCanvasMouseMove,
    onMouseUp: handleCanvasMouseUp,
    onMouseLeave: handleCanvasMouseUp,
    onDrop: handleDrop,
    onDragOver: handleDragOver
  },
    // Grid background
    showGrid && h('div', {
      className: "canvas-grid",
      style: {
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`
      }
    }),

    // Viewport (transformable layer)
    h('div', {
      className: "canvas-viewport",
      style: {
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
      }
    },
      // SVG layer for connections
      h('svg', {
        ref: svgRef,
        style: { position: 'absolute', top: 0, left: 0, width: '5000px', height: '5000px', pointerEvents: 'none', overflow: 'visible' }
      },
        connections.map(renderConnectionPath)
      ),

      // Start node
      h(StartNode, { x: 40, y: 30 }),

      // Step nodes
      steps.map(step => h(CanvasNode, {
        key: step.id,
        step,
        isSelected: selectedNodes.includes(step.id),
        isActive: activeStep === step.id,
        isDragging: draggingNode === step.id,
        onMouseDown: (e) => handleNodeMouseDown(e, step.id),
        onDelete: () => onDeleteStep(step.id),
        onAddBranch: () => onAddBranch(step.id),
        onRemoveBranch: (bi) => onRemoveBranch(step.id, bi),
        onUpdateBranchCondition: (bi, cond) => onUpdateBranchCondition(step.id, bi, cond)
      })),

      // End node (positioned after last step)
      steps.length > 0 && h(EndNode, {
        x: steps[steps.length - 1].x + 85,
        y: steps[steps.length - 1].y + 200
      })
    ),

    // Block Palette (left side)
    h(BlockPalette, { onAddStep }),

    // Canvas Controls (bottom center)
    h(CanvasControls, {
      zoom,
      tool,
      setTool,
      showGrid,
      setShowGrid,
      onZoomIn: zoomIn,
      onZoomOut: zoomOut,
      onResetView: resetView,
      onFitView: () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          fitView(steps, rect.width, rect.height);
        }
      }
    }),

    // Minimap (bottom right)
    h(Minimap, { steps, pan, zoom, containerRef })
  );
};

// --- 7. Canvas Sub-Components ---

const StartNode = ({ x, y }) => {
  return h('div', {
    className: "canvas-node",
    style: { left: x, top: y, cursor: 'default' }
  },
    h('div', { className: "node-card", style: { minWidth: '120px' } },
      h('div', { className: "node-header start" },
        h('div', { className: "node-icon start" },
          h(Icons.Play, { size: 16 })
        ),
        h('span', { className: "font-semibold text-sm text-stone-700" }, "Start")
      )
    )
  );
};

const EndNode = ({ x, y }) => {
  return h('div', {
    className: "canvas-node",
    style: { left: x, top: y, cursor: 'default' }
  },
    h('div', { className: "node-card", style: { minWidth: '120px' } },
      h('div', { className: "node-header end" },
        h('div', { className: "node-icon end" },
          h(Icons.Check, { size: 16 })
        ),
        h('span', { className: "font-semibold text-sm text-stone-700" }, "End")
      )
    )
  );
};

const CanvasNode = ({ step, isSelected, isActive, isDragging, onMouseDown, onDelete, onAddBranch, onRemoveBranch, onUpdateBranchCondition }) => {
  const nodeType = NODE_TYPES[step.step_type] || NODE_TYPES.email;
  const IconComponent = Icons[nodeType.icon];

  return h('div', {
    className: `canvas-node ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isActive ? 'new' : ''}`,
    style: { left: step.x, top: step.y },
    onMouseDown
  },
    h('div', { className: "node-card" },
      // Header
      h('div', { className: `node-header ${nodeType.bgClass}` },
        h('div', { className: `node-icon ${nodeType.bgClass}` },
          IconComponent && h(IconComponent, { size: 16 })
        ),
        h('div', { className: "flex-1 min-w-0" },
          h('span', { className: "font-semibold text-sm text-stone-700 block truncate" },
            step.step_type === 'email' ? (step.subject || 'New Email') :
            step.step_type === 'wait' ? `Wait ${formatWaitDuration(step)}` :
            'Condition'
          )
        ),
        h('button', {
          onClick: (e) => { e.stopPropagation(); onDelete(); },
          className: "p-1 rounded hover:bg-white/50 text-stone-400 hover:text-red-500 transition-colors"
        }, h(Icons.X, { size: 14 }))
      ),

      // Content
      h('div', { className: "node-content" },
        step.step_type === 'email' && h('p', { className: "text-xs text-stone-500 truncate" },
          (step.body || 'No content yet...').substring(0, 50) + (step.body?.length > 50 ? '...' : '')
        ),

        step.step_type === 'wait' && h('div', { className: "flex items-center gap-2 text-xs text-stone-500" },
          h(Icons.Clock, { size: 12 }),
          h('span', null, 'Delay before next step')
        ),

        step.step_type === 'condition' && h('div', { className: "space-y-2" },
          (step.condition_branches || []).map((branch, bi) => {
            const opt = CONDITION_OPTIONS.find(o => o.value === branch.condition);
            return h('div', { key: bi, className: "flex items-center gap-2" },
              h('div', { className: `w-2 h-2 rounded-full ${opt?.color || 'bg-stone-400'}` }),
              h('select', {
                className: "text-xs px-1 py-0.5 border rounded bg-white flex-1",
                value: branch.condition,
                onClick: e => e.stopPropagation(),
                onChange: e => { e.stopPropagation(); onUpdateBranchCondition(bi, e.target.value); }
              },
                CONDITION_OPTIONS.map(o => h('option', { key: o.value, value: o.value }, o.label))
              ),
              (step.condition_branches || []).length > 1 && h('button', {
                onClick: (e) => { e.stopPropagation(); onRemoveBranch(bi); },
                className: "p-0.5 text-stone-400 hover:text-red-500"
              }, h(Icons.X, { size: 12 }))
            );
          }),
          (step.condition_branches || []).length < CONDITION_OPTIONS.length && h('button', {
            onClick: (e) => { e.stopPropagation(); onAddBranch(); },
            className: "text-xs text-jaguar-900 hover:underline flex items-center gap-1"
          }, h(Icons.Plus, { size: 12 }), 'Add branch')
        )
      )
    ),

    // Connection ports
    h('div', { className: "node-port input" }),
    h('div', { className: "node-port output" })
  );
};

const BlockPalette = ({ onAddStep }) => {
  const handleDragStart = (e, stepType) => {
    e.dataTransfer.setData('stepType', stepType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const blocks = [
    { type: 'email', icon: 'Mail', label: 'Email', color: '#3b82f6' },
    { type: 'wait', icon: 'Clock', label: 'Wait', color: '#8b5cf6' },
    { type: 'condition', icon: 'Split', label: 'Condition', color: '#f59e0b' }
  ];

  return h('div', { className: "block-palette" },
    h('div', { className: "text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 px-2" }, "Blocks"),
    blocks.map(block => {
      const IconComponent = Icons[block.icon];
      return h('div', {
        key: block.type,
        className: "palette-item",
        draggable: true,
        onDragStart: (e) => handleDragStart(e, block.type),
        onClick: () => onAddStep(block.type)
      },
        h('div', { className: "icon", style: { background: block.color } },
          IconComponent && h(IconComponent, { size: 16, color: 'white' })
        ),
        h('span', { className: "text-sm font-medium text-stone-700" }, block.label)
      );
    })
  );
};

const CanvasControls = ({ zoom, tool, setTool, showGrid, setShowGrid, onZoomIn, onZoomOut, onResetView, onFitView }) => {
  return h('div', { className: "canvas-controls" },
    // Zoom controls
    h('button', {
      className: "canvas-control-btn",
      onClick: onZoomOut,
      title: "Zoom Out"
    }, h(Icons.ZoomOut, { size: 18 })),

    h('span', { className: "zoom-display" }, `${Math.round(zoom * 100)}%`),

    h('button', {
      className: "canvas-control-btn",
      onClick: onZoomIn,
      title: "Zoom In"
    }, h(Icons.ZoomIn, { size: 18 })),

    h('div', { className: "control-divider" }),

    // Tool selection
    h('button', {
      className: `canvas-control-btn ${tool === 'select' ? 'active' : ''}`,
      onClick: () => setTool('select'),
      title: "Select Tool (V)"
    }, h(Icons.MousePointer, { size: 18 })),

    h('button', {
      className: `canvas-control-btn ${tool === 'pan' ? 'active' : ''}`,
      onClick: () => setTool('pan'),
      title: "Pan Tool (H)"
    }, h(Icons.Hand, { size: 18 })),

    h('div', { className: "control-divider" }),

    // View controls
    h('button', {
      className: `canvas-control-btn ${showGrid ? 'active' : ''}`,
      onClick: () => setShowGrid(!showGrid),
      title: "Toggle Grid"
    }, h(Icons.Grid3x3, { size: 18 })),

    h('button', {
      className: "canvas-control-btn",
      onClick: onFitView,
      title: "Fit to View"
    }, h(Icons.Maximize2, { size: 18 })),

    h('button', {
      className: "canvas-control-btn",
      onClick: onResetView,
      title: "Reset View"
    }, h(Icons.Target, { size: 18 }))
  );
};

const Minimap = ({ steps, pan, zoom, containerRef }) => {
  const scale = 0.08;
  const mapWidth = 180;
  const mapHeight = 120;

  // Calculate bounds
  const allX = steps.map(s => s.x);
  const allY = steps.map(s => s.y);
  const minX = Math.min(0, ...allX) - 50;
  const maxX = Math.max(500, ...allX.map(x => x + 220)) + 50;
  const minY = Math.min(0, ...allY) - 50;
  const maxY = Math.max(300, ...allY.map(y => y + 120)) + 50;

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  const minimapScale = Math.min(mapWidth / contentWidth, mapHeight / contentHeight);

  // Viewport indicator
  const containerRect = containerRef.current?.getBoundingClientRect();
  const viewportWidth = containerRect ? containerRect.width / zoom : 800;
  const viewportHeight = containerRect ? containerRect.height / zoom : 600;
  const viewportX = (-pan.x / zoom - minX) * minimapScale;
  const viewportY = (-pan.y / zoom - minY) * minimapScale;
  const viewportW = viewportWidth * minimapScale;
  const viewportH = viewportHeight * minimapScale;

  return h('div', { className: "canvas-minimap" },
    h('div', { className: "minimap-content" },
      // Nodes
      steps.map(step => h('div', {
        key: step.id,
        className: "minimap-node",
        style: {
          left: (step.x - minX) * minimapScale,
          top: (step.y - minY) * minimapScale,
          width: 220 * minimapScale,
          height: 80 * minimapScale,
          background: step.step_type === 'email' ? '#3b82f6' : step.step_type === 'wait' ? '#8b5cf6' : '#f59e0b'
        }
      })),
      // Viewport indicator
      h('div', {
        className: "minimap-viewport",
        style: {
          left: Math.max(0, viewportX),
          top: Math.max(0, viewportY),
          width: Math.min(viewportW, mapWidth),
          height: Math.min(viewportH, mapHeight)
        }
      })
    )
  );
};

// --- 8. Step Editor Component ---

const StepEditor = ({ step, onUpdate, onDelete, saving }) => {
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

  const nodeType = NODE_TYPES[step.step_type] || NODE_TYPES.email;
  const IconComponent = Icons[nodeType.icon];

  return h('div', { className: "flex flex-col h-full" },
    // Header
    h('div', { className: `p-4 border-b border-stone-200 node-header ${nodeType.bgClass}` },
      h('div', { className: "flex items-center justify-between" },
        h('div', { className: "flex items-center gap-3" },
          h('div', { className: `node-icon ${nodeType.bgClass}` },
            IconComponent && h(IconComponent, { size: 18 })
          ),
          h('div', null,
            h('h3', { className: "font-semibold text-stone-800" }, nodeType.label),
            saving && h('span', { className: "text-xs text-stone-500 flex items-center gap-1" },
              h(Icons.Loader2, { size: 10, className: "animate-spin" }), "Saving..."
            )
          )
        ),
        h('button', {
          onClick: onDelete,
          className: "p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        }, h(Icons.Trash2, { size: 16 }))
      )
    ),

    // Content
    h('div', { className: "flex-1 overflow-y-auto p-4" },
      step.step_type === 'email' && h('div', { className: "space-y-4" },
        h('div', null,
          h('label', { className: "block text-sm font-medium text-stone-700 mb-1" }, "Subject"),
          h('input', {
            className: "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900",
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
              personalizationVars.slice(0, 3).map(v => h('button', {
                key: v.var,
                onClick: () => insertVar(v.var),
                className: "text-xs bg-stone-100 px-1.5 py-0.5 rounded hover:bg-jaguar-900 hover:text-white transition-colors"
              }, v.var))
            )
          ),
          h('textarea', {
            id: "emailBody",
            className: "w-full px-3 py-2 border border-stone-200 rounded-lg h-64 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900",
            value: data.body,
            onChange: e => handleChange('body', e.target.value),
            onBlur: handleBlur,
            placeholder: "Write your email here..."
          })
        )
      ),

      step.step_type === 'wait' && h('div', { className: "space-y-4" },
        h('p', { className: "text-sm text-stone-600 mb-4" }, "Set how long to wait before proceeding to the next step."),
        h('div', { className: "grid grid-cols-3 gap-3" },
          h('div', null,
            h('label', { className: "block text-xs text-stone-500 mb-1" }, "Days"),
            h('input', {
              type: "number",
              min: "0",
              className: "w-full px-3 py-2 border border-stone-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-jaguar-900/20",
              value: data.wait_days || 0,
              onChange: e => {
                const v = Math.max(0, parseInt(e.target.value) || 0);
                handleChange('wait_days', v);
                onUpdate(step.id, { wait_days: v, wait_hours: data.wait_hours || 0, wait_minutes: data.wait_minutes || 0 });
              }
            })
          ),
          h('div', null,
            h('label', { className: "block text-xs text-stone-500 mb-1" }, "Hours"),
            h('input', {
              type: "number",
              min: "0",
              max: "23",
              className: "w-full px-3 py-2 border border-stone-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-jaguar-900/20",
              value: data.wait_hours || 0,
              onChange: e => {
                const v = Math.min(23, Math.max(0, parseInt(e.target.value) || 0));
                handleChange('wait_hours', v);
                onUpdate(step.id, { wait_days: data.wait_days || 0, wait_hours: v, wait_minutes: data.wait_minutes || 0 });
              }
            })
          ),
          h('div', null,
            h('label', { className: "block text-xs text-stone-500 mb-1" }, "Minutes"),
            h('input', {
              type: "number",
              min: "0",
              max: "59",
              className: "w-full px-3 py-2 border border-stone-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-jaguar-900/20",
              value: data.wait_minutes || 0,
              onChange: e => {
                const v = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                handleChange('wait_minutes', v);
                onUpdate(step.id, { wait_days: data.wait_days || 0, wait_hours: data.wait_hours || 0, wait_minutes: v });
              }
            })
          )
        ),
        h('div', { className: "mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200" },
          h('div', { className: "flex items-center gap-2" },
            h(Icons.Clock, { size: 16, className: "text-purple-600" }),
            h('span', { className: "text-sm font-medium text-purple-900" }, `Total: ${formatWaitDuration(data)}`)
          )
        )
      ),

      step.step_type === 'condition' && h('div', { className: "space-y-4" },
        h('div', { className: "p-3 bg-amber-50 rounded-lg border border-amber-200" },
          h('div', { className: "flex items-center gap-2 mb-2" },
            h(Icons.Split, { size: 16, className: "text-amber-600" }),
            h('span', { className: "font-medium text-amber-900" }, "Condition Branches")
          ),
          h('p', { className: "text-sm text-amber-700" },
            "Each branch evaluates a condition. Configure branches directly on the canvas node."
          )
        ),
        h('div', { className: "p-3 bg-blue-50 rounded-lg border border-blue-200" },
          h('p', { className: "text-sm text-blue-700" },
            "For 'NOT' conditions, the system waits the specified time before checking if the condition was met."
          )
        )
      )
    )
  );
};

// --- 9. New Campaign Modal ---

const NewCampaignModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = React.useState({
    name: '',
    email_account_ids: [],
    contact_list_id: '',
    send_schedule: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start_hour: 9, end_hour: 17 },
    send_immediately: false
  });
  const [emailAccounts, setEmailAccounts] = React.useState([]);
  const [contactLists, setContactLists] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const allDays = [
    { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
    { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' }, { key: 'sun', label: 'Sun' }
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
    const newDays = currentDays.includes(day) ? currentDays.filter(d => d !== day) : [...currentDays, day];
    setFormData({ ...formData, send_schedule: { ...formData.send_schedule, days: newDays } });
  };

  const toggleEmailAccount = (accountId) => {
    const current = formData.email_account_ids;
    const newSelection = current.includes(accountId) ? current.filter(id => id !== accountId) : [...current, accountId];
    setFormData({ ...formData, email_account_ids: newSelection });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.email_account_ids.length === 0) { alert('Please select at least one email account'); return; }
    if (!formData.contact_list_id) { alert('Please select a contact list'); return; }
    const payload = { ...formData, email_account_id: formData.email_account_ids[0] };
    onCreate(payload);
  };

  return h('div', { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in", onClick: onClose },
    h('div', { className: "bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl", onClick: e => e.stopPropagation() },
      h('div', { className: "flex items-center justify-between mb-4" },
        h('h3', { className: "font-serif text-2xl text-jaguar-900" }, "New Campaign"),
        h('button', { onClick: onClose, className: "p-2 hover:bg-stone-100 rounded-lg" }, h(Icons.X, { size: 20 }))
      ),
      loading ? h('div', { className: "flex justify-center py-8" }, h(Icons.Loader2, { className: "animate-spin text-jaguar-900", size: 32 })) :
      h('form', { onSubmit: handleSubmit, className: "space-y-4" },
        h('div', null,
          h('label', { className: "block text-sm font-medium text-stone-700 mb-1" }, "Campaign Name"),
          h('input', {
            required: true,
            className: "w-full border border-stone-200 p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-jaguar-900/20",
            value: formData.name,
            onChange: e => setFormData({...formData, name: e.target.value}),
            placeholder: "e.g., Q1 Outreach Campaign"
          })
        ),
        h('div', null,
          h('label', { className: "block text-sm font-medium text-stone-700 mb-1" }, "Send From"),
          h('div', { className: "border border-stone-200 rounded-lg max-h-32 overflow-y-auto" },
            emailAccounts.length === 0 ?
              h('div', { className: "p-3 text-center text-stone-500 text-sm" }, "No email accounts found") :
              emailAccounts.map(account =>
                h('label', {
                  key: account.id,
                  className: `flex items-center gap-2 p-2.5 hover:bg-stone-50 cursor-pointer border-b last:border-b-0 ${formData.email_account_ids.includes(account.id) ? 'bg-cream-50' : ''}`
                },
                  h('input', {
                    type: "checkbox",
                    checked: formData.email_account_ids.includes(account.id),
                    onChange: () => toggleEmailAccount(account.id),
                    className: "w-4 h-4 rounded border-stone-300 text-jaguar-900"
                  }),
                  h('span', { className: "text-sm text-stone-700 truncate" }, account.email_address)
                )
              )
          )
        ),
        h('div', null,
          h('label', { className: "block text-sm font-medium text-stone-700 mb-1" }, "Target List"),
          h('select', {
            required: true,
            className: "w-full border border-stone-200 p-2.5 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-jaguar-900/20",
            value: formData.contact_list_id,
            onChange: e => setFormData({...formData, contact_list_id: e.target.value})
          },
            h('option', { value: "" }, "Select a contact list..."),
            contactLists.map(l => h('option', { key: l.id, value: l.id }, String(l.name)))
          )
        ),
        h('label', { className: "flex items-center gap-3 p-3 bg-cream-50 rounded-lg border border-stone-200 cursor-pointer" },
          h('input', {
            type: "checkbox",
            checked: formData.send_immediately,
            onChange: e => setFormData({...formData, send_immediately: e.target.checked}),
            className: "w-4 h-4 rounded"
          }),
          h('div', null,
            h('span', { className: "block text-sm font-medium text-stone-700" }, "Send anytime (ignore schedule)"),
            h('span', { className: "text-xs text-stone-500" }, "Emails will send 24/7")
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
            h('label', { className: "block text-xs font-medium text-stone-600 mb-2" }, "Send Days"),
            h('div', { className: "flex flex-wrap gap-1" },
              allDays.map(day =>
                h('button', {
                  key: day.key,
                  type: "button",
                  onClick: () => toggleDay(day.key),
                  className: `px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    formData.send_schedule.days.includes(day.key)
                      ? 'bg-jaguar-900 text-white'
                      : 'bg-white border border-stone-300 text-stone-600 hover:border-jaguar-900'
                  }`
                }, day.label)
              )
            )
          ),
          h('div', { className: "grid grid-cols-2 gap-3" },
            h('div', null,
              h('label', { className: "block text-xs text-stone-600 mb-1" }, "Start Hour"),
              h('select', {
                className: "w-full border border-stone-200 p-2 rounded-lg bg-white text-sm",
                value: formData.send_schedule.start_hour,
                onChange: e => setFormData({ ...formData, send_schedule: { ...formData.send_schedule, start_hour: parseInt(e.target.value) } })
              }, Array.from({ length: 24 }, (_, i) => h('option', { key: i, value: i }, `${i.toString().padStart(2, '0')}:00`)))
            ),
            h('div', null,
              h('label', { className: "block text-xs text-stone-600 mb-1" }, "End Hour"),
              h('select', {
                className: "w-full border border-stone-200 p-2 rounded-lg bg-white text-sm",
                value: formData.send_schedule.end_hour,
                onChange: e => setFormData({ ...formData, send_schedule: { ...formData.send_schedule, end_hour: parseInt(e.target.value) } })
              }, Array.from({ length: 25 }, (_, i) => h('option', { key: i, value: i }, i === 24 ? '24:00' : `${i.toString().padStart(2, '0')}:00`)))
            )
          )
        ),
        h('button', {
          type: "submit",
          className: "w-full bg-jaguar-900 text-white p-3 rounded-lg hover:bg-jaguar-800 font-medium transition-colors flex items-center justify-center gap-2"
        }, h(Icons.Plus, { size: 18 }), "Create Campaign")
      )
    )
  );
};
