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
      try { branches = JSON.parse(s.condition_branches); } catch (e) { branches = []; }
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

const START_NODE = { x: 300, y: 30, width: 120, height: 50 };

const NODE_TYPES = {
  start: { icon: 'Play', color: '#10b981', label: 'Start', bgClass: 'start' },
  email: { icon: 'Mail', color: '#3b82f6', label: 'Email', bgClass: 'email' },
  wait: { icon: 'Clock', color: '#8b5cf6', label: 'Wait', bgClass: 'wait' },
  condition: { icon: 'Split', color: '#f59e0b', label: 'Condition', bgClass: 'condition' },
  end: { icon: 'Check', color: '#ef4444', label: 'End', bgClass: 'end' }
};

// --- Branch width calculation for dynamic fan-out ---
const BASE_BRANCH_WIDTH = 250;

// Recursively calculate horizontal width needed for a single branch
const calculateBranchWidth = (branch) => {
  const branchSteps = branch.branch_steps || [];
  const conditionSteps = branchSteps.filter(s => s.step_type === 'condition');
  if (conditionSteps.length === 0) return BASE_BRANCH_WIDTH;

  let maxWidth = BASE_BRANCH_WIDTH;
  for (const condStep of conditionSteps) {
    const subBranches = condStep.condition_branches || [];
    if (subBranches.length > 0) {
      const totalSubWidth = subBranches.reduce((sum, b) => sum + calculateBranchWidth(b), 0);
      maxWidth = Math.max(maxWidth, totalSubWidth);
    }
  }
  return maxWidth;
};

// Compute X offsets for each branch based on their recursive widths
const getBranchOffsets = (conditionBranches) => {
  if (!conditionBranches || conditionBranches.length === 0) return [];
  const widths = conditionBranches.map(b => calculateBranchWidth(b));
  const totalWidth = widths.reduce((sum, w) => sum + w, 0);
  const offsets = [];
  let currentX = -totalWidth / 2;
  for (let i = 0; i < widths.length; i++) {
    offsets.push(currentX + widths[i] / 2);
    currentX += widths[i];
  }
  return offsets;
};

// Recursively find a step anywhere in the step tree (returns { step, rootStepId, parentId, branchIndex } or null)
const deepFindStep = (steps, targetId) => {
  for (const step of steps) {
    if (step.id === targetId) return { step, rootStepId: step.id, parentId: null, branchIndex: null };
    if (step.step_type === 'condition' && step.condition_branches) {
      const result = deepFindInBranches(step.condition_branches, targetId);
      if (result) return { ...result, rootStepId: step.id };
    }
  }
  return null;
};

const deepFindInBranches = (branches, targetId) => {
  for (let bi = 0; bi < branches.length; bi++) {
    const branch = branches[bi];
    const branchSteps = branch.branch_steps || [];
    for (const bs of branchSteps) {
      if (bs.id === targetId) return { step: bs, parentId: null, branchIndex: bi };
      if (bs.step_type === 'condition' && bs.condition_branches) {
        const deeper = deepFindInBranches(bs.condition_branches, targetId);
        if (deeper) return deeper;
      }
    }
  }
  return null;
};

// Recursively update a step anywhere in the step tree
const deepUpdateStepTree = (stepsArray, targetId, updateFn) => {
  return stepsArray.map(step => {
    if (step.id === targetId) return updateFn(step);
    if (step.step_type === 'condition' && step.condition_branches) {
      return {
        ...step,
        condition_branches: step.condition_branches.map(branch => ({
          ...branch,
          branch_steps: branch.branch_steps
            ? deepUpdateStepTree(branch.branch_steps, targetId, updateFn)
            : []
        }))
      };
    }
    return step;
  });
};

// Find the root-level step that contains a nested step ID
const findRootStepId = (steps, nestedId) => {
  for (const step of steps) {
    if (step.id === nestedId) return step.id;
    if (step.step_type === 'condition' && step.condition_branches) {
      const found = deepFindInBranches(step.condition_branches, nestedId);
      if (found) return step.id;
    }
  }
  return null;
};

