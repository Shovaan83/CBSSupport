"use strict";

document.addEventListener('DOMContentLoaded', () => {

    // --- STATE AND CONFIGURATION ---
    const supportAgentIdentity = "CBS Support";
    let currentUserIdentity = supportAgentIdentity;
    let currentChatContext = {};
    let typingTimeout = null;
    let currentInquiryChatId = null; // State for the inquiry chat pop-up

    // --- MOCK DATA ---
    const teamMembers = [{ name: "CBS Support", initials: "S", avatarClass: "avatar-bg-green" }, { name: "Admin User", initials: "A", avatarClass: "avatar-bg-purple" }];
    const customerList = [{ name: "Alzeena Limbu", initials: "A", avatarClass: "avatar-bg-purple" }, { name: "Soniya Basnet", initials: "S", avatarClass: "avatar-bg-red" }, { name: "Ram Shah", initials: "R", avatarClass: "avatar-bg-blue" }, { name: "Namsang Limbu", initials: "N", avatarClass: "avatar-bg-red" }];
    const defaultInquiryList = [{ id: "#INQ-345", topic: "Pricing for Enterprise Plan", inquiredBy: "Ram Shah", date: "2024-09-05T10:42:00Z", outcome: "Completed" }, { id: "#INQ-340", topic: "API Access Question", inquiredBy: "Admin User", date: "2024-08-22T15:15:00Z", outcome: "Pending" }];

    // --- DOM ELEMENT REFERENCES ---
    const roleSwitcher = document.getElementById("role-switcher"),
        conversationListContainer = document.getElementById("conversation-list-container"),
        messageInput = document.getElementById("message-input"),
        sendButton = document.getElementById("send-button"),
        chatPanelBody = document.getElementById("chat-panel-body"),
        chatHeader = document.getElementById("chat-header"),
        typingIndicator = document.getElementById("typing-indicator"),
        attachmentButton = document.getElementById("attachment-button"),
        fileInput = document.getElementById("file-input"),
        inquiryForm = document.getElementById('inquiryForm'),
        newInquiryModal = new bootstrap.Modal(document.getElementById('newInquiryModal')),
        inquiryChatPopup = document.getElementById('inquiry-chat-popup'),
        popupChatTitle = document.getElementById('popup-chat-title'),
        popupChatBody = document.getElementById('popup-chat-body'),
        popupChatInput = document.getElementById('popup-chat-input'),
        popupChatSendBtn = document.getElementById('popup-chat-send-btn'),
        popupChatCloseBtn = document.getElementById('popup-chat-close-btn');

    // --- SIGNALR CONNECTION ---
    const connection = new signalR.HubConnectionBuilder().withUrl("/chathub").withAutomaticReconnect().build();

    // --- HELPER FUNCTIONS ---
    const formatTimestamp = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formatDateForSeparator = (dStr) => { const d = new Date(dStr); const t = new Date(); const y = new Date(t); y.setDate(y.getDate() - 1); if (d.toDateString() === t.toDateString()) return 'Today'; if (d.toDateString() === y.toDateString()) return 'Yesterday'; return d.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }); };
    const getUserRole = (userName) => teamMembers.some(m => m.name === userName) ? "Team Member" : "Customer";
    const updateSendButtonState = () => sendButton.disabled = connection.state !== "Connected" || (messageInput.value.trim() === "" && !fileInput.files.length);
    const scrollToBottom = (element) => element.scrollTop = element.scrollHeight;
    const generateGroupName = (u1, u2) => [u1, u2].sort().join('_');
    const getAvatarDetails = (userName) => teamMembers.find(u => u.name === userName) || customerList.find(u => u.name === userName) || { initials: userName.substring(0, 1).toUpperCase(), avatarClass: "avatar-bg-blue" };

    // --- INQUIRY CHAT HELPERS ---
    const getInquiryChatHistory = (inquiryId) => JSON.parse(localStorage.getItem(`inquiry-chat-${inquiryId}`)) || [];
    const saveInquiryChatMessage = (inquiryId, messageData) => {
        const history = getInquiryChatHistory(inquiryId);
        history.push(messageData);
        localStorage.setItem(`inquiry-chat-${inquiryId}`, JSON.stringify(history));
    };

    // --- FILE UPLOAD LOGIC ---
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
            const textMessage = messageInput.value.trim();
            const method = currentChatContext.type === 'group' ? "SendPublicMessage" : "SendPrivateMessage";
            const args = currentChatContext.type === 'group' ? [currentUserIdentity, textMessage, result.url, result.name, result.type] : [currentChatContext.id, currentUserIdentity, textMessage, result.url, result.name, result.type];
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

    // --- CHAT HISTORY & STATE ---
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
                if (!isNaN(messageId)) {
                    connection.invoke("MarkAsSeen", messageId, currentUserIdentity).catch(err => console.error("MarkAsSeen error:", err));
                }
                seenObserver.unobserve(messageEl);
            }
        });
    }, { threshold: 0.8 });

    // --- UI RENDERING ---
    let lastMessageDate = null;
    function displayMessage(messageData, isHistory) {
        const messageDate = new Date(messageData.timestamp).toDateString();
        if (lastMessageDate !== messageDate) {
            lastMessageDate = messageDate;
            const ds = document.createElement('div');
            ds.className = 'date-separator';
            ds.textContent = formatDateForSeparator(messageData.timestamp);
            chatPanelBody.appendChild(ds);
        }

        const isSent = messageData.sender === currentUserIdentity;
        const messageClass = isSent ? 'sent' : 'received';
        const avatar = getAvatarDetails(messageData.sender);
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${messageClass}`;
        messageRow.id = `msg-${messageData.id}`;
        messageRow.dataset.messageId = messageData.id;
        const readReceiptHtml = isSent ? `<span class="read-receipt fas fa-check-circle"></span>` : '';

        messageRow.innerHTML = `
            <div class="avatar-initials ${avatar.avatarClass}" title="${messageData.sender}">${avatar.initials}</div>
            <div class="message-content">
                <div class="message-bubble">
                    <p>${messageData.message || ''}</p>
                </div>
                <div class="message-timestamp">
                    ${messageData.sender} - ${formatTimestamp(messageData.timestamp)}
                    ${readReceiptHtml}
                </div>
            </div>`;
        chatPanelBody.appendChild(messageRow);
        const hasSeen = (messageData.seenBy || []).some(u => u.name === currentUserIdentity);
        if (!hasSeen && !isSent) {
            seenObserver.observe(messageRow);
        }
        if (!isHistory) {
            scrollToBottom(chatPanelBody);
        }
    }

    function displayInquiryChatMessage(messageData) {
        const isSent = messageData.sender === currentUserIdentity;
        const messageClass = isSent ? 'sent' : 'received';
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${messageClass}`;
        messageRow.innerHTML = `
            <div class="message-content">
                <div class="message-bubble">
                    <p>${messageData.text}</p>
                </div>
                <div class="message-timestamp">
                    ${messageData.sender} - ${formatTimestamp(messageData.timestamp)}
                </div>
            </div>`;
        popupChatBody.appendChild(messageRow);
    }

    function openInquiryChat(inquiryId, inquiryTopic) {
        currentInquiryChatId = inquiryId;
        popupChatTitle.textContent = `Chat for: ${inquiryTopic}`;
        popupChatBody.innerHTML = '';
        const history = getInquiryChatHistory(inquiryId);
        history.forEach(msg => displayInquiryChatMessage(msg));
        scrollToBottom(popupChatBody);
        inquiryChatPopup.style.display = 'flex';
        popupChatInput.focus();
    }

    function closeInquiryChat() {
        inquiryChatPopup.style.display = 'none';
        currentInquiryChatId = null;
    }

    function sendInquiryChatMessage() {
        const text = popupChatInput.value.trim();
        if (!text || !currentInquiryChatId) return;
        const messageData = { sender: currentUserIdentity, text: text, timestamp: new Date().toISOString() };
        saveInquiryChatMessage(currentInquiryChatId, messageData);
        displayInquiryChatMessage(messageData);
        scrollToBottom(popupChatBody);
        popupChatInput.value = '';
        popupChatInput.focus();
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
    async function switchChatContext(contextData) { currentChatContext = contextData; document.querySelectorAll('.conversation-item.active').forEach(el => el.classList.remove('active')); const activeItem = document.querySelector(`.conversation-item[data-id='${contextData.id}']`); if (activeItem) activeItem.classList.add('active'); const partnerName = contextData.name || "Public Group Chat"; const partnerAvatar = getAvatarDetails(partnerName); const chatType = contextData.type === 'group' ? 'Group Chat' : 'Private Chat'; chatHeader.innerHTML = `<div class="avatar-initials ${partnerAvatar.avatarClass}">${partnerAvatar.initials}</div><div><div class="fw-bold">${partnerName}</div><small class="text-muted">${chatType}</small></div>`; chatPanelBody.innerHTML = ''; lastMessageDate = null; getChatHistory(currentChatContext.id).forEach(msg => displayMessage(msg, true)); scrollToBottom(chatPanelBody); if (contextData.type === 'private') { await connection.invoke("JoinPrivateChat", contextData.id); } }
    async function sendMessage() {
        const message = messageInput.value.trim();
        const file = fileInput.files[0];
        if (!message && !file) return;
        if (file) { await uploadFile(file); } else { try { const method = currentChatContext.type === 'group' ? "SendPublicMessage" : "SendPrivateMessage"; const args = currentChatContext.type === 'group' ? [currentUserIdentity, message, null, null, null] : [currentChatContext.id, currentUserIdentity, message, null, null, null]; await connection.invoke(method, ...args); messageInput.value = ""; updateSendButtonState(); } catch (err) { console.error("Error sending message:", err); } }
    }
    function setViewForRole(role) { currentUserIdentity = role; renderSidebar(role, teamMembers.some(u => u.name === role)); const firstItem = conversationListContainer.querySelector('.conversation-item'); if (firstItem) { switchChatContext(firstItem.dataset); } }

    // --- EVENT LISTENERS ---
    roleSwitcher.innerHTML = [...teamMembers, ...customerList].map(u => `<option value="${u.name}">Role: ${u.name}</option>`).join('');
    roleSwitcher.addEventListener('change', (e) => setViewForRole(e.target.value));
    conversationListContainer.addEventListener('click', (e) => { const item = e.target.closest('.conversation-item'); if (item) { e.preventDefault(); switchChatContext(item.dataset); } });
    sendButton.addEventListener("click", sendMessage);
    messageInput.addEventListener("keyup", (e) => { updateSendButtonState(); if (e.key === "Enter") sendMessage(); });
    attachmentButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => updateSendButtonState());
    popupChatSendBtn.addEventListener('click', sendInquiryChatMessage);
    popupChatCloseBtn.addEventListener('click', closeInquiryChat);
    popupChatInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') { sendInquiryChatMessage(); } });

    // --- SIGNALR EVENT HANDLERS ---
    connection.on("ReceivePublicMessage", (messageId, sender, msg, time, initials, fileUrl, fileName, fileType) => { const data = { id: messageId, sender, message: msg, timestamp: time, initials, fileUrl, fileName, fileType, seenBy: [] }; if (sender === currentUserIdentity) { data.seenBy.push({ name: currentUserIdentity, time: time }); } const history = getChatHistory('public'); history.push(data); localStorage.setItem('public', JSON.stringify(history)); if (currentChatContext.id === 'public') { displayMessage(data, false); } });
    connection.on("ReceivePrivateMessage", (messageId, groupName, sender, msg, time, initials, fileUrl, fileName, fileType) => { const data = { id: messageId, sender, message: msg, timestamp: time, initials, fileUrl, fileName, fileType, seenBy: [] }; if (sender === currentUserIdentity) { data.seenBy.push({ name: currentUserIdentity, time: time }); } const history = getChatHistory(groupName); history.push(data); localStorage.setItem(groupName, JSON.stringify(history)); if (currentChatContext.id === groupName) { displayMessage(data, false); } });
    connection.on("MessageSeen", (messageId, userName, seenTime) => { updateMessageInHistory(currentChatContext.id, messageId, (message) => { if (!message.seenBy.some(u => u.name === userName)) { message.seenBy.push({ name: userName, time: seenTime }); } }); const messageEl = document.getElementById(`msg-${messageId}`); if (messageEl && messageEl.closest('#chat-panel-body')) { const receiptEl = messageEl.querySelector('.read-receipt'); if (receiptEl) { const message = getChatHistory(currentChatContext.id).find(m => m.id === messageId); const tooltip = bootstrap.Tooltip.getInstance(receiptEl); const newTitle = `Seen by: ${message.seenBy.map(u => u.name).join(', ')}`; receiptEl.className = 'read-receipt receipt-seen fas fa-check-double'; if (tooltip) { tooltip.setContent({ '.tooltip-inner': newTitle }); } else { receiptEl.setAttribute('title', newTitle); new bootstrap.Tooltip(receiptEl, { boundary: document.body }); } } } });
    connection.start().then(() => { console.log("SignalR Connected."); setViewForRole(supportAgentIdentity); updateSendButtonState(); }).catch(err => console.error("SignalR Connection Error: ", err));

    // --- TICKET & INQUIRY SYSTEM LOGIC ---
    const supportSubjects = [{ text: "TRAINING" }, { text: "MIGRATION" }, { text: "SETUPS" }, { text: "CORRECTION" }, { text: "BUGS FIX" }, { text: "NEW FEATURES" }, { text: "FEATURE ENCHANCEMENT" }, { text: "BACKEND WORKAROUND" }];
    const subjectDropdown = $('#ticketSubject'), editSubjectDropdown = $('#edit-ticketSubject');
    subjectDropdown.append('<option value="" disabled selected>Select a subject...</option>');
    supportSubjects.forEach(s => { const o = `<option value="${s.text}">${s.text}</option>`; subjectDropdown.append(o); editSubjectDropdown.append(o.toString()); });

    const inquiryLocalStorageKey = 'clientInquiries';
    const getInquiries = () => JSON.parse(localStorage.getItem(inquiryLocalStorageKey)) || defaultInquiryList;
    const saveInquiries = (allInquiries) => localStorage.setItem(inquiryLocalStorageKey, JSON.stringify(allInquiries));

    const generateInquiryStatusBadge = (outcome) => {
        if (outcome === 'Completed') {
            return `<span class="badge bg-success">Completed</span>`;
        }
        return `<span class="badge bg-warning text-dark">Pending</span>`;
    };

    const inquiriesTable = $('#inquiriesDataTable').DataTable({
        data: getInquiries(),
        columns: [
            { data: 'id' }, { data: 'topic' }, { data: 'inquiredBy' },
            { data: 'date', render: (data) => new Date(data).toLocaleString() },
            { data: 'outcome', render: (data) => generateInquiryStatusBadge(data || 'Pending') },
            {
                data: 'id', orderable: false, searchable: false,
                render: function (data, type, row) {
                    return `<button class="btn btn-sm btn-primary start-inquiry-chat-btn" data-inquiry-id="${data}" data-inquiry-topic="${row.topic}"><i class="fas fa-comments"></i> Chat</button>`;
                }
            }
        ],
        order: [[3, 'desc']],
        "dom": "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>>" + "<'row'<'col-sm-12'tr>>" + "<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
        "pageLength": 5,
        "lengthMenu": [[5, 20, 50, 100, -1], ['5', '20', '50', '100', 'All']],
        "pagingType": "full_numbers",
        language: { lengthMenu: '_MENU_', search: "", searchPlaceholder: "Search inquiries...", emptyTable: "No inquiries yet — let us know how we can help!" }
    });

    $('#inquiriesDataTable tbody').on('click', '.start-inquiry-chat-btn', function () { openInquiryChat($(this).data('inquiry-id'), $(this).data('inquiry-topic')); });
    $(inquiryForm).on('submit', function (e) {
        e.preventDefault();
        const newInquiry = {
            id: `#INQ-${Date.now().toString().slice(-5)}`,
            topic: $('#inquirySubject').val(),
            inquiredBy: currentUserIdentity,
            date: new Date().toISOString(),
            outcome: "Pending"
        };
        const allInquiries = getInquiries();
        allInquiries.unshift(newInquiry);
        saveInquiries(allInquiries);
        inquiriesTable.clear().rows.add(allInquiries).draw();
        this.reset();
        newInquiryModal.hide();
    });

    const ticketsLocalStorageKey = 'supportTickets', supportTicketForm = document.getElementById('supportTicketForm'), editTicketForm = document.getElementById('editTicketForm'), newTicketModal = new bootstrap.Modal(document.getElementById('newSupportTicketModal')), viewTicketModal = new bootstrap.Modal(document.getElementById('viewTicketDetailsModal'));
    const getTickets = () => JSON.parse(localStorage.getItem(ticketsLocalStorageKey)) || [], getFilteredTickets = () => getTickets().filter(t => t.status && t.status !== 'Open');
    const generateStatusBadge = s => { let b = 'bg-secondary', i = 'fa-question-circle'; if (s === 'Resolved') { b = 'bg-success'; i = 'fa-check-circle'; } else if (s === 'Pending') { b = 'bg-warning text-dark'; i = 'fa-hourglass-half'; } return `<span class="badge ${b}"><i class="fas ${i} me-1"></i>${s}</span>`; };
    const generatePriorityBadge = p => { let b = 'badge-priority-low', i = 'fa-arrow-down'; if (p === 'Urgent') { b = 'badge-priority-urgent'; i = 'fa-exclamation-circle'; } else if (p === 'High') { b = 'badge-priority-high'; i = 'fa-arrow-up'; } return `<span class="badge ${b}"><i class="fas ${i} me-1"></i>${p}</span>`; };

    const ticketsTable = $('#supportTicketsDataTable').DataTable({
        data: getFilteredTickets(),
        columns: [
            { data: 'id', render: d => `#${d}` }, { data: 'subject', defaultContent: 'N/A' },
            {
                data: 'submissionTimestamp', defaultContent: 'N/A',
                render: function (data, type, row) { if (!data) return 'N/A'; if (type === 'display') { return new Date(data).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } return data; }
            },
            { data: 'createdBy', defaultContent: 'N/A' }, { data: 'resolvedBy', defaultContent: 'N/A' },
            { data: 'status', render: generateStatusBadge, defaultContent: '' },
            { data: 'priority', render: generatePriorityBadge, defaultContent: 'Low' },
            {
                data: 'id', orderable: false, searchable: false,
                render: function (data, type, row) {
                    let chatButton = '';
                    const isAdmin = teamMembers.some(u => u.name === currentUserIdentity);
                    if (isAdmin && row.createdBy && row.createdBy !== currentUserIdentity) {
                        chatButton = `<button class="btn btn-sm btn-success start-chat-btn ms-1" data-ticket-id="${row.id}" aria-label="Chat with ${row.createdBy}"><i class="fas fa-comments"></i></button>`;
                    }
                    return `<button class="btn btn-sm btn-info view-details-btn" data-ticket-id="${data}">View Details</button>${chatButton}`;
                }
            }
        ],
        order: [[2, 'desc']],
        "dom": "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>>" + "<'row'<'col-sm-12'tr>>" + "<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
        "pageLength": 5,
        "lengthMenu": [[5, 20, 50, 100, -1], ['5', '20', '50', '100', 'All']],
        "pagingType": "full_numbers",
        language: { lengthMenu: '_MENU_', search: "", searchPlaceholder: "Search tickets...", emptyTable: "No support tickets found." }
    });

    $('#supportTicketsDataTable_filter input, #inquiriesDataTable_filter input').before('<i class="fas fa-search search-icon"></i>');

    $(supportTicketForm).on('submit', function (e) {
        e.preventDefault();
        if (!this.checkValidity()) { e.stopPropagation(); $(this).addClass('was-validated'); return; }
        try {
            const now = new Date();
            const newTicket = {
                id: String(Date.now()).slice(-6),
                subject: $('#ticketSubject').val(),
                submissionTimestamp: now.toISOString(),
                createdBy: $('#fullName').val() || 'System',
                resolvedBy: 'Pending',
                description: $('#ticketDescription').val(),
                remarks: $('#ticketRemarks').val() || 'N/A',
                status: 'Pending',
                priority: $('#ticketPriority').val(),
                expiryDate: new Date($('#ticketExpiryDate').val()).toLocaleString()
            };
            const allTickets = getTickets();
            allTickets.unshift(newTicket);
            localStorage.setItem(ticketsLocalStorageKey, JSON.stringify(allTickets));
            ticketsTable.clear().rows.add(getFilteredTickets()).draw();
            this.reset();
            $(this).removeClass('was-validated');
            newTicketModal.hide();
            alert('Support ticket submitted successfully!');
        } catch (error) {
            console.error("Error submitting ticket:", error);
            alert('An error occurred while submitting the ticket. Please check the console for details.');
        }
    });

    const setViewModalMode = m => { if (m === 'edit') { $('#ticket-details-view').hide(); $('#editTicketForm').show(); $('#editTicketBtn, #closeModalBtn').hide(); $('#saveChangesBtn, #cancelEditBtn').show(); } else { $('#ticket-details-view').show(); $('#editTicketForm').hide(); $('#editTicketBtn, #closeModalBtn').show(); $('#saveChangesBtn, #cancelEditBtn').hide(); $('#editTicketForm').removeClass('was-validated'); } };

    $('#supportTicketsDataTable tbody').on('click', '.view-details-btn', function () {
        const ticketId = $(this).data('ticket-id').toString(), ticket = getTickets().find(t => t.id === ticketId);
        if (ticket) {
            $('#details-id').text(`#${ticket.id}`);
            $('#details-status').html(generateStatusBadge(ticket.status || 'Pending'));
            $('#details-priority').html(generatePriorityBadge(ticket.priority || 'Low'));
            $('#details-subject').text(ticket.subject || 'N/A');
            $('#details-date').text(ticket.submissionTimestamp ? new Date(ticket.submissionTimestamp).toLocaleString() : 'N/A');
            $('#details-expiryDate').text(ticket.expiryDate || 'N/A');
            $('#details-createdBy').text(ticket.createdBy || 'N/A');
            $('#details-resolvedBy').text(ticket.resolvedBy || 'N/A');
            $('#details-description').text(ticket.description || 'N/A');
            $('#details-remarks').text(ticket.remarks || 'N/A');
            $('#edit-ticketId').val(ticket.id);
            $('#edit-fullName').val(ticket.createdBy || '');
            $('#edit-ticketSubject').val(ticket.subject || '');
            $('#edit-ticketPriority').val(ticket.priority || 'Low');
            const expiryForInput = ticket.expiryDate ? new Date(ticket.expiryDate).toISOString().slice(0, 16) : '';
            $('#edit-ticketExpiryDate').val(expiryForInput);
            $('#edit-ticketDescription').val(ticket.description || '');
            $('#edit-ticketRemarks').val(ticket.remarks || '');
            setViewModalMode('view');
            viewTicketModal.show();
        }
    });

    $('#supportTicketsDataTable tbody').on('click', '.start-chat-btn', function () {
        const ticketId = $(this).data('ticket-id').toString();
        const ticket = getTickets().find(t => t.id === ticketId);
        if (ticket && ticket.createdBy) {
            const ticketCreatorName = ticket.createdBy;
            const matchedCustomer = customerList.find(c => ticketCreatorName.includes(c.name));

            if (matchedCustomer) {
                const customerChatName = matchedCustomer.name;
                const conversationItem = document.querySelector(`.conversation-item[data-name="${customerChatName}"]`);

                if (conversationItem) {
                    const collapsedParent = conversationItem.closest('.accordion-collapse.collapse:not(.show)');
                    if (collapsedParent) {
                        new bootstrap.Collapse(collapsedParent).show();
                    }
                    conversationItem.click();
                } else {
                    alert(`Could not find the conversation UI element for "${customerChatName}".`);
                }
            } else {
                alert(`A chat with a user matching "${ticketCreatorName}" is not available in your conversation list.`);
            }
        }
    });

    $('#editTicketBtn').on('click', () => setViewModalMode('edit'));
    $('#cancelEditBtn').on('click', () => setViewModalMode('view'));

    $(editTicketForm).on('submit', function (e) {
        e.preventDefault();
        if (!this.checkValidity()) { e.stopPropagation(); $(this).addClass('was-validated'); return; }
        const ticketId = $('#edit-ticketId').val(), allTickets = getTickets(), ticketIndex = allTickets.findIndex(t => t.id === ticketId);
        if (ticketIndex > -1) {
            allTickets[ticketIndex].createdBy = $('#edit-fullName').val();
            allTickets[ticketIndex].subject = $('#edit-ticketSubject').val();
            allTickets[ticketIndex].submissionTimestamp = new Date().toISOString();
            allTickets[ticketIndex].description = $('#edit-ticketDescription').val();
            allTickets[ticketIndex].remarks = $('#edit-ticketRemarks').val() || 'N/A';
            allTickets[ticketIndex].priority = $('#edit-ticketPriority').val();
            allTickets[ticketIndex].expiryDate = new Date($('#edit-ticketExpiryDate').val()).toLocaleString();
            localStorage.setItem(ticketsLocalStorageKey, JSON.stringify(allTickets));
            ticketsTable.clear().rows.add(getFilteredTickets()).draw();
            $('#details-subject').text(allTickets[ticketIndex].subject);
            $('#details-createdBy').text(allTickets[ticketIndex].createdBy);
            $('#details-date').text(new Date(allTickets[ticketIndex].submissionTimestamp).toLocaleString());
            $('#details-description').text(allTickets[ticketIndex].description);
            $('#details-remarks').text(allTickets[ticketIndex].remarks);
            $('#details-priority').html(generatePriorityBadge(allTickets[ticketIndex].priority));
            $('#details-expiryDate').text(allTickets[ticketIndex].expiryDate);
        }
        setViewModalMode('view');
    });
});