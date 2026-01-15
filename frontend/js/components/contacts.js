// Mr. Snowman - Contacts Component with Import Modal

const Contacts = () => {
  const { useState, useEffect, createElement: h } = React;
  const [contactLists, setContactLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadContactLists();
  }, []);

  const loadContactLists = async () => {
    try {
      setLoading(true);
      const data = await api.getContactLists();
      setContactLists(data);
    } catch (err) {
      console.error('Failed to load contact lists:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImportComplete = () => {
    loadContactLists();
    setShowModal(false);
  };

  return h('div', { className: "space-y-8" },
    h('div', { className: "flex justify-between items-end" },
      h('div', null,
        h('h2', { className: "font-serif text-3xl text-jaguar-900" }, 'Contacts'),
        h('p', { className: "text-stone-500 mt-2" }, 'Manage your contact lists and import from CSV.')),
      h('button', {
        onClick: () => setShowModal(true),
        className: "px-6 py-3 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-xl font-medium hover:shadow-xl transition-all duration-300 flex items-center gap-2"
      },
        Icons.Upload({ size: 20 }), 'Import CSV')),
    loading ? h('div', { className: "text-center py-12" },
      h('div', { className: "inline-block animate-spin text-jaguar-900" }, Icons.Loader2({ size: 32 })),
      h('p', { className: "text-stone-400 mt-4" }, 'Loading contacts...')
    ) : contactLists.length === 0 ? h('div', { className: "text-center py-12" },
      h('p', { className: "text-stone-400" }, 'No contacts yet. Import a CSV file to get started!')
    ) : h('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" },
      ...contactLists.map(list =>
        h('div', { key: list.id, className: "bg-white rounded-2xl p-6 border border-stone-200 shadow-sm hover:shadow-md transition-shadow" },
          h('div', { className: "flex items-start justify-between mb-4" },
            h('div', { className: "flex items-center gap-3" },
              h('div', { className: "w-12 h-12 rounded-xl bg-gradient-to-br from-jaguar-900 to-jaguar-800 flex items-center justify-center shadow-lg" },
                Icons.Users({ size: 24, className: "text-cream-50" })),
              h('div', null,
                h('h3', { className: "font-medium text-jaguar-900" }, list.name),
                h('p', { className: "text-xs text-stone-500" }, list.description || 'No description'))),
            h('span', { className: "px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-700 font-medium" },
              `${list.total_contacts || 0} contacts`)),
          list.created_at && h('div', { className: "text-xs text-stone-500 mt-4" },
            `Created ${new Date(list.created_at).toLocaleDateString()}`))
      )),
    showModal && h(ImportContactsModal, {
      onClose: () => setShowModal(false),
      onSuccess: handleImportComplete
    })
  );
};

// Import Contacts Modal - Enhanced with drag-drop, Excel support, and column mapping
const ImportContactsModal = ({ onClose, onSuccess }) => {
  const { useState, createElement: h } = React;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1);
  const [listName, setListName] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = { current: null };

  const parseFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        let workbook;

        if (file.name.endsWith('.csv')) {
          workbook = XLSX.read(data, { type: 'string' });
        } else {
          workbook = XLSX.read(data, { type: 'binary' });
        }

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

        if (jsonData.length < 2) {
          setError('File must contain at least a header row and one data row');
          return;
        }

        const headers = jsonData[0];
        const rows = jsonData.slice(1, 6);

        setParsedData({ headers, rows, allData: jsonData });
        setFile(file);
        setError('');
        setSuccess('');

        // Auto-detect columns
        const mapping = {};
        headers.forEach((header, idx) => {
          const lower = String(header).toLowerCase();
          if (lower.includes('email') || lower.includes('e-mail')) mapping[idx] = 'email';
          else if (lower.includes('first') && lower.includes('name')) mapping[idx] = 'first_name';
          else if (lower.includes('last') && lower.includes('name')) mapping[idx] = 'last_name';
          else if (lower.includes('name') && !mapping[idx]) mapping[idx] = 'first_name';
          else if (lower.includes('company') || lower.includes('organization')) mapping[idx] = 'company';
        });
        setColumnMapping(mapping);
        setStep(3);
      } catch (err) {
        setError('Failed to parse file: ' + err.message);
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const isValid = validExtensions.some(ext => selectedFile.name.toLowerCase().endsWith(ext));

    if (!isValid) {
      setError('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    parseFile(selectedFile);
  };

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
      const droppedFile = e.dataTransfer.files[0];
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const isValid = validExtensions.some(ext => droppedFile.name.toLowerCase().endsWith(ext));

      if (!isValid) {
        setError('Please drop a CSV or Excel file (.csv, .xlsx, .xls)');
        return;
      }

      parseFile(droppedFile);
    }
  };

  const handleNext = () => {
    if (!listName) {
      setError('Please enter a list name');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const emailColumnIdx = Object.keys(columnMapping).find(idx => columnMapping[idx] === 'email');
      if (!emailColumnIdx) {
        setError('Please map at least one column to Email');
        setLoading(false);
        return;
      }

      const list = await api.createContactList(listName, listDescription);

      const contacts = [];
      for (let i = 1; i < parsedData.allData.length; i++) {
        const row = parsedData.allData[i];
        const contact = {
          email: '',
          first_name: '',
          last_name: '',
          company: '',
          custom_fields: {}
        };

        Object.keys(columnMapping).forEach(colIdx => {
          const fieldType = columnMapping[colIdx];
          const value = String(row[colIdx] || '').trim();

          if (fieldType === 'email') contact.email = value;
          else if (fieldType === 'first_name') contact.first_name = value;
          else if (fieldType === 'last_name') contact.last_name = value;
          else if (fieldType === 'company') contact.company = value;
          else if (fieldType !== 'skip') contact.custom_fields[parsedData.headers[colIdx]] = value;
        });

        if (contact.email && contact.email.includes('@')) {
          contacts.push(contact);
        }
      }

      if (contacts.length === 0) {
        setError('No valid contacts found. Please ensure email addresses are valid.');
        setLoading(false);
        return;
      }

      const result = await api.post(`/api/contact-lists/${list.id}/import`, { contacts });
      setSuccess(`Successfully imported ${result.imported} contacts!${result.duplicates > 0 ? ` (${result.duplicates} duplicates skipped)` : ''}`);
      setTimeout(() => onSuccess(), 1500);
    } catch (err) {
      setError(err.message || 'Failed to import contacts');
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = ['Contact List Info', 'Upload File', 'Map Columns'];
  const stepDescriptions = ['Name your contact list', 'CSV, Excel (.xlsx, .xls)', 'Match columns to fields'];

  return h('div', {
    className: "fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4",
    onClick: onClose
  },
    h('div', {
      className: "bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl",
      onClick: e => e.stopPropagation()
    },
      h('div', { className: "sticky top-0 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 p-6 rounded-t-2xl z-10" },
        h('div', { className: "flex justify-between items-center mb-4" },
          h('div', null,
            h('h3', { className: "font-serif text-2xl" }, 'Import Contacts'),
            h('p', { className: "text-jaguar-100 text-sm mt-1" }, stepDescriptions[step - 1])),
          h('button', {
            onClick: onClose,
            className: "w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-300"
          }, Icons.X({ size: 20 }))),
        h('div', { className: "flex gap-2" },
          ...stepTitles.map((title, idx) =>
            h('div', {
              key: idx,
              className: `flex-1 h-1 rounded-full transition-all ${idx < step ? 'bg-gold-500' : 'bg-white/20'}`
            })))),

      h('div', { className: "p-6" },
        error && h('div', { className: "mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2" },
          Icons.AlertCircle({ size: 16 }), error),
        success && h('div', { className: "mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2" },
          h('svg', { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
            h('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" })),
          success),

        // Step 1: List Name
        step === 1 && h('div', { className: "space-y-5" },
          h('div', null,
            h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'List Name *'),
            h('input', {
              type: "text",
              required: true,
              value: listName,
              onChange: e => setListName(e.target.value),
              className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900 transition-all",
              placeholder: "e.g., Q1 2024 Prospects"
            })),
          h('div', null,
            h('label', { className: "block text-sm font-medium text-stone-700 mb-2" }, 'Description'),
            h('textarea', {
              value: listDescription,
              onChange: e => setListDescription(e.target.value),
              rows: 3,
              className: "w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 transition-all resize-none",
              placeholder: "Brief description of this contact list..."
            })),
          h('button', {
            onClick: handleNext,
            disabled: !listName,
            className: "w-full px-6 py-3 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-xl hover:from-jaguar-800 hover:to-jaguar-700 transition-all duration-300 shadow-lg hover:shadow-xl font-medium disabled:opacity-50"
          }, 'Next: Upload File →')),

        // Step 2: File Upload with Drag-Drop
        step === 2 && h('div', { className: "space-y-5" },
          h('div', {
            className: `border-2 border-dashed rounded-xl p-12 text-center transition-all ${dragActive ? 'border-jaguar-900 bg-jaguar-50' : file ? 'border-green-500 bg-green-50' : 'border-stone-300 hover:border-jaguar-900'}`,
            onDragEnter: handleDrag,
            onDragLeave: handleDrag,
            onDragOver: handleDrag,
            onDrop: handleDrop
          },
            h('input', {
              ref: r => fileInputRef.current = r,
              type: "file",
              accept: ".csv,.xlsx,.xls",
              onChange: handleFileChange,
              className: "hidden"
            }),
            file ? h('div', { className: "space-y-3" },
              h('div', { className: "w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center" },
                h('svg', { className: "w-8 h-8 text-green-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" },
                  h('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }))),
              h('div', null,
                h('p', { className: "font-semibold text-green-900 text-lg" }, file.name),
                h('p', { className: "text-sm text-green-700 mt-1" },
                  `${(file.size / 1024).toFixed(1)} KB • ${parsedData.allData.length - 1} rows detected`)),
              h('button', {
                type: "button",
                onClick: () => fileInputRef.current?.click(),
                className: "mt-2 px-4 py-2 text-sm bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors font-medium"
              }, 'Choose Different File')
            ) : h('div', { className: "space-y-4" },
              h('div', { className: "w-20 h-20 mx-auto rounded-full bg-jaguar-100 flex items-center justify-center" },
                Icons.Upload({ size: 32, className: "text-jaguar-900" })),
              h('div', null,
                h('p', { className: "text-lg font-semibold text-stone-700" }, 'Drag & drop your file here'),
                h('p', { className: "text-sm text-stone-500 mt-1" }, 'or click to browse')),
              h('div', { className: "flex items-center justify-center gap-2 mt-4" },
                h('span', { className: "px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-medium" }, '.CSV'),
                h('span', { className: "px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-medium" }, '.XLSX'),
                h('span', { className: "px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-medium" }, '.XLS')),
              h('button', {
                type: "button",
                onClick: () => fileInputRef.current?.click(),
                className: "mt-4 px-6 py-3 bg-jaguar-900 text-cream-50 rounded-xl hover:bg-jaguar-800 transition-colors font-medium"
              }, 'Browse Files'))),
          file && h('button', {
            onClick: () => setStep(1),
            className: "w-full px-6 py-3 bg-white border-2 border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition-all font-medium"
          }, '← Back')),

        // Step 3: Column Mapping
        step === 3 && parsedData && h('div', { className: "space-y-5" },
          h('div', { className: "bg-blue-50 border border-blue-200 rounded-xl p-4" },
            h('p', { className: "text-sm text-blue-800 font-medium" },
              `📊 ${parsedData.allData.length - 1} contacts detected. Map columns below:`)),

          h('div', { className: "overflow-x-auto" },
            h('table', { className: "w-full border-collapse" },
              h('thead', null,
                h('tr', { className: "border-b-2 border-stone-200" },
                  h('th', { className: "text-left py-3 px-4 text-sm font-semibold text-stone-700" }, 'Column'),
                  h('th', { className: "text-left py-3 px-4 text-sm font-semibold text-stone-700" }, 'Sample Data'),
                  h('th', { className: "text-left py-3 px-4 text-sm font-semibold text-stone-700 w-48" }, 'Map To Field'))),
              h('tbody', null,
                ...parsedData.headers.map((header, idx) =>
                  h('tr', { key: idx, className: "border-b border-stone-100 hover:bg-stone-50" },
                    h('td', { className: "py-3 px-4 font-medium text-stone-900" }, header || `Column ${idx + 1}`),
                    h('td', { className: "py-3 px-4 text-sm text-stone-600" },
                      parsedData.rows[0]?.[idx] ? String(parsedData.rows[0][idx]).substring(0, 30) + (String(parsedData.rows[0][idx]).length > 30 ? '...' : '') : '—'),
                    h('td', { className: "py-3 px-4" },
                      h('select', {
                        value: columnMapping[idx] || '',
                        onChange: e => setColumnMapping({ ...columnMapping, [idx]: e.target.value }),
                        className: "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-jaguar-900/20 focus:border-jaguar-900"
                      },
                        h('option', { value: '' }, 'Skip'),
                        h('option', { value: 'email' }, '📧 Email'),
                        h('option', { value: 'first_name' }, '👤 First Name'),
                        h('option', { value: 'last_name' }, '👤 Last Name'),
                        h('option', { value: 'company' }, '🏢 Company')))))))),

          h('div', { className: "flex gap-3" },
            h('button', {
              onClick: () => { setStep(2); setParsedData(null); setFile(null); },
              className: "flex-1 px-6 py-3 bg-white border-2 border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition-all font-medium"
            }, '← Back'),
            h('button', {
              onClick: handleSubmit,
              disabled: loading || !Object.values(columnMapping).includes('email'),
              className: "flex-1 px-6 py-3 bg-gradient-to-r from-jaguar-900 to-jaguar-800 text-cream-50 rounded-xl hover:from-jaguar-800 hover:to-jaguar-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            }, loading ? [Icons.Loader2({ size: 18 }), ' Importing...'] : 'Import Contacts')))
      ))
    )
  );
};
