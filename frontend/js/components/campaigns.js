// Mr. Snowman - Campaign Builder Component

const { useState, useEffect } = React;

const CampaignBuilder = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [steps, setSteps] = useState([]);
  const [activeStep, setActiveStep] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const data = await api.getCampaigns();
      setCampaigns(data);
      if (data.length > 0 && !selectedCampaign) {
        setSelectedCampaign(data[0]);
        loadCampaignSteps(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignSteps = async (campaignId) => {
    try {
      const data = await api.get(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${campaignId}/steps`);
      setSteps(data);
      if (data.length > 0) {
        setActiveStep(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load steps:', error);
    }
  };

  const handleCreateCampaign = async (campaignData) => {
    try {
      const newCampaign = await api.createCampaign(campaignData);
      setCampaigns([...campaigns, newCampaign]);
      setSelectedCampaign(newCampaign);
      setSteps([]);
      setShowNewCampaignModal(false);
    } catch (error) {
      console.error('Failed to create campaign:', error);
      alert('Failed to create campaign: ' + error.message);
    }
  };

  const handleAddStep = async (stepType) => {
    if (!selectedCampaign) return;

    const stepData = {
      step_order: steps.length + 1,
      step_type: stepType,
      subject: stepType === 'email' ? 'New Email' : null,
      body: stepType === 'email' ? 'Hi {{first_name}},\n\nI wanted to reach out...' : null,
      wait_days: stepType === 'wait' ? 3 : null,
      condition_type: stepType === 'condition' ? 'if_opened' : null
    };

    try {
      const newStep = await api.post(
        `${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps`,
        stepData
      );
      const updatedSteps = [...steps, newStep];
      setSteps(updatedSteps);
      setActiveStep(newStep.id);
    } catch (error) {
      console.error('Failed to add step:', error);
      alert('Failed to add step: ' + error.message);
    }
  };

  const handleUpdateStep = async (stepId, updates) => {
    setSaving(true);
    try {
      const updatedStep = await api.put(
        `${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${stepId}`,
        updates
      );
      setSteps(steps.map(s => s.id === stepId ? updatedStep : s));
    } catch (error) {
      console.error('Failed to update step:', error);
      alert('Failed to update step: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStep = async (stepId) => {
    if (!confirm('Are you sure you want to delete this step?')) return;

    try {
      await api.delete(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/steps/${stepId}`);
      const updatedSteps = steps.filter(s => s.id !== stepId);
      setSteps(updatedSteps);
      if (activeStep === stepId) {
        setActiveStep(updatedSteps.length > 0 ? updatedSteps[0].id : null);
      }
    } catch (error) {
      console.error('Failed to delete step:', error);
      alert('Failed to delete step: ' + error.message);
    }
  };

  const handleStartCampaign = async () => {
    if (!selectedCampaign) return;
    if (steps.length === 0) {
      alert('Please add at least one step before launching the campaign.');
      return;
    }

    try {
      await api.startCampaign(selectedCampaign.id);
      await loadCampaigns();
      alert('Campaign launched successfully!');
    } catch (error) {
      console.error('Failed to start campaign:', error);
      alert('Failed to start campaign: ' + error.message);
    }
  };

  const handlePauseCampaign = async () => {
    if (!selectedCampaign) return;

    try {
      await api.post(`${APP_CONFIG.ENDPOINTS.CAMPAIGNS}/${selectedCampaign.id}/pause`);
      await loadCampaigns();
    } catch (error) {
      console.error('Failed to pause campaign:', error);
      alert('Failed to pause campaign: ' + error.message);
    }
  };

  if (loading) {
    return h('div', { className: "flex items-center justify-center h-96" },
      h(Icons.Loader2, { size: 48, className: "text-jaguar-900" })
    );
  }

  if (campaigns.length === 0) {
    return h('div', { className: "flex flex-col items-center justify-center h-96 text-center animate-fade-in" },
      h(Icons.Send, { size: 64, className: "text-stone-300 mb-4" }),
      h('h3', { className: "font-serif text-2xl text-jaguar-900 mb-2" }, 'No Campaigns Yet'),
      h('p', { className: "text-stone-500 mb-6 max-w-md" }, 'Create your first email campaign to start reaching out to prospects.'),
      h('button', {
        onClick: () => setShowNewCampaignModal(true),
        className: "px-6 py-3 bg-jaguar-900 text-cream-50 rounded-lg hover:bg-jaguar-800 flex items-center gap-2 transition-colors"
      },
        h(Icons.Plus, { size: 20 }),
        ' Create Your First Campaign'
      )
    );
  }

  return h('div', { className: "h-[calc(100vh-120px)] flex flex-col animate-fade-in" },
    h('div', { className: "flex justify-between items-center mb-6" },
      h('div', null,
        h('h2', { className: "font-serif text-3xl text-jaguar-900" }, selectedCampaign?.name || 'Campaign Builder'),
        h('div', { className: "flex items-center gap-2 mt-2" },
          h('span', {
            className: `w-2 h-2 rounded-full ${
              selectedCampaign?.status === 'running' ? 'bg-green-500 animate-pulse' :
              selectedCampaign?.status === 'paused' ? 'bg-amber-500' :
              'bg-stone-300'
            }`
          }),
          h('p', { className: "text-stone-500 text-sm capitalize" }, selectedCampaign?.status || 'draft')
        )
      ),
      h('div', { className: "flex gap-3" },
        h('select', {
          value: selectedCampaign?.id || '',
          onChange: (e) => {
            const campaign = campaigns.find(c => c.id === e.target.value);
            setSelectedCampaign(campaign);
            loadCampaignSteps(campaign.id);
          },
          className: "px-4 py-2 bg-white border border-stone-200 rounded-md text-stone-700 focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
        },
          ...campaigns.map(c =>
            h('option', { key: c.id, value: c.id }, c.name)
          )
        ),
        h('button', {
          onClick: () => setShowNewCampaignModal(true),
          className: "px-4 py-2 bg-white border border-stone-200 text-stone-700 rounded-md hover:bg-stone-50 font-medium flex items-center gap-2 transition-colors"
        },
          h(Icons.Plus, { size: 18 }),
          ' New Campaign'
        ),
        selectedCampaign?.status === 'draft' && h('button', {
          onClick: handleStartCampaign,
          className: "px-6 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 font-medium flex items-center gap-2 shadow-lg transition-colors"
        },
          h(Icons.Play, { size: 18 }),
          ' Launch'
        ),
        selectedCampaign?.status === 'running' && h('button', {
          onClick: handlePauseCampaign,
          className: "px-6 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 font-medium transition-colors"
        }, 'Pause')
      )
    ),
    h('div', { className: "flex gap-6 flex-1 overflow-hidden" },
      h('div', { className: "w-1/3 overflow-y-auto pr-2 pb-10" },
        h('div', { className: "relative" },
          h('div', { className: "absolute left-6 top-4 bottom-20 w-0.5 bg-stone-200" }),
          h('div', { className: "space-y-6" },
            ...steps.map((step, index) =>
              h('div', {
                key: step.id,
                onClick: () => setActiveStep(step.id),
                className: `relative pl-16 group cursor-pointer transition-all ${
                  activeStep === step.id ? 'opacity-100 scale-[1.02]' : 'opacity-80 hover:opacity-100'
                }`
              },
                h('div', {
                  className: `absolute left-0 top-0 w-12 h-12 rounded-full border-4 border-[#FDFBF7] flex items-center justify-center z-10 shadow-sm transition-all ${
                    activeStep === step.id
                      ? 'bg-jaguar-900 text-cream-50'
                      : 'bg-white text-stone-400 group-hover:text-jaguar-900 group-hover:border-jaguar-900/20'
                  }`
                },
                  step.step_type === 'email' && h(Icons.Mail, { size: 18 }),
                  step.step_type === 'wait' && h(Icons.Clock, { size: 18 }),
                  step.step_type === 'condition' && h(Icons.Split, { size: 18 })
                ),
                h('div', {
                  className: `p-4 rounded-lg border transition-all ${
                    activeStep === step.id
                      ? 'bg-white border-jaguar-900 shadow-md'
                      : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-sm'
                  }`
                },
                  h('div', { className: "flex justify-between items-start mb-2" },
                    h('span', { className: "text-xs font-bold uppercase tracking-wider text-stone-400" }, `Step ${index + 1}`),
                    h('div', { className: "flex gap-2" },
                      h('button', {
                        onClick: (e) => {
                          e.stopPropagation();
                          handleDeleteStep(step.id);
                        },
                        className: "text-stone-300 hover:text-red-500 transition-colors"
                      }, h(Icons.Trash2, { size: 14 }))
                    )
                  ),
                  step.step_type === 'email' && h('div', null,
                    h('h4', { className: "font-serif font-medium text-jaguar-900 mb-1" }, step.subject || 'No Subject'),
                    h('p', { className: "text-xs text-stone-500 line-clamp-2" }, step.body)
                  ),
                  step.step_type === 'wait' && h('div', { className: "flex items-center gap-2" },
                    h('span', { className: "font-medium text-stone-700" }, `Wait ${step.wait_days} Days`)
                  ),
                  step.step_type === 'condition' && h('div', { className: "bg-cream-50 p-2 rounded border border-stone-100" },
                    h('span', { className: "text-sm font-medium text-jaguar-900" }, 'Condition:'),
                    h('span', { className: "text-sm text-stone-600 ml-1" }, `If ${step.condition_type?.replace('if_', '')}...`)
                  )
                )
              )
            ),
            h('div', { className: "relative pl-16" },
              h('div', { className: "absolute left-0 top-0 w-12 h-12 rounded-full border-4 border-[#FDFBF7] bg-stone-100 text-stone-400 flex items-center justify-center z-10" },
                h(Icons.Plus, { size: 20 })
              ),
              h('div', { className: "space-y-2" },
                h('button', {
                  onClick: () => handleAddStep('email'),
                  className: "w-full p-3 border-2 border-dashed border-stone-200 rounded-lg text-stone-400 font-medium hover:border-jaguar-900 hover:text-jaguar-900 hover:bg-cream-50 transition-all text-left flex items-center gap-2"
                },
                  h(Icons.Mail, { size: 16 }),
                  ' Add Email'
                ),
                h('button', {
                  onClick: () => handleAddStep('wait'),
                  className: "w-full p-3 border-2 border-dashed border-stone-200 rounded-lg text-stone-400 font-medium hover:border-jaguar-900 hover:text-jaguar-900 hover:bg-cream-50 transition-all text-left flex items-center gap-2"
                },
                  h(Icons.Clock, { size: 16 }),
                  ' Add Wait'
                ),
                h('button', {
                  onClick: () => handleAddStep('condition'),
                  className: "w-full p-3 border-2 border-dashed border-stone-200 rounded-lg text-stone-400 font-medium hover:border-jaguar-900 hover:text-jaguar-900 hover:bg-cream-50 transition-all text-left flex items-center gap-2"
                },
                  h(Icons.Split, { size: 16 }),
                  ' Add Condition'
                )
              )
            )
          )
        )
      ),
      h('div', { className: "w-2/3 bg-white border border-stone-200 rounded-lg shadow-sm p-8 overflow-y-auto" },
        activeStep
          ? h(StepEditor, {
              step: steps.find(s => s.id === activeStep),
              onUpdate: handleUpdateStep,
              saving: saving
            })
          : h('div', { className: "h-full flex flex-col items-center justify-center text-stone-400" },
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

const StepEditor = ({ step, onUpdate, saving }) => {
  const [formData, setFormData] = useState({
    subject: step?.subject || '',
    body: step?.body || '',
    wait_days: step?.wait_days || 3,
    condition_type: step?.condition_type || 'if_opened'
  });

  useEffect(() => {
    setFormData({
      subject: step?.subject || '',
      body: step?.body || '',
      wait_days: step?.wait_days || 3,
      condition_type: step?.condition_type || 'if_opened'
    });
  }, [step?.id]);

  const handleSave = () => {
    onUpdate(step.id, formData);
  };

  const insertVariable = (variable) => {
    const textarea = document.querySelector('textarea[name="body"]');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.body;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + variable + after;
      setFormData({ ...formData, body: newText });
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
      }, 0);
    }
  };

  if (!step) return null;

  return h('div', { className: "animate-fade-in" },
    step.step_type === 'email' && h('div', { className: "space-y-6" },
      h('div', { className: "flex justify-between items-center mb-4" },
        h('h3', { className: "font-serif text-2xl text-jaguar-900" }, 'Email Step'),
        h('button', {
          onClick: handleSave,
          disabled: saving,
          className: "px-4 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 disabled:opacity-50 flex items-center gap-2 transition-colors"
        },
          saving ? h(Icons.Loader2, { size: 16 }) : h(Icons.Save, { size: 16 }),
          'Save Changes'
        )
      ),
      h('div', null,
        h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Subject Line'),
        h('input', {
          type: "text",
          value: formData.subject,
          onChange: (e) => setFormData({ ...formData, subject: e.target.value }),
          onBlur: handleSave,
          className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all font-serif",
          placeholder: "Enter email subject..."
        })
      ),
      h('div', null,
        h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Email Body'),
        h('div', { className: "border border-stone-200 rounded-md overflow-hidden" },
          h('div', { className: "bg-stone-50 px-3 py-2 border-b border-stone-200 flex gap-2 flex-wrap" },
            h('button', {
              type: "button",
              onClick: () => insertVariable('{{first_name}}'),
              className: "px-2 py-1 bg-white border border-stone-200 rounded text-xs text-gold-600 hover:text-gold-500 hover:border-gold-500 transition-colors"
            }, '{{first_name}}'),
            h('button', {
              type: "button",
              onClick: () => insertVariable('{{last_name}}'),
              className: "px-2 py-1 bg-white border border-stone-200 rounded text-xs text-gold-600 hover:text-gold-500 hover:border-gold-500 transition-colors"
            }, '{{last_name}}'),
            h('button', {
              type: "button",
              onClick: () => insertVariable('{{company}}'),
              className: "px-2 py-1 bg-white border border-stone-200 rounded text-xs text-gold-600 hover:text-gold-500 hover:border-gold-500 transition-colors"
            }, '{{company}}'),
            h('button', {
              type: "button",
              onClick: () => insertVariable('{{email}}'),
              className: "px-2 py-1 bg-white border border-stone-200 rounded text-xs text-gold-600 hover:text-gold-500 hover:border-gold-500 transition-colors"
            }, '{{email}}')
          ),
          h('textarea', {
            name: "body",
            value: formData.body,
            onChange: (e) => setFormData({ ...formData, body: e.target.value }),
            onBlur: handleSave,
            rows: 12,
            className: "w-full p-4 focus:outline-none resize-none",
            placeholder: "Hi {{first_name}},\n\nI noticed..."
          })
        )
      ),
      h('div', { className: "p-4 bg-cream-50 border border-stone-100 rounded-lg" },
        h('h4', { className: "text-sm font-medium text-jaguar-900 mb-3" }, 'Tracking Options'),
        h('div', { className: "flex gap-6" },
          h('label', { className: "flex items-center gap-2 text-sm text-stone-600 cursor-pointer" },
            h('input', { type: "checkbox", defaultChecked: true, className: "rounded" }),
            'Track Opens'
          ),
          h('label', { className: "flex items-center gap-2 text-sm text-stone-600 cursor-pointer" },
            h('input', { type: "checkbox", defaultChecked: true, className: "rounded" }),
            'Track Clicks'
          )
        )
      )
    ),
    step.step_type === 'wait' && h('div', { className: "flex flex-col items-center justify-center h-full text-center" },
      h(Icons.Clock, { size: 48, className: "text-gold-500 mb-4" }),
      h('h3', { className: "text-xl font-serif text-jaguar-900 mb-6" }, 'Delay Duration'),
      h('div', { className: "flex items-center gap-4" },
        h('button', {
          onClick: () => {
            const newDays = Math.max(1, formData.wait_days - 1);
            setFormData({ ...formData, wait_days: newDays });
            onUpdate(step.id, { wait_days: newDays });
          },
          className: "w-10 h-10 rounded-full border border-stone-200 flex items-center justify-center hover:bg-stone-50 hover:border-jaguar-900 transition-colors"
        }, '-'),
        h('div', { className: "text-4xl font-serif text-jaguar-900 w-24" }, formData.wait_days),
        h('button', {
          onClick: () => {
            const newDays = formData.wait_days + 1;
            setFormData({ ...formData, wait_days: newDays });
            onUpdate(step.id, { wait_days: newDays });
          },
          className: "w-10 h-10 rounded-full border border-stone-200 flex items-center justify-center hover:bg-stone-50 hover:border-jaguar-900 transition-colors"
        }, '+')
      ),
      h('p', { className: "mt-4 text-stone-500 uppercase tracking-widest text-sm" }, 'Days')
    ),
    step.step_type === 'condition' && h('div', { className: "space-y-6" },
      h('div', { className: "flex justify-between items-center mb-4" },
        h('h3', { className: "font-serif text-2xl text-jaguar-900" }, 'Condition Step'),
        h('button', {
          onClick: handleSave,
          disabled: saving,
          className: "px-4 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 disabled:opacity-50 flex items-center gap-2"
        },
          saving ? h(Icons.Loader2, { size: 16 }) : h(Icons.Save, { size: 16 }),
          'Save Changes'
        )
      ),
      h('div', { className: "p-6 bg-cream-50 rounded-lg border border-stone-200" },
        h(Icons.Split, { size: 32, className: "text-gold-500 mb-4" }),
        h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Condition Type'),
        h('select', {
          value: formData.condition_type,
          onChange: (e) => {
            setFormData({ ...formData, condition_type: e.target.value });
            handleSave();
          },
          className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20"
        },
          h('option', { value: "if_opened" }, 'If Email Opened'),
          h('option', { value: "if_not_opened" }, 'If Email Not Opened'),
          h('option', { value: "if_clicked" }, 'If Link Clicked'),
          h('option', { value: "if_replied" }, 'If Replied')
        ),
        h('p', { className: "text-xs text-stone-500 mt-2" }, 'Recipients will only continue if this condition is met')
      )
    )
  );
};

const NewCampaignModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    email_account_id: '',
    contact_list_id: ''
  });
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [contactLists, setContactLists] = useState([]);
  const [loading, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData);
  };

  return h('div', {
    className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in",
    onClick: onClose
  },
    h('div', {
      className: "bg-white rounded-lg p-8 max-w-md w-full mx-4",
      onClick: (e) => e.stopPropagation()
    },
      h('h3', { className: "font-serif text-2xl text-jaguar-900 mb-6" }, 'Create New Campaign'),
      loading
        ? h('div', { className: "flex justify-center py-8" },
            h(Icons.Loader2, { size: 32, className: "text-jaguar-900" })
          )
        : h('form', { onSubmit: handleSubmit, className: "space-y-4" },
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Campaign Name'),
              h('input', {
                type: "text",
                required: true,
                value: formData.name,
                onChange: (e) => setFormData({...formData, name: e.target.value}),
                className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all",
                placeholder: "Q1 Outreach"
              })
            ),
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Email Account'),
              h('select', {
                required: true,
                value: formData.email_account_id,
                onChange: (e) => setFormData({...formData, email_account_id: e.target.value}),
                className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all"
              },
                h('option', { value: "" }, 'Select account...'),
                ...emailAccounts.map(acc =>
                  h('option', { key: acc.id, value: acc.id }, acc.email_address)
                )
              )
            ),
            h('div', null,
              h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Contact List'),
              h('select', {
                required: true,
                value: formData.contact_list_id,
                onChange: (e) => setFormData({...formData, contact_list_id: e.target.value}),
                className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all"
              },
                h('option', { value: "" }, 'Select list...'),
                ...contactLists.map(list =>
                  h('option', { key: list.id, value: list.id }, list.name)
                )
              )
            ),
            h('div', { className: "flex gap-3 pt-4" },
              h('button', {
                type: "button",
                onClick: onClose,
                className: "flex-1 px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50 transition-colors"
              }, 'Cancel'),
              h('button', {
                type: "submit",
                className: "flex-1 px-4 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 transition-colors"
              }, 'Create')
            )
          )
    )
  );
};
