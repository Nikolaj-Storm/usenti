// Mr. Snowman - Contacts Component

const { useState, useEffect, useRef } = React;

const Contacts = () => {
  const [contactLists, setContactLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    loadContactLists();
  }, []);

  const loadContactLists = async () => {
    try {
      const data = await api.getContactLists();
      setContactLists(data);
      if (data.length > 0 && !selectedList) {
        setSelectedList(data[0]);
        loadContacts(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load contact lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async (listId) => {
    try {
      const data = await api.getContacts(listId);
      setContacts(data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  const handleCreateList = async (name, description) => {
    try {
      const newList = await api.createContactList(name, description);
      setContactLists([...contactLists, newList]);
      setSelectedList(newList);
      setContacts([]);
      setShowNewListModal(false);
    } catch (error) {
      console.error('Failed to create list:', error);
      alert('Failed to create list: ' + error.message);
    }
  };

  const handleImportComplete = (importedContacts) => {
    setContacts([...contacts, ...importedContacts]);
    setShowImportModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Icons.Loader2 size={48} className="text-jaguar-900" />
      </div>
    );
  }

  if (contactLists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center animate-fade-in">
        <Icons.Users size={64} className="text-stone-300 mb-4" />
        <h3 className="font-serif text-2xl text-jaguar-900 mb-2">No Contact Lists Yet</h3>
        <p className="text-stone-500 mb-6 max-w-md">Create your first contact list to start organizing your prospects.</p>
        <button
          onClick={() => setShowNewListModal(true)}
          className="px-6 py-3 bg-jaguar-900 text-cream-50 rounded-lg hover:bg-jaguar-800 flex items-center gap-2 transition-colors"
        >
          <Icons.Plus size={20} /> Create Your First List
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-serif text-3xl text-jaguar-900">Contacts</h2>
          <p className="text-stone-500 mt-2 font-light">Manage your contact lists and prospects.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowNewListModal(true)}
            className="px-4 py-2 bg-white border border-stone-200 text-stone-700 rounded-md hover:bg-stone-50 font-medium flex items-center gap-2 transition-colors"
          >
            <Icons.Plus size={18} /> New List
          </button>
          {selectedList && (
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 font-medium flex items-center gap-2 transition-colors"
            >
              <Icons.Upload size={18} /> Import Contacts
            </button>
          )}
        </div>
      </div>

      {/* List Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {contactLists.map((list) => (
          <button
            key={list.id}
            onClick={() => {
              setSelectedList(list);
              loadContacts(list.id);
            }}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
              selectedList?.id === list.id
                ? 'bg-jaguar-900 text-cream-50 shadow-lg'
                : 'bg-white border border-stone-200 text-stone-700 hover:border-jaguar-900/30'
            }`}
          >
            {list.name}
            <span className={`ml-2 text-xs ${
              selectedList?.id === list.id ? 'text-cream-200' : 'text-stone-400'
            }`}>
              ({list.contact_count || 0})
            </span>
          </button>
        ))}
      </div>

      {/* Contacts Table */}
      <div className="bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden">
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Icons.Users size={48} className="text-stone-300 mb-3" />
            <h3 className="font-medium text-jaguar-900 mb-2">No Contacts Yet</h3>
            <p className="text-stone-500 text-sm mb-4">Import contacts to get started</p>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 flex items-center gap-2 transition-colors"
            >
              <Icons.Upload size={16} /> Import Contacts
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-cream-50 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-cream-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-jaguar-100 text-jaguar-900 flex items-center justify-center text-sm font-medium mr-3">
                          {contact.first_name?.[0]?.toUpperCase() || contact.email?.[0]?.toUpperCase()}
                        </div>
                        <div className="font-medium text-jaguar-900">
                          {contact.first_name} {contact.last_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">
                      {contact.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">
                      {contact.company || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        contact.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : contact.status === 'bounced'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-stone-100 text-stone-600'
                      }`}>
                        {contact.status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button className="text-stone-400 hover:text-stone-600 transition-colors">
                        <Icons.Edit3 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats */}
      {selectedList && contacts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-stone-200">
            <div className="text-sm text-stone-500 mb-1">Total Contacts</div>
            <div className="text-2xl font-serif text-jaguar-900">{contacts.length}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-stone-200">
            <div className="text-sm text-stone-500 mb-1">Active</div>
            <div className="text-2xl font-serif text-green-600">
              {contacts.filter(c => c.status === 'active').length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-stone-200">
            <div className="text-sm text-stone-500 mb-1">Bounced</div>
            <div className="text-2xl font-serif text-red-600">
              {contacts.filter(c => c.status === 'bounced').length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-stone-200">
            <div className="text-sm text-stone-500 mb-1">Unsubscribed</div>
            <div className="text-2xl font-serif text-stone-400">
              {contacts.filter(c => c.status === 'unsubscribed').length}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewListModal && (
        <NewListModal
          onClose={() => setShowNewListModal(false)}
          onCreate={handleCreateList}
        />
      )}

      {showImportModal && (
        <ImportModal
          listId={selectedList.id}
          onClose={() => setShowImportModal(false)}
          onComplete={handleImportComplete}
        />
      )}
    </div>
  );
};

// New List Modal Component
const NewListModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({ name: '', description: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData.name, formData.description);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-2xl text-jaguar-900 mb-6">Create New List</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">List Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all"
              placeholder="Enterprise Prospects"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-2 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all resize-none"
              rows={3}
              placeholder="Describe this contact list..."
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Import Modal Component with CSV/Excel Support
const ImportModal = ({ listId, onClose, onComplete }) => {
  const [step, setStep] = useState('upload'); // 'upload', 'mapping', 'processing'
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({
    first_name: '',
    last_name: '',
    email: '',
    company: '',
    title: '',
    phone: ''
  });
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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

        // Auto-detect mappings
        const autoMapping = {};
        const lowerHeaders = headers.map(h => String(h).toLowerCase());

        if (lowerHeaders.includes('first name') || lowerHeaders.includes('firstname')) {
          autoMapping.first_name = headers[lowerHeaders.findIndex(h => h === 'first name' || h === 'firstname')];
        }
        if (lowerHeaders.includes('last name') || lowerHeaders.includes('lastname')) {
          autoMapping.last_name = headers[lowerHeaders.findIndex(h => h === 'last name' || h === 'lastname')];
        }
        if (lowerHeaders.includes('email')) {
          autoMapping.email = headers[lowerHeaders.findIndex(h => h === 'email')];
        }
        if (lowerHeaders.includes('company')) {
          autoMapping.company = headers[lowerHeaders.findIndex(h => h === 'company')];
        }
        if (lowerHeaders.includes('title') || lowerHeaders.includes('job title')) {
          autoMapping.title = headers[lowerHeaders.findIndex(h => h === 'title' || h === 'job title')];
        }
        if (lowerHeaders.includes('phone')) {
          autoMapping.phone = headers[lowerHeaders.findIndex(h => h === 'phone')];
        }

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
      // Transform data based on mapping
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
      }).filter(c => c.email); // Only include contacts with email

      // Import contacts via API
      await api.importContacts(listId, contacts);

      onComplete(contacts);
      alert(`Successfully imported ${contacts.length} contacts!`);
    } catch (error) {
      console.error('Error importing contacts:', error);
      alert('Error importing contacts: ' + error.message);
      setStep('mapping');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-serif text-2xl text-jaguar-900">Import Contacts</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <Icons.X size={24} />
          </button>
        </div>

        {step === 'upload' && (
          <div className="space-y-6">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
                dragActive
                  ? 'border-jaguar-900 bg-jaguar-100/10'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <Icons.Upload size={48} className="text-stone-300 mx-auto mb-4" />
              <h4 className="font-medium text-jaguar-900 mb-2">Drop your file here</h4>
              <p className="text-sm text-stone-500 mb-4">
                Supports CSV, XLS, and XLSX files
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileInput}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 transition-colors"
              >
                Choose File
              </button>
            </div>

            <div className="p-4 bg-cream-50 border border-stone-200 rounded-lg">
              <h5 className="font-medium text-jaguar-900 mb-2 flex items-center gap-2">
                <Icons.AlertCircle size={16} className="text-gold-600" />
                File Requirements
              </h5>
              <ul className="text-sm text-stone-600 space-y-1 ml-6 list-disc">
                <li>Must include an email column</li>
                <li>First row should contain column headers</li>
                <li>Supported formats: CSV, Excel (.xlsx, .xls)</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-6">
            <div className="p-4 bg-cream-50 border border-stone-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Icons.Check size={16} className="text-green-600" />
                <span className="font-medium text-jaguar-900">{file?.name}</span>
              </div>
              <p className="text-sm text-stone-600">
                {parsedData.length} rows detected
              </p>
            </div>

            <div>
              <h4 className="font-medium text-jaguar-900 mb-4">Map Your Columns</h4>
              <div className="space-y-3">
                {Object.keys(mapping).map(field => (
                  <div key={field} className="grid grid-cols-2 gap-4 items-center">
                    <label className="text-sm font-medium text-stone-700 capitalize">
                      {field.replace('_', ' ')}
                      {field === 'email' && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <select
                      value={mapping[field]}
                      onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                      className="px-3 py-2 border border-stone-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900"
                    >
                      <option value="">-- Skip --</option>
                      {headers.map((header, idx) => (
                        <option key={idx} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <h4 className="font-medium text-jaguar-900 mb-3">Preview (First 3 Rows)</h4>
              <div className="overflow-x-auto border border-stone-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-cream-50">
                    <tr>
                      {Object.keys(mapping).filter(k => mapping[k]).map(field => (
                        <th key={field} className="px-3 py-2 text-left text-xs font-medium text-stone-500 uppercase">
                          {field.replace('_', ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {parsedData.slice(0, 3).map((row, idx) => (
                      <tr key={idx}>
                        {Object.keys(mapping).filter(k => mapping[k]).map(field => {
                          const colIndex = headers.indexOf(mapping[field]);
                          return (
                            <td key={field} className="px-3 py-2 text-stone-600">
                              {row[colIndex] || '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('upload')}
                className="flex-1 px-4 py-2 border border-stone-200 rounded-md hover:bg-stone-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={!mapping.email}
                className="flex-1 px-4 py-2 bg-jaguar-900 text-cream-50 rounded-md hover:bg-jaguar-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Import {parsedData.length} Contacts
              </button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Icons.Loader2 size={48} className="text-jaguar-900 mb-4" />
            <h4 className="font-medium text-jaguar-900 mb-2">Importing Contacts...</h4>
            <p className="text-sm text-stone-500">Please wait while we process your file</p>
          </div>
        )}
      </div>
    </div>
  );
};
