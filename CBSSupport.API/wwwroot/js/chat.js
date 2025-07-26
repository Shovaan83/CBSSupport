"use strict";

document.addEventListener('DOMContentLoaded', () => {

    // --- STATE, MOCK DATA, DOM REFS (Unchanged) ---
    const supportAgentIdentity = "CBS Support";
    let currentUserIdentity = supportAgentIdentity;
    let currentChatContext = {};
    let typingTimeout = null;
    const teamMembers = [{ name: "CBS Support", initials: "S", avatarClass: "avatar-bg-green" }, { name: "Admin User", initials: "A", avatarClass: "avatar-bg-purple" }];
    const customerList = [{ name: "Alzeena Limbu", initials: "A", avatarClass: "avatar-bg-purple" }, { name: "Soniya Basnet", initials: "S", avatarClass: "avatar-bg-red" }, { name: "Ram Shah", initials: "R", avatarClass: "avatar-bg-blue" }, { name: "Namsang Limbu", initials: "N", avatarClass: "avatar-bg-red" }];
    const inquiryList = [{ id: "#INQ-345", topic: "Pricing for Enterprise Plan", inquiredBy: "Ram Shah", date: "2024-09-05 10:42 AM", outcome: "Info Sent" }, { id: "#INQ-340", topic: "API Access Question", inquiredBy: "Admin User", date: "2024-08-22 03:15 PM", outcome: "Info Sent" }];
    const roleSwitcher = document.getElementById("role-switcher"),
        conversationListContainer = document.getElementById("conversation-list-container"),
        messageInput = document.getElementById("message-input"),
        sendButton = document.getElementById("send-button"),
        chatPanelBody = document.getElementById("chat-panel-body"),
        chatHeader = document.getElementById("chat-header"),
        typingIndicator = document.getElementById("typing-indicator"),
        attachmentButton = document.getElementById("attachment-button"),
        fileInput = document.getElementById("file-input");

    const connection = new signalR.HubConnectionBuilder().withUrl("/chathub").withAutomaticReconnect().build();

    // --- HELPER, FILE UPLOAD, HISTORY, OBSERVER, UI RENDERING functions (Unchanged) ---
    const formatTimestamp = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formatDateForSeparator = (dStr) => { const d = new Date(dStr); const t = new Date(); const y = new Date(t); y.setDate(y.getDate() - 1); if (d.toDateString() === t.toDateString()) return 'Today'; if (d.toDateString() === y.toDateString()) return 'Yesterday'; return d.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }); };
    const getUserRole = (userName) => teamMembers.some(m => m.name === userName) ? "Team Member" : "Customer";
    const updateSendButtonState = () => sendButton.disabled = connection.state !== "Connected" || (messageInput.value.trim() === "" && !fileInput.files.length);
    const scrollToBottom = () => chatPanelBody.scrollTop = chatPanelBody.scrollHeight;
    const generateGroupName = (u1, u2) => [u1, u2].sort().join('_');
    const getAvatarDetails = (userName) => teamMembers.find(u => u.name === userName) || customerList.find(u => u.name === userName) || { initials: userName.substring(0, 1).toUpperCase(), avatarClass: "avatar-bg-blue" };
    async function uploadFile(file) {
        const maxFileSize = 10 * 1024 * 1024;
        if (file.size > maxFileSize) { alert(`Error: File size cannot exceed ${maxFileSize / 1024 / 1024} MB.`); return; }
        const formData = new FormData();
        formData.append('file', file);
        try {
            messageInput.placeholder = "Uploading file...";
            attachmentButton.disabled = true;
            sendButton.disabled = true;
            const response = await fetch('/api/FileUpload/UploadFile', { method: 'POST', body: formData });
            if (!response.ok) { const errorText = await response.text(); throw new Error(errorText || 'File upload failed.'); }
            const result = await response.json();
            // MODIFICATION: Pass file data to sendMessage logic instead of invoking directly.
            const textMessage = messageInput.value.trim();
            const method = currentChatContext.type === 'group' ? "SendPublicMessage" : "SendPrivateMessage";
            const args = currentChatContext.type === 'group'
                ? [currentUserIdentity, textMessage, result.url, result.name, result.type]
                : [currentChatContext.id, currentUserIdentity, textMessage, result.url, result.name, result.type];
            await connection.invoke(method, ...args);
            messageInput.value = '';
        } catch (error) {
            console.error('Upload error:', error);
            alert(`Upload Error: ${error.message}`);
        } finally {
            messageInput.placeholder = "Type a message...";
            attachmentButton.disabled = false;
            fileInput.value = '';
            updateSendButtonState();
        }
    }
    const getChatHistory = (id) => JSON.parse(localStorage.getItem(id)) || [];
    function updateMessageInHistory(chatId, messageId, updateFn) {
        const history = getChatHistory(chatId);
        const messageIndex = history.findIndex(m => m.id === messageId);
        if (messageIndex > -1) { updateFn(history[messageIndex]); localStorage.setItem(chatId, JSON.stringify(history)); }
    }
    const seenObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const messageEl = entry.target;
                const messageId = parseInt(messageEl.dataset.messageId, 10);
                connection.invoke("MarkAsSeen", messageId, currentUserIdentity).catch(err => console.error("MarkAsSeen error:", err));
                seenObserver.unobserve(messageEl);
            }
        });
    }, { threshold: 0.8 });
    let lastMessageDate = null;
    function displayMessage(messageData, isHistory) {
        const messageDate = new Date(messageData.timestamp).toDateString();
        if (lastMessageDate !== messageDate) { lastMessageDate = messageDate; const ds = document.createElement('div'); ds.className = 'date-separator'; ds.textContent = formatDateForSeparator(messageData.timestamp); chatPanelBody.appendChild(ds); }
        const isSent = messageData.sender === currentUserIdentity;
        const avatar = getAvatarDetails(messageData.sender);
        const messageRow = document.createElement('div');
        messageRow.className = 'message-row ' + (isSent ? 'sent' : 'received');
        messageRow.id = `msg-${messageData.id}`;
        messageRow.dataset.messageId = messageData.id;
        messageData.seenBy = messageData.seenBy || [];
        const avatarTooltip = `${messageData.sender} - ${getUserRole(messageData.sender)}`;
        const getReceiptHtml = (msg) => { let iconClass = 'receipt-sent fas fa-check'; let tooltip = 'Sent'; if ((msg.seenBy || []).length > 0) { iconClass = 'receipt-seen fas fa-check-double'; tooltip = `Seen by: ${msg.seenBy.map(u => u.name).join(', ')}`; } return `<span class="read-receipt ${iconClass}" data-bs-toggle="tooltip" title="${tooltip}"></span>`; };
        const readReceiptHtml = isSent ? getReceiptHtml(messageData) : '';
        let messageContentHtml = '';
        if (messageData.fileUrl) {
            const isImage = (messageData.fileType || '').startsWith('image/');
            if (isImage) { messageContentHtml = `<a href="${messageData.fileUrl}" target="_blank"><img src="${messageData.fileUrl}" alt="${messageData.fileName}" class="attachment-preview-image"/></a>`; } else { messageContentHtml = `<div class="message-attachment"><i class="fas fa-file-alt attachment-icon"></i><div class="attachment-info"><span class="attachment-name">${messageData.fileName}</span><a href="${messageData.fileUrl}" target="_blank" class="attachment-link">Download</a></div></div>`; }
        }
        if (messageData.message) { messageContentHtml += `<div class="message-bubble"><p class="message-text">${messageData.message}</p></div>`; }
        messageRow.innerHTML = `<div class="avatar-initials ${avatar.avatarClass}" data-bs-toggle="tooltip" title="${avatarTooltip}">${avatar.initials}</div><div class="message-content"><div class="message-sender">${messageData.sender}</div>${messageContentHtml}<div class="message-meta"><span class="message-timestamp">${formatTimestamp(messageData.timestamp)}</span>${readReceiptHtml}</div></div>`;
        chatPanelBody.appendChild(messageRow);
        messageRow.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el, { boundary: document.body }));
        const hasSeen = messageData.seenBy.some(u => u.name === currentUserIdentity);
        if (!hasSeen && messageData.sender !== currentUserIdentity) { seenObserver.observe(messageRow); }
        if (!isHistory) scrollToBottom();
    }
    function renderSidebar(role, isAdmin) {
        conversationListContainer.innerHTML = '';
        const createChatItem = (type, id, name, subtext, iconClass) => { const avatar = getAvatarDetails(name); return `<a href="#" class="list-group-item list-group-item-action conversation-item" data-type="${type}" data-id="${id}" data-name="${name}"><div class="d-flex w-100 align-items-center"><div class="avatar-initials ${avatar.avatarClass} me-3">${avatar.initials}</div><div class="flex-grow-1"><div class="fw-bold">${name}</div><small class="text-muted">${subtext}</small></div><div class="icon ms-2"><i class="fas ${iconClass}"></i></div></div></a>`; };
        conversationListContainer.innerHTML += createChatItem('group', 'public', 'Public Group Chat', 'Group Chat', 'fa-users');
        if (isAdmin) {
            let accordionHtml = '<div class="accordion" id="sidebarAccordion">';
            if (role === supportAgentIdentity) { let customerItems = ''; customerList.forEach(user => { customerItems += createChatItem('private', generateGroupName(role, user.name), user.name, 'Private Chat', 'fa-user'); }); accordionHtml += `<div class="accordion-item"><h2 class="accordion-header" id="headingSupport"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSupport">Support</button></h2><div id="collapseSupport" class="accordion-collapse collapse"><div class="list-group list-group-flush">${customerItems}</div></div></div>`; }
            let teamItems = ''; teamMembers.filter(u => u.name !== role).forEach(user => { teamItems += createChatItem('private', generateGroupName(role, user.name), user.name, 'Private Chat', 'fa-user'); }); accordionHtml += `<div class="accordion-item"><h2 class="accordion-header" id="headingTeams"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTeams">Teams</button></h2><div id="collapseTeams" class="accordion-collapse collapse"><div class="list-group list-group-flush">${teamItems}</div></div></div>`;
            accordionHtml += '</div>';
            conversationListContainer.innerHTML += accordionHtml;
        } else {
            conversationListContainer.innerHTML += createChatItem('private', generateGroupName(role, supportAgentIdentity), supportAgentIdentity, 'Private Chat', 'fa-headset');
        }
    }
    async function switchChatContext(contextData) { currentChatContext = contextData; document.querySelectorAll('.conversation-item.active').forEach(el => el.classList.remove('active')); const activeItem = document.querySelector(`.conversation-item[data-id='${contextData.id}']`); if (activeItem) activeItem.classList.add('active'); const partnerName = contextData.name || "Public Group Chat"; const partnerAvatar = getAvatarDetails(partnerName); const chatType = contextData.type === 'group' ? 'Group Chat' : 'Private Chat'; chatHeader.innerHTML = `<div class="avatar-initials ${partnerAvatar.avatarClass}">${partnerAvatar.initials}</div><div><div class="fw-bold">${partnerName}</div><small class="text-muted">${chatType}</small></div>`; chatPanelBody.innerHTML = ''; lastMessageDate = null; getChatHistory(currentChatContext.id).forEach(msg => displayMessage(msg, true)); scrollToBottom(); if (contextData.type === 'private') { await connection.invoke("JoinPrivateChat", contextData.id); } }

    // --- CORE LOGIC ---
    // MODIFICATION: Consolidated logic for sending public and private messages.
    async function sendMessage() {
        const message = messageInput.value.trim();
        const file = fileInput.files[0];

        if (!message && !file) return;

        if (file) {
            await uploadFile(file); // uploadFile will call the correct SignalR method
        } else {
            try {
                // Determine the correct method and arguments based on chat context
                const method = currentChatContext.type === 'group' ? "SendPublicMessage" : "SendPrivateMessage";
                const args = currentChatContext.type === 'group'
                    ? [currentUserIdentity, message, null, null, null]
                    : [currentChatContext.id, currentUserIdentity, message, null, null, null];

                await connection.invoke(method, ...args);
                messageInput.value = "";
                updateSendButtonState();
            } catch (err) {
                console.error("Error sending message:", err);
            }
        }
    }

    function setViewForRole(role) { currentUserIdentity = role; renderSidebar(role, teamMembers.some(u => u.name === role)); const firstItem = conversationListContainer.querySelector('.conversation-item'); if (firstItem) { switchChatContext(firstItem.dataset); } }

    // --- INITIALIZATION ---
    roleSwitcher.innerHTML = [...teamMembers, ...customerList].map(u => `<option value="${u.name}">Role: ${u.name}</option>`).join('');
    roleSwitcher.addEventListener('change', (e) => setViewForRole(e.target.value));
    conversationListContainer.addEventListener('click', (e) => { const item = e.target.closest('.conversation-item'); if (item) { e.preventDefault(); switchChatContext(item.dataset); } });
    sendButton.addEventListener("click", sendMessage);
    messageInput.addEventListener("keyup", (e) => { updateSendButtonState(); if (e.key === "Enter") sendMessage(); });
    attachmentButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => updateSendButtonState());

    // --- SIGNALR EVENT HANDLERS ---
    connection.on("ReceivePublicMessage", (messageId, sender, msg, time, initials, fileUrl, fileName, fileType) => {
        const data = { id: messageId, sender, message: msg, timestamp: time, initials, fileUrl, fileName, fileType, seenBy: [] };
        if (sender === currentUserIdentity) { data.seenBy.push({ name: currentUserIdentity, time: time }); }
        const history = getChatHistory('public');
        history.push(data);
        localStorage.setItem('public', JSON.stringify(history));
        if (currentChatContext.id === 'public') { displayMessage(data, false); }
    });

    // MODIFICATION: New handler for private messages that mirrors the public one.
    connection.on("ReceivePrivateMessage", (messageId, groupName, sender, msg, time, initials, fileUrl, fileName, fileType) => {
        const data = { id: messageId, sender, message: msg, timestamp: time, initials, fileUrl, fileName, fileType, seenBy: [] };
        if (sender === currentUserIdentity) { data.seenBy.push({ name: currentUserIdentity, time: time }); }
        const history = getChatHistory(groupName);
        history.push(data);
        localStorage.setItem(groupName, JSON.stringify(history));
        if (currentChatContext.id === groupName) {
            displayMessage(data, false);
        }
    });

    connection.on("MessageSeen", (messageId, userName, seenTime) => {
        // This needs to check both public and private history now
        updateMessageInHistory(currentChatContext.id, messageId, (message) => { if (!message.seenBy.some(u => u.name === userName)) { message.seenBy.push({ name: userName, time: seenTime }); } });
        const messageEl = document.getElementById(`msg-${messageId}`);
        if (messageEl && messageEl.closest('#chat-panel-body')) {
            const receiptEl = messageEl.querySelector('.read-receipt');
            if (receiptEl) {
                const message = getChatHistory(currentChatContext.id).find(m => m.id === messageId);
                const tooltip = bootstrap.Tooltip.getInstance(receiptEl);
                const newTitle = `Seen by: ${message.seenBy.map(u => u.name).join(', ')}`;
                receiptEl.className = 'read-receipt receipt-seen fas fa-check-double';
                if (tooltip) { tooltip.setContent({ '.tooltip-inner': newTitle }); } else { receiptEl.setAttribute('title', newTitle); new bootstrap.Tooltip(receiptEl, { boundary: document.body }); }
            }
        }
    });

    connection.start().then(() => { console.log("SignalR Connected."); setViewForRole(supportAgentIdentity); updateSendButtonState(); }).catch(err => console.error("SignalR Connection Error: ", err));

    // --- TICKET & INQUIRY SYSTEM LOGIC (Unchanged) ---
    const supportSubjects = [{ text: "TRAINING" }, { text: "MIGRATION" }, { text: "SETUPS" }, { text: "CORRECTION" }, { text: "BUGS FIX" }, { text: "NEW FEATURES" }, { text: "FEATURE ENCHANCEMENT" }, { text: "BACKEND WORKAROUND" }];
    const subjectDropdown = $('#ticketSubject'), editSubjectDropdown = $('#edit-ticketSubject');
    subjectDropdown.append('<option value="" disabled selected>Select a subject...</option>');
    supportSubjects.forEach(s => { const o = `<option value="${s.text}">${s.text}</option>`; subjectDropdown.append(o); editSubjectDropdown.append(o); });
    $('#inquiriesDataTable').DataTable({ data: inquiryList, columns: [{ data: 'id' }, { data: 'topic' }, { data: 'inquiredBy' }, { data: 'date' }, { data: 'outcome', render: o => `<span class="badge bg-info">${o}</span>` }], pageLength: 5, lengthChange: false, searching: true, info: false, language: { search: "", searchPlaceholder: "Search inquiries...", emptyTable: "No inquiries yet — let us know how we can help!" } });
    const ticketsLocalStorageKey = 'supportTickets', supportTicketForm = document.getElementById('supportTicketForm'), editTicketForm = document.getElementById('editTicketForm'), newTicketModal = new bootstrap.Modal(document.getElementById('newSupportTicketModal')), viewTicketModal = new bootstrap.Modal(document.getElementById('viewTicketDetailsModal'));
    const getTickets = () => JSON.parse(localStorage.getItem(ticketsLocalStorageKey)) || [], getFilteredTickets = () => getTickets().filter(t => t.status && t.status !== 'Open');
    const generateStatusBadge = s => { let b = 'bg-secondary', i = 'fa-question-circle'; if (s === 'Resolved') { b = 'bg-success'; i = 'fa-check-circle'; } else if (s === 'Pending') { b = 'bg-warning text-dark'; i = 'fa-hourglass-half'; } return `<span class="badge ${b}"><i class="fas ${i} me-1"></i>${s}</span>`; };
    const ticketsTable = $('#supportTicketsDataTable').DataTable({ data: getFilteredTickets(), columns: [{ data: 'id', render: d => `#${d}` }, { data: 'subject' }, { data: 'submissionTimestamp', defaultContent: 'N/A' }, { data: 'createdBy' }, { data: 'resolvedBy' }, { data: 'status', render: generateStatusBadge }, { data: 'id', render: d => `<button class="btn btn-sm btn-info view-details-btn" data-ticket-id="${d}">View Details</button>`, orderable: false, searchable: false }], pageLength: 5, lengthChange: true, lengthMenu: [[5, 10, 20, -1], ['Show 5', 'Show 10', 'Show 20', 'Show All']], searching: true, order: [[2, 'desc']], language: { search: "", searchPlaceholder: "Search tickets...", emptyTable: "No support tickets found. Click 'New Support Ticket' to create one.", lengthMenu: "_MENU_" }, dom: '<"row mb-3"<"col-sm-12 col-md-auto"l><"col-sm-12 col-md-auto ms-md-auto"f>>rtip' });
    $('#supportTicketsDataTable_filter input, #inquiriesDataTable_filter input').before('<i class="fas fa-search search-icon"></i>');
    $(supportTicketForm).on('submit', function (e) { e.preventDefault(); if (!this.checkValidity()) { e.stopPropagation(); $(this).addClass('was-validated'); return; } const now = new Date(); const newTicket = { id: String(Date.now()).slice(-6), subject: $('#ticketSubject').val(), submissionTimestamp: now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), createdBy: $('#fullName').val() || 'System', resolvedBy: 'Pending', accountNumber: $('#accountNumber').val() || 'N/A', description: $('#ticketDescription').val(), remarks: $('#ticketRemarks').val() || 'N/A', status: 'Pending' }; const allTickets = getTickets(); allTickets.unshift(newTicket); localStorage.setItem(ticketsLocalStorageKey, JSON.stringify(allTickets)); ticketsTable.clear().rows.add(getFilteredTickets()).draw(); this.reset(); $(this).removeClass('was-validated'); newTicketModal.hide(); });
    const setViewModalMode = m => { if (m === 'edit') { $('#ticket-details-view').hide(); $('#editTicketForm').show(); $('#editTicketBtn, #closeModalBtn').hide(); $('#saveChangesBtn, #cancelEditBtn').show(); } else { $('#ticket-details-view').show(); $('#editTicketForm').hide(); $('#editTicketBtn, #closeModalBtn').show(); $('#saveChangesBtn, #cancelEditBtn').hide(); $('#editTicketForm').removeClass('was-validated'); } };
    $('#supportTicketsDataTable tbody').on('click', '.view-details-btn', function () { const ticketId = $(this).data('ticket-id').toString(), ticket = getTickets().find(t => t.id === ticketId); if (ticket) { $('#details-id').text(`#${ticket.id}`); $('#details-status').html(generateStatusBadge(ticket.status)); $('#details-subject').text(ticket.subject); $('#details-date').text(ticket.submissionTimestamp); $('#details-createdBy').text(ticket.createdBy); $('#details-account').text(ticket.accountNumber); $('#details-resolvedBy').text(ticket.resolvedBy); $('#details-description').text(ticket.description); $('#details-remarks').text(ticket.remarks || 'N/A'); $('#edit-ticketId').val(ticket.id); $('#edit-fullName').val(ticket.createdBy); $('#edit-accountNumber').val(ticket.accountNumber); $('#edit-ticketSubject').val(ticket.subject); $('#edit-ticketDescription').val(ticket.description); $('#edit-ticketRemarks').val(ticket.remarks); setViewModalMode('view'); viewTicketModal.show(); } });
    $('#editTicketBtn').on('click', () => setViewModalMode('edit'));
    $('#cancelEditBtn').on('click', () => setViewModalMode('view'));
    $(editTicketForm).on('submit', function (e) { e.preventDefault(); if (!this.checkValidity()) { e.stopPropagation(); $(this).addClass('was-validated'); return; } const ticketId = $('#edit-ticketId').val(), allTickets = getTickets(), ticketIndex = allTickets.findIndex(t => t.id === ticketId); if (ticketIndex > -1) { const now = new Date(), updatedTimestamp = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); allTickets[ticketIndex].createdBy = $('#edit-fullName').val(); allTickets[ticketIndex].accountNumber = $('#edit-accountNumber').val(); allTickets[ticketIndex].subject = $('#edit-ticketSubject').val(); allTickets[ticketIndex].description = $('#edit-ticketDescription').val(); allTickets[ticketIndex].remarks = $('#edit-ticketRemarks').val() || 'N/A'; allTickets[ticketIndex].submissionTimestamp = updatedTimestamp; localStorage.setItem(ticketsLocalStorageKey, JSON.stringify(allTickets)); ticketsTable.clear().rows.add(getFilteredTickets()).draw(); $('#details-date').text(allTickets[ticketIndex].submissionTimestamp); $('#details-subject').text(allTickets[ticketIndex].subject); $('#details-createdBy').text(allTickets[ticketIndex].createdBy); $('#details-account').text(allTickets[ticketIndex].accountNumber); $('#details-description').text(allTickets[ticketIndex].description); $('#details-remarks').text(allTickets[ticketIndex].remarks); } setViewModalMode('view'); });
});