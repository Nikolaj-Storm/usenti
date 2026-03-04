// Usenti - Campaign Builder (Canvas-Based Visual Workflow)
// n8n meets Scratch meets Miro style interface

// --- 1. Data Sanitizers ---

const sanitizeCampaign = (c) => {
  if (!c || typeof c !== 'object') return null;
  return {
    id: String(c.id || ''),
    name: String(c.name || 'Untitled Campaign'),
    status: String(c.status || 'draft'),
    updated_at: c.updated_at ? String(c.updated_at) : null,
    track_opens: !!c.track_opens
  };
};

const sanitizeStep = (s, index = 0) => {
  if (!s || typeof s !== 'object') return null;

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
    // Condition fields
    condition_type: s.condition_type ? String(s.condition_type) : null,
    parent_step_id: s.parent_step_id ? String(s.parent_step_id) : null,
    branch: s.branch ? String(s.branch) : null,
    // Canvas position
    x: Number(s.x || s.position_x || defaultX),
    y: Number(s.y || s.position_y || defaultY)
  };
};

// --- 2. Constants ---

const START_NODE = { x: 300, y: 30, width: 120, height: 50 };

const NODE_TYPES = {
  start: { icon: 'Play', color: '#10b981', label: 'Start', bgClass: 'start' },
  email: { icon: 'Mail', color: '#3b82f6', label: 'Email', bgClass: 'email' },
  wait: { icon: 'Clock', color: '#8b5cf6', label: 'Wait', bgClass: 'wait' },
  condition: { icon: 'Split', color: '#f59e0b', label: 'Condition', bgClass: 'condition' },
  linkedin_dm: { icon: 'MessageSquare', color: '#0a66c2', label: 'LinkedIn DM', bgClass: 'linkedin_dm' },
  linkedin_connection_request: { icon: 'UserPlus', color: '#0a66c2', label: 'LinkedIn Connect', bgClass: 'linkedin_connection_request' },
  end: { icon: 'Check', color: '#ef4444', label: 'End', bgClass: 'end' }
};

const CONDITION_TYPES = {
  email_opened: { label: 'Email Opened', yesLabel: 'If Opened', noLabel: 'If NOT Opened', icon: 'Eye' }
};

