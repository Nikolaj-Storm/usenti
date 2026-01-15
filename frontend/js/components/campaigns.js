// Mr. Snowman - Campaigns Component with Campaign Builder

const Campaigns = () => {
  const { useState, useEffect, createElement: h } = React;
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const data = await api.getCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignCreated = () => {
    loadCampaigns();
    setShowModal(false);
  };

  return h('div', { className: "space-y-8" },
    h('div', { className: "flex justify-between items-end" },
      h('div', null,
        h('h2', { className: "font-serif text-3xl text-jaguar-900" }, 'Campaigns'),
        h('p', { className: "text-stone-500 mt-2" }, 'Create and manage your email campaigns.')),
      h('button', {
        onClick: () => setShowModal(true),
        className: "px-6 py-3 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-xl font-medium hover:shadow-xl transition-all duration-300 flex items-center gap-2"
      },
        Icons.Plus({ size: 20 }), 'Create Campaign')),
    loading ? h('div', { className: "text-center py-12" },
      h('div', { className: "inline-block animate-spin text-jaguar-900" }, Icons.Loader2({ size: 32 })),
      h('p', { className: "text-stone-400 mt-4" }, 'Loading campaigns...')
    ) : campaigns.length === 0 ? h('div', { className: "text-center py-12" },
      h('p', { className: "text-stone-400" }, 'No campaigns yet. Create your first campaign to get started!')
    ) : h('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" },
      ...campaigns.map(campaign =>
        h('div', { key: campaign.id, className: "bg-white rounded-2xl p-6 border border-stone-200 shadow-sm hover:shadow-md transition-shadow" },
          h('div', { className: "flex items-start justify-between mb-4" },
            h('div', null,
              h('h3', { className: "font-medium text-jaguar-900 text-lg" }, campaign.name),
              h('p', { className: "text-xs text-stone-500 mt-1" },
                campaign.email_accounts?.email_address || 'No account')),
            h('span', {
              className: `px-2 py-1 text-xs rounded-full ${
                campaign.status === 'running' ? 'bg-green-100 text-green-700' :
                campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                campaign.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                'bg-stone-100 text-stone-700'
              }`
            }, campaign.status)),
          h('div', { className: "space-y-2 text-sm" },
            h('div', { className: "flex justify-between" },
              h('span', { className: "text-stone-500" }, 'Contact List:'),
              h('span', { className: "font-medium text-jaguar-900" },
                campaign.contact_lists?.name || 'None')),
            h('div', { className: "flex justify-between" },
              h('span', { className: "text-stone-500" }, 'Daily Limit:'),
              h('span', { className: "font-medium text-jaguar-900" }, campaign.daily_limit || 'N/A')),
            campaign.started_at && h('div', { className: "flex justify-between" },
              h('span', { className: "text-stone-500" }, 'Started:'),
              h('span', { className: "text-xs text-stone-600" },
                new Date(campaign.started_at).toLocaleDateString()))))
      )),
    showModal && h(CreateCampaignModal, {
      onClose: () => setShowModal(false),
      onSuccess: handleCampaignCreated
    })
  );
};

