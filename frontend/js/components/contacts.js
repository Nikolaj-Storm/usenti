// Mr. Snowman - Contacts Component (COMPLETE FIX)

const Contacts = () => {
  const [contactLists, setContactLists] = React.useState([]);
  const [selectedList, setSelectedList] = React.useState(null);
  const [contacts, setContacts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showNewListModal, setShowNewListModal] = React.useState(false);
  const [showImportModal, setShowImportModal] = React.useState(false);
  const [editingContact, setEditingContact] = React.useState(null);

  React.useEffect(() => {
    loadContactLists();
  }, []);

  const loadContactLists = async () => {
    try {
      const data = await api.getContactLists();
      const listData = Array.isArray(data) ? data : [];
      console.log('Loaded contact lists:', listData);
      setContactLists(listData);
      
      if (listData.length > 0) {
        // If we have a selected list, keep it selected, otherwise select first
        const listToSelect = selectedList 
          ? listData.find(l => l.id === selectedList.id) || listData[0]
          : listData[0];
        setSelectedList(listToSelect);
        await loadContacts(listToSelect.id);
      } else {
        setSelectedList(null);
        setContacts([]);
      }
    } catch (error) {
      console.error('Failed to load contact lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async (listId) => {
    console.log('Loading contacts for list:', listId);
    try {
      // CORRECT endpoint structure from backend: /api/contacts/lists/:listId/contacts
      const response = await api.get(`/api/contacts/lists/${listId}/contacts`);
      console.log('Raw contacts response:', response);
      console.log('Response type:', typeof response);
      console.log('Response keys:', Object.keys(response || {}));
      
      // The backend returns { contacts: [...], total: N, limit: N, offset: N }
      let contactData = [];
      if (Array.isArray(response)) {
        contactData = response;
        console.log('Response was an array');
      } else if (response && response.contacts) {
        contactData = response.contacts;
        console.log('Extracted contacts from response.contacts');
      } else {
        console.warn('Unexpected response format:', response);
      }
      
      console.log('Final parsed contacts:', contactData);
      console.log('Number of contacts:', contactData.length);
      setContacts(contactData);
    } catch (error) {
      console.error('Failed to load contacts:', error);
      console.error('Error details:', error.message);
      setContacts([]);
    }
  };

  const handleCreateList = async (name, description) => {
    try {
      const newList = await api.createContactList(name, description);
      const updatedLists = [...contactLists, newList];
      setContactLists(updatedLists);
      setSelectedList(newList);
      setContacts([]);
      setShowNewListModal(false);
    } catch (error) {
      console.error('Failed to create list:', error);
      alert('Failed to create list: ' + error.message);
    }
  };

  const handleDeleteList = async (listId) => {
    if (!confirm('Are you sure you want to delete this list? All contacts in this list will be removed.')) {
      return;
    }

    try {
      console.log('Deleting list:', listId);
      // FIXED: Correct backend endpoint is /api/contacts/lists/:listId
      await api.delete(`/api/contacts/lists/${listId}`);
      
      const updatedLists = contactLists.filter(l => l.id !== listId);
      console.log('Updated lists after delete:', updatedLists);
      setContactLists(updatedLists);
      
      // If we deleted the selected list, select another one
      if (selectedList?.id === listId) {
        if (updatedLists.length > 0) {
          setSelectedList(updatedLists[0]);
          await loadContacts(updatedLists[0].id);
        } else {
          setSelectedList(null);
          setContacts([]);
        }
      }
    } catch (error) {
      console.error('Failed to delete list:', error);
      alert('Failed to delete list: ' + error.message);
    }
  };

  const handleUpdateContact = async (contactId, updates) => {
    try {
      console.log('Updating contact:', contactId, updates);
      const updated = await api.put(`/api/contacts/${contactId}`, updates);
      
      // Update the contact in the list
      setContacts(contacts.map(c => c.id === contactId ? updated : c));
      setEditingContact(null);
      alert('Contact updated successfully!');
    } catch (error) {
      console.error('Failed to update contact:', error);
      alert('Failed to update contact: ' + error.message);
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (!confirm('Are you sure you want to delete this contact?')) {
      return;
    }

    try {
      await api.delete(`/api/contacts/${contactId}`);
      setContacts(contacts.filter(c => c.id !== contactId));
      // Refresh list counts
      await loadContactLists();
    } catch (error) {
      console.error('Failed to delete contact:', error);
      alert('Failed to delete contact: ' + error.message);
    }
  };

  const handleImportComplete = async () => {
    setShowImportModal(false);
    // Refresh both the list counts and the contacts
    await loadContactLists();
  };

  if (loading) {
    return h('div', { className: "flex items-center justify-center h-96" },
      h(Icons.Loader2, { size: 48, className: "text-jaguar-900 animate-spin" })
    );
  }

  // --- 1. Empty State (No Lists) ---
  if (contactLists.length === 0) {
    return h('div', { className: "flex flex-col items-center justify-center h-96 text-center animate-fade-in" },
      h(Icons.Users, { size: 64, className: "text-stone-300 mb-4" }),
      h('h3', { className: "font-serif text-2xl text-jaguar-900 mb-2" }, 'No Contact Lists Yet'),
      h('p', { className: "text-stone-500 mb-6 max-w-md" }, 'Create your first contact list to start organizing your prospects.'),
      h('button', {
        onClick: () => setShowNewListModal(true),
        className: "px-6 py-3 bg-jaguar-900 text-cream-50 rounded-lg hover:bg-jaguar-800 flex items-center gap-2 transition-colors"
      },
        h(Icons.Plus, { size: 20 }),
        ' Create Your First List'
      ),
      showNewListModal && h(NewListModal, {
        onClose: () => setShowNewListModal(false),
        onCreate: handleCreateList
      })
    );
  }

  // --- 2. Main Dashboard View ---
  return h('div', { className: "space-y-6 animate-fade-in" },
    h('div', { className: "flex justify-between items-end" },
      h('div', null,
        h('h2', { className: "font-serif text-3xl text-jaguar-900" }, 'Contacts'),
        h('p', { className: "text-stone-500 mt-2 font-light" }, 'Manage your contact lists and prospects.')
      ),
      h('div', { className: "flex gap-3" },
        h('button', {
          onClick: () => setShowNewListModal(true),
          className: "px-4 py-2 bg-white border border-stone-200 text-stone-700 rounded-md hover:bg-stone-50 font-medium flex items-center gap-2 transition-colors"
        },
          h(Icons.Plus, { size: 18 }),
          ' New List'
        ),
        selectedList && h('button', {
          onClick: () => setShowImportModal(true),
          className: "px-4 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 font-medium flex items-center gap-2 transition-colors"
        },
          h(Icons.Upload, { size: 18 }),
          ' Import Contacts'
        )
      )
    ),
    
    // Tab Navigation for Lists
    h('div', { className: "flex gap-2 overflow-x-auto pb-2" },
      ...contactLists.map((list) =>
        h('div', { key: list.id, className: "relative group" },
          h('button', {
            onClick: () => {
              console.log('Selecting list:', list);
              setSelectedList(list);
              loadContacts(list.id);
            },
            className: `px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
              selectedList?.id === list.id
                ? 'bg-jaguar-900 text-cream-50 shadow-lg'
                : 'bg-white border border-stone-200 text-stone-700 hover:border-jaguar-900/30'
            }`
          },
            h('span', null, list.name),
            h('span', {
              className: `ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                selectedList?.id === list.id ? 'bg-white/20 text-cream-50' : 'bg-stone-100 text-stone-500'
              }`
            }, list.total_contacts || 0)
          ),
          // Delete button (shown on hover)
          h('button', {
            onClick: (e) => {
              e.stopPropagation();
              handleDeleteList(list.id);
            },
            className: "absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600 shadow-lg z-10",
            title: "Delete list"
          }, h(Icons.X, { size: 14 }))
        )
      )
    ),

    // Contacts Table Container
    h('div', { className: "bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden min-h-[400px]" },
      contacts.length === 0
        ? h('div', { className: "flex flex-col items-center justify-center py-20 text-center h-full" },
            h(Icons.Users, { size: 48, className: "text-stone-300 mb-3" }),
            h('h3', { className: "font-medium text-jaguar-900 mb-2" }, 'No Contacts Yet'),
            h('p', { className: "text-stone-500 text-sm mb-4" }, 'Import contacts to get started'),
            h('button', {
              onClick: () => setShowImportModal(true),
              className: "px-4 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 flex items-center gap-2 transition-colors"
            },
              h(Icons.Upload, { size: 16 }),
              ' Import Contacts'
            )
          )
        : h('div', { className: "overflow-x-auto" },
            h('table', { className: "w-full" },
              h('thead', { className: "bg-cream-50 border-b border-stone-200" },
                h('tr', null,
                  h('th', { className: "px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider" }, 'Name'),
                  h('th', { className: "px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider" }, 'Email'),
                  h('th', { className: "px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider" }, 'Company'),
                  h('th', { className: "px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider" }, 'Status'),
                  h('th', { className: "px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider" }, 'Actions')
                )
              ),
              h('tbody', { className: "divide-y divide-stone-100" },
                ...contacts.map((contact) =>
                  h('tr', { 
                    key: contact.id, 
                    className: "hover:bg-cream-50 transition-colors cursor-pointer",
                    onClick: () => setEditingContact(contact)
                  },
                    h('td', { className: "px-6 py-4 whitespace-nowrap" },
                      h('div', { className: "flex items-center" },
                        h('div', { className: "w-8 h-8 rounded-full bg-jaguar-100 text-jaguar-900 flex items-center justify-center text-sm font-medium mr-3" },
                          (contact.first_name?.[0]?.toUpperCase() || contact.email?.[0]?.toUpperCase() || '?')
                        ),
                        h('div', { className: "font-medium text-jaguar-900" },
                          `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown'
                        )
                      )
                    ),
                    h('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-stone-600" }, contact.email),
                    h('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-stone-600" }, contact.company || '-'),
                    h('td', { className: "px-6 py-4 whitespace-nowrap" },
                      h('span', {
                        className: `px-2 py-1 text-xs font-medium rounded-full ${
                          contact.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : contact.status === 'bounced'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-stone-100 text-stone-600'
                        }`
                      }, contact.status || 'active')
                    ),
                    h('td', { className: "px-6 py-4 whitespace-nowrap text-right text-sm" },
                      h('div', { className: "flex gap-2 justify-end" },
                        h('button', { 
                          onClick: (e) => {
                            e.stopPropagation();
                            setEditingContact(contact);
                          },
                          className: "text-stone-400 hover:text-jaguar-900 transition-colors",
                          title: "Edit contact"
                        }, h(Icons.Edit3, { size: 16 })),
                        h('button', { 
                          onClick: (e) => {
                            e.stopPropagation();
                            handleDeleteContact(contact.id);
                          },
                          className: "text-stone-400 hover:text-red-600 transition-colors",
                          title: "Delete contact"
                        }, h(Icons.Trash2, { size: 16 }))
                      )
                    )
                  )
                )
              )
            )
          )
    ),

    // Stats Dashboard
    selectedList && contacts.length > 0 && h('div', { className: "grid grid-cols-1 md:grid-cols-4 gap-4" },
      h('div', { className: "bg-white p-4 rounded-lg border border-stone-200" },
        h('div', { className: "text-sm text-stone-500 mb-1" }, 'Total Contacts'),
        h('div', { className: "text-2xl font-serif text-jaguar-900" }, contacts.length)
      ),
      h('div', { className: "bg-white p-4 rounded-lg border border-stone-200" },
        h('div', { className: "text-sm text-stone-500 mb-1" }, 'Active'),
        h('div', { className: "text-2xl font-serif text-green-600" },
          contacts.filter(c => c.status === 'active').length
        )
      ),
      h('div', { className: "bg-white p-4 rounded-lg border border-stone-200" },
        h('div', { className: "text-sm text-stone-500 mb-1" }, 'Bounced'),
        h('div', { className: "text-2xl font-serif text-red-600" },
          contacts.filter(c => c.status === 'bounced').length
        )
      ),
      h('div', { className: "bg-white p-4 rounded-lg border border-stone-200" },
        h('div', { className: "text-sm text-stone-500 mb-1" }, 'Unsubscribed'),
        h('div', { className: "text-2xl font-serif text-stone-400" },
          contacts.filter(c => c.status === 'unsubscribed').length
        )
      )
    ),
    
    // Modals
    showNewListModal && h(NewListModal, {
      onClose: () => setShowNewListModal(false),
      onCreate: handleCreateList
    }),
    showImportModal && h(ImportModal, {
      listId: selectedList.id,
      onClose: () => setShowImportModal(false),
      onComplete: handleImportComplete
    }),
    editingContact && h(EditContactModal, {
      contact: editingContact,
      onClose: () => setEditingContact(null),
      onSave: handleUpdateContact
    })
  );
};

// --- Modal Components ---

const NewListModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = React.useState({ name: '', description: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData.name, formData.description);
  };

  return h('div', {
    className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in",
    onClick: onClose
  },
    h('div', {
      className: "bg-white rounded-lg p-8 max-w-md w-full mx-4",
      onClick: (e) => e.stopPropagation()
    },
      h('h3', { className: "font-serif text-2xl text-jaguar-900 mb-6" }, 'Create New List'),
      h('form', { onSubmit: handleSubmit, className: "space-y-4" },
        h('div', null,
          h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'List Name'),
          h('input', {
            type: "text",
            required: true,
            value: formData.name,
            onChange: (e) => setFormData({...formData, name: e.target.value}),
            className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all",
            placeholder: "Enterprise Prospects"
          })
        ),
        h('div', null,
          h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Description (Optional)'),
          h('textarea', {
            value: formData.description,
            onChange: (e) => setFormData({...formData, description: e.target.value}),
            className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all resize-none",
            rows: 3,
            placeholder: "Describe this contact list..."
          })
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

const EditContactModal = ({ contact, onClose, onSave }) => {
  const [formData, setFormData] = React.useState({
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    email: contact.email || '',
    company: contact.company || '',
    status: contact.status || 'active'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(contact.id, formData);
  };

  return h('div', {
    className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in",
    onClick: onClose
  },
    h('div', {
      className: "bg-white rounded-lg p-8 max-w-md w-full mx-4",
      onClick: (e) => e.stopPropagation()
    },
      h('h3', { className: "font-serif text-2xl text-jaguar-900 mb-6" }, 'Edit Contact'),
      h('form', { onSubmit: handleSubmit, className: "space-y-4" },
        h('div', { className: "grid grid-cols-2 gap-4" },
          h('div', null,
            h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'First Name'),
            h('input', {
              type: "text",
              value: formData.first_name,
              onChange: (e) => setFormData({...formData, first_name: e.target.value}),
              className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all",
              placeholder: "John"
            })
          ),
          h('div', null,
            h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Last Name'),
            h('input', {
              type: "text",
              value: formData.last_name,
              onChange: (e) => setFormData({...formData, last_name: e.target.value}),
              className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all",
              placeholder: "Doe"
            })
          )
        ),
        h('div', null,
          h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Email'),
          h('input', {
            type: "email",
            required: true,
            value: formData.email,
            onChange: (e) => setFormData({...formData, email: e.target.value}),
            className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all",
            placeholder: "john@company.com"
          })
        ),
        h('div', null,
          h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Company'),
          h('input', {
            type: "text",
            value: formData.company,
            onChange: (e) => setFormData({...formData, company: e.target.value}),
            className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all",
            placeholder: "Acme Corp"
          })
        ),
        h('div', null,
          h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Status'),
          h('select', {
            value: formData.status,
            onChange: (e) => setFormData({...formData, status: e.target.value}),
            className: "w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all"
          },
            h('option', { value: "active" }, 'Active'),
            h('option', { value: "bounced" }, 'Bounced'),
            h('option', { value: "unsubscribed" }, 'Unsubscribed'),
            h('option', { value: "invalid" }, 'Invalid')
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
          }, 'Save Changes')
        )
      )
    )
  );
};

const ImportModal = ({ listId, onClose, onComplete }) => {
  const [step, setStep] = React.useState('upload');
  const [file, setFile] = React.useState(null);
  const [parsedData, setParsedData] = React.useState([]);
  const [headers, setHeaders] = React.useState([]);
  const [mapping, setMapping] = React.useState({
    first_name: '',
    last_name: '',
    email: '',
    company: '',
    title: '',
    phone: ''
  });
  const [dragActive, setDragActive] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  
  const fileInputRef = React.useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file) => {
    setFile(file);
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (!['csv', 'xlsx', 'xls'].includes(fileExtension)) {
      alert('Please upload a CSV or Excel file');
      return;
    }

    try {
      const reader = new FileReader();

      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        if (jsonData.length === 0) {
          alert('File is empty');
          return;
        }

        const headers = jsonData[0];
        const rows = jsonData.slice(1).filter(row => row.some(cell => cell));

        setHeaders(headers);
        setParsedData(rows);

        // Auto-mapping logic
        const autoMapping = {};
        const lowerHeaders = headers.map(h => String(h).toLowerCase());

        const findHeader = (terms) => {
             const idx = lowerHeaders.findIndex(h => terms.some(t => h === t || h.includes(t)));
             return idx !== -1 ? headers[idx] : null;
        };

        if (lowerHeaders.includes('email')) autoMapping.email = headers[lowerHeaders.indexOf('email')];
        
        const firstName = findHeader(['first name', 'firstname', 'first']);
        if(firstName) autoMapping.first_name = firstName;

        const lastName = findHeader(['last name', 'lastname', 'last']);
        if(lastName) autoMapping.last_name = lastName;

        const company = findHeader(['company', 'organization', 'business']);
        if(company) autoMapping.company = company;

        setMapping({ ...mapping, ...autoMapping });
        setStep('mapping');
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Error parsing file: ' + error.message);
    }
  };

  const handleImport = async () => {
    if (!mapping.email) {
      alert('Please map the email field');
      return;
    }

    setStep('processing');
    setUploading(true);

    try {
      const contacts = parsedData.map(row => {
        const contact = {};
        Object.keys(mapping).forEach(field => {
          if (mapping[field]) {
            const colIndex = headers.indexOf(mapping[field]);
            if (colIndex !== -1) {
              contact[field] = row[colIndex];
            }
          }
        });
        return contact;
      }).filter(c => c.email);

      console.log('Importing contacts:', contacts);

      const result = await api.importContacts(listId, contacts);
      console.log('Import result:', result);

      // Close modal and trigger refresh
      onComplete();
      alert(`Successfully imported ${result.imported || contacts.length} contacts!`);
    } catch (error) {
      console.error('Error importing contacts:', error);
      alert('Error importing contacts: ' + error.message);
      setStep('mapping');
    } finally {
      setUploading(false);
    }
  };

  return h('div', {
    className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in",
    onClick: onClose
  },
    h('div', {
      className: "bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto",
      onClick: (e) => e.stopPropagation()
    },
      h('div', { className: "flex justify-between items-center mb-6" },
        h('h3', { className: "font-serif text-2xl text-jaguar-900" }, 'Import Contacts'),
        h('button', {
          onClick: onClose,
          className: "text-stone-400 hover:text-stone-600 transition-colors"
        }, h(Icons.X, { size: 24 }))
      ),
      step === 'upload' && h('div', { className: "space-y-6" },
        h('div', {
          onDragEnter: handleDrag,
          onDragLeave: handleDrag,
          onDragOver: handleDrag,
          onDrop: handleDrop,
          className: `border-2 border-dashed rounded-lg p-12 text-center transition-all ${
            dragActive
              ? 'border-jaguar-900 bg-jaguar-100/10'
              : 'border-stone-200 hover:border-stone-300'
          }`
        },
          h(Icons.Upload, { size: 48, className: "text-stone-300 mx-auto mb-4" }),
          h('h4', { className: "font-medium text-jaguar-900 mb-2" }, 'Drop your file here'),
          h('p', { className: "text-sm text-stone-500 mb-4" }, 'Supports CSV, XLS, and XLSX files'),
          h('input', {
            ref: fileInputRef,
            type: "file",
            accept: ".csv,.xlsx,.xls",
            onChange: handleFileInput,
            className: "hidden"
          }),
          h('button', {
            onClick: () => fileInputRef.current?.click(),
            className: "px-6 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 transition-colors"
          }, 'Choose File')
        ),
        h('div', { className: "p-4 bg-cream-50 border border-stone-200 rounded-lg" },
          h('h5', { className: "font-medium text-jaguar-900 mb-2 flex items-center gap-2" },
            h(Icons.AlertCircle, { size: 16, className: "text-gold-600" }),
            'File Requirements'
          ),
          h('ul', { className: "text-sm text-stone-600 space-y-1 ml-6 list-disc" },
            h('li', null, 'Must include an email column'),
            h('li', null, 'First row should contain column headers'),
            h('li', null, 'Supported formats: CSV, Excel (.xlsx, .xls)')
          )
        )
      ),
      step === 'mapping' && h('div', { className: "space-y-6" },
        h('div', { className: "p-4 bg-cream-50 border border-stone-200 rounded-lg" },
          h('div', { className: "flex items-center gap-2 mb-2" },
            h(Icons.Check, { size: 16, className: "text-green-600" }),
            h('span', { className: "font-medium text-jaguar-900" }, file?.name)
          ),
          h('p', { className: "text-sm text-stone-600" }, `${parsedData.length} rows detected`)
        ),
        h('div', null,
          h('h4', { className: "font-medium text-jaguar-900 mb-4" }, 'Map Your Columns'),
          h('div', { className: "space-y-3" },
            ...Object.keys(mapping).map(field =>
              h('div', { key: field, className: "grid grid-cols-2 gap-4 items-center" },
                h('label', { className: "text-sm font-medium text-stone-700 capitalize" },
                  field.replace('_', ' '),
                  field === 'email' && h('span', { className: "text-red-500 ml-1" }, '*')
                ),
                h('select', {
                  value: mapping[field],
                  onChange: (e) => setMapping({ ...mapping, [field]: e.target.value }),
                  className: "px-3 py-2 border border-stone-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900"
                },
                  h('option', { value: "" }, '-- Skip --'),
                  ...headers.map((header, idx) =>
                    h('option', { key: idx, value: header }, header)
                  )
                )
              )
            )
          )
        ),
        h('div', null,
          h('h4', { className: "font-medium text-jaguar-900 mb-3" }, 'Preview (First 3 Rows)'),
          h('div', { className: "overflow-x-auto border border-stone-200 rounded-lg" },
            h('table', { className: "w-full text-sm" },
              h('thead', { className: "bg-cream-50" },
                h('tr', null,
                  ...Object.keys(mapping).filter(k => mapping[k]).map(field =>
                    h('th', { key: field, className: "px-3 py-2 text-left text-xs font-medium text-stone-500 uppercase" },
                      field.replace('_', ' ')
                    )
                  )
                )
              ),
              h('tbody', { className: "divide-y divide-stone-100" },
                ...parsedData.slice(0, 3).map((row, idx) =>
                  h('tr', { key: idx },
                    ...Object.keys(mapping).filter(k => mapping[k]).map(field => {
                      const colIndex = headers.indexOf(mapping[field]);
                      return h('td', { key: field, className: "px-3 py-2 text-stone-600" },
                        row[colIndex] || '-'
                      );
                    })
                  )
                )
              )
            )
          )
        ),
        h('div', { className: "flex gap-3" },
          h('button', {
            onClick: () => setStep('upload'),
            className: "flex-1 px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50 transition-colors"
          }, 'Back'),
          h('button', {
            onClick: handleImport,
            disabled: !mapping.email,
            className: "flex-1 px-4 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          }, `Import ${parsedData.length} Contacts`)
        )
      ),
      step === 'processing' && h('div', { className: "flex flex-col items-center justify-center py-12" },
        h(Icons.Loader2, { size: 48, className: "text-jaguar-900 animate-spin mb-4" }),
        h('h4', { className: "font-medium text-jaguar-900 mb-2" }, 'Importing Contacts...'),
        h('p', { className: "text-sm text-stone-500" }, 'Please wait while we process your file')
      )
    )
  );
};