const getConditionLabel = (conditionType) => {
  const ct = CONDITION_TYPES[conditionType];
  return ct ? ct.label : 'Unknown Condition';
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
      nodes.forEach(n => {
        let w = 220;
        let h = 120;
        let x = n.x;
        let y = n.y;

        // For condition nodes, include the "potential" branch space
        if (n.step_type === 'condition') {
          // Expand left/right/down
          x = n.x - 260; // Include left branch space
          w = 220 + 520; // Original width + left offset + right offset
          h = 120 + 400; // Height + branch depth
        }
        allPoints.push({ x, y, w, h });
      });
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

  const ensureNodeVisible = (node, containerWidth, containerHeight) => {
    // Check if node is out of view
    // Viewport bounds in canvas coordinates
    const viewX = -pan.x / zoom;
    const viewY = -pan.y / zoom;
    const viewW = containerWidth / zoom;
    const viewH = containerHeight / zoom;

    const nodeRight = node.x + 220; // Node width
    const nodeBottom = node.y + 120; // Node height

    const padding = 50;

    let newZoom = zoom;
    let newPanX = pan.x;
    let newPanY = pan.y;
    let changed = false;

    // Check bounds (with padding)
    if (nodeRight > viewX + viewW - padding || nodeBottom > viewY + viewH - padding ||
      node.x < viewX + padding || node.y < viewY + padding) {

      // Calculate required scale to fit
      // Simple approach: Zoom out until it fits, if it's just off screen
      // Or just pan if zoom is already low?
      // User asked to "zoom out a little"

      // Let's try zooming out by 10% steps until it fits or we hit min zoom
      // But we also need to center/pan effectively. 
      // Actually, fitting the view to include the new node and the start node 
      // might be the most robust "zoom out to see context" approach.
      // But let's try a softer approach first:

      const targetZoom = Math.max(zoom * 0.9, 0.25);

      // If we zoom out, we want to keep the center or top-left relatively stable or center the new content?
      // Let's use fitView logic but scoped to the new extent?
      // No, let's just use the `fitView` logic but make sure we include the new node. 
      // But we can't easily access *all* nodes here inside the hook without passing them.
      // So checking bounds and stepping down zoom is valid.

      if (nodeBottom > viewY + viewH - padding) {
        newZoom = Math.max(zoom * 0.85, 0.25);
        changed = true;
      }
    }

    if (changed || (right > -pan.x / newZoom + containerWidth / newZoom - padding) || (bottom > -pan.y / newZoom + containerHeight / newZoom - padding)) {
      if (!changed) newZoom = zoom; // If we didn't change zoom above

      // Re-calculate view bounds with new zoom
      const newViewW = containerWidth / newZoom;
      const newViewH = containerHeight / newZoom;

      // Center the new content area? Or just ensure it's in view?
      // Let's try to center the bottom-center of the new block logic
      const targetCenterX = (left + right) / 2;

      // Pan X: Center horizontally
      newPanX = containerWidth / 2 - targetCenterX * newZoom;

      // Pan Y: 
      // Ensure bottom is visible with significant padding (approx 15% of viewport height buffer)
      // This ensures the user sees "what's next" or empty space below
      const bottomBuffer = newViewH * 0.15;

      if (bottom > -pan.y / newZoom + newViewH - bottomBuffer) {
        // Pan up so that 'bottom' is at (viewportHeight - bottomBuffer)
        newPanY = -(bottom - newViewH + bottomBuffer) * newZoom;
      } else {
        // If we zoomed out but didn't need to pan Y (e.g. it fits), maybe we still want to center X?
        // Yes, newPanX is already set. newPanY defaults to current pan.y
        // But if we zoomed out, the current pan.y might be weird relative to the new zoom center
        // dragging/wheel logic uses mouse-relative. Here we set absolute pan.
        // So we should probably try to keep the top stable or center the content?
        // Let's just keep the current Y if it fits, but maybe ensure top doesn't fly off?
        // For now, just ensuring bottom visibility is the priority.
        newPanY = pan.y;

        // Actually, if we just set zoom, the pan needs to be adjusted because the coordinate system scaled.
        // If we don't change pan, the view scales around 0,0 (top left of canvas content space).
        // If we want to "zoom out" effectively, we usually want to keep the center of view stable or similar.
        // But `setZoom` and `setPan` are independent in our state (unlike distinct transform matrix).
        // When rendering: translate(pan.x, pan.y) scale(zoom).

        // If we change zoom but not pan, the point at (0,0) in screen space remains (0,0) in canvas space.
        // The content shrinks towards top-left.

        // So we MUST calculate a new Pan Y if we change zoom, even if "it fits", to avoid disorientation?
        // The simple logic above only calculates newPanY if it overflows bottom.
        // If we change zoom, we should probably center the target node if we can?
        // Let's just default to centering the node vertically if we change zoom and it fits easily.

        if (changed) {
          const targetCenterY = (top + bottom) / 2;
          newPanY = containerHeight / 2 - targetCenterY * newZoom;
        }
      }

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    }
  };

  return { zoom, setZoom, pan, setPan, isPanning, setIsPanning, tool, setTool, zoomIn, zoomOut, resetView, fitView, ensureNodeVisible };
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
  const [showStartModal, setShowStartModal] = React.useState(false);
  const [usage, setUsage] = React.useState(null);

  const canvasState = useCanvasState();
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    loadCampaigns();
    loadUsage();
  }, []);

  const loadUsage = async () => {
    try {
      const res = await api.get('/api/stripe/status');
      setUsage(res.usage);
    } catch (e) {
      console.error('Failed to load usage status', e);
    }
  };

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
      { id: 's3', step_type: 'condition', condition_type: 'email_opened', step_order: 3, x: 400, y: 460 },
      // Yes branch (opened)
      { id: 's4', step_type: 'email', subject: 'Thanks for reading!', body: 'Hi {{first_name}}, since you showed interest...', step_order: 1, parent_step_id: 's3', branch: 'yes', x: 140, y: 640 },
      // No branch (not opened)
      { id: 's5', step_type: 'email', subject: 'Did you miss this?', body: 'Hi {{first_name}}, I wanted to make sure you saw...', step_order: 1, parent_step_id: 's3', branch: 'no', x: 660, y: 640 },
      { id: 's6', step_type: 'wait', wait_days: 1, step_order: 2, parent_step_id: 's3', branch: 'no', x: 660, y: 800 }
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
    setShowStartModal(true);
  };

  const confirmStartCampaign = async () => {
    setShowStartModal(false);
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

  // Add step to canvas (supports main flow and branch steps)
  const handleAddStep = async (stepType, position = null, parentStepId = null, branch = null) => {
    // Calculate position: for branch steps, position relative to parent condition
    let newPos = position;
    if (!newPos) {
      if (parentStepId && branch) {
        // Position branch step relative to parent condition
        const parentStep = steps.find(s => s.id === parentStepId);
        const branchSteps = steps.filter(s => s.parent_step_id === parentStepId && s.branch === branch);
        const lastBranchStep = branchSteps.length > 0
          ? branchSteps.sort((a, b) => a.step_order - b.step_order)[branchSteps.length - 1]
          : null;
        const offsetX = branch === 'yes' ? -260 : 260;
        newPos = {
          x: lastBranchStep ? lastBranchStep.x : (parentStep ? parentStep.x + offsetX : 400),
          y: lastBranchStep ? lastBranchStep.y + 160 : (parentStep ? parentStep.y + 180 : 280)
        };
      } else {
        // Main flow positioning logic - align with START_NODE (x=300)
        const mainSteps = steps.filter(s => !s.parent_step_id);
        const lastMainStep = mainSteps.length > 0
          ? mainSteps.sort((a, b) => a.step_order - b.step_order)[mainSteps.length - 1]
          : null;

        newPos = {
          x: 300, // Always align with Start node
          y: lastMainStep ? lastMainStep.y + 180 : 180 // Below start node (y=30) or last step
        };
      }
    }

    // Calculate step_order within the relevant sequence
    let stepOrder;
    if (parentStepId && branch) {
      const branchSteps = steps.filter(s => s.parent_step_id === parentStepId && s.branch === branch);
      stepOrder = branchSteps.length + 1;
    } else {
      const mainSteps = steps.filter(s => !s.parent_step_id);
      stepOrder = mainSteps.length + 1;
    }

    const newStepRaw = {
      step_type: stepType,
      step_order: stepOrder,
      subject: stepType === 'email' ? 'New Email' : '',
      body: '',
      wait_days: stepType === 'wait' ? 1 : 0,
      wait_hours: 0,
      wait_minutes: 0,
      condition_type: stepType === 'condition' ? 'email_opened' : null,
      parent_step_id: parentStepId || null,
      branch: branch || null,
      x: newPos.x,
      y: newPos.y
    };

    let addedStep = null;

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
        addedStep = realStep;
      } catch (e) {
        console.error('Failed to create step:', e);
      }
    } else {
      // Demo mode: use local temp ID
      const cleanStep = sanitizeStep({ ...newStepRaw, id: 'temp-' + Date.now() }, steps.length);
      setSteps([...steps, cleanStep]);
      setSelectedNodes([cleanStep.id]);
      setActiveStep(cleanStep.id);
      addedStep = cleanStep;
    }

    // Auto-zoom to fit ALL nodes
    if (addedStep && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      // Include the new step in the calculation
      const allSteps = [...steps, addedStep];
      // Small timeout to let state settle? Not strictly needed if we pass the list explicitly
      canvasState.fitView(allSteps, rect.width, rect.height);
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

  // Reorder steps based on Y position (drag-drop ordering) - only for main flow steps
  const handleReorderSteps = async (stepId, newOrder) => {
    const step = steps.find(s => s.id === stepId);
    // Only reorder main flow steps (not branch steps)
    if (step && step.parent_step_id) {
      // Branch step dragged - just save position, don't reorder
      handleNodeDragEnd(stepId, step.x, step.y);
      return;
    }

    // Sort main flow steps by their Y position to determine new order
    const mainSteps = steps.filter(s => !s.parent_step_id);
    const branchSteps = steps.filter(s => s.parent_step_id);
    const sortedByY = [...mainSteps].sort((a, b) => a.y - b.y);

    // Update all step_order values based on Y position
    const reorderedMain = sortedByY.map((s, index) => ({
      ...s,
      step_order: index + 1
    }));

    setSteps([...reorderedMain, ...branchSteps]);

    // Save to backend
    if (!isDemo && selectedCampaign) {
      try {
        const savedSteps = reorderedMain.filter(s => !String(s.id).startsWith('temp-'));
        for (const s of savedSteps) {
          await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${s.id}`, {
            step_order: s.step_order,
            position_x: Math.round(s.x),
            position_y: Math.round(s.y)
          });
        }
      } catch (e) {
        console.error('Failed to reorder steps:', e);
      }
    }
  };

  const handleUpdateStep = async (stepId, updates) => {
    setSaving(true);
    setSteps(steps.map(s => s.id === stepId ? { ...s, ...updates } : s));
    if (!isDemo && selectedCampaign && !String(stepId).startsWith('temp-')) {
      try {
        await api.put(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${stepId}`, updates);
      } catch (error) {
        console.error('Update failed:', error);
      }
    }
    setTimeout(() => setSaving(false), 500);
  };

  // Collect all descendant step IDs (branch steps and their nested condition branches)
  const getDescendantIds = (parentId) => {
    const children = steps.filter(s => s.parent_step_id === parentId);
    let ids = children.map(c => c.id);
    for (const child of children) {
      if (child.step_type === 'condition') {
        ids = ids.concat(getDescendantIds(child.id));
      }
    }
    return ids;
  };

  const handleDeleteStep = async (stepId) => {
    const step = steps.find(s => s.id === stepId);
    const isCondition = step && step.step_type === 'condition';
    const descendantIds = isCondition ? getDescendantIds(stepId) : [];
    const allIdsToDelete = [stepId, ...descendantIds];

    if (!isDemo && !confirm(isCondition && descendantIds.length > 0
      ? `Delete this condition and its ${descendantIds.length} branch step(s)?`
      : 'Delete this step?'
    )) return;

    if (isDemo) {
      const remaining = steps.filter(s => !allIdsToDelete.includes(s.id));
      setSteps(remaining);
      setSelectedNodes(prev => prev.filter(id => !allIdsToDelete.includes(id)));
      if (allIdsToDelete.includes(activeStep)) {
        setActiveStep(remaining.length > 0 ? remaining[0].id : null);
      }
      return;
    }

    try {
      // Delete descendants first (backend CASCADE handles this, but be explicit)
      for (const id of descendantIds) {
        if (!String(id).startsWith('temp-')) {
          await api.delete(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${id}`);
        }
      }
      // Delete the step itself
      await api.delete(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${stepId}`);
      const remaining = steps.filter(s => !allIdsToDelete.includes(s.id));
      setSteps(remaining);
      setSelectedNodes(prev => prev.filter(id => !allIdsToDelete.includes(id)));
      if (allIdsToDelete.includes(activeStep)) setActiveStep(remaining.length > 0 ? remaining[0].id : null);
    } catch (err) {
      alert(err.message);
    }
  };

  // Get active step data
  const getActiveStepData = () => {
    if (!activeStep) return null;
    const mainStep = steps.find(s => s.id === activeStep);
    if (mainStep) return { step: mainStep };
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
      usage,
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
    h(BlockToolbar, {
      onAddStep: handleAddStep,
      trackOpens: selectedCampaign ? selectedCampaign.track_opens : true
    }),

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
          containerRef,
          trackOpens: selectedCampaign ? selectedCampaign.track_opens : true
        })
      ),

      // Editor Panel (collapsible)
      showEditor && h('div', { className: "w-80 glass-card rounded-l-none border-l border-white/10 overflow-hidden flex flex-col" },
        activeStepData
          ? h(StepEditor, {
            step: activeStepData.step,
            onUpdate: (stepId, updates) => handleUpdateStep(stepId, updates),
            onDelete: () => handleDeleteStep(activeStepData.step.id),
            saving: saving
          })
          : h('div', { className: "h-full flex flex-col items-center justify-center text-white/40 p-6" },
            h(Icons.MousePointer, { size: 48, className: "opacity-20 mb-4" }),
            h('p', { className: "text-center" }, "Select a node on the canvas to edit its properties")
          )
      )
    ),

    showNewCampaignModal && h(NewCampaignModal, { onClose: () => setShowNewCampaignModal(false), onCreate: handleCreateCampaign }),
    showStartModal && h(CampaignStartModal, {
      campaignName: selectedCampaign?.name || 'Campaign',
      onClose: () => setShowStartModal(false),
      onConfirm: confirmStartCampaign
    })
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

      !isDemo && selectedCampaign && (() => {
        const isLimited = usage && usage.sent >= usage.limit;

        if (selectedCampaign.status === 'running') {
          return h('button', {
            onClick: onPauseCampaign,
            className: "px-3 py-2 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-xl hover:bg-yellow-500/30 flex items-center gap-2 text-sm"
          }, h(Icons.Pause, { size: 16 }), 'Pause');
        } else {
          return h('button', {
            onClick: isLimited ? null : onStartCampaign,
            disabled: isLimited,
            title: isLimited ? 'Email limit reached for this billing cycle.' : '',
            className: `px-3 py-2 border rounded-xl flex items-center gap-2 text-sm transition-colors ${isLimited
                ? 'bg-gray-500/10 text-gray-500 border-gray-500/20 cursor-not-allowed'
                : 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30'
              }`
          }, h(Icons.Play, { size: 16 }), selectedCampaign.status === 'paused' ? 'Resume' : 'Start');
        }
      })(),

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