// Campaign Sequence Builder Modal - Full Featured
const CreateCampaignModal = ({ onClose, onSuccess }) => {
  const { useState, useEffect, createElement: h } = React;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [contactLists, setContactLists] = useState([]);
  const [campaignName, setCampaignName] = useState('');
  const [emailAccountId, setEmailAccountId] = useState('');
  const [contactListId, setContactListId] = useState('');
  const [dailyLimit, setDailyLimit] = useState(500);
  const [steps, setSteps] = useState([{
    id: 1,
    type: 'email',
    subject: 'Collaboration Opportunity',
    body: 'Hi {{first_name}}, I saw your work at...',
    order: 1
  }]);
  const [selectedStepId, setSelectedStepId] = useState(1);
  const [showAddMenu, setShowAddMenu] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [accounts, lists] = await Promise.all([api.getEmailAccounts(), api.getContactLists()]);
      setEmailAccounts(accounts);
      setContactLists(lists);
      if (accounts.length > 0) setEmailAccountId(accounts[0].id);
      if (lists.length > 0) setContactListId(lists[0].id);
    } catch (err) {
      setError('Failed to load accounts and lists');
    }
  };

  const getCurrentStep = () => steps.find(s => s.id === selectedStepId);
  const updateStep = (id, updates) => setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));

  const addStep = (type) => {
    const newId = Math.max(...steps.map(s => s.id), 0) + 1;
    const newStep = {
      id: newId, order: steps.length + 1, type,
      subject: type === 'email' ? 'Follow Up' : '',
      body: type === 'email' ? 'Hi {{first_name}},' : '',
      wait_days: type === 'wait' ? 2 : undefined,
      condition_type: type === 'condition' ? 'if_opened' : undefined
    };
    setSteps([...steps, newStep]);
    setSelectedStepId(newId);
    setShowAddMenu(false);
  };

  const deleteStep = (id) => {
    if (steps.length === 1) return;
    const filtered = steps.filter(s => s.id !== id);
    setSteps(filtered.map((s, idx) => ({ ...s, order: idx + 1 })));
    setSelectedStepId(filtered[0]?.id || steps[0]?.id);
  };

  const insertVariable = (variable) => {
    const step = getCurrentStep();
    if (step && step.type === 'email') {
      updateStep(step.id, { body: (step.body || '') + ` {{${variable}}}` });
    }
  };

  const handleSaveDraft = async () => {
    if (!campaignName) { setError('Please enter a campaign name'); return; }
    if (!emailAccountId) { setError('Please select an email account'); return; }
    if (!contactListId) { setError('Please select a contact list'); return; }
    setLoading(true);
    setError('');
    try {
      await api.createCampaign({ name: campaignName, email_account_id: emailAccountId, contact_list_id: contactListId, daily_limit: dailyLimit });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to save campaign');
    } finally {
      setLoading(false);
    }
  };

  const currentStep = getCurrentStep();

  return h('div', { className: "fixed inset-0 bg-stone-50 z-50 flex flex-col" },
    h('div', { className: "bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between" },
      h('div', { className: "flex items-center gap-4" },
        h('button', { onClick: onClose, className: "p-2 hover:bg-stone-100 rounded-lg transition-colors" }, Icons.X({ size: 20 })),
        h('div', null,
          h('input', {
            type: "text", value: campaignName, onChange: e => setCampaignName(e.target.value),
            placeholder: "Campaign Name",
            className: "text-xl font-serif font-semibold text-jaguar-900 border-none outline-none focus:ring-0 bg-transparent"
          }),
          h('p', { className: "text-xs text-stone-500 mt-0.5" }, 'Draft • Last saved just now'))),
      h('div', { className: "flex items-center gap-3" },
        h('button', {
          onClick: handleSaveDraft, disabled: loading,
          className: "px-4 py-2 border-2 border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors font-medium flex items-center gap-2"
        }, loading ? Icons.Loader2({ size: 16 }) : Icons.Upload({ size: 16 }), 'Save Draft'),
        h('button', {
          onClick: handleSaveDraft, disabled: loading || !campaignName,
          className: "px-5 py-2 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-lg hover:shadow-lg transition-all font-medium flex items-center gap-2 disabled:opacity-50"
        }, Icons.Send({ size: 16 }), 'Launch'))),

    error && h('div', { className: "mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2" },
      Icons.AlertCircle({ size: 16 }), error),

    h('div', { className: "flex-1 flex overflow-hidden" },
      h('div', { className: "w-96 bg-cream-50 border-r border-stone-200 flex flex-col" },
        h('div', { className: "p-4 space-y-3 flex-1 overflow-y-auto" },
          ...steps.map((step, idx) =>
            h('div', { key: step.id, className: "space-y-2" },
              h('button', {
                onClick: () => setSelectedStepId(step.id),
                className: `w-full text-left p-4 rounded-xl transition-all ${selectedStepId === step.id ? 'bg-white shadow-md border-2 border-jaguar-900' : 'bg-white border border-stone-200 hover:border-jaguar-300'}`
              },
                h('div', { className: "flex items-start gap-3" },
                  h('div', { className: `w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${step.type === 'email' ? 'bg-blue-100' : step.type === 'wait' ? 'bg-yellow-100' : 'bg-purple-100'}` },
                    step.type === 'email' ? Icons.Mail({ size: 18, className: "text-blue-600" }) :
                    step.type === 'wait' ? h('svg', { className: "w-5 h-5 text-yellow-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, h('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" })) :
                    h('svg', { className: "w-5 h-5 text-purple-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, h('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 9l4-4 4 4m0 6l-4 4-4-4" }))),
                  h('div', { className: "flex-1 min-w-0" },
                    h('div', { className: "flex items-center justify-between mb-1" },
                      h('span', { className: "text-xs font-semibold text-stone-500 uppercase tracking-wide" }, `Step ${idx + 1}`),
                      selectedStepId === step.id && steps.length > 1 && h('button', {
                        onClick: (e) => { e.stopPropagation(); deleteStep(step.id); },
                        className: "text-red-500 hover:text-red-700 p-1"
                      }, h('svg', { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, h('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" })))),
                    step.type === 'email' && h('div', null,
                      h('p', { className: "font-semibold text-stone-900 truncate" }, step.subject || 'Untitled Email'),
                      h('p', { className: "text-xs text-stone-500 truncate mt-0.5" }, step.body?.substring(0, 50) + '...' || 'No content')),
                    step.type === 'wait' && h('div', null,
                      h('p', { className: "font-semibold text-stone-900" }, `Wait ${step.wait_days || 2} Days`),
                      h('p', { className: "text-xs text-stone-500 mt-0.5" }, 'Pause before next step')),
                    step.type === 'condition' && h('div', null,
                      h('p', { className: "font-semibold text-stone-900" }, `Condition: ${step.condition_type === 'if_opened' ? 'If opened...' : step.condition_type === 'if_clicked' ? 'If clicked...' : 'If replied...'}`),
                      h('p', { className: "text-xs text-stone-500 mt-0.5" }, 'Branch based on action'))))),
              idx < steps.length - 1 && h('div', { className: "flex justify-center" }, h('div', { className: "w-0.5 h-4 bg-stone-300" })))),

        h('div', { className: "p-4 border-t border-stone-200 relative" },
          h('button', {
            onClick: () => setShowAddMenu(!showAddMenu),
            className: "w-full py-3 border-2 border-dashed border-stone-300 rounded-xl hover:border-jaguar-900 hover:bg-jaguar-50 transition-all font-medium text-stone-600 hover:text-jaguar-900 flex items-center justify-center gap-2"
          }, Icons.Plus({ size: 20 }), 'Add Next Step'),
          showAddMenu && h('div', { className: "absolute bottom-full left-4 right-4 mb-2 bg-white rounded-xl shadow-xl border border-stone-200 overflow-hidden z-10" },
            h('button', {
              onClick: () => addStep('email'),
              className: "w-full px-4 py-3 text-left hover:bg-stone-50 flex items-center gap-3 border-b border-stone-100"
            },
              h('div', { className: "w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center" }, Icons.Mail({ size: 16, className: "text-blue-600" })),
              h('div', null, h('p', { className: "font-medium text-stone-900" }, 'Email'), h('p', { className: "text-xs text-stone-500" }, 'Send an email message'))),
            h('button', {
              onClick: () => addStep('wait'),
              className: "w-full px-4 py-3 text-left hover:bg-stone-50 flex items-center gap-3 border-b border-stone-100"
            },
              h('div', { className: "w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center" }, h('svg', { className: "w-4 h-4 text-yellow-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, h('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" }))),
              h('div', null, h('p', { className: "font-medium text-stone-900" }, 'Wait'), h('p', { className: "text-xs text-stone-500" }, 'Delay before next step'))),
            h('button', {
              onClick: () => addStep('condition'),
              className: "w-full px-4 py-3 text-left hover:bg-stone-50 flex items-center gap-3"
            },
              h('div', { className: "w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center" }, h('svg', { className: "w-4 h-4 text-purple-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, h('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 9l4-4 4 4m0 6l-4 4-4-4" }))),
              h('div', null, h('p', { className: "font-medium text-stone-900" }, 'Condition'), h('p', { className: "text-xs text-stone-500" }, 'Branch based on action')))))),

      h('div', { className: "flex-1 flex flex-col bg-white" },
        !currentStep ? h('div', { className: "flex-1 flex items-center justify-center text-stone-400" },
          h('div', { className: "text-center" }, h('p', { className: "text-lg font-medium" }, 'Select a step from the timeline'), h('p', { className: "text-sm mt-1" }, 'Choose a step to edit'))) :

        currentStep.type === 'email' ? h('div', { className: "flex-1 flex flex-col p-6 overflow-y-auto" },
          h('div', { className: "max-w-3xl mx-auto w-full space-y-6" },
            h('div', null,
              h('label', { className: "block text-sm font-semibold text-stone-700 mb-2" }, 'Subject Line'),
              h('input', {
                type: "text", value: currentStep.subject || '', onChange: e => updateStep(currentStep.id, { subject: e.target.value }),
                className: "w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all",
                placeholder: "e.g., Collaboration Opportunity"
              }),
              h('p', { className: "text-xs text-stone-500 mt-1" }, `${(currentStep.subject || '').length} / 60 characters`)),

            h('div', null,
              h('div', { className: "flex items-center justify-between mb-2" },
                h('label', { className: "block text-sm font-semibold text-stone-700" }, 'Email Body'),
                h('div', { className: "flex gap-1" },
                  ['first_name', 'last_name', 'company', 'email'].map(v =>
                    h('button', {
                      key: v, onClick: () => insertVariable(v),
                      className: "px-2 py-1 text-xs bg-stone-100 hover:bg-jaguar-100 text-stone-700 hover:text-jaguar-900 rounded border border-stone-200 hover:border-jaguar-300 transition-colors"
                    }, `{{${v}}}`)))),
              h('textarea', {
                value: currentStep.body || '', onChange: e => updateStep(currentStep.id, { body: e.target.value }),
                rows: 12,
                className: "w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all resize-none font-mono text-sm",
                placeholder: "Hi {{first_name}},\n\nI came across your work and..."
              }),
              h('p', { className: "text-xs text-stone-500 mt-1" }, 'Use {{variable}} for personalization')),

            h('div', { className: "grid grid-cols-2 gap-4 pt-4 border-t border-stone-200" },
              h('div', null,
                h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Email Account'),
                h('select', {
                  value: emailAccountId, onChange: e => setEmailAccountId(e.target.value),
                  className: "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
                }, ...emailAccounts.map(acc => h('option', { key: acc.id, value: acc.id }, acc.email_address)))),
              h('div', null,
                h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Contact List'),
                h('select', {
                  value: contactListId, onChange: e => setContactListId(e.target.value),
                  className: "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
                }, ...contactLists.map(list => h('option', { key: list.id, value: list.id }, `${list.name} (${list.total_contacts || 0})`))))))) :

        currentStep.type === 'wait' ? h('div', { className: "flex-1 flex items-center justify-center p-6" },
          h('div', { className: "max-w-md w-full space-y-6" },
            h('div', { className: "text-center mb-6" },
              h('div', { className: "w-16 h-16 mx-auto rounded-full bg-yellow-100 flex items-center justify-center mb-4" }, h('svg', { className: "w-8 h-8 text-yellow-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, h('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" }))),
              h('h3', { className: "text-xl font-semibold text-stone-900" }, 'Wait Step')),
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Wait Duration (Days)'),
              h('input', {
                type: "number", min: 1, max: 30, value: currentStep.wait_days || 2,
                onChange: e => updateStep(currentStep.id, { wait_days: parseInt(e.target.value) }),
                className: "w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all text-center text-2xl font-bold"
              }),
              h('p', { className: "text-sm text-stone-500 mt-2 text-center" }, 'Pause before sending the next message')))) :

        h('div', { className: "flex-1 flex items-center justify-center p-6" },
          h('div', { className: "max-w-md w-full space-y-6" },
            h('div', { className: "text-center mb-6" },
              h('div', { className: "w-16 h-16 mx-auto rounded-full bg-purple-100 flex items-center justify-center mb-4" }, h('svg', { className: "w-8 h-8 text-purple-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, h('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 9l4-4 4 4m0 6l-4 4-4-4" }))),
              h('h3', { className: "text-xl font-semibold text-stone-900" }, 'Conditional Branch')),
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Condition Type'),
              h('select', {
                value: currentStep.condition_type || 'if_opened',
                onChange: e => updateStep(currentStep.id, { condition_type: e.target.value }),
                className: "w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all"
              },
                h('option', { value: 'if_opened' }, 'If email was opened'),
                h('option', { value: 'if_not_opened' }, 'If email was NOT opened'),
                h('option', { value: 'if_clicked' }, 'If link was clicked'),
                h('option', { value: 'if_replied' }, 'If contact replied')),
              h('p', { className: "text-sm text-stone-500 mt-2" }, 'Branch to different steps based on contact behavior'))))))
  );
};