// Recursively remove a step from any branch_steps in the tree
const deepRemoveFromTree = (stepsArray, targetId) => {
  return stepsArray.map(step => {
    if (step.step_type === 'condition' && step.condition_branches) {
      return {
        ...step,
        condition_branches: step.condition_branches.map(branch => ({
          ...branch,
          branch_steps: branch.branch_steps
            ? deepRemoveFromTree(branch.branch_steps.filter(bs => bs.id !== targetId), targetId)
            : []
        }))
      };
    }
    return step;
  });
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
    // Always include the Start node in bounds calculation
    const allPoints = [{ x: START_NODE.x, y: START_NODE.y, w: START_NODE.width, h: START_NODE.height }];
    if (nodes && nodes.length > 0) {
      nodes.forEach(n => allPoints.push({ x: n.x, y: n.y, w: 220, h: 120 }));
    }

    const padding = 100;
    const minX = Math.min(...allPoints.map(p => p.x)) - padding;
    const maxX = Math.max(...allPoints.map(p => p.x + p.w)) + padding;
    const minY = Math.min(...allPoints.map(p => p.y)) - padding;
    const maxY = Math.max(...allPoints.map(p => p.y + p.h)) + padding;

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
      // DEBUG: Log raw steps from server, especially condition_branches
      console.log('[LOAD STEPS] Raw steps from server:', rawSteps.length, 'steps');
      rawSteps.forEach(s => {
        if (s.step_type === 'condition') {
          console.log(`[LOAD STEPS] Condition step ${s.id}: condition_branches =`, JSON.stringify(s.condition_branches));
        }
      });
      const cleanSteps = rawSteps.map((s, i) => sanitizeStep(s, i)).filter(Boolean);
      // DEBUG: Log sanitized steps
      cleanSteps.forEach(s => {
        if (s.step_type === 'condition') {
          console.log(`[LOAD STEPS] After sanitize ${s.id}: condition_branches =`, JSON.stringify(s.condition_branches));
        }
      });
      setSteps(cleanSteps);
      loadCampaignStats(campaign.id);
      // Fit view after loading (always center, even with no steps, so Start node is visible)
      setTimeout(() => {
        if (containerRef.current) {
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
      {
        id: 's3', step_type: 'condition', step_order: 3, x: 400, y: 460, condition_branches: [
          {
            condition: 'if_opened', wait_days: 0, branch_steps: [
              { id: 'b1s1', step_type: 'email', subject: 'Thanks for opening!', body: 'Since you showed interest...', x: 200, y: 640 }
            ]
          },
          {
            condition: 'if_not_opened', wait_days: 2, branch_steps: [
              { id: 'b2s1', step_type: 'email', subject: 'Did you miss my email?', body: 'Just wanted to follow up...', x: 600, y: 640 }
            ]
          }
        ]
      }
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
      x: Math.round(400 + (Math.random() - 0.5) * 100),
      y: Math.round(100 + steps.length * 180)
    };

    const newStepRaw = {
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

    if (!isDemo && selectedCampaign) {
      // Create on server FIRST, then add to canvas with real UUID
      try {
        const serverStep = await api.post(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps`, newStepRaw);
        const realStep = sanitizeStep(serverStep, steps.length);
        realStep.x = newPos.x;
        realStep.y = newPos.y;
        setSteps(prev => [...prev, realStep]);
        setSelectedNodes([realStep.id]);
        setActiveStep(realStep.id);
      } catch (e) {
        console.error('Failed to create step:', e);
      }
    } else {
      // Demo mode: use local temp ID
      const cleanStep = sanitizeStep({ ...newStepRaw, id: 'temp-' + Date.now() }, steps.length);
      setSteps([...steps, cleanStep]);
      setSelectedNodes([cleanStep.id]);
      setActiveStep(cleanStep.id);
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
    if (!isDemo && selectedCampaign && !String(stepId).startsWith('temp-')) {
      try {
        await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${stepId}`, {
          position_x: Math.round(newX),
          position_y: Math.round(newY)
        });
      } catch (e) {
        console.error('Failed to save position:', e);
      }
    }
  };

  // Reorder steps based on Y position (drag-drop ordering)
  const handleReorderSteps = async (stepId, newOrder) => {
    // Sort steps by their Y position to determine new order
    const sortedByY = [...steps].sort((a, b) => a.y - b.y);

    // Update all step_order values based on Y position
    const reorderedSteps = sortedByY.map((step, index) => ({
      ...step,
      step_order: index + 1
    }));

    setSteps(reorderedSteps);

    // Save to backend - sequential updates to avoid UNIQUE constraint violations on step_order
    if (!isDemo && selectedCampaign) {
      try {
        const savedSteps = reorderedSteps.filter(s => !String(s.id).startsWith('temp-'));
        // First pass: set all step_orders to temporary negative values to avoid conflicts
        for (const step of savedSteps) {
          await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${step.id}`, {
            step_order: -(step.step_order + 1000)
          });
        }
        // Second pass: set final step_order values and positions
        for (const step of savedSteps) {
          await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${step.id}`, {
            step_order: step.step_order,
            position_x: Math.round(step.x),
            position_y: Math.round(step.y)
          });
        }
      } catch (e) {
        console.error('Failed to reorder steps:', e);
      }
    }
  };

  const handleUpdateStep = async (stepId, updates, parentBranchId = null, branchIndex = null) => {
    setSaving(true);
    const isTopLevel = steps.some(s => s.id === stepId);

    if (isTopLevel) {
      setSteps(steps.map(s => s.id === stepId ? { ...s, ...updates } : s));
      if (!isDemo && selectedCampaign && !String(stepId).startsWith('temp-')) {
        try {
          await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${stepId}`, updates);
        } catch (error) {
          console.error('Update failed:', error);
        }
      }
    } else {
      // Nested step - deep update through the tree
      const updatedSteps = deepUpdateStepTree(steps, stepId, step => ({ ...step, ...updates }));
      setSteps(updatedSteps);

      const rootId = findRootStepId(steps, stepId);
      if (rootId && !isDemo && selectedCampaign && !String(rootId).startsWith('temp-')) {
        try {
          const rootStep = updatedSteps.find(s => s.id === rootId);
          await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${rootId}`, {
            condition_branches: rootStep.condition_branches
          });
        } catch (error) {
          console.error('[SAVE BRANCHES] ERROR updating nested branch step:', error);
        }
      }
    }
    setTimeout(() => setSaving(false), 500);
  };

  const handleDeleteStep = async (stepId, parentBranchId = null, branchIndex = null) => {
    const isTopLevel = steps.some(s => s.id === stepId);

    if (!isTopLevel) {
      // Nested step - deep remove from tree
      const rootId = findRootStepId(steps, stepId);
      const updatedSteps = deepRemoveFromTree(steps, stepId);
      setSteps(updatedSteps);

      if (activeStep === stepId) setActiveStep(null);
      setSelectedNodes(prev => prev.filter(id => id !== stepId));

      if (rootId && !isDemo && selectedCampaign && !String(rootId).startsWith('temp-')) {
        try {
          const rootStep = updatedSteps.find(s => s.id === rootId);
          await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${rootId}`, {
            condition_branches: rootStep.condition_branches
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
    } catch (err) {
      alert(err.message);
    }
  };

  // Helper to find a condition step (top-level or nested) and save after mutation
  const findConditionAndSave = async (conditionStepId, updateFn) => {
    const isTopLevel = steps.some(s => s.id === conditionStepId);
    let conditionStep = isTopLevel ? steps.find(s => s.id === conditionStepId) : null;

    if (!conditionStep) {
      const found = deepFindStep(steps, conditionStepId);
      if (!found) return null;
      conditionStep = found.step;
    }
    if (conditionStep.step_type !== 'condition') return null;

    const updated = updateFn(conditionStep);

    if (isTopLevel) {
      setSteps(prevSteps => prevSteps.map(s => s.id === conditionStepId ? updated : s));
    } else {
      setSteps(prevSteps => deepUpdateStepTree(prevSteps, conditionStepId, () => updated));
    }

    // Save to API
    const rootId = isTopLevel ? conditionStepId : findRootStepId(steps, conditionStepId);
    if (rootId && !isDemo && selectedCampaign && !String(rootId).startsWith('temp-')) {
      try {
        if (isTopLevel) {
          await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${rootId}`, {
            condition_branches: updated.condition_branches
          });
        } else {
          const updatedSteps = deepUpdateStepTree(steps, conditionStepId, () => updated);
          const rootStep = updatedSteps.find(s => s.id === rootId);
          await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${rootId}`, {
            condition_branches: rootStep.condition_branches
          });
        }
      } catch (e) {
        console.error('Error saving condition step:', e);
      }
    }
    return updated;
  };

  const handleAddBranch = async (conditionStepId) => {
    await findConditionAndSave(conditionStepId, (conditionStep) => {
      const usedConditions = conditionStep.condition_branches.map(b => b.condition);
      const available = CONDITION_OPTIONS.find(opt => !usedConditions.includes(opt.value));
      if (!available) return conditionStep;

      const defaultWait = available.hasWait ? { wait_days: 2, wait_hours: 0, wait_minutes: 0 } : { wait_days: 0, wait_hours: 0, wait_minutes: 0 };
      return {
        ...conditionStep,
        condition_branches: [...conditionStep.condition_branches, { condition: available.value, ...defaultWait, branch_steps: [] }]
      };
    });
  };

  const handleRemoveBranch = async (conditionStepId, branchIndex) => {
    await findConditionAndSave(conditionStepId, (conditionStep) => {
      if (conditionStep.condition_branches.length <= 1) return conditionStep;
      return {
        ...conditionStep,
        condition_branches: conditionStep.condition_branches.filter((_, i) => i !== branchIndex)
      };
    });
  };

  const handleUpdateBranchCondition = async (conditionStepId, branchIndex, newCondition) => {
    await findConditionAndSave(conditionStepId, (conditionStep) => {
      const newBranches = [...conditionStep.condition_branches];
      const conditionOpt = CONDITION_OPTIONS.find(o => o.value === newCondition);
      const defaultWait = conditionOpt?.hasWait ? { wait_days: 2, wait_hours: 0, wait_minutes: 0 } : { wait_days: 0, wait_hours: 0, wait_minutes: 0 };
      newBranches[branchIndex] = { ...newBranches[branchIndex], condition: newCondition, ...defaultWait };
      return { ...conditionStep, condition_branches: newBranches };
    });
  };

  // Add step to a specific branch (works for nested conditions too)
  const handleAddStepToBranch = async (conditionStepId, branchIndex, stepType) => {
    let newStepRaw = null;

    await findConditionAndSave(conditionStepId, (conditionStep) => {
      const branches = conditionStep.condition_branches || [];
      const branch = branches[branchIndex];
      const branchSteps = branch.branch_steps || [];
      const offsets = getBranchOffsets(branches);
      const offsetX = offsets[branchIndex] || 0;
      const branchStepY = conditionStep.y + 200 + branchSteps.length * 150;

      newStepRaw = {
        id: 'branch-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        step_type: stepType,
        step_order: branchSteps.length + 1,
        subject: stepType === 'email' ? 'Follow-up Email' : '',
        body: '',
        wait_days: stepType === 'wait' ? 1 : 0,
        wait_hours: 0,
        wait_minutes: 0,
        condition_type: 'if_opened',
        condition_branches: stepType === 'condition' ? [
          { condition: 'if_opened', wait_days: 0, branch_steps: [] },
          { condition: 'if_not_opened', wait_days: 2, branch_steps: [] }
        ] : [],
        x: conditionStep.x + offsetX,
        y: branchStepY
      };

      const newBranches = [...branches];
      newBranches[branchIndex] = {
        ...branch,
        branch_steps: [...branchSteps, newStepRaw]
      };
      return { ...conditionStep, condition_branches: newBranches };
    });

    if (newStepRaw) setActiveStep(newStepRaw.id);
  };

  // Get active step data (searches recursively through nested conditions)
  const getActiveStepData = () => {
    if (!activeStep) return null;
    const mainStep = steps.find(s => s.id === activeStep);
    if (mainStep) return { step: mainStep, parentBranchId: null, branchIndex: null };

    const result = deepFindStep(steps, activeStep);
    if (result) return { step: result.step, parentBranchId: result.rootStepId, branchIndex: null };
    return null;
  };

  // --- Views ---

  if (loading) {
    return h('div', { className: "flex items-center justify-center h-96" },
      h(Icons.Loader2, { className: "animate-spin text-cream-100", size: 48 })
    );
  }

  // Empty State
  if (!selectedCampaign && campaigns.length === 0) {
    return h('div', { className: "flex flex-col items-center justify-center h-96 text-center animate-fade-in" },
      h(Icons.Send, { size: 64, className: "text-white/30 mb-4" }),
      h('h3', { className: "font-serif text-2xl text-white mb-2" }, 'No Campaigns Yet'),
      h('p', { className: "text-white/60 mb-6 max-w-md" }, 'Create your first email campaign to start reaching out.'),
      h('div', { className: "flex gap-3" },
        h('button', {
          onClick: () => setShowNewCampaignModal(true),
          className: "btn-primary px-6 py-3 flex items-center gap-2"
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

    // Block Toolbar (top bar)
    h(BlockToolbar, { onAddStep: handleAddStep }),

    // Main Layout - Canvas + Editor
    h('div', { className: "flex flex-1 overflow-hidden gap-0" },
      // Canvas Area
      h('div', {
        ref: containerRef,
        className: `flex-1 relative overflow-hidden glass-card ${showEditor ? 'rounded-r-none' : ''}`
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
          onReorderSteps: handleReorderSteps,
          onAddBranch: handleAddBranch,
          onRemoveBranch: handleRemoveBranch,
          onUpdateBranchCondition: handleUpdateBranchCondition,
          onAddStepToBranch: handleAddStepToBranch,
          containerRef
        })
      ),

      // Editor Panel (collapsible)
      showEditor && h('div', { className: "w-80 glass-card rounded-l-none border-l border-white/10 overflow-hidden flex flex-col" },
        activeStepData
          ? h(StepEditor, {
            step: activeStepData.step,
            onUpdate: (stepId, updates) => handleUpdateStep(stepId, updates, activeStepData.parentBranchId, activeStepData.branchIndex),
            onDelete: () => handleDeleteStep(activeStepData.step.id, activeStepData.parentBranchId, activeStepData.branchIndex),
            saving: saving
          })
          : h('div', { className: "h-full flex flex-col items-center justify-center text-white/40 p-6" },
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
  return h('div', { className: "flex justify-between items-center mb-3 pb-3 border-b border-white/10" },
    h('div', { className: "flex items-center gap-4" },
      h('div', null,
        h('h1', { className: "font-serif text-2xl text-white" }, selectedCampaign?.name || 'Campaign Builder'),
        h('div', { className: "flex items-center gap-2 text-sm text-white/60" },
          h('span', { className: `w-2 h-2 rounded-full ${selectedCampaign?.status === 'running' ? 'bg-green-500 animate-pulse' : selectedCampaign?.status === 'paused' ? 'bg-yellow-500' : 'bg-white/30'}` }),
          h('span', { className: "capitalize" }, selectedCampaign?.status || 'draft'),
          isDemo && h('span', { className: "ml-2 px-2 py-0.5 bg-cream-100 text-rust-900 text-xs rounded-full" }, "Demo")
        )
      ),
      // Quick stats
      !isDemo && stats && h('div', { className: "flex gap-4 ml-6 pl-6 border-l border-white/10" },
        h(MiniStat, { label: "Sent", value: stats.sent_count, icon: Icons.Send }),
        h(MiniStat, { label: "Opened", value: stats.opened_count, rate: stats.open_rate, icon: Icons.Eye }),
        h(MiniStat, { label: "Replied", value: stats.replied_count, rate: stats.reply_rate, icon: Icons.Reply })
      )
    ),
    h('div', { className: "flex items-center gap-2" },
      h('button', {
        onClick: onToggleEditor,
        className: `p-2 rounded-xl border transition-colors ${showEditor ? 'bg-cream-100 text-rust-900 border-cream-100' : 'border-white/20 text-white/60 hover:bg-white/10 hover:text-white'}`,
        title: showEditor ? "Hide Editor" : "Show Editor"
      }, h(Icons.Edit3, { size: 18 })),

      h('div', { className: "w-px h-6 bg-white/10 mx-1" }),

      !isDemo && selectedCampaign && h('button', {
        onClick: onDeleteCampaign,
        className: "p-2 border border-red-500/30 rounded-xl hover:bg-red-500/20 text-red-400",
        title: "Delete Campaign"
      }, h(Icons.Trash2, { size: 18 })),

      !isDemo && selectedCampaign && (
        selectedCampaign.status === 'running'
          ? h('button', {
            onClick: onPauseCampaign,
            className: "px-3 py-2 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-xl hover:bg-yellow-500/30 flex items-center gap-2 text-sm"
          }, h(Icons.Pause, { size: 16 }), 'Pause')
          : h('button', {
            onClick: onStartCampaign,
            className: "px-3 py-2 bg-green-500/20 text-green-300 border border-green-500/30 rounded-xl hover:bg-green-500/30 flex items-center gap-2 text-sm"
          }, h(Icons.Play, { size: 16 }), selectedCampaign.status === 'paused' ? 'Resume' : 'Start')
      ),

      !isDemo && h('select', {
        className: "glass-input px-3 py-2 rounded-xl text-sm",
        value: selectedCampaign?.id || '',
        onChange: e => {
          const c = campaigns.find(x => x.id === e.target.value);
          if (c) onSelectCampaign(c);
        }
      }, campaigns.map(c => h('option', { key: c.id, value: c.id }, c.name))),

      h('button', {
        onClick: onNewCampaign,
        className: "p-2 bg-cream-100 text-rust-900 rounded-xl hover:bg-cream-200",
        title: "New Campaign"
      }, h(Icons.Plus, { size: 18 }))
    )
  );
};

const MiniStat = ({ label, value, rate, icon: IconComponent }) => {
  return h('div', { className: "flex items-center gap-2" },
    h(IconComponent, { size: 14, className: "text-white/40" }),
    h('span', { className: "text-sm font-medium text-white" }, value || 0),
    rate !== undefined && rate > 0 && h('span', { className: "text-xs text-white/40" }, `(${rate}%)`),
    h('span', { className: "text-xs text-white/40" }, label)
  );
};

// --- 6. Canvas Component ---

const WorkflowCanvas = ({ steps, selectedNodes, setSelectedNodes, activeStep, setActiveStep, canvasState, onAddStep, onDeleteStep, onNodeDrag, onNodeDragEnd, onReorderSteps, onAddBranch, onRemoveBranch, onUpdateBranchCondition, onAddStepToBranch, containerRef }) => {
  const { zoom, setZoom, pan, setPan, isPanning, setIsPanning } = canvasState;

  const [draggingNode, setDraggingNode] = React.useState(null);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });

  const svgRef = React.useRef(null);

  // Handle wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoom * delta, 0.25), 3);

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

  // Handle canvas pan - ALWAYS pan when clicking background
  const handleCanvasMouseDown = (e) => {
    if (e.target === e.currentTarget || e.target.classList.contains('canvas-grid')) {
      // Always start panning when clicking on background
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      // Deselect nodes
      setSelectedNodes([]);
      setActiveStep(null);
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
      const draggedStep = steps.find(s => s.id === draggingNode);
      if (draggedStep) {
        // Check if we should reorder based on Y position
        const sortedByY = [...steps].sort((a, b) => a.y - b.y);
        const newOrder = sortedByY.findIndex(s => s.id === draggingNode) + 1;

        if (newOrder !== draggedStep.step_order) {
          onReorderSteps(draggingNode, newOrder);
        } else {
          onNodeDragEnd(draggingNode, draggedStep.x, draggedStep.y);
        }
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

  // Drop from toolbar
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
  // Recursive helper to add connections for condition branches at any nesting depth
  const addBranchConnections = (connections, parentCenterX, parentY, branches, parentId) => {
    const offsets = getBranchOffsets(branches);
    branches.forEach((branch, bi) => {
      const branchSteps = branch.branch_steps || [];
      const laneCenterX = parentCenterX + offsets[bi];
      const conditionOpt = CONDITION_OPTIONS.find(o => o.value === branch.condition);
      const label = conditionOpt?.shortLabel || branch.condition;

      if (branchSteps.length > 0) {
        connections.push({
          id: `${parentId}-branch-${bi}-start`,
          from: { x: parentCenterX, y: parentY + 100 },
          to: { x: laneCenterX, y: parentY + 200 },
          type: 'branch',
          label: label
        });

        for (let j = 0; j < branchSteps.length - 1; j++) {
          connections.push({
            id: `${parentId}-branch-${bi}-step-${j}`,
            from: { x: laneCenterX, y: parentY + 200 + (j * 150) + 100 },
            to: { x: laneCenterX, y: parentY + 200 + ((j + 1) * 150) },
            type: 'branch'
          });
        }

        connections.push({
          id: `${parentId}-branch-${bi}-to-add`,
          from: { x: laneCenterX, y: parentY + 200 + ((branchSteps.length - 1) * 150) + 100 },
          to: { x: laneCenterX, y: parentY + 200 + (branchSteps.length * 150) },
          type: 'branch-add'
        });

        // Recurse into nested condition steps within this branch
        branchSteps.forEach((bs, bsi) => {
          if (bs.step_type === 'condition' && bs.condition_branches && bs.condition_branches.length > 0) {
            addBranchConnections(connections, laneCenterX, parentY + 200 + bsi * 150, bs.condition_branches, bs.id);
          }
        });
      } else {
        connections.push({
          id: `${parentId}-branch-${bi}-empty`,
          from: { x: parentCenterX, y: parentY + 100 },
          to: { x: laneCenterX, y: parentY + 200 },
          type: 'branch',
          label: label
        });
      }
    });
  };

  const getConnections = () => {
    const connections = [];
    const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);

    // Add start node connection to first step
    if (sortedSteps.length > 0) {
      const firstStep = sortedSteps[0];
      connections.push({
        id: 'start-' + firstStep.id,
        from: { x: START_NODE.x + START_NODE.width / 2, y: START_NODE.y + START_NODE.height },
        to: { x: firstStep.x + 110, y: firstStep.y },
        type: 'main'
      });
    }

    // Connect sequential steps
    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];
      const nextStep = sortedSteps[i + 1];

      if (step.step_type === 'condition') {
        const branches = step.condition_branches || [];
        if (branches.length > 0) {
          addBranchConnections(connections, step.x + 110, step.y, branches, step.id);
        }
      } else if (nextStep) {
        connections.push({
          id: step.id + '-' + nextStep.id,
          from: { x: step.x + 110, y: step.y + 100 },
          to: { x: nextStep.x + 110, y: nextStep.y },
          type: 'main'
        });
      }
    }

    // Add end node connection from last step (only if not a condition)
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

  // Recursive helper to render branch step nodes and add-step placeholders at any depth
  const renderBranchElements = (conditionStep, parentCenterX, parentY) => {
    const branches = conditionStep.condition_branches || [];
    const offsets = getBranchOffsets(branches);
    const elements = [];

    branches.forEach((branch, bi) => {
      const branchSteps = branch.branch_steps || [];
      const laneCenterX = parentCenterX + offsets[bi];
      const nodeX = laneCenterX - 125;

      branchSteps.forEach((branchStep, bsi) => {
        const nodeY = parentY + 200 + (bsi * 150);
        elements.push(h(BranchStepNode, {
          key: `${conditionStep.id}-branch-${bi}-step-${bsi}`,
          step: branchStep,
          parentStep: conditionStep,
          branchIndex: bi,
          stepIndex: bsi,
          x: nodeX,
          y: nodeY,
          isSelected: selectedNodes.includes(branchStep.id),
          isActive: activeStep === branchStep.id,
          onSelect: () => {
            setSelectedNodes([branchStep.id]);
            setActiveStep(branchStep.id);
          },
          onDelete: () => onDeleteStep(branchStep.id, conditionStep.id, bi)
        }));

        // Recurse into nested condition steps
        if (branchStep.step_type === 'condition' && branchStep.condition_branches && branchStep.condition_branches.length > 0) {
          elements.push(...renderBranchElements(branchStep, laneCenterX, nodeY));
        }
      });

      elements.push(h(AddStepPlaceholder, {
        key: `${conditionStep.id}-branch-${bi}-add`,
        x: nodeX,
        y: parentY + 200 + (branchSteps.length * 150),
        branchCondition: branch.condition,
        onAddStep: (stepType) => onAddStepToBranch(conditionStep.id, bi, stepType)
      }));
    });

    return elements;
  };

  return h('div', {
    className: `canvas-container ${isPanning ? 'grabbing' : ''}`,
    onWheel: handleWheel,
    onMouseDown: handleCanvasMouseDown,
    onMouseMove: handleCanvasMouseMove,
    onMouseUp: handleCanvasMouseUp,
    onMouseLeave: handleCanvasMouseUp,
    onDrop: handleDrop,
    onDragOver: handleDragOver
  },
    // Grid background
    h('div', {
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
      h(StartNode, { x: START_NODE.x, y: START_NODE.y }),

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

      // Branch step nodes and add-step placeholders (recursive for nested conditions)
      steps.filter(s => s.step_type === 'condition').flatMap(conditionStep => {
        return renderBranchElements(conditionStep, conditionStep.x + 110, conditionStep.y);
      }),

      // End node (positioned after last step that's not a condition)
      steps.length > 0 && steps[steps.length - 1].step_type !== 'condition' && h(EndNode, {
        x: steps[steps.length - 1].x + 85,
        y: steps[steps.length - 1].y + 200
      })
    ),

    // Zoom indicator (small, bottom right)
    h('div', { className: "absolute bottom-3 right-3 px-2 py-1 bg-black/30 backdrop-blur rounded-lg text-xs text-white/70 font-medium" },
      `${Math.round(zoom * 100)}%`
    )
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

// Branch step node - steps within condition branches
const BranchStepNode = ({ step, parentStep, branchIndex, stepIndex, x, y, isSelected, isActive, onSelect, onDelete }) => {
  const nodeType = NODE_TYPES[step.step_type] || NODE_TYPES.email;
  const IconComponent = Icons[nodeType.icon];

  return h('div', {
    className: `canvas-node ${isSelected ? 'selected' : ''} ${isActive ? 'new' : ''}`,
    style: { left: x, top: y, width: '200px' },
    onMouseDown: (e) => e.stopPropagation(),
    onClick: (e) => { e.stopPropagation(); onSelect(); }
  },
    h('div', { className: "node-card" },
      h('div', { className: `node-header ${nodeType.bgClass}` },
        h('div', { className: `node-icon ${nodeType.bgClass}` },
          IconComponent && h(IconComponent, { size: 14 })
        ),
        h('div', { className: "flex-1 min-w-0" },
          h('span', { className: "font-semibold text-xs text-stone-700 block truncate" },
            step.step_type === 'email' ? (step.subject || 'New Email') :
              step.step_type === 'wait' ? `Wait ${formatWaitDuration(step)}` :
                'Condition'
          )
        ),
        h('button', {
          onClick: (e) => { e.stopPropagation(); onDelete(); },
          className: "p-0.5 rounded hover:bg-white/50 text-stone-400 hover:text-red-500 transition-colors"
        }, h(Icons.X, { size: 12 }))
      ),
      h('div', { className: "node-content py-1" },
        step.step_type === 'email' && h('p', { className: "text-xs text-stone-500 truncate" },
          (step.body || 'No content...').substring(0, 30) + (step.body?.length > 30 ? '...' : '')
        ),
        step.step_type === 'wait' && h('div', { className: "flex items-center gap-1 text-xs text-stone-500" },
          h(Icons.Clock, { size: 10 }),
          h('span', null, 'Delay')
        )
      )
    ),
    h('div', { className: "node-port input" }),
    h('div', { className: "node-port output" })
  );
};

// Add step placeholder - appears at the end of each branch
const AddStepPlaceholder = ({ x, y, branchCondition, onAddStep }) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const conditionOpt = CONDITION_OPTIONS.find(o => o.value === branchCondition);

  const stepOptions = [
    { type: 'email', icon: 'Mail', label: 'Email', color: '#3b82f6' },
    { type: 'wait', icon: 'Clock', label: 'Wait', color: '#8b5cf6' },
    { type: 'condition', icon: 'Split', label: 'Condition', color: '#f59e0b' }
  ];

  const handleAddStepClick = (e, stepType) => {
    e.preventDefault();
    e.stopPropagation();
    onAddStep(stepType);
    setShowMenu(false);
  };

  const handlePlaceholderClick = (e) => {
    e.stopPropagation();
    if (!showMenu) {
      setShowMenu(true);
    }
  };

  const handleOuterMouseDown = (e) => {
    e.stopPropagation();
  };

  // Close menu when clicking outside
  React.useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (e) => {
      setShowMenu(false);
    };

    // Add listener with a small delay to prevent immediate closing
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showMenu]);

  return h('div', {
    className: "canvas-node",
    style: { left: x, top: y, width: '200px', zIndex: showMenu ? 100 : 1 },
    onMouseDown: handleOuterMouseDown,
    onClick: (e) => e.stopPropagation()
  },
    // The clickable card that opens the menu
    h('div', {
      className: "node-card border-2 border-dashed border-stone-300 bg-stone-50/80 hover:border-stone-400 hover:bg-stone-100/80 transition-all cursor-pointer relative",
      onMouseDown: (e) => e.stopPropagation(),
      onClick: handlePlaceholderClick
    },
      h('div', { className: "p-3 text-center" },
        h('div', { className: "flex items-center justify-center gap-2 text-stone-400" },
          h(Icons.Plus, { size: 18 }),
          h('span', { className: "text-sm font-medium" }, "Add Step")
        ),
        h('p', { className: "text-xs text-stone-400 mt-1" },
          `to "${conditionOpt?.shortLabel || branchCondition}" branch`
        )
      )
    ),

    // Dropdown menu - OUTSIDE the clickable card
    showMenu && h('div', {
      className: "absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg border border-stone-200 overflow-hidden",
      style: { zIndex: 1000 },
      onMouseDown: (e) => e.stopPropagation(),
      onClick: (e) => e.stopPropagation()
    },
      stepOptions.map(opt => {
        const Icon = Icons[opt.icon];
        return h('button', {
          key: opt.type,
          type: 'button',
          className: "w-full px-3 py-2 flex items-center gap-2 hover:bg-stone-100 transition-colors text-left",
          onMouseDown: (e) => e.stopPropagation(),
          onClick: (e) => handleAddStepClick(e, opt.type)
        },
          h('div', {
            className: "w-6 h-6 rounded flex items-center justify-center",
            style: { background: opt.color }
          },
            Icon && h(Icon, { size: 12, color: 'white' })
          ),
          h('span', { className: "text-sm text-stone-700" }, opt.label)
        );
      })
    ),

    h('div', { className: "node-port input" })
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
              h('span', { className: "text-xs text-stone-600" }, opt?.label || branch.condition)
            );
          }),
          h('span', { className: "text-xs text-stone-400 italic" }, 'Click to edit branches')
        )
      )
    ),

    // Connection ports
    h('div', { className: "node-port input" }),
    h('div', { className: "node-port output" })
  );
};

// Horizontal toolbar for adding blocks
const BlockToolbar = ({ onAddStep }) => {
  const handleDragStart = (e, stepType) => {
    e.dataTransfer.setData('stepType', stepType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const blocks = [
    { type: 'email', icon: 'Mail', label: 'Email', color: '#3b82f6', desc: 'Send an email' },
    { type: 'wait', icon: 'Clock', label: 'Wait', color: '#8b5cf6', desc: 'Add a delay' },
    { type: 'condition', icon: 'Split', label: 'Condition', color: '#f59e0b', desc: 'Branch logic' }
  ];

  return h('div', { className: "flex items-center gap-2 p-2 glass-card rounded-xl mb-2" },
    h('span', { className: "text-xs font-semibold text-white/40 uppercase tracking-wider px-2" }, "Add Block:"),
    blocks.map(block => {
      const IconComponent = Icons[block.icon];
      return h('div', {
        key: block.type,
        className: "flex items-center gap-2 px-3 py-2 bg-white/10 rounded-xl cursor-grab border border-transparent hover:border-white/20 hover:bg-white/15 transition-all",
        draggable: true,
        onDragStart: (e) => handleDragStart(e, block.type),
        onClick: () => onAddStep(block.type),
        title: block.desc
      },
        h('div', {
          className: "w-7 h-7 rounded-lg flex items-center justify-center",
          style: { background: block.color }
        },
          IconComponent && h(IconComponent, { size: 14, color: 'white' })
        ),
        h('span', { className: "text-sm font-medium text-white" }, block.label)
      );
    }),
    h('div', { className: "flex-1" }),
    h('span', { className: "text-xs text-white/40 px-2" }, "Drag blocks onto canvas or click to add")
  );
};

// --- 8. Step Editor Component ---

const StepEditor = ({ step, onUpdate, onDelete, saving }) => {
  const [data, setData] = React.useState(step);
  React.useEffect(() => { setData(step); }, [step.id]);
  // Keep condition_branches in sync with parent (they change via canvas interactions)
  const branchesKey = JSON.stringify(step.condition_branches);
  React.useEffect(() => {
    setData(prev => ({ ...prev, condition_branches: step.condition_branches }));
  }, [branchesKey]);

  const handleChange = (key, val) => setData({ ...data, [key]: val });
  // IMPORTANT: Exclude condition_branches from blur updates - they have their own save handlers
  // Sending stale condition_branches from local data state would overwrite freshly-saved branches
  const handleBlur = () => {
    const { condition_branches, ...fieldsToUpdate } = data;
    onUpdate(step.id, fieldsToUpdate);
  };

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
    h('div', { className: `p-4 border-b border-white/10` },
      h('div', { className: "flex items-center justify-between" },
        h('div', { className: "flex items-center gap-3" },
          h('div', { className: `node-icon ${nodeType.bgClass}` },
            IconComponent && h(IconComponent, { size: 18 })
          ),
          h('div', { className: "min-h-[40px]" },
            h('h3', { className: "font-semibold text-white" }, nodeType.label),
            h('span', {
              className: `text-xs text-white/50 flex items-center gap-1 transition-opacity duration-200 ${saving ? 'opacity-100' : 'opacity-0'}`
            },
              h(Icons.Loader2, { size: 10, className: "animate-spin" }), "Saving..."
            )
          )
        ),
        h('button', {
          onClick: onDelete,
          className: "p-2 text-white/40 hover:text-red-400 hover:bg-red-500/20 rounded-xl transition-colors"
        }, h(Icons.Trash2, { size: 16 }))
      )
    ),

    // Content
    h('div', { className: "flex-1 overflow-y-auto p-4" },
      step.step_type === 'email' && h('div', { className: "space-y-4" },
        h('div', null,
          h('label', { className: "block text-sm font-medium text-white mb-1" }, "Subject"),
          h('input', {
            className: "glass-input w-full px-3 py-2 rounded-xl text-sm",
            value: data.subject,
            onChange: e => handleChange('subject', e.target.value),
            onBlur: handleBlur,
            placeholder: "Email subject line..."
          })
        ),
        h('div', null,
          h('div', { className: "flex justify-between items-center mb-1" },
            h('label', { className: "block text-sm font-medium text-white" }, "Body"),
            h('div', { className: "flex flex-wrap gap-1" },
              personalizationVars.slice(0, 3).map(v => h('button', {
                key: v.var,
                onClick: () => insertVar(v.var),
                className: "text-xs bg-white/10 text-white/70 px-1.5 py-0.5 rounded-lg hover:bg-cream-100 hover:text-rust-900 transition-colors"
              }, v.var))
            )
          ),
          h('textarea', {
            id: "emailBody",
            className: "glass-input w-full px-3 py-2 rounded-xl h-64 font-mono text-sm",
            value: data.body,
            onChange: e => handleChange('body', e.target.value),
            onBlur: handleBlur,
            placeholder: "Write your email here..."
          })
        )
      ),

      step.step_type === 'wait' && h('div', { className: "space-y-4" },
        h('p', { className: "text-sm text-white/60 mb-4" }, "Set how long to wait before proceeding to the next step."),
        h('div', { className: "grid grid-cols-3 gap-3" },
          h('div', null,
            h('label', { className: "block text-xs text-white/50 mb-1" }, "Days"),
            h('input', {
              type: "number",
              min: "0",
              className: "glass-input w-full px-3 py-2 rounded-xl text-center",
              value: data.wait_days || 0,
              onChange: e => {
                const v = Math.max(0, parseInt(e.target.value) || 0);
                handleChange('wait_days', v);
                onUpdate(step.id, { wait_days: v, wait_hours: data.wait_hours || 0, wait_minutes: data.wait_minutes || 0 });
              }
            })
          ),
          h('div', null,
            h('label', { className: "block text-xs text-white/50 mb-1" }, "Hours"),
            h('input', {
              type: "number",
              min: "0",
              max: "23",
              className: "glass-input w-full px-3 py-2 rounded-xl text-center",
              value: data.wait_hours || 0,
              onChange: e => {
                const v = Math.min(23, Math.max(0, parseInt(e.target.value) || 0));
                handleChange('wait_hours', v);
                onUpdate(step.id, { wait_days: data.wait_days || 0, wait_hours: v, wait_minutes: data.wait_minutes || 0 });
              }
            })
          ),
          h('div', null,
            h('label', { className: "block text-xs text-white/50 mb-1" }, "Minutes"),
            h('input', {
              type: "number",
              min: "0",
              max: "59",
              className: "glass-input w-full px-3 py-2 rounded-xl text-center",
              value: data.wait_minutes || 0,
              onChange: e => {
                const v = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                handleChange('wait_minutes', v);
                onUpdate(step.id, { wait_days: data.wait_days || 0, wait_hours: data.wait_hours || 0, wait_minutes: v });
              }
            })
          )
        ),
        h('div', { className: "mt-4 p-3 bg-purple-500/20 rounded-xl border border-purple-500/30" },
          h('div', { className: "flex items-center gap-2" },
            h(Icons.Clock, { size: 16, className: "text-purple-300" }),
            h('span', { className: "text-sm font-medium text-purple-200" }, `Total: ${formatWaitDuration(data)}`)
          )
        )
      ),

      step.step_type === 'condition' && h('div', { className: "space-y-4" },
        // Branch List
        h('div', { className: "space-y-3" },
          h('label', { className: "block text-sm font-medium text-white mb-2" }, "Condition Branches"),
          (data.condition_branches || []).map((branch, bi) => {
            const conditionOpt = CONDITION_OPTIONS.find(o => o.value === branch.condition);
            return h('div', {
              key: bi,
              className: "p-3 bg-white/5 rounded-xl border border-white/10"
            },
              // Branch header with condition selector
              h('div', { className: "flex items-center gap-2 mb-3" },
                h('div', { className: `w-3 h-3 rounded-full ${conditionOpt?.color || 'bg-stone-400'}` }),
                h('select', {
                  className: "glass-input flex-1 px-2 py-1.5 rounded-lg text-sm",
                  value: branch.condition,
                  onChange: e => {
                    const newCondition = e.target.value;
                    const newOpt = CONDITION_OPTIONS.find(o => o.value === newCondition);
                    const defaultWait = newOpt?.hasWait ? { wait_days: 2, wait_hours: 0, wait_minutes: 0 } : { wait_days: 0, wait_hours: 0, wait_minutes: 0 };
                    const newBranches = [...data.condition_branches];
                    newBranches[bi] = { ...branch, condition: newCondition, ...defaultWait };
                    setData({ ...data, condition_branches: newBranches });
                    onUpdate(step.id, { condition_branches: newBranches });
                  }
                },
                  CONDITION_OPTIONS.map(o => h('option', { key: o.value, value: o.value }, o.label))
                ),
                (data.condition_branches || []).length > 1 && h('button', {
                  onClick: () => {
                    const newBranches = data.condition_branches.filter((_, i) => i !== bi);
                    setData({ ...data, condition_branches: newBranches });
                    onUpdate(step.id, { condition_branches: newBranches });
                  },
                  className: "p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                }, h(Icons.Trash2, { size: 14 }))
              ),

              // Wait time inputs (for conditions that have wait)
              conditionOpt?.hasWait && h('div', { className: "mt-2" },
                h('label', { className: "block text-xs text-white/50 mb-2" }, "Wait before checking:"),
                h('div', { className: "grid grid-cols-3 gap-2" },
                  h('div', null,
                    h('label', { className: "block text-xs text-white/40 mb-1" }, "Days"),
                    h('input', {
                      type: "number",
                      min: "0",
                      className: "glass-input w-full px-2 py-1 rounded-lg text-sm text-center",
                      value: branch.wait_days || 0,
                      onChange: e => {
                        const v = Math.max(0, parseInt(e.target.value) || 0);
                        const newBranches = [...data.condition_branches];
                        newBranches[bi] = { ...branch, wait_days: v };
                        setData({ ...data, condition_branches: newBranches });
                        onUpdate(step.id, { condition_branches: newBranches });
                      }
                    })
                  ),
                  h('div', null,
                    h('label', { className: "block text-xs text-white/40 mb-1" }, "Hours"),
                    h('input', {
                      type: "number",
                      min: "0",
                      max: "23",
                      className: "glass-input w-full px-2 py-1 rounded-lg text-sm text-center",
                      value: branch.wait_hours || 0,
                      onChange: e => {
                        const v = Math.min(23, Math.max(0, parseInt(e.target.value) || 0));
                        const newBranches = [...data.condition_branches];
                        newBranches[bi] = { ...branch, wait_hours: v };
                        setData({ ...data, condition_branches: newBranches });
                        onUpdate(step.id, { condition_branches: newBranches });
                      }
                    })
                  ),
                  h('div', null,
                    h('label', { className: "block text-xs text-white/40 mb-1" }, "Min"),
                    h('input', {
                      type: "number",
                      min: "0",
                      max: "59",
                      className: "glass-input w-full px-2 py-1 rounded-lg text-sm text-center",
                      value: branch.wait_minutes || 0,
                      onChange: e => {
                        const v = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                        const newBranches = [...data.condition_branches];
                        newBranches[bi] = { ...branch, wait_minutes: v };
                        setData({ ...data, condition_branches: newBranches });
                        onUpdate(step.id, { condition_branches: newBranches });
                      }
                    })
                  )
                )
              ),

              // Branch steps count
              h('div', { className: "mt-2 text-xs text-white/40" },
                `${(branch.branch_steps || []).length} step(s) in this branch`
              )
            );
          })
        ),

        // Add Branch Button
        (data.condition_branches || []).length < CONDITION_OPTIONS.length && h('button', {
          onClick: () => {
            const usedConditions = (data.condition_branches || []).map(b => b.condition);
            const available = CONDITION_OPTIONS.find(opt => !usedConditions.includes(opt.value));
            if (!available) return;
            const defaultWait = available.hasWait ? { wait_days: 2, wait_hours: 0, wait_minutes: 0 } : { wait_days: 0, wait_hours: 0, wait_minutes: 0 };
            const newBranches = [...(data.condition_branches || []), { condition: available.value, ...defaultWait, branch_steps: [] }];
            setData({ ...data, condition_branches: newBranches });
            onUpdate(step.id, { condition_branches: newBranches });
          },
          className: "w-full p-2 border border-dashed border-white/20 rounded-xl text-white/60 hover:border-amber-500/50 hover:text-amber-300 transition-colors flex items-center justify-center gap-2"
        },
          h(Icons.Plus, { size: 16 }),
          "Add Branch"
        ),

        // Info panel
        h('div', { className: "p-3 bg-blue-500/20 rounded-xl border border-blue-500/30" },
          h('p', { className: "text-sm text-blue-200/70" },
            "For 'NOT' conditions (Not Opened, Not Replied), the system waits the specified time before checking if the condition was met."
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

  return h('div', { className: "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in", onClick: onClose },
    h('div', { className: "glass-modal rounded-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto", onClick: e => e.stopPropagation() },
      h('div', { className: "flex items-center justify-between mb-4" },
        h('h3', { className: "font-serif text-2xl text-white" }, "New Campaign"),
        h('button', { onClick: onClose, className: "p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors" }, h(Icons.X, { size: 20 }))
      ),
      loading ? h('div', { className: "flex justify-center py-8" }, h(Icons.Loader2, { className: "animate-spin text-cream-100", size: 32 })) :
        h('form', { onSubmit: handleSubmit, className: "space-y-4" },
          h('div', null,
            h('label', { className: "block text-sm font-medium text-white mb-1" }, "Campaign Name"),
            h('input', {
              required: true,
              className: "glass-input w-full p-2.5 rounded-xl text-sm",
              value: formData.name,
              onChange: e => setFormData({ ...formData, name: e.target.value }),
              placeholder: "e.g., Q1 Outreach Campaign"
            })
          ),
          h('div', null,
            h('label', { className: "block text-sm font-medium text-white mb-1" }, "Send From"),
            h('div', { className: "glass-input rounded-xl max-h-32 overflow-y-auto p-0" },
              emailAccounts.length === 0 ?
                h('div', { className: "p-3 text-center text-white/50 text-sm" }, "No email accounts found") :
                emailAccounts.map(account =>
                  h('label', {
                    key: account.id,
                    className: `flex items-center gap-2 p-2.5 hover:bg-white/10 cursor-pointer border-b border-white/10 last:border-b-0 ${formData.email_account_ids.includes(account.id) ? 'bg-cream-100/10' : ''}`
                  },
                    h('input', {
                      type: "checkbox",
                      checked: formData.email_account_ids.includes(account.id),
                      onChange: () => toggleEmailAccount(account.id),
                      className: "w-4 h-4 rounded border-white/30 bg-transparent"
                    }),
                    h('span', { className: "text-sm text-white truncate" }, account.email_address)
                  )
                )
            )
          ),
          h('div', null,
            h('label', { className: "block text-sm font-medium text-white mb-1" }, "Target List"),
            h('select', {
              required: true,
              className: "glass-input w-full p-2.5 rounded-xl text-sm",
              value: formData.contact_list_id,
              onChange: e => setFormData({ ...formData, contact_list_id: e.target.value })
            },
              h('option', { value: "" }, "Select a contact list..."),
              contactLists.map(l => h('option', { key: l.id, value: l.id }, String(l.name)))
            )
          ),
          h('label', { className: "flex items-center gap-3 p-3 bg-cream-100/10 rounded-xl border border-white/10 cursor-pointer" },
            h('input', {
              type: "checkbox",
              checked: formData.send_immediately,
              onChange: e => setFormData({ ...formData, send_immediately: e.target.checked }),
              className: "w-4 h-4 rounded bg-transparent border-white/30"
            }),
            h('div', null,
              h('span', { className: "block text-sm font-medium text-white" }, "Send anytime (ignore schedule)"),
              h('span', { className: "text-xs text-white/50" }, "Emails will send 24/7")
            )
          ),
          h('button', {
            type: "button",
            onClick: () => setShowAdvanced(!showAdvanced),
            className: "text-sm text-cream-100 hover:text-white flex items-center gap-1 transition-colors"
          },
            h(showAdvanced ? Icons.ChevronUp : Icons.ChevronDown, { size: 16 }),
            showAdvanced ? "Hide Schedule" : "Show Schedule"
          ),
          showAdvanced && h('div', { className: "space-y-3 p-3 bg-white/5 rounded-xl border border-white/10" },
            h('div', null,
              h('label', { className: "block text-xs font-medium text-white/60 mb-2" }, "Send Days"),
              h('div', { className: "flex flex-wrap gap-1" },
                allDays.map(day =>
                  h('button', {
                    key: day.key,
                    type: "button",
                    onClick: () => toggleDay(day.key),
                    className: `px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${formData.send_schedule.days.includes(day.key)
                        ? 'bg-cream-100 text-rust-900'
                        : 'bg-white/10 border border-white/20 text-white/60 hover:border-white/40'
                      }`
                  }, day.label)
                )
              )
            ),
            h('div', { className: "grid grid-cols-2 gap-3" },
              h('div', null,
                h('label', { className: "block text-xs text-white/60 mb-1" }, "Start Hour"),
                h('select', {
                  className: "glass-input w-full p-2 rounded-xl text-sm",
                  value: formData.send_schedule.start_hour,
                  onChange: e => setFormData({ ...formData, send_schedule: { ...formData.send_schedule, start_hour: parseInt(e.target.value) } })
                }, Array.from({ length: 24 }, (_, i) => h('option', { key: i, value: i }, `${i.toString().padStart(2, '0')}:00`)))
              ),
              h('div', null,
                h('label', { className: "block text-xs text-white/60 mb-1" }, "End Hour"),
                h('select', {
                  className: "glass-input w-full p-2 rounded-xl text-sm",
                  value: formData.send_schedule.end_hour,
                  onChange: e => setFormData({ ...formData, send_schedule: { ...formData.send_schedule, end_hour: parseInt(e.target.value) } })
                }, Array.from({ length: 25 }, (_, i) => h('option', { key: i, value: i }, i === 24 ? '24:00' : `${i.toString().padStart(2, '0')}:00`)))
              )
            )
          ),
          h('button', {
            type: "submit",
            className: "btn-primary w-full p-3 flex items-center justify-center gap-2"
          }, h(Icons.Plus, { size: 18 }), "Create Campaign")
        )
    )
  );
};