const WorkflowCanvas = ({ steps, selectedNodes, setSelectedNodes, activeStep, setActiveStep, canvasState, onAddStep, onDeleteStep, onNodeDrag, onNodeDragEnd, onReorderSteps, containerRef, trackOpens }) => {
  const { zoom, setZoom, pan, setPan, isPanning, setIsPanning } = canvasState;

  const [draggingNode, setDraggingNode] = React.useState(null);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });

  const svgRef = React.useRef(null);
  const canvasRef = React.useRef(null);

  // Use ref-based wheel listener with { passive: false } to allow preventDefault
  React.useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoom * delta, 0.25), 3);

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPan = {
        x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
        y: mouseY - (mouseY - pan.y) * (newZoom / zoom)
      };

      setZoom(newZoom);
      setPan(newPan);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [zoom, pan]);

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
        // Branch steps: just save position, never reorder
        if (draggedStep.parent_step_id) {
          onNodeDragEnd(draggingNode, draggedStep.x, draggedStep.y);
        } else {
          // Main flow: check if Y-order changed among main flow steps only
          const mainSteps = steps.filter(s => !s.parent_step_id);
          const sortedByY = [...mainSteps].sort((a, b) => a.y - b.y);
          const newOrder = sortedByY.findIndex(s => s.id === draggingNode) + 1;

          if (newOrder !== draggedStep.step_order) {
            onReorderSteps(draggingNode, newOrder);
          } else {
            onNodeDragEnd(draggingNode, draggedStep.x, draggedStep.y);
          }
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

  // Calculate connections (supports branching from condition blocks)
  const getConnections = () => {
    const connections = [];

    // Helper: get steps in a sequence (main flow or specific branch)
    const getSequence = (parentId, branchName) => {
      return steps
        .filter(s => {
          if (parentId === null) return !s.parent_step_id;
          return s.parent_step_id === parentId && s.branch === branchName;
        })
        .sort((a, b) => a.step_order - b.step_order);
    };

    // Helper: recursively process a sequence of steps and add connections
    const processSequence = (sequence, startFrom) => {
      if (startFrom && sequence.length > 0) {
        connections.push({
          id: startFrom.id,
          from: startFrom.pos,
          to: { x: sequence[0].x + 110, y: sequence[0].y },
          type: startFrom.type
        });
      }

      for (let i = 0; i < sequence.length; i++) {
        const step = sequence[i];
        const nextStep = sequence[i + 1];

        if (step.step_type === 'condition') {
          // Condition block: connect to branch starts
          const yesBranch = getSequence(step.id, 'yes');
          const noBranch = getSequence(step.id, 'no');

          if (yesBranch.length > 0) {
            processSequence(yesBranch, {
              id: step.id + '-yes-start',
              pos: { x: step.x + 55, y: step.y + 120 },
              type: 'branch-yes'
            });
          }
          if (noBranch.length > 0) {
            processSequence(noBranch, {
              id: step.id + '-no-start',
              pos: { x: step.x + 165, y: step.y + 120 },
              type: 'branch-no'
            });
          }
          // Condition blocks don't connect to the next sequential step (flow forks)
          continue;
        }

        // Regular step: connect to next in sequence
        if (nextStep) {
          connections.push({
            id: step.id + '-' + nextStep.id,
            from: { x: step.x + 110, y: step.y + 100 },
            to: { x: nextStep.x + 110, y: nextStep.y },
            type: 'main'
          });
        }
      }
    };

    // Process main flow
    const mainFlow = getSequence(null, null);

    // Start node connection
    if (mainFlow.length > 0) {
      processSequence(mainFlow, {
        id: 'start-' + mainFlow[0].id,
        pos: { x: START_NODE.x + START_NODE.width / 2, y: START_NODE.y + START_NODE.height },
        type: 'main'
      });
    }

    return connections;
  };

  const connections = getConnections();

  // Render SVG path for connection
  const renderConnectionPath = (conn) => {
    const dy = conn.to.y - conn.from.y;
    const midY = conn.from.y + dy / 2;

    // Bezier curve
    const path = `M ${conn.from.x} ${conn.from.y} C ${conn.from.x} ${midY}, ${conn.to.x} ${midY}, ${conn.to.x} ${conn.to.y}`;

    // Color based on branch type
    const isBranch = conn.type === 'branch-yes' || conn.type === 'branch-no';
    const branchColor = conn.type === 'branch-yes' ? '#3b82f6' : conn.type === 'branch-no' ? '#f97316' : null;
    const isMain = conn.type === 'main';

    return h('g', { key: conn.id },
      h('path', {
        d: path,
        className: `connection-line ${isMain ? 'active' : ''}`,
        style: isBranch ? { stroke: branchColor, strokeWidth: 2.5, strokeDasharray: '6 3' } : {}
      }),
      // Arrow head
      h('polygon', {
        points: `${conn.to.x},${conn.to.y} ${conn.to.x - 5},${conn.to.y - 8} ${conn.to.x + 5},${conn.to.y - 8}`,
        fill: isBranch ? branchColor : (isMain ? '#0B2B26' : '#9ca3af')
      }),
      // Branch label at midpoint
      isBranch && h('g', null,
        h('rect', {
          x: (conn.from.x + conn.to.x) / 2 - 40,
          y: midY - 10,
          width: 80,
          height: 20,
          rx: 10,
          fill: conn.type === 'branch-yes' ? 'rgba(59,130,246,0.25)' : 'rgba(249,115,22,0.25)',
          stroke: branchColor,
          strokeWidth: 1
        }),
        h('text', {
          x: (conn.from.x + conn.to.x) / 2,
          y: midY + 4,
          textAnchor: 'middle',
          fill: branchColor,
          fontSize: '10',
          fontWeight: '600'
        }, conn.type === 'branch-yes' ? 'If Opened' : 'If NOT Opened')
      )
    );
  };

  return h('div', {
    ref: canvasRef,
    className: `canvas-container ${isPanning ? 'grabbing' : ''}`,
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
        steps,
        isSelected: selectedNodes.includes(step.id),
        isActive: activeStep === step.id,
        isDragging: draggingNode === step.id,
        onMouseDown: (e) => handleNodeMouseDown(e, step.id),
        onDelete: () => onDeleteStep(step.id)
      })),

      // Branch add buttons for each condition block
      steps.filter(s => s.step_type === 'condition').map(condStep => {
        const ct = CONDITION_TYPES[condStep.condition_type] || CONDITION_TYPES.email_opened;
        return ['yes', 'no'].map(branchType => {
          const branchSteps = steps
            .filter(s => s.parent_step_id === condStep.id && s.branch === branchType)
            .sort((a, b) => a.step_order - b.step_order);
          const lastStep = branchSteps.length > 0 ? branchSteps[branchSteps.length - 1] : null;
          // Check if last step in branch is a condition (no add button needed - it forks further)
          if (lastStep && lastStep.step_type === 'condition') return null;
          const offsetX = branchType === 'yes' ? -260 : 260;
          const btnX = lastStep ? lastStep.x + 50 : condStep.x + offsetX + 50;
          const btnY = lastStep ? lastStep.y + 130 : condStep.y + 180;
          return h(BranchAddButtons, {
            key: condStep.id + '-add-' + branchType,
            x: btnX,
            y: btnY,
            label: branchType === 'yes' ? ct.yesLabel : ct.noLabel,
            conditionStepId: condStep.id,
            branchType,
            onAddStep: onAddStep,
            trackOpens
          });
        });
      }),

      // End nodes: for main flow (last non-condition step) and for each branch terminus
      (() => {
        const endNodes = [];
        // Main flow end
        const mainSteps = steps.filter(s => !s.parent_step_id).sort((a, b) => a.step_order - b.step_order);
        if (mainSteps.length > 0) {
          const lastMain = mainSteps[mainSteps.length - 1];
          if (lastMain.step_type !== 'condition') {
            endNodes.push(h(EndNode, { key: 'end-main', x: lastMain.x + 85, y: lastMain.y + 200 }));
          }
        }
        // Branch ends
        steps.filter(s => s.step_type === 'condition').forEach(condStep => {
          ['yes', 'no'].forEach(branchType => {
            const branchSteps = steps
              .filter(s => s.parent_step_id === condStep.id && s.branch === branchType)
              .sort((a, b) => a.step_order - b.step_order);
            if (branchSteps.length > 0) {
              const lastBranch = branchSteps[branchSteps.length - 1];
              if (lastBranch.step_type !== 'condition') {
                endNodes.push(h(EndNode, {
                  key: 'end-' + condStep.id + '-' + branchType,
                  x: lastBranch.x + 85,
                  y: lastBranch.y + 200
                }));
              }
            }
          });
        });
        return endNodes;
      })()
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

