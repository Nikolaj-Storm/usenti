// Contacts Component - Smooth CSV import and management
const Contacts = () => {
  const { useState, useEffect } = React;
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showNewListModal, setShowNewListModal] = useState(false);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    try {
      const data = await api.getContactLists();
      setLists(data);
      if (data.length > 0 && !selectedList) {
        setSelectedList(data[0]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to load lists:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Icons.Loader2 size={48} className="text-jaguar-900 mx-auto" />
          <p className="text-stone-500">Loading your contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end animate-fade-in">
        <div>
          <h2 className="font-serif text-3xl text-jaguar-900">Contacts</h2>
          <p className="text-stone-500 mt-2 font-light">Manage your contact lists and import from CSV.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowNewListModal(true)}
            className="px-6 py-3 bg-white border border-stone-200 text-jaguar-900 rounded-xl font-medium hover:bg-cream-50 transition-all duration-300 flex items-center gap-2 shadow-sm hover:shadow"
          >
            <Icons.Plus size={20} />
            New List
          </button>
          <button 
            onClick={() => setShowImportModal(true)}
            disabled={!selectedList}
            className="px-6 py-3 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-xl font-medium hover:shadow-xl transition-all duration-300 flex items-center gap-2 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <Icons.Upload size={20} />
            Import CSV
          </button>
        </div>
      </div>

      {lists.length === 0 ? (
        <div className="text-center py-24 animate-fade-in">
          <div className="w-24 h-24 rounded-full bg-cream-100 mx-auto mb-6 flex items-center justify-center">
            <Icons.Users size={40} className="text-stone-400" />
          </div>
          <h3 className="font-serif text-2xl text-jaguar-900 mb-2">No contact lists yet</h3>
          <p className="text-stone-500 mb-8 max-w-md mx-auto">Create your first contact list to start organizing your prospects and leads.</p>
          <button 
            onClick={() => setShowNewListModal(true)}
            className="px-8 py-4 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-xl font-medium hover:shadow-xl transition-all duration-300 inline-flex items-center gap-2"
          >
            <Icons.Plus size={20} />
            Create First List
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Contact Lists Sidebar */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="font-medium text-stone-700 text-sm uppercase tracking-wider mb-4">Your Lists</h3>
            {lists.map((list, index) => (
              <button
                key={list.id}
                onClick={() => setSelectedList(list)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-300 ${
                  selectedList?.id === list.id
                    ? 'border-jaguar-900 bg-jaguar-900 text-cream-50 shadow-lg scale-105'
                    : 'border-stone-200 bg-white hover:border-jaguar-900 hover:bg-cream-50'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-medium ${selectedList?.id === list.id ? 'text-cream-50' : 'text-jaguar-900'}`}>
                    {list.name}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    selectedList?.id === list.id 
                      ? 'bg-cream-50/20 text-cream-50' 
                      : 'bg-stone-100 text-stone-600'
                  }`}>
                    {list.total_contacts || 0}
                  </span>
                </div>
                {list.description && (
                  <p className={`text-xs ${selectedList?.id === list.id ? 'text-cream-50/80' : 'text-stone-500'} line-clamp-2`}>
                    {list.description}
                  </p>
                )}
              </button>
            ))}
          </div>

          {/* Contact List Details */}
          <div className="lg:col-span-3">
            {selectedList ? (
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-lg transition-all duration-500 overflow-hidden">
                <div className="px-6 py-5 border-b border-stone-100 bg-gradient-to-r from-cream-50 to-white">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-serif text-2xl text-jaguar-900">{selectedList.name}</h3>
                      <p className="text-sm text-stone-500 mt-1">{selectedList.description || 'No description'}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-3xl font-serif text-jaguar-900">{selectedList.total_contacts || 0}</div>
                        <div className="text-xs text-stone-500 uppercase tracking-wider">Contacts</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  {selectedList.total_contacts === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 rounded-full bg-cream-100 mx-auto mb-4 flex items-center justify-center">
                        <Icons.Upload size={28} className="text-stone-400" />
                      </div>
                      <p className="text-stone-600 font-medium mb-2">No contacts in this list</p>
                      <p className="text-stone-500 text-sm mb-6">Import contacts from a CSV file to get started</p>
                      <button 
                        onClick={() => setShowImportModal(true)}
                        className="px-6 py-3 bg-jaguar-900 text-cream-50 rounded-xl font-medium hover:bg-jaguar-800 transition-all duration-300 inline-flex items-center gap-2"
                      >
                        <Icons.Upload size={18} />
                        Import CSV
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex-1 max-w-md">
                          <div className="relative">
                            <Icons.Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                            <input
                              type="text"
                              placeholder="Search contacts..."
                              className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all"
                            />
                          </div>
                        </div>
                        <button className="px-4 py-2 bg-white border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-all duration-300 flex items-center gap-2">
                          <Icons.Download size={16} />
                          Export
                        </button>
                      </div>

                      {/* Contact Table Preview */}
                      <div className="border border-stone-200 rounded-xl overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-cream-50 border-b border-stone-200">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">Email</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">Name</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">Company</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-stone-100">
                            {/* Sample row - replace with actual data */}
                            <tr className="hover:bg-cream-50 transition-colors">
                              <td className="px-4 py-4 text-sm text-jaguar-900">example@email.com</td>
                              <td className="px-4 py-4 text-sm text-stone-600">John Doe</td>
                              <td className="px-4 py-4 text-sm text-stone-600">Acme Inc</td>
                              <td className="px-4 py-4">
                                <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Active</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="text-center text-sm text-stone-500 mt-4">
                        Showing {Math.min(50, selectedList.total_contacts)} of {selectedList.total_contacts} contacts
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-24">
                <p className="text-stone-500">Select a list to view contacts</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewListModal && (
        <NewListModal onClose={() => setShowNewListModal(false)} onSuccess={loadLists} />
      )}
      {showImportModal && selectedList && (
        <ImportCSVModal 
          listId={selectedList.id} 
          onClose={() => setShowImportModal(false)} 
          onSuccess={loadLists} 
        />
      )}
    </div>
  );
};

// New List Modal
const NewListModal = ({ onClose, onSuccess }) => {
  const { useState } = React;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await api.createContactList(formData.name, formData.description);
      onSuccess();
      onClose();
    } catch (error) {
      alert('Failed to create list: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-stone-100">
          <h3 className="font-serif text-2xl text-jaguar-900">Create Contact List</h3>
          <p className="text-sm text-stone-500 mt-1">Organize your contacts into lists</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">List Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all"
              placeholder="e.g., Prospects Q1 2025"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Description (optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={3}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all resize-none"
              placeholder="Add a description..."
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-white border-2 border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition-all duration-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-xl hover:shadow-xl transition-all duration-300 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {loading ? <><Icons.Loader2 size={18} /> Creating...</> : 'Create List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Import CSV Modal
const ImportCSVModal = ({ listId, onClose, onSuccess }) => {
  const { useState } = React;
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
    } else {
      alert('Please select a valid CSV file');
    }
  };

  const handleImport = async () => {
    if (!file) return;
    
    setLoading(true);
    
    try {
      // Parse CSV
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const contacts = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= headers.length && values[0]) {
          const contact = {};
          headers.forEach((header, index) => {
            contact[header] = values[index]?.trim() || '';
          });
          
          // Map common header variations
          contact.email = contact.email || contact['email address'] || contact.mail;
          contact.first_name = contact.first_name || contact.firstname || contact['first name'];
          contact.last_name = contact.last_name || contact.lastname || contact['last name'];
          contact.company = contact.company || contact.organization || contact.org;
          
          if (contact.email) {
            contacts.push(contact);
          }
        }
      }
      
      if (contacts.length === 0) {
        alert('No valid contacts found in CSV');
        setLoading(false);
        return;
      }
      
      const response = await api.importContacts(listId, contacts);
      setResult(response);
      onSuccess();
      
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      alert('Import failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-stone-100">
          <h3 className="font-serif text-2xl text-jaguar-900">Import Contacts from CSV</h3>
          <p className="text-sm text-stone-500 mt-1">Upload a CSV file with email, name, and company columns</p>
        </div>
        
        <div className="p-6 space-y-6">
          {!result ? (
            <>
              <div className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center hover:border-jaguar-900 transition-all duration-300 cursor-pointer bg-cream-50">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Icons.Upload size={40} className="mx-auto text-stone-400 mb-4" />
                  <p className="text-stone-700 font-medium mb-2">
                    {file ? file.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-stone-500">CSV files only (max 5MB)</p>
                </label>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex gap-3">
                  <Icons.AlertCircle size={20} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 mb-1">CSV Format</p>
                    <p className="text-xs text-blue-700">
                      Your CSV should have columns: <code className="bg-blue-100 px-1 rounded">email</code>, <code className="bg-blue-100 px-1 rounded">first_name</code>, <code className="bg-blue-100 px-1 rounded">last_name</code>, <code className="bg-blue-100 px-1 rounded">company</code>
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 bg-white border-2 border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition-all duration-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!file || loading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-xl hover:shadow-xl transition-all duration-300 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {loading ? <><Icons.Loader2 size={18} /> Importing...</> : <><Icons.Upload size={18} /> Import</>}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center">
                <Icons.Check size={32} className="text-green-600" />
              </div>
              <h4 className="font-serif text-2xl text-jaguar-900 mb-2">Import Successful!</h4>
              <p className="text-stone-600 mb-4">
                Imported <span className="font-bold text-jaguar-900">{result.imported}</span> contacts
                {result.skipped > 0 && <span className="text-stone-500"> ({result.skipped} skipped)</span>}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Make Contacts globally available
window.Contacts = Contacts;
