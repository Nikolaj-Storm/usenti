// Usenti - Unified Inbox Component

const Inbox = ({ onUnansweredCountChange }) => {
  const [accounts, setAccounts] = React.useState([]);
  const [messages, setMessages] = React.useState([]);
  const [selectedAccount, setSelectedAccount] = React.useState('all');
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [filterCampaign, setFilterCampaign] = React.useState('all');
  const [sortOrder, setSortOrder] = React.useState('newest');
  const [campaigns, setCampaigns] = React.useState([]);
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
  const [deleting, setDeleting] = React.useState(null);
  const [messageToDelete, setMessageToDelete] = React.useState(null);
  const fileInputRef = React.useRef(null);

  React.useEffect(() => {
    loadData();
  }, [selectedAccount, filterStatus, filterCampaign, sortOrder]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accs, msgs, camps] = await Promise.all([
        api.getEmailAccounts(),
        api.getInbox(selectedAccount, 50, 0, filterStatus, filterCampaign, sortOrder),
        campaigns.length === 0 ? api.getCampaigns() : Promise.resolve(campaigns)
      ]);
      setAccounts(Array.isArray(accs) ? accs : []);
      setMessages(Array.isArray(msgs) ? msgs : []);
      if (camps && camps !== campaigns) {
        setCampaigns(Array.isArray(camps) ? camps : []);
      }
    } catch (error) {
      console.error('Failed to load inbox:', error);
      setError(error.message || 'Failed to load inbox data');
    } finally {
      setLoading(false);
    }
  };

  const [syncWarning, setSyncWarning] = React.useState(null);

  const handleSyncInbox = async () => {
    setSyncing(true);
    setSyncWarning(null);
    try {
      console.log('📥 [Inbox] Starting IMAP sync...');
      const result = await api.syncInbox(selectedAccount === 'all' ? null : selectedAccount, 50);
      console.log('✅ [Inbox] Sync complete:', result);

      // Check for per-account errors in the sync result
      if (result && result.accounts) {
        const failedAccounts = result.accounts.filter(a => a.status === 'error');
        if (failedAccounts.length > 0) {
          const errorMessages = failedAccounts.map(a => `${a.email}: ${a.error}`).join('\n');
          console.warn('⚠️ [Inbox] Some accounts failed to sync:', errorMessages);
          setSyncWarning(failedAccounts.map(a => `${a.email}: ${a.error}`));
        }
      }

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
      // Mark the message as answered in local state
      setMessages(prev => prev.map(m =>
        m.id === selectedMessage.id ? { ...m, is_answered: true } : m
      ));
      setSelectedMessage(prev => prev ? { ...prev, is_answered: true } : prev);
      if (onUnansweredCountChange) onUnansweredCountChange();
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

  const handleDeleteMessage = (msgId, e) => {
    if (e) e.stopPropagation();
    setMessageToDelete(msgId);
  };

  const confirmDeleteMessage = async () => {
    if (!messageToDelete) return;
    const msgId = messageToDelete;

    setDeleting(msgId);
    setMessageToDelete(null); // Close modal
    try {
      await api.deleteInboxMessage(msgId);
      setMessages(prev => prev.filter(m => m.id !== msgId));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(null);
        setEmailContent(null);
      }
      if (onUnansweredCountChange) onUnansweredCountChange();
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message: ' + error.message);
    } finally {
      setDeleting(null);
    }
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
        h(Icons.Loader2, { size: 48, className: "text-cream-100 animate-spin mx-auto mb-4" }),
        h('p', { className: "text-white/60" }, 'Loading inbox...')
      )
    );
  }

  // Error state
  if (error) {
    return h('div', { className: "flex flex-col items-center justify-center h-96 animate-fade-in" },
      h(Icons.AlertCircle, { size: 64, className: "text-red-400/60 mb-4" }),
      h('h3', { className: "font-serif text-2xl text-white mb-2" }, 'Failed to Load Inbox'),
      h('p', { className: "text-white/60 mb-4" }, error),
      h('button', {
        onClick: loadData,
        className: "px-4 py-3 bg-cream-100 text-rust-900 rounded-full hover:bg-cream-200 transition-colors font-medium"
      }, 'Retry')
    );
  }

  return h(React.Fragment, null,
    h('div', { className: "h-[calc(100vh-120px)] flex flex-col animate-fade-in" },
      // Header and Controls
      // Header and Controls
      h('div', { className: "mb-6 pb-4 border-b border-white/10 flex flex-col gap-4" },
        // Title Area
        h('div', null,
          h('h1', { className: "font-serif text-3xl text-white" }, "Unified Inbox")
        ),
        // Controls Area (Filters & Sync)
        h('div', { className: "flex flex-wrap gap-2 items-center" },
          // Status Filter
          h('div', { className: "relative group" },
            h(Icons.Check, { size: 12, className: "absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none group-focus-within:text-cream-100 transition-colors z-10" }),
            h('select', {
              className: "h-8 pl-7 pr-8 py-0 text-xs bg-white/5 border border-white/10 text-white/80 rounded-md focus:outline-none focus:border-cream-100/50 focus:bg-white/10 transition-all appearance-none cursor-pointer w-full text-ellipsis line-clamp-1",
              style: { backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22rgba(255,255,255,0.4)%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem top 50%', backgroundSize: '0.5rem auto' },
              value: filterStatus,
              onChange: (e) => setFilterStatus(e.target.value)
            },
              h('option', { value: "all", className: "bg-gray-900" }, "All Status"),
              h('option', { value: "answered", className: "bg-gray-900" }, "Answered"),
              h('option', { value: "unanswered", className: "bg-gray-900" }, "Unanswered")
            )
          ),

          // Campaign Filter
          h('div', { className: "relative group" },
            h(Icons.Target, { size: 12, className: "absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none group-focus-within:text-cream-100 transition-colors z-10" }),
            h('select', {
              className: "h-8 pl-7 pr-8 py-0 text-xs bg-white/5 border border-white/10 text-white/80 rounded-md focus:outline-none focus:border-cream-100/50 focus:bg-white/10 transition-all appearance-none cursor-pointer max-w-[140px] text-ellipsis line-clamp-1",
              style: { backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22rgba(255,255,255,0.4)%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem top 50%', backgroundSize: '0.5rem auto' },
              value: filterCampaign,
              onChange: (e) => setFilterCampaign(e.target.value)
            },
              h('option', { value: "all", className: "bg-gray-900" }, "All Campaigns"),
              campaigns.map(camp =>
                h('option', { key: camp.id, value: camp.id, className: "bg-gray-900" }, camp.name)
              )
            )
          ),

          // Inbox Filter
          h('div', { className: "relative group" },
            h(Icons.Mail, { size: 12, className: "absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none group-focus-within:text-cream-100 transition-colors z-10" }),
            h('select', {
              className: "h-8 pl-7 pr-8 py-0 text-xs bg-white/5 border border-white/10 text-white/80 rounded-md focus:outline-none focus:border-cream-100/50 focus:bg-white/10 transition-all appearance-none cursor-pointer max-w-[160px] text-ellipsis line-clamp-1",
              style: { backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22rgba(255,255,255,0.4)%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem top 50%', backgroundSize: '0.5rem auto' },
              value: selectedAccount,
              onChange: (e) => handleAccountChange(e.target.value)
            },
              h('option', { value: "all", className: "bg-gray-900" }, "All Inboxes"),
              accounts.map(acc =>
                h('option', { key: acc.id, value: acc.id, className: "bg-gray-900" }, acc.email_address)
              )
            )
          ),

          // Sorting
          h('div', { className: "relative group" },
            h(Icons.Clock, { size: 12, className: "absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none group-focus-within:text-cream-100 transition-colors z-10" }),
            h('select', {
              className: "h-8 pl-7 pr-8 py-0 text-xs bg-white/5 border border-white/10 text-white/80 rounded-md focus:outline-none focus:border-cream-100/50 focus:bg-white/10 transition-all appearance-none cursor-pointer w-full text-ellipsis line-clamp-1",
              style: { backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22rgba(255,255,255,0.4)%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem top 50%', backgroundSize: '0.5rem auto' },
              value: sortOrder,
              onChange: (e) => setSortOrder(e.target.value)
            },
              h('option', { value: "newest", className: "bg-gray-900" }, "Newest First"),
              h('option', { value: "oldest", className: "bg-gray-900" }, "Oldest First")
            )
          ),

          // Sync Button
          h('button', {
            onClick: handleSyncInbox,
            disabled: syncing || loading,
            className: "h-8 px-3 ml-1 text-xs bg-cream-100 text-rust-900 rounded-md hover:bg-cream-200 transition-all font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 min-w-[70px] shadow-sm",
            title: "Sync from mail server"
          },
            h(Icons.RefreshCw, { size: 12, className: syncing ? "animate-spin" : "" }),
            h('span', null, syncing ? 'Syncing...' : 'Sync')
          )
        )
      ),

      // Sync warning banner
      syncWarning && h('div', { className: "mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30" },
        h('div', { className: "flex justify-between items-start" },
          h('div', { className: "flex gap-3 items-start" },
            h(Icons.AlertCircle, { size: 20, className: "text-amber-400 mt-0.5 flex-shrink-0" }),
            h('div', null,
              h('p', { className: "text-amber-200 font-medium text-sm mb-1" }, "Some accounts failed to sync:"),
              syncWarning.map((msg, i) =>
                h('p', { key: i, className: "text-amber-200/80 text-sm" }, msg)
              )
            )
          ),
          h('button', {
            className: "text-amber-400/60 hover:text-amber-400 transition-colors p-1",
            onClick: () => setSyncWarning(null)
          }, h(Icons.X, { size: 16 }))
        )
      ),

      // Content Layout
      h('div', { className: "flex gap-6 flex-1 overflow-hidden" },

        // Message List (Left Sidebar)
        h('div', { className: "w-1/3 glass-card overflow-hidden flex flex-col" },
          messages.length === 0 && !loading
            ? h('div', { className: "flex-1 flex flex-col items-center justify-center text-white/40 p-8 text-center" },
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
                  className: `p-4 border-b border-white/5 cursor-pointer transition-all relative group/msg ${selectedMessage?.id === msg.id
                    ? 'bg-cream-100/20 border-l-4 border-l-cream-100'
                    : msg.is_read
                      ? 'hover:bg-white/5'
                      : 'bg-white/5 hover:bg-white/10'
                    }`
                },
                  h('div', { className: "flex justify-between items-start mb-1" },
                    h('span', {
                      className: `truncate pr-2 ${msg.is_read ? 'text-white/70' : 'font-semibold text-white'}`
                    }, msg.from_name || msg.from_address),
                    h('div', { className: "flex items-center gap-2 flex-shrink-0" },
                      h('span', { className: "text-xs text-white/40 whitespace-nowrap" }, formatDate(msg.received_at)),
                      // Delete button (visible on hover)
                      h('button', {
                        className: "opacity-0 group-hover/msg:opacity-100 p-1 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded transition-all",
                        onClick: (e) => handleDeleteMessage(msg.id, e),
                        disabled: deleting === msg.id,
                        title: "Delete message"
                      }, deleting === msg.id
                        ? h(Icons.Loader2, { size: 14, className: "animate-spin" })
                        : h(Icons.Trash2, { size: 14 })
                      )
                    )
                  ),
                  h('h4', {
                    className: `text-sm truncate mb-1 ${msg.is_read ? 'text-white/60 font-normal' : 'text-white/90 font-medium'}`
                  }, msg.subject || '(No Subject)'),
                  h('p', { className: "text-xs text-white/50 line-clamp-2" }, msg.snippet || ''),
                  // Labels row: account, answered status, campaigns
                  h('div', { className: "mt-2 flex flex-wrap items-center gap-1.5" },
                    // Account label (when showing all inboxes)
                    selectedAccount === 'all' && msg.email_accounts && h('span', {
                      className: "text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full"
                    }, msg.email_accounts.email_address || 'Unknown Account'),
                    // Answered/Unanswered label
                    msg.is_answered
                      ? h('span', { className: "text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30" }, 'Answered')
                      : h('span', { className: "text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full border border-red-500/30" }, 'Unanswered'),
                    // Campaign labels
                    msg.campaign_names && msg.campaign_names.length > 0 && msg.campaign_names.map((name, i) =>
                      h('span', {
                        key: `camp-${i}`,
                        className: "text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30"
                      }, name)
                    )
                  )
                )
              )
            )
        ),

        // Message Detail (Right Content)
        h('div', { className: "flex-1 glass-card overflow-hidden flex flex-col" },
          selectedMessage
            ? h('div', { className: "flex flex-col h-full" },
              // Message Header
              h('div', { className: "p-6 border-b border-white/10 bg-white/5" },
                h('h2', { className: "font-serif text-2xl text-white mb-4" }, selectedMessage.subject || '(No Subject)'),
                h('div', { className: "flex justify-between items-start" },
                  h('div', { className: "flex gap-3" },
                    h('div', { className: "w-10 h-10 rounded-full bg-cream-100 flex items-center justify-center text-rust-900 font-bold" },
                      getInitial(selectedMessage.from_name, selectedMessage.from_address)
                    ),
                    h('div', null,
                      h('p', { className: "font-medium text-white" }, selectedMessage.from_name || selectedMessage.from_address),
                      h('p', { className: "text-sm text-white/60" }, `<${selectedMessage.from_address}>`)
                    )
                  ),
                  h('div', { className: "text-right" },
                    h('p', { className: "text-sm text-white/60" }, formatFullDate(selectedMessage.received_at)),
                    selectedMessage.email_accounts && h('p', { className: "text-xs text-white/40 mt-1" },
                      `To: ${selectedMessage.email_accounts.email_address}`
                    )
                  )
                )
              ),
              // Message Body
              h('div', { className: "flex-1 p-8 overflow-y-auto bg-white/5" },
                loadingContent
                  ? h('div', { className: "flex flex-col items-center justify-center h-full text-white/40" },
                    h(Icons.Loader2, { size: 32, className: "animate-spin mb-3" }),
                    h('p', { className: "text-sm" }, "Loading email content...")
                  )
                  : emailContent
                    ? h(React.Fragment, null,
                      // Email body content
                      h('div', {
                        className: "prose prose-invert max-w-none text-white/90",
                        dangerouslySetInnerHTML: {
                          __html: emailContent.body_html || (emailContent.body_text?.replace(/\n/g, '<br/>') || '<p class="text-white/40 italic">No content available</p>')
                        }
                      }),
                      // Attachments section (if any)
                      emailContent.attachments && emailContent.attachments.length > 0 && h('div', { className: "mt-6 pt-6 border-t border-white/10" },
                        h('p', { className: "text-sm font-medium text-white/70 mb-3 flex items-center gap-2" },
                          h(Icons.Paperclip, { size: 16 }),
                          `${emailContent.attachments.length} attachment${emailContent.attachments.length !== 1 ? 's' : ''}`
                        ),
                        h('div', { className: "space-y-2" },
                          emailContent.attachments.map((att, index) =>
                            h('div', {
                              key: index,
                              className: "flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                            },
                              h('div', { className: "flex items-center gap-3 min-w-0" },
                                h(Icons.File, { size: 18, className: "text-cream-100 flex-shrink-0" }),
                                h('div', { className: "min-w-0" },
                                  h('p', { className: "text-sm font-medium text-white truncate" }, att.filename || 'Unnamed file'),
                                  h('p', { className: "text-xs text-white/40" },
                                    `${att.contentType || 'Unknown type'}${att.size ? ' · ' + formatFileSize(att.size) : ''}`
                                  )
                                )
                              ),
                              h('button', {
                                className: "ml-3 px-3 py-1.5 text-sm bg-cream-100 text-rust-900 rounded-full hover:bg-cream-200 transition-colors flex items-center gap-1.5 flex-shrink-0 font-medium",
                                onClick: async () => {
                                  try {
                                    await api.downloadAttachment(selectedMessage.id, index, att.filename);
                                  } catch (err) {
                                    console.error('Failed to download attachment:', err);
                                    alert('Failed to download attachment: ' + err.message);
                                  }
                                }
                              },
                                h(Icons.Download, { size: 14 }),
                                'Download'
                              )
                            )
                          )
                        )
                      )
                    )
                    : h('div', { className: "text-white/40 italic" }, "Loading...")
              ),
              // Message Actions (Footer)
              h('div', { className: "p-4 border-t border-white/10 bg-white/5 flex gap-2" },
                h('button', {
                  className: "px-4 py-2 bg-cream-100 text-rust-900 rounded-full hover:bg-cream-200 transition-colors flex items-center gap-2 font-medium",
                  onClick: () => setShowReplyForm(true)
                },
                  h(Icons.Reply, { size: 16 }),
                  h('span', null, 'Reply')
                ),
                h('button', {
                  className: "px-4 py-2 glass-card text-white hover:bg-white/15 rounded-full transition-colors",
                  onClick: () => {
                    // Copy email to clipboard for forwarding
                    const text = `Subject: Fwd: ${selectedMessage.subject}\n\n--- Forwarded Message ---\nFrom: ${selectedMessage.from_name || selectedMessage.from_address} <${selectedMessage.from_address}>\nDate: ${formatFullDate(selectedMessage.received_at)}\n\n${emailContent?.body_text || selectedMessage.snippet}`;
                    navigator.clipboard.writeText(text);
                    alert('Email content copied to clipboard for forwarding');
                  }
                }, 'Copy for Forward'),
                h('div', { className: "flex-1" }),
                h('button', {
                  className: "px-4 py-2 text-red-400 hover:bg-red-400/10 rounded-full transition-colors flex items-center gap-2",
                  onClick: () => handleDeleteMessage(selectedMessage.id),
                  disabled: deleting === selectedMessage.id
                },
                  deleting === selectedMessage.id
                    ? h(Icons.Loader2, { size: 16, className: "animate-spin" })
                    : h(Icons.Trash2, { size: 16 }),
                  h('span', null, 'Delete')
                )
              )
            )
            : h('div', { className: "h-full flex flex-col items-center justify-center text-white/40" },
              h(Icons.Mail, { size: 48, className: "opacity-20 mb-4" }),
              h('p', { className: "text-lg font-medium" }, "Select an email to read"),
              h('p', { className: "text-sm mt-1" }, "Choose a message from the list to view its content")
            )
        )
      )
    ),

    // Reply Composer Modal
    showReplyForm && selectedMessage && h('div', {
      className: "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50",
      onClick: (e) => {
        if (e.target === e.currentTarget && !sendingReply) closeReplyForm();
      }
    },
      h('div', {
        className: "glass-modal w-full max-w-3xl max-h-[90vh] flex flex-col mx-4",
        onClick: (e) => e.stopPropagation()
      },
        // Modal Header
        h('div', { className: "p-6 border-b border-white/10" },
          h('div', { className: "flex justify-between items-start" },
            h('div', null,
              h('h3', { className: "font-serif text-xl text-white mb-1" }, "Reply to Email"),
              h('p', { className: "text-sm text-white/70" },
                `To: ${selectedMessage.from_name || selectedMessage.from_address} <${selectedMessage.from_address}>`
              ),
              h('p', { className: "text-xs text-white/50 mt-1" },
                `Re: ${selectedMessage.subject || '(No Subject)'}`
              )
            ),
            h('button', {
              className: "p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors",
              onClick: closeReplyForm,
              disabled: sendingReply
            }, h(Icons.X, { size: 20 }))
          )
        ),

        // Compose Area
        h('div', { className: "flex-1 p-6 overflow-y-auto" },
          h('textarea', {
            className: "w-full h-64 p-4 glass-input rounded-xl resize-none transition-all",
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
              h('p', { className: "text-sm font-medium text-white/70 mb-2" }, `Attachments (${attachments.length})`),
              h('div', { className: "space-y-2" },
                attachments.map((att, index) =>
                  h('div', {
                    key: index,
                    className: "flex items-center justify-between p-3 glass-card"
                  },
                    h('div', { className: "flex items-center gap-3" },
                      h(Icons.File, { size: 18, className: "text-white/40" }),
                      h('div', null,
                        h('p', { className: "text-sm font-medium text-white truncate max-w-xs" }, att.name),
                        h('p', { className: "text-xs text-white/40" }, formatFileSize(att.size))
                      )
                    ),
                    h('button', {
                      className: "p-1 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors",
                      onClick: () => removeAttachment(index),
                      disabled: sendingReply
                    }, h(Icons.X, { size: 16 }))
                  )
                )
              )
            ),

            // Add attachment button
            h('button', {
              className: "flex items-center gap-2 px-4 py-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors border border-dashed border-white/20",
              onClick: () => fileInputRef.current?.click(),
              disabled: sendingReply
            },
              h(Icons.Paperclip, { size: 18 }),
              h('span', { className: "text-sm" }, "Add Attachment")
            )
          )
        ),

        // Modal Footer
        h('div', { className: "p-6 border-t border-white/10 flex justify-between items-center" },
          h('p', { className: "text-xs text-white/40" },
            attachments.length > 0 ? `${attachments.length} file${attachments.length > 1 ? 's' : ''} attached` : "No attachments"
          ),
          h('div', { className: "flex gap-3" },
            h('button', {
              className: "px-5 py-2.5 glass-card text-white hover:bg-white/15 rounded-full transition-colors font-medium",
              onClick: closeReplyForm,
              disabled: sendingReply
            }, 'Cancel'),
            h('button', {
              className: "px-6 py-2.5 bg-cream-100 text-rust-900 rounded-full hover:bg-cream-200 transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed",
              onClick: handleSendReply,
              disabled: sendingReply || !replyBody.trim()
            },
              sendingReply ? h(Icons.Loader2, { size: 18, className: "animate-spin" }) : h(Icons.Send, { size: 18 }),
              h('span', null, sendingReply ? 'Sending...' : 'Send Reply')
            )
          )
        )
      )
    ),

    // Confirmation Modal for Delete
    messageToDelete && h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in' },
      h('div', { className: 'glass-panel p-8 rounded-2xl max-w-md w-full mx-4 space-y-6 shadow-2xl relative border border-white/10' },
        h('div', { className: 'flex items-center gap-4' },
          h('div', { className: 'w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center' },
            h(Icons.Trash2, { size: 24, className: 'text-red-400' })
          ),
          h('div', null,
            h('h3', { className: 'text-xl font-serif text-white' }, 'Delete Message?'),
            h('p', { className: 'text-white/60 text-sm mt-1' }, 'Are you sure you want to delete this email?')
          )
        ),
        h('div', { className: 'flex gap-3 pt-4' },
          h('button', {
            onClick: () => setMessageToDelete(null),
            className: 'flex-1 py-3 px-4 rounded-xl font-medium bg-white/10 hover:bg-white/20 text-white transition-all shadow-sm'
          }, 'Cancel'),
          h('button', {
            onClick: confirmDeleteMessage,
            className: 'flex-1 py-3 px-4 rounded-xl font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 transition-all shadow-sm',
            disabled: deleting !== null
          }, deleting === messageToDelete ? 'Deleting...' : 'Delete')
        )
      )
    )
  );
};