const CanvasNode = ({ step, steps, isSelected, isActive, isDragging, onMouseDown, onDelete }) => {
  const nodeType = NODE_TYPES[step.step_type] || NODE_TYPES.email;
  const IconComponent = Icons[nodeType.icon];

  // For condition blocks, count branch steps
  const isCondition = step.step_type === 'condition';
  const ct = isCondition ? (CONDITION_TYPES[step.condition_type] || CONDITION_TYPES.email_opened) : null;
  const yesBranchCount = isCondition ? steps.filter(s => s.parent_step_id === step.id && s.branch === 'yes').length : 0;
  const noBranchCount = isCondition ? steps.filter(s => s.parent_step_id === step.id && s.branch === 'no').length : 0;

  // Get node title
  const getNodeTitle = () => {
    if (step.step_type === 'email') return step.subject || 'New Email';
    if (step.step_type === 'linkedin_dm') return 'LinkedIn Message';
    if (step.step_type === 'linkedin_connection_request') return 'Connection Request';
    if (step.step_type === 'wait') return `Wait ${formatWaitDuration(step)}`;
    if (step.step_type === 'condition') return getConditionLabel(step.condition_type);
    return 'Step';
  };

  return h('div', {
    className: `canvas-node ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isActive ? 'new' : ''}`,
    style: { left: step.x, top: step.y },
    onMouseDown
  },
    h('div', { className: "node-card", style: isCondition ? { minWidth: '240px' } : {} },
      // Header
      h('div', { className: `node-header ${nodeType.bgClass}` },
        h('div', { className: `node-icon ${nodeType.bgClass}` },
          IconComponent && h(IconComponent, { size: 16 })
        ),
        h('div', { className: "flex-1 min-w-0" },
          h('span', { className: "font-semibold text-sm text-stone-700 block truncate" }, getNodeTitle())
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

        (step.step_type === 'linkedin_dm' || step.step_type === 'linkedin_connection_request') && h('p', { className: "text-xs text-stone-500 truncate" },
          (step.body || 'No content yet...').substring(0, 50) + (step.body?.length > 50 ? '...' : '')
        ),

        step.step_type === 'wait' && h('div', { className: "flex items-center gap-2 text-xs text-stone-500" },
          h(Icons.Clock, { size: 12 }),
          h('span', null, 'Delay before next step')
        ),

        isCondition && h('div', { className: "space-y-2" },
          // Branch indicators
          h('div', { className: "flex items-center justify-between gap-3" },
            h('div', { className: "flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-50 border border-blue-200" },
              h(Icons.Eye, { size: 11, className: "text-blue-500" }),
              h('span', { className: "text-xs font-medium text-blue-600" }, ct.yesLabel),
              h('span', { className: "text-xs text-blue-400 ml-1" }, `(${yesBranchCount})`)
            ),
            h('div', { className: "flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-50 border border-orange-200" },
              h(Icons.EyeOff, { size: 11, className: "text-orange-500" }),
              h('span', { className: "text-xs font-medium text-orange-600" }, ct.noLabel),
              h('span', { className: "text-xs text-orange-400 ml-1" }, `(${noBranchCount})`)
            )
          )
        )
      )
    ),

    // Connection ports
    h('div', { className: "node-port input" }),
    // For condition blocks: two output ports (left and right)
    isCondition
      ? h(React.Fragment, null,
        h('div', { className: "node-port output", style: { left: '25%', transform: 'translateX(-50%)' } }),
        h('div', { className: "node-port output", style: { left: '75%', transform: 'translateX(-50%)' } })
      )
      : h('div', { className: "node-port output" })
  );
};

// Branch add buttons (shown below condition blocks on canvas)
const BranchAddButtons = ({ x, y, label, conditionStepId, branchType, onAddStep, trackOpens = true }) => {
  const [showMenu, setShowMenu] = React.useState(false);

  const addOpts = [
    { type: 'email', icon: Icons.Mail, label: 'Email', color: '#3b82f6' },
    { type: 'wait', icon: Icons.Clock, label: 'Wait', color: '#8b5cf6' },
  ];

  if (trackOpens) {
    addOpts.push({ type: 'condition', icon: Icons.Split, label: 'Condition', color: '#f59e0b' });
  }

  return h('div', {
    className: "canvas-node",
    style: { left: x, top: y, cursor: 'default' }
  },
    h('div', {
      className: "branch-add-container",
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.9)',
        borderRadius: '12px',
        border: '2px dashed rgba(0,0,0,0.15)',
        minWidth: '120px',
        transition: 'all 0.2s ease'
      }
    },
      h('span', {
        style: { fontSize: '10px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }
      }, label),
      !showMenu
        ? h('button', {
          onClick: (e) => { e.stopPropagation(); setShowMenu(true); },
          style: {
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)',
            background: 'rgba(0,0,0,0.03)', cursor: 'pointer', fontSize: '11px', fontWeight: '500', color: '#374151'
          }
        },
          h(Icons.Plus, { size: 12 }),
          'Add Step'
        )
        : h('div', { style: { display: 'flex', gap: '4px' } },
          addOpts.map(opt =>
            h('button', {
              key: opt.type,
              onClick: (e) => {
                e.stopPropagation();
                onAddStep(opt.type, null, conditionStepId, branchType);
                setShowMenu(false);
              },
              style: {
                width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                background: opt.color, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', transition: 'transform 0.1s'
              },
              title: opt.label
            },
              h(opt.icon, { size: 14, color: 'white' })
            )
          ),
          h('button', {
            onClick: (e) => { e.stopPropagation(); setShowMenu(false); },
            style: {
              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)',
              background: 'white', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center'
            }
          },
            h(Icons.X, { size: 12, color: '#9ca3af' })
          )
        )
    )
  );
};

