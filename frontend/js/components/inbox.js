// Mr. Snowman - Unified Inbox Component

const Inbox = () => {
  const [accounts, setAccounts] = React.useState([]);
  const [messages, setMessages] = React.useState([]);
  const [selectedAccount, setSelectedAccount] = React.useState('all');
  const [selectedMessage, setSelectedMessage] = React.useState(null);
  const [emailContent, setEmailContent] = React.useState(null);
  const [loadingContent, setLoadingContent] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [showReplyForm, setShowReplyForm] = React.useState(false);
  const [replyBody, setReplyBody] = React.useState('');
  const [sendingReply, setSendingReply] = React.useState(false);
  const [attachments, setAttachments] = React.useState([]);
  const fileInputRef = React.useRef(null);

  React.useEffect(() => {
    loadData();
  }, [selectedAccount]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accs, msgs] = await Promise.all([
        api.getEmailAccounts(),
        api.getInbox(selectedAccount)
      ]);
      setAccounts(Array.isArray(accs) ? accs : []);
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (error) {
      console.error('Failed to load inbox:', error);
      setError(error.message || 'Failed to load inbox data');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncInbox = async () => {
    setSyncing(true);
    try {
      console.log('📥 [Inbox] Starting IMAP sync...');
      const result = await api.syncInbox(selectedAccount === 'all' ? null : selectedAccount, 50);
      console.log('✅ [Inbox] Sync complete:', result);
      // Reload inbox data after sync
      await loadData();
    } catch (error) {
      console.error('❌ [Inbox] Sync failed:', error);
      setError('Failed to sync inbox: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleAccountChange = (accountId) => {
    setSelectedAccount(accountId);
    setSelectedMessage(null); // Clear selected message when switching accounts
  };

  const handleSendReply = async () => {
    if (!replyBody.trim() || !selectedMessage) return;

    setSendingReply(true);
    try {
      await api.sendReply(selectedMessage.id, replyBody, attachments);
      alert('Reply sent successfully!');
      closeReplyForm();
    } catch (error) {
      console.error('Failed to send reply:', error);
      alert('Failed to send reply: ' + error.message);
    } finally {
      setSendingReply(false);
    }
  };

  const closeReplyForm = () => {
    setShowReplyForm(false);
    setReplyBody('');
    setAttachments([]);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map(file => ({
      file,
      name: file.name,
      size: file.size,
      type: file.type
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSelectMessage = async (msg) => {
    setSelectedMessage(msg);
    setEmailContent(null);
    closeReplyForm();

    // Mark as read if it's unread
    if (!msg.is_read) {
      try {
        await api.markInboxAsRead(msg.id, true);
        // Update local state
        setMessages(messages.map(m =>
          m.id === msg.id ? { ...m, is_read: true } : m
        ));
      } catch (error) {
        console.error('Failed to mark message as read:', error);
      }
    }

    // Fetch full email content on-demand
    setLoadingContent(true);
    try {
      const content = await api.getEmailContent(msg.id);
      setEmailContent(content);
    } catch (error) {
      console.error('Failed to load email content:', error);
      // Use snippet as fallback
      setEmailContent({
        body_text: msg.snippet || 'Failed to load email content',
        body_html: null
      });
    } finally {
      setLoadingContent(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Today - show time
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatFullDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitial = (name, email) => {
    if (name && name.length > 0) {
      return name[0].toUpperCase();
    }
    if (email && email.length > 0) {
      return email[0].toUpperCase();
    }
    return '?';
  };

  // Loading state
  if (loading && messages.length === 0) {
    return h('div', { className: "flex items-center justify-center h-96 animate-fade-in" },
      h('div', { className: "text-center" },
        h(Icons.Loader2, { size: 48, className: "text-jaguar-900 animate-spin mx-auto mb-4" }),
        h('p', { className: "text-stone-500" }, 'Loading inbox...')
      )
    );
  }

  // Error state
  if (error) {
    return h('div', { className: "flex flex-col items-center justify-center h-96 animate-fade-in" },
      h(Icons.AlertCircle, { size: 64, className: "text-red-300 mb-4" }),
      h('h3', { className: "font-serif text-2xl text-jaguar-900 mb-2" }, 'Failed to Load Inbox'),
      h('p', { className: "text-stone-500 mb-4" }, error),
      h('button', {
        onClick: loadData,
        className: "px-4 py-2 bg-jaguar-900 text-white rounded-lg hover:bg-jaguar-800 transition-colors"
      }, 'Retry')
    );
  }

  return h(React.Fragment, null,
    h('div', { className: "h-[calc(100vh-120px)] flex flex-col animate-fade-in" },
      // Header
    h('div', { className: "flex justify-between items-center mb-6 pb-6 border-b border-stone-200" },
      h('div', null,
        h('h1', { className: "font-serif text-3xl text-jaguar-900" }, "Unified Inbox"),
        h('p', { className: "text-stone-500 mt-1" },
          messages.length === 0
            ? "No messages yet"
            : `${messages.length} recent message${messages.length !== 1 ? 's' : ''} (max 500 per account, 30-day retention)`
        )
      ),
      h('div', { className: "flex gap-3" },
        h('select', {
          className: "px-4 py-2 border border-stone-200 rounded-lg bg-white min-w-[200px] focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-all",
          value: selectedAccount,
          onChange: (e) => handleAccountChange(e.target.value)
        },
          h('option', { value: "all" }, "All Inboxes"),
          accounts.map(acc =>
            h('option', { key: acc.id, value: acc.id }, acc.email_address)
          )
        ),
        h('button', {
          onClick: handleSyncInbox,
          disabled: syncing || loading,
          className: "px-4 py-2 bg-jaguar-900 text-white rounded-lg hover:bg-jaguar-800 transition-colors disabled:opacity-50 flex items-center gap-2",
          title: "Sync from mail server"
        },
          h(Icons.Download, { size: 16, className: syncing ? "animate-bounce" : "" }),
          h('span', null, syncing ? 'Syncing...' : 'Sync Inbox')
        ),
        h('button', {
          onClick: loadData,
          disabled: loading,
          className: "p-2 border border-stone-200 rounded-lg hover:bg-stone-50 text-stone-600 transition-colors disabled:opacity-50",
          title: "Refresh inbox"
        }, h(Icons.RefreshCw, { size: 20, className: loading ? "animate-spin" : "" }))
      )
    ),

    // Content Layout
    h('div', { className: "flex gap-6 flex-1 overflow-hidden" },

      // Message List (Left Sidebar)
      h('div', { className: "w-1/3 bg-white border border-stone-200 rounded-lg overflow-hidden flex flex-col shadow-sm" },
        messages.length === 0 && !loading
          ? h('div', { className: "flex-1 flex flex-col items-center justify-center text-stone-400 p-8 text-center" },
              h(Icons.Inbox, { size: 48, className: "mb-4 opacity-20" }),
              h('p', { className: "font-medium text-lg mb-1" }, "No messages found"),
              h('p', { className: "text-sm" },
                selectedAccount === 'all'
                  ? "Emails will appear here once you receive them"
                  : "No emails in this inbox yet"
              )
            )
          : h('div', { className: "overflow-y-auto custom-scrollbar flex-1" },
              messages.map(msg =>
                h('div', {
                  key: msg.id,
                  onClick: () => handleSelectMessage(msg),
                  className: `p-4 border-b border-stone-100 cursor-pointer transition-all ${
                    selectedMessage?.id === msg.id
                      ? 'bg-cream-100 border-l-4 border-l-gold-600'
                      : msg.is_read
                        ? 'hover:bg-cream-50'
                        : 'bg-blue-50/30 hover:bg-blue-50/50'
                  }`
                },
                  h('div', { className: "flex justify-between items-start mb-1" },
                    h('span', {
                      className: `truncate pr-2 ${msg.is_read ? 'text-stone-700' : 'font-semibold text-jaguar-900'}`
                    }, msg.from_name || msg.from_address),
                    h('span', { className: "text-xs text-stone-400 whitespace-nowrap" }, formatDate(msg.received_at))
                  ),
                  h('h4', {
                    className: `text-sm truncate mb-1 ${msg.is_read ? 'text-stone-600 font-normal' : 'text-stone-800 font-medium'}`
                  }, msg.subject || '(No Subject)'),
                  h('p', { className: "text-xs text-stone-500 line-clamp-2" }, msg.snippet || ''),
                  selectedAccount === 'all' && msg.email_accounts && h('div', { className: "mt-2" },
                    h('span', { className: "text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full" },
                      msg.email_accounts.email_address || 'Unknown Account'
                    )
                  )
                )
              )
            )
      ),

      // Message Detail (Right Content)
      h('div', { className: "flex-1 bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden flex flex-col" },
        selectedMessage
          ? h('div', { className: "flex flex-col h-full" },
              // Message Header
              h('div', { className: "p-6 border-b border-stone-100 bg-cream-50" },
                h('h2', { className: "font-serif text-2xl text-jaguar-900 mb-4" }, selectedMessage.subject || '(No Subject)'),
                h('div', { className: "flex justify-between items-start" },
                  h('div', { className: "flex gap-3" },
                    h('div', { className: "w-10 h-10 rounded-full bg-jaguar-100 flex items-center justify-center text-jaguar-900 font-bold" },
                      getInitial(selectedMessage.from_name, selectedMessage.from_address)
                    ),
                    h('div', null,
                      h('p', { className: "font-medium text-jaguar-900" }, selectedMessage.from_name || selectedMessage.from_address),
                      h('p', { className: "text-sm text-stone-500" }, `<${selectedMessage.from_address}>`)
                    )
                  ),
                  h('div', { className: "text-right" },
                    h('p', { className: "text-sm text-stone-500" }, formatFullDate(selectedMessage.received_at)),
                    selectedMessage.email_accounts && h('p', { className: "text-xs text-stone-400 mt-1" },
                      `To: ${selectedMessage.email_accounts.email_address}`
                    )
                  )
                )
              ),
              // Message Body
              h('div', { className: "flex-1 p-8 overflow-y-auto" },
                loadingContent
                  ? h('div', { className: "flex flex-col items-center justify-center h-full text-stone-400" },
                      h(Icons.Loader2, { size: 32, className: "animate-spin mb-3" }),
                      h('p', { className: "text-sm" }, "Loading email content...")
                    )
                  : emailContent
                    ? h('div', {
                        className: "prose max-w-none text-stone-800",
                        dangerouslySetInnerHTML: {
                          __html: emailContent.body_html || (emailContent.body_text?.replace(/\n/g, '<br/>') || '<p class="text-stone-400 italic">No content available</p>')
                        }
                      })
                    : h('div', { className: "text-stone-400 italic" }, "Loading...")
              ),
              // Message Actions (Footer)
              h('div', { className: "p-4 border-t border-stone-100 bg-stone-50 flex gap-2" },
                h('button', {
                  className: "px-4 py-2 bg-jaguar-900 text-white rounded-lg hover:bg-jaguar-800 transition-colors flex items-center gap-2",
                  onClick: () => setShowReplyForm(true)
                },
                  h(Icons.Reply, { size: 16 }),
                  h('span', null, 'Reply')
                ),
                h('button', {
                  className: "px-4 py-2 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-100 transition-colors",
                  onClick: () => {
                    // Copy email to clipboard for forwarding
                    const text = `Subject: Fwd: ${selectedMessage.subject}\n\n--- Forwarded Message ---\nFrom: ${selectedMessage.from_name || selectedMessage.from_address} <${selectedMessage.from_address}>\nDate: ${formatFullDate(selectedMessage.received_at)}\n\n${emailContent?.body_text || selectedMessage.snippet}`;
                    navigator.clipboard.writeText(text);
                    alert('Email content copied to clipboard for forwarding');
                  }
                }, 'Copy for Forward')
              )
            )
          : h('div', { className: "h-full flex flex-col items-center justify-center text-stone-400" },
              h(Icons.Mail, { size: 48, className: "opacity-20 mb-4" }),
              h('p', { className: "text-lg font-medium" }, "Select an email to read"),
              h('p', { className: "text-sm mt-1" }, "Choose a message from the list to view its content")
            )
        )
      )
    ),

    // Reply Composer Modal
    showReplyForm && selectedMessage && h('div', {
      className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50",
      onClick: (e) => {
        if (e.target === e.currentTarget && !sendingReply) closeReplyForm();
      }
    },
      h('div', {
        className: "bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4",
        onClick: (e) => e.stopPropagation()
      },
        // Modal Header
        h('div', { className: "p-6 border-b border-stone-200 bg-cream-50 rounded-t-xl" },
          h('div', { className: "flex justify-between items-start" },
            h('div', null,
              h('h3', { className: "font-serif text-xl text-jaguar-900 mb-1" }, "Reply to Email"),
              h('p', { className: "text-sm text-stone-600" },
                `To: ${selectedMessage.from_name || selectedMessage.from_address} <${selectedMessage.from_address}>`
              ),
              h('p', { className: "text-xs text-stone-400 mt-1" },
                `Re: ${selectedMessage.subject || '(No Subject)'}`
              )
            ),
            h('button', {
              className: "p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors",
              onClick: closeReplyForm,
              disabled: sendingReply
            }, h(Icons.X, { size: 20 }))
          )
        ),

        // Compose Area
        h('div', { className: "flex-1 p-6 overflow-y-auto" },
          h('textarea', {
            className: "w-full h-64 p-4 border border-stone-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent text-stone-800",
            placeholder: "Write your reply here...",
            value: replyBody,
            onChange: (e) => setReplyBody(e.target.value),
            disabled: sendingReply,
            autoFocus: true
          }),

          // Attachments Section
          h('div', { className: "mt-4" },
            // Hidden file input
            h('input', {
              type: "file",
              ref: fileInputRef,
              onChange: handleFileSelect,
              multiple: true,
              className: "hidden"
            }),

            // Attachment list
            attachments.length > 0 && h('div', { className: "mb-4" },
              h('p', { className: "text-sm font-medium text-stone-700 mb-2" }, `Attachments (${attachments.length})`),
              h('div', { className: "space-y-2" },
                attachments.map((att, index) =>
                  h('div', {
                    key: index,
                    className: "flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-200"
                  },
                    h('div', { className: "flex items-center gap-3" },
                      h(Icons.File, { size: 18, className: "text-stone-400" }),
                      h('div', null,
                        h('p', { className: "text-sm font-medium text-stone-700 truncate max-w-xs" }, att.name),
                        h('p', { className: "text-xs text-stone-400" }, formatFileSize(att.size))
                      )
                    ),
                    h('button', {
                      className: "p-1 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors",
                      onClick: () => removeAttachment(index),
                      disabled: sendingReply
                    }, h(Icons.X, { size: 16 }))
                  )
                )
              )
            ),

            // Add attachment button
            h('button', {
              className: "flex items-center gap-2 px-4 py-2 text-stone-600 hover:text-jaguar-900 hover:bg-stone-100 rounded-lg transition-colors border border-dashed border-stone-300",
              onClick: () => fileInputRef.current?.click(),
              disabled: sendingReply
            },
              h(Icons.Paperclip, { size: 18 }),
              h('span', { className: "text-sm" }, "Add Attachment")
            )
          )
        ),

        // Modal Footer
        h('div', { className: "p-6 border-t border-stone-200 bg-stone-50 rounded-b-xl flex justify-between items-center" },
          h('p', { className: "text-xs text-stone-400" },
            attachments.length > 0 ? `${attachments.length} file${attachments.length > 1 ? 's' : ''} attached` : "No attachments"
          ),
          h('div', { className: "flex gap-3" },
            h('button', {
              className: "px-5 py-2.5 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-100 transition-colors font-medium",
              onClick: closeReplyForm,
              disabled: sendingReply
            }, 'Cancel'),
            h('button', {
              className: "px-6 py-2.5 bg-jaguar-900 text-white rounded-lg hover:bg-jaguar-800 transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed",
              onClick: handleSendReply,
              disabled: sendingReply || !replyBody.trim()
            },
              sendingReply ? h(Icons.Loader2, { size: 18, className: "animate-spin" }) : h(Icons.Send, { size: 18 }),
              h('span', null, sendingReply ? 'Sending...' : 'Send Reply')
            )
          )
        )
      )
    )
  );
};