// Horizontal toolbar for adding blocks
const BlockToolbar = ({ onAddStep, trackOpens = true }) => {
  const handleDragStart = (e, stepType) => {
    e.dataTransfer.setData('stepType', stepType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const blocks = [
    { type: 'email', icon: 'Mail', label: 'Email', color: '#3b82f6', desc: 'Send an email' },
    { type: 'wait', icon: 'Clock', label: 'Wait', color: '#8b5cf6', desc: 'Add a delay' },
    { type: 'linkedin_dm', icon: 'MessageSquare', label: 'LI Message', color: '#0a66c2', desc: 'Send a LinkedIn message' },
    { type: 'linkedin_connection_request', icon: 'UserPlus', label: 'LI Connect', color: '#0a66c2', desc: 'Send a LinkedIn connection request' },
  ];

  if (trackOpens) {
    blocks.push({ type: 'condition', icon: 'Split', label: 'Condition', color: '#f59e0b', desc: 'Branch based on recipient behavior' });
  }

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

  const handleChange = (key, val) => setData({ ...data, [key]: val });
  const handleBlur = () => {
    onUpdate(step.id, data);
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
      (step.step_type === 'email' || step.step_type === 'linkedin_dm' || step.step_type === 'linkedin_connection_request') && h('div', { className: "space-y-4" },
        step.step_type === 'email' && h('div', null,
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
            h('label', { className: "block text-sm font-medium text-white" }, step.step_type === 'email' ? "Body" : "Message Note"),
            h('div', { className: "flex flex-wrap gap-1" },
              personalizationVars.slice(0, 4).map(v => h('button', {
                key: v.var,
                onClick: () => insertVar(v.var),
                className: "text-xs bg-white/10 text-white/70 px-1.5 py-0.5 rounded-lg hover:bg-cream-100 hover:text-rust-900 transition-colors"
              }, v.var))
            )
          ),
          h('div', { className: "relative" },
            h('textarea', {
              id: "emailBody",
              className: "glass-input w-full px-3 py-2 rounded-xl h-64 font-mono text-sm",
              value: data.body,
              onChange: e => handleChange('body', e.target.value),
              onBlur: handleBlur,
              placeholder: step.step_type === 'email' ? "Write your email here..." : "Write your personalized linkedin message/note here..."
            }),
            step.step_type === 'linkedin_connection_request' && h('div', {
              className: `absolute bottom-3 right-3 text-xs font-mono font-medium px-2 py-1 rounded bg-black/40 backdrop-blur ${data.body?.length > 300 ? 'text-red-400' : 'text-white/60'}`
            },
              `${data.body?.length || 0} / 300 max`
            )
          ),

          step.step_type !== 'email' && h('div', { className: "space-y-2 mt-2" },
            step.step_type === 'linkedin_connection_request' && data.body?.length > 300 && h('p', { className: "text-xs text-red-400 flex items-start gap-1 p-2 bg-red-500/10 rounded-lg border border-red-500/20" },
              h(Icons.AlertCircle, { size: 14, className: "shrink-0 mt-0.5" }),
              "LinkedIn restricts connection request notes to 300 characters. Your message will be truncated."
            ),
            h('p', { className: "text-xs text-white/40 italic flex items-start gap-1 p-2 bg-white/5 rounded-lg border border-white/10" },
              h(Icons.Info, { size: 14, className: "shrink-0 mt-0.5" }),
              "LinkedIn tasks rely on the Usenti Chrome extension. Users must have their browser open to execute these tasks."
            )
          )
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
        h('p', { className: "text-sm text-white/60 mb-4" }, "Set a condition to branch the campaign flow. Recipients who match the condition follow one path, and those who don't follow another."),
        h('div', null,
          h('label', { className: "block text-sm font-medium text-white mb-1" }, "Condition Type"),
          h('select', {
            className: "glass-input w-full px-3 py-2 rounded-xl text-sm",
            value: data.condition_type || 'email_opened',
            onChange: e => {
              handleChange('condition_type', e.target.value);
              onUpdate(step.id, { condition_type: e.target.value });
            }
          },
            Object.entries(CONDITION_TYPES).map(([key, ct]) =>
              h('option', { key, value: key }, ct.label)
            )
          )
        ),
        // Branch summary
        h('div', { className: "space-y-3 mt-4" },
          h('div', { className: "p-3 bg-blue-500/20 rounded-xl border border-blue-500/30" },
            h('div', { className: "flex items-center gap-2 mb-1" },
              h(Icons.Eye, { size: 14, className: "text-blue-300" }),
              h('span', { className: "text-sm font-medium text-blue-200" },
                (CONDITION_TYPES[data.condition_type] || CONDITION_TYPES.email_opened).yesLabel
              )
            ),
            h('p', { className: "text-xs text-blue-200/60" }, "Recipients who satisfy this condition will follow this branch.")
          ),
          h('div', { className: "p-3 bg-orange-500/20 rounded-xl border border-orange-500/30" },
            h('div', { className: "flex items-center gap-2 mb-1" },
              h(Icons.EyeOff, { size: 14, className: "text-orange-300" }),
              h('span', { className: "text-sm font-medium text-orange-200" },
                (CONDITION_TYPES[data.condition_type] || CONDITION_TYPES.email_opened).noLabel
              )
            ),
            h('p', { className: "text-xs text-orange-200/60" }, "Recipients who do NOT satisfy this condition will follow this branch.")
          )
        ),
        h('div', { className: "mt-4 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20" },
          h('div', { className: "flex items-center gap-2" },
            h(Icons.Split, { size: 14, className: "text-amber-300" }),
            h('span', { className: "text-xs text-amber-200/80" }, "Add steps to each branch using the + buttons on the canvas below this condition block.")
          )
        )
      ),

    )
  );
};

// --- 9. New Campaign Modal ---

// --- Campaign Start Confirmation Modal ---

const CampaignStartModal = ({ campaignName, onClose, onConfirm }) => {
  const [addressConfirmed, setAddressConfirmed] = React.useState(false);

  return h('div', {
    className: "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in",
    onClick: onClose
  },
    h('div', {
      className: "glass-modal rounded-2xl p-6 max-w-md w-full mx-4",
      onClick: e => e.stopPropagation()
    },
      h('div', { className: "flex items-center justify-between mb-4" },
        h('h3', { className: "font-serif text-2xl text-white" }, "Start Campaign"),
        h('button', { onClick: onClose, className: "p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors" }, h(Icons.X, { size: 20 }))
      ),
      h('p', { className: "text-sm text-white/70 mb-4" },
        `You are about to start "${campaignName}". Emails will be sent to all contacts in the selected list.`
      ),
      h('label', { className: "flex items-start gap-3 p-4 glass-card rounded-xl border border-amber-500/30 bg-amber-500/5 cursor-pointer mb-4" },
        h('input', {
          type: "checkbox",
          checked: addressConfirmed,
          onChange: e => setAddressConfirmed(e.target.checked),
          className: "w-4 h-4 mt-0.5 rounded bg-transparent border-white/30 flex-shrink-0"
        }),
        h('div', null,
          h('span', { className: "block text-sm font-medium text-white" }, "Physical Address Certification"),
          h('span', { className: "text-xs text-white/60 leading-relaxed" },
            "I certify that all emails sent through this campaign will include a valid physical postal address as required by the CAN-SPAM Act (15 U.S.C. § 7704)."
          )
        )
      ),
      h('div', { className: "flex gap-3" },
        h('button', {
          onClick: onClose,
          className: "flex-1 px-4 py-3 glass-card text-white hover:bg-white/15 rounded-full transition-colors"
        }, "Cancel"),
        h('button', {
          onClick: onConfirm,
          disabled: !addressConfirmed,
          className: "flex-1 px-4 py-3 bg-green-500/20 text-green-300 border border-green-500/30 rounded-full hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
        }, h(Icons.Play, { size: 16 }), "Start Campaign")
      )
    )
  );
};

const NewCampaignModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = React.useState({
    name: '',
    email_account_ids: [],
    contact_list_id: '',
    send_schedule: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start_hour: 9, end_hour: 17 },
    send_immediately: false,
    track_opens: false
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
          h('label', { className: `flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${formData.track_opens ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 border-white/10'}` },
            h('input', {
              type: "checkbox",
              checked: formData.track_opens,
              onChange: e => setFormData({ ...formData, track_opens: e.target.checked }),
              className: "w-4 h-4 rounded bg-transparent border-white/30"
            }),
            h('div', null,
              h('span', { className: "block text-sm font-medium text-white" }, "Track Email Opens"),
              h('span', { className: "text-xs text-white/50" }, "Adds a tracking pixel to detect opens")
            )
          ),
          formData.track_opens && h('div', { className: "p-3 rounded-xl border border-amber-500/30 bg-amber-500/5" },
            h('div', { className: "flex items-start gap-2" },
              h(Icons.AlertCircle, { size: 14, className: "text-amber-400 mt-0.5 flex-shrink-0" }),
              h('span', { className: "text-xs text-amber-200/80 leading-relaxed" },
                "Open tracking uses a hidden pixel that may conflict with the EU ePrivacy Directive (2002/58/EC) and GDPR. Only enable if your recipients have consented to tracking."
              )
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
