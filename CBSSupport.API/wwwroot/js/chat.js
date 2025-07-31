"use strict";

document.addEventListener('DOMContentLoaded', () => {

    // --- STATE AND CONFIGURATION ---
    const supportAgentIdentity = "CBS Support";
    let currentUserIdentity = supportAgentIdentity;
    let currentChatContext = {};
    let typingTimeout = null;
    let currentInquiryChatId = null;
    let currentTicketChatId = null;
    let selectedFile = null;

    // --- MOCK DATA ---
    const teamMembers = [{ name: "CBS Support", initials: "S", avatarClass: "avatar-bg-green" }, { name: "Admin User", initials: "A", avatarClass: "avatar-bg-purple" }];
    const customerList = [{ name: "Alzeena Limbu", initials: "A", avatarClass: "avatar-bg-purple" }, { name: "Soniya Basnet", initials: "S", avatarClass: "avatar-bg-red" }, { name: "Ram Shah", initials: "R", avatarClass: "avatar-bg-blue" }, { name: "Namsang Limbu", initials: "N", avatarClass: "avatar-bg-red" }];
    const defaultInquiryList = [{ id: "#INQ-345", topic: "Pricing for Enterprise Plan", inquiredBy: "Ram Shah", date: "2024-09-05T10:42:00Z", outcome: "Completed", message: "What are the details of the enterprise plan?", assignedTo: "John Doe" }];

    // --- DOM ELEMENT REFERENCES ---
    const roleSwitcher = document.getElementById("role-switcher"),
        conversationListContainer = document.getElementById("conversation-list-container"),
        messageInput = document.getElementById("message-input"),
        sendButton = document.getElementById("send-button"),
        chatPanelBody = document.getElementById("chat-panel-body"),
        chatHeader = document.getElementById("chat-header"),
        attachmentButton = document.getElementById("attachment-button"),
        fileInput = document.getElementById("file-input"),
        filePreviewContainer = document.getElementById('file-preview-container'),
        inquiryForm = document.getElementById('inquiryForm'),

        // MODALS (Initialized once to prevent errors)
        newTicketModal = new bootstrap.Modal(document.getElementById('newSupportTicketModal')),
        viewTicketModal = new bootstrap.Modal(document.getElementById('viewTicketDetailsModal')),
        newInquiryModal = new bootstrap.Modal(document.getElementById('newInquiryModal')),
        viewInquiryModal = new bootstrap.Modal(document.getElementById('viewInquiryDetailsModal')),

        // POPUPS
        inquiryChatPopup = document.getElementById('inquiry-chat-popup'),
        popupChatTitle = document.getElementById('popup-chat-title'),
        popupChatBody = document.getElementById('popup-chat-body'),
        popupChatInput = document.getElementById('popup-chat-input'),
        popupChatSendBtn = document.getElementById('popup-chat-send-btn'),
        popupChatCloseBtn = document.getElementById('popup-chat-close-btn'),
        ticketChatPopup = document.getElementById('ticket-chat-popup'),
        popupTicketChatTitle = document.getElementById('popup-ticket-chat-title'),
        popupTicketChatBody = document.getElementById('popup-ticket-chat-body'),
        popupTicketChatInput = document.getElementById('popup-ticket-chat-input'),
        popupTicketChatSendBtn = document.getElementById('popup-ticket-chat-send-btn'),
        popupTicketChatCloseBtn = document.getElementById('popup-ticket-chat-close-btn');

    // --- SIGNALR CONNECTION ---
    const connection = new signalR.HubConnectionBuilder().withUrl("/chathub").withAutomaticReconnect().build();

    // --- HELPER FUNCTIONS ---
    const formatTimestamp = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formatDateForSeparator = (dStr) => { const d = new Date(dStr); const t = new Date(); const y = new Date(t); y.setDate(y.getDate() - 1); if (d.toDateString() === t.toDateString()) return 'Today'; if (d.toDateString() === y.toDateString()) return 'Yesterday'; return d.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }); };
    const getAvatarDetails = (userName) => teamMembers.find(u => u.name === userName) || customerList.find(u => u.name === userName) || { initials: userName.substring(0, 1).toUpperCase(), avatarClass: "avatar-bg-blue" };
    const scrollToBottom = (element) => element.scrollTop = element.scrollHeight;
    const updateSendButtonState = () => {
        const hasText = messageInput.value.trim() !== "";
        const hasFile = selectedFile !== null;
        sendButton.disabled = connection.state !== "Connected" || (!hasText && !hasFile);
    };

    // --- FILE HANDLING & PREVIEW LOGIC ---
    function clearAttachmentPreview() {
        selectedFile = null;
        fileInput.value = '';
        filePreviewContainer.innerHTML = '';
        filePreviewContainer.style.display = 'none';
        updateSendButtonState();
    }

    function showFilePreview(file) {
        let previewHtml = '';
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewHtml = `<img id="preview-image" src="${e.target.result}" alt="Image preview"><span id="preview-info">${file.name}</span><button id="cancel-attachment-btn" type="button" aria-label="Cancel attachment">×</button>`;
                filePreviewContainer.innerHTML = previewHtml;
            };
            reader.readAsDataURL(file);
        } else {
            previewHtml = `<i class="fas fa-file-alt fa-2x text-muted"></i><span id="preview-info">${file.name}</span><button id="cancel-attachment-btn" type="button" aria-label="Cancel attachment">×</button>`;
            filePreviewContainer.innerHTML = previewHtml;
        }
        filePreviewContainer.style.display = 'flex';
        updateSendButtonState();
    }

    async function uploadFileAndSendMessage(file, textMessage) {
        const maxFileSize = 10 * 1024 * 1024;
        if (file.size > maxFileSize) {
            alert(`Error: File size cannot exceed ${maxFileSize / 1024 / 1024} MB.`);
            clearAttachmentPreview();
            return;
        }
        const formData = new FormData();
        formData.append('file', file);
        try {
            messageInput.placeholder = "Uploading file...";
            attachmentButton.disabled = true;
            sendButton.disabled = true;
            const response = await fetch('/api/FileUpload/UploadFile', { method: 'POST', body: formData });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'File upload failed.');
            }
            const result = await response.json();
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
            clearAttachmentPreview();
        }
    }

    // --- CHAT & MESSAGE LOGIC ---
    async function sendMessage() {
        const message = messageInput.value.trim();
        const file = selectedFile;
        if (!message && !file) return;
        if (file) {
            await uploadFileAndSendMessage(file, message);
        } else {
            try {
                const method = currentChatContext.type === 'group' ? "SendPublicMessage" : "SendPrivateMessage";
                const args = currentChatContext.type === 'group' ? [currentUserIdentity, message, null, null, null] : [currentChatContext.id, currentUserIdentity, message, null, null, null];
                await connection.invoke(method, ...args);
                messageInput.value = "";
                updateSendButtonState();
            } catch (err) {
                console.error("Error sending message:", err);
            }
        }
    }

    // --- UI RENDERING ---
    const getChatHistory = (id) => JSON.parse(localStorage.getItem(id)) || [];
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
        let attachmentHtml = '';
        if (messageData.fileUrl) {
            if (messageData.fileType && messageData.fileType.startsWith('image/')) {
                attachmentHtml = `<a href="${messageData.fileUrl}" target="_blank" class="attachment-link"><img src="${messageData.fileUrl}" class="attachment-preview-image" alt="${messageData.fileName}"></a>`;
            } else {
                attachmentHtml = `<div class="message-attachment"><i class="attachment-icon fas fa-file"></i><div class="attachment-info"><a href="${messageData.fileUrl}" target="_blank" class="attachment-link attachment-name">${messageData.fileName}</a></div></div>`;
            }
        }
        messageRow.innerHTML = `
            <div class="avatar-initials ${avatar.avatarClass}" title="${messageData.sender}">${avatar.initials}</div>
            <div class="message-content">
                <div class="message-bubble">
                    ${attachmentHtml}
                    ${messageData.message ? `<p>${messageData.message}</p>` : ''}
                </div>
                <div class="message-timestamp">
                    ${messageData.sender} - ${formatTimestamp(messageData.timestamp)}
                    ${readReceiptHtml}
                </div>
            </div>`;
        chatPanelBody.appendChild(messageRow);
        if (!isHistory) {
            scrollToBottom(chatPanelBody);
        }
    }

    // --- POPUP CHAT LOGIC ---
    const getInquiryChatHistory = (inquiryId) => JSON.parse(localStorage.getItem(`inquiry-chat-${inquiryId}`)) || [];
    const saveInquiryChatMessage = (inquiryId, messageData) => { const history = getInquiryChatHistory(inquiryId); history.push(messageData); localStorage.setItem(`inquiry-chat-${inquiryId}`, JSON.stringify(history)); };
    function displayInquiryChatMessage(messageData) {
        const isSent = messageData.sender === currentUserIdentity;
        const messageClass = isSent ? 'sent' : 'received';
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${messageClass}`;
        messageRow.innerHTML = `<div class="message-content"><div class="message-bubble"><p>${messageData.text}</p></div><div class="message-timestamp">${messageData.sender} - ${formatTimestamp(messageData.timestamp)}</div></div>`;
        popupChatBody.appendChild(messageRow);
    }
    function openInquiryChat(inquiryId, inquiryTopic) {
        currentInquiryChatId = inquiryId;
        popupChatTitle.textContent = `Chat for: ${inquiryTopic}`;
        popupChatBody.innerHTML = '';
        getInquiryChatHistory(inquiryId).forEach(msg => displayInquiryChatMessage(msg));
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

    const getTicketChatHistory = (ticketId) => JSON.parse(localStorage.getItem(`ticket-chat-${ticketId}`)) || [];
    const saveTicketChatMessage = (ticketId, messageData) => { const history = getTicketChatHistory(ticketId); history.push(messageData); localStorage.setItem(`ticket-chat-${ticketId}`, JSON.stringify(history)); };
    function displayTicketChatMessage(messageData) {
        const isSent = messageData.sender === currentUserIdentity;
        const messageClass = isSent ? 'sent' : 'received';
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${messageClass}`;
        messageRow.innerHTML = `<div class="message-content"><div class="message-bubble"><p>${messageData.text}</p></div><div class="message-timestamp">${messageData.sender} - ${formatTimestamp(messageData.timestamp)}</div></div>`;
        popupTicketChatBody.appendChild(messageRow);
    }
    function openTicketChat(ticketId, ticketSubject) {
        currentTicketChatId = ticketId;
        const ticket = getTickets().find(t => t.id === ticketId);
        if (!ticket) return;
        popupTicketChatTitle.textContent = `Chat for: #${ticket.id} - ${ticketSubject}`;
        popupTicketChatBody.innerHTML = '';
        getTicketChatHistory(ticketId).forEach(msg => displayTicketChatMessage(msg));
        scrollToBottom(popupTicketChatBody);
        ticketChatPopup.style.display = 'flex';
        popupTicketChatInput.focus();
    }
    function closeTicketChat() {
        ticketChatPopup.style.display = 'none';
        currentTicketChatId = null;
    }
    function sendTicketChatMessage() {
        const text = popupTicketChatInput.value.trim();
        if (!text || !currentTicketChatId) return;
        const messageData = { sender: currentUserIdentity, text: text, timestamp: new Date().toISOString() };
        saveTicketChatMessage(currentTicketChatId, messageData);
        displayTicketChatMessage(messageData);
        scrollToBottom(popupTicketChatBody);
        popupTicketChatInput.value = '';
        popupTicketChatInput.focus();
    }

    // --- SIDEBAR AND CONTEXT SWITCHING ---
    function renderSidebar(role, isAdmin) {
        conversationListContainer.innerHTML = '';
        const createChatItem = (type, id, name, subtext, iconClass) => { const avatar = getAvatarDetails(name); return `<a href="#" class="list-group-item list-group-item-action conversation-item" data-type="${type}" data-id="${id}" data-name="${name}"><div class="d-flex w-100 align-items-center"><div class="avatar-initials ${avatar.avatarClass} me-3">${avatar.initials}</div><div class="flex-grow-1"><div class="fw-bold">${name}</div><small class="text-muted">${subtext}</small></div><div class="icon ms-2"><i class="fas ${iconClass}"></i></div></div></a>`; };
        conversationListContainer.innerHTML += createChatItem('group', 'public', 'Public Group Chat', 'Group Chat', 'fa-users');
        if (isAdmin) {
            let accordionHtml = '<div class="accordion" id="sidebarAccordion">';
            if (role === supportAgentIdentity) { let customerItems = ''; customerList.forEach(user => { customerItems += createChatItem('private', [role, user.name].sort().join('_'), user.name, 'Private Chat', 'fa-user'); }); accordionHtml += `<div class="accordion-item"><h2 class="accordion-header" id="headingSupport"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSupport">Support</button></h2><div id="collapseSupport" class="accordion-collapse collapse"><div class="list-group list-group-flush">${customerItems}</div></div></div>`; }
            let teamItems = ''; teamMembers.filter(u => u.name !== role).forEach(user => { teamItems += createChatItem('private', [role, user.name].sort().join('_'), user.name, 'Private Chat', 'fa-user'); }); accordionHtml += `<div class="accordion-item"><h2 class="accordion-header" id="headingTeams"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTeams">Teams</button></h2><div id="collapseTeams" class="accordion-collapse collapse"><div class="list-group list-group-flush">${teamItems}</div></div></div>`;
            accordionHtml += '</div>';
            conversationListContainer.innerHTML += accordionHtml;
        } else {
            conversationListContainer.innerHTML += createChatItem('private', [role, supportAgentIdentity].sort().join('_'), supportAgentIdentity, 'Private Chat', 'fa-headset');
        }
    }
    async function switchChatContext(contextData) {
        currentChatContext = contextData;
        document.querySelectorAll('.conversation-item.active').forEach(el => el.classList.remove('active'));
        const activeItem = document.querySelector(`.conversation-item[data-id='${contextData.id}']`);
        if (activeItem) activeItem.classList.add('active');
        const partnerName = contextData.name || "Public Group Chat";
        const partnerAvatar = getAvatarDetails(partnerName);
        const chatType = contextData.type === 'group' ? 'Group Chat' : 'Private Chat';
        chatHeader.innerHTML = `<div class="avatar-initials ${partnerAvatar.avatarClass}">${partnerAvatar.initials}</div><div><div class="fw-bold">${partnerName}</div><small class="text-muted">${chatType}</small></div>`;
        chatPanelBody.innerHTML = '';
        lastMessageDate = null;
        getChatHistory(currentChatContext.id).forEach(msg => displayMessage(msg, true));
        scrollToBottom(chatPanelBody);
        if (contextData.type === 'private') {
            await connection.invoke("JoinPrivateChat", contextData.id);
        }
    }
    function setViewForRole(role) {
        currentUserIdentity = role;
        renderSidebar(role, teamMembers.some(u => u.name === role));
        const firstItem = conversationListContainer.querySelector('.conversation-item');
        if (firstItem) {
            switchChatContext(firstItem.dataset);
        }
    }

    // --- EVENT LISTENERS & INITIALIZATION ---
    roleSwitcher.innerHTML = [...teamMembers, ...customerList].map(u => `<option value="${u.name}">Role: ${u.name}</option>`).join('');
    roleSwitcher.addEventListener('change', (e) => setViewForRole(e.target.value));
    conversationListContainer.addEventListener('click', (e) => { const item = e.target.closest('.conversation-item'); if (item) { e.preventDefault(); switchChatContext(item.dataset); } });
    sendButton.addEventListener("click", sendMessage);
    messageInput.addEventListener("keyup", (e) => { updateSendButtonState(); if (e.key === "Enter") sendMessage(); });
    attachmentButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => { if (e.target.files.length > 0) { selectedFile = e.target.files[0]; showFilePreview(selectedFile); messageInput.focus(); } });
    filePreviewContainer.addEventListener('click', (e) => { if (e.target.id === 'cancel-attachment-btn') { clearAttachmentPreview(); } });
    popupChatSendBtn.addEventListener('click', sendInquiryChatMessage);
    popupChatCloseBtn.addEventListener('click', closeInquiryChat);
    popupChatInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') { sendInquiryChatMessage(); } });
    popupTicketChatSendBtn.addEventListener('click', sendTicketChatMessage);
    popupTicketChatCloseBtn.addEventListener('click', closeTicketChat);
    popupTicketChatInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') { sendTicketChatMessage(); } });

    // --- SIGNALR EVENT HANDLERS ---
    connection.start().then(() => { console.log("SignalR Connected."); setViewForRole(supportAgentIdentity); updateSendButtonState(); }).catch(err => console.error("SignalR Connection Error: ", err));
    connection.on("ReceivePublicMessage", (messageId, sender, msg, time, initials, fileUrl, fileName, fileType) => { const data = { id: messageId, sender, message: msg, timestamp: time, initials, fileUrl, fileName, fileType, seenBy: [] }; if (currentChatContext.id === 'public') { displayMessage(data, false); } });
    connection.on("ReceivePrivateMessage", (messageId, groupName, sender, msg, time, initials, fileUrl, fileName, fileType) => { const data = { id: messageId, sender, message: msg, timestamp: time, initials, fileUrl, fileName, fileType, seenBy: [] }; if (currentChatContext.id === groupName) { displayMessage(data, false); } });

    // --- TICKET & INQUIRY SYSTEM LOGIC ---
    const inquiryLocalStorageKey = 'clientInquiries';
    const getInquiries = () => JSON.parse(localStorage.getItem(inquiryLocalStorageKey)) || defaultInquiryList;
    const saveInquiries = (allInquiries) => localStorage.setItem(inquiryLocalStorageKey, JSON.stringify(allInquiries));
    const generateInquiryStatusBadge = (outcome) => { if (outcome === 'Completed') { return `<span class="badge bg-success">Completed</span>`; } return `<span class="badge bg-warning text-dark">Pending</span>`; };

    const inquiriesTable = $('#inquiriesDataTable').DataTable({
        data: getInquiries(),
        columns: [
            { data: 'id' },
            { data: 'topic' },
            { data: 'date', render: (data) => data ? new Date(data).toLocaleString() : 'N/A' },
            { data: 'assignedTo', defaultContent: 'Unassigned' },
            { data: 'outcome', render: (data) => generateInquiryStatusBadge(data || 'Pending') },
            {
                data: 'id', orderable: false, searchable: false,
                render: function (data, type, row) {
                    return `<div class="d-flex gap-1">
                                <button class="btn btn-sm btn-info view-inquiry-details-btn" data-inquiry-id="${data}"><i class="fas fa-eye"></i></button>
                                <button class="btn btn-sm btn-primary start-inquiry-chat-btn" data-inquiry-id="${data}" data-inquiry-topic="${row.topic}"><i class="fas fa-comments"></i></button>
                            </div>`;
                }
            }
        ],
        order: [[2, 'desc']],
        pageLength: 5,
        "columnDefs": [{ "width": "20%", "targets": 5 }]
    });

    $('#inquiriesDataTable tbody').on('click', '.view-inquiry-details-btn', function () {
        const inquiryId = $(this).data('inquiry-id');
        const inquiry = getInquiries().find(i => i.id === inquiryId);
        if (inquiry) {
            $('#details-inquiry-id').text(inquiry.id);
            $('#details-inquiry-outcome').html(generateInquiryStatusBadge(inquiry.outcome || 'Pending'));
            $('#details-inquiry-topic').text(inquiry.topic || 'N/A');
            $('#details-inquiry-date').text(inquiry.date ? new Date(inquiry.date).toLocaleString() : 'N/A');
            $('#details-inquiry-inquiredBy').text(inquiry.inquiredBy || 'N/A');
            $('#details-inquiry-message').text(inquiry.message || 'N/A');
            viewInquiryModal.show();
        }
    });

    $('#inquiriesDataTable tbody').on('click', '.start-inquiry-chat-btn', function () { openInquiryChat($(this).data('inquiry-id'), $(this).data('inquiry-topic')); });

    $(inquiryForm).on('submit', function (e) {
        e.preventDefault();
        const newInquiry = { id: `#INQ-${Date.now().toString().slice(-5)}`, topic: $('#inquirySubject').val(), inquiredBy: currentUserIdentity, date: new Date().toISOString(), message: $('#inquiryMessage').val(), outcome: "Pending", assignedTo: "Unassigned" };
        const allInquiries = getInquiries();
        allInquiries.unshift(newInquiry);
        saveInquiries(allInquiries);
        inquiriesTable.clear().rows.add(allInquiries).draw();
        this.reset();
        newInquiryModal.hide();
    });

    const ticketsLocalStorageKey = 'supportTickets', supportTicketForm = document.getElementById('supportTicketForm');
    const getTickets = () => JSON.parse(localStorage.getItem(ticketsLocalStorageKey)) || [];
    const getFilteredTickets = () => getTickets().filter(t => t.status && t.status !== 'Open');
    const generateStatusBadge = s => { let b = 'bg-secondary', i = 'fa-question-circle'; if (s === 'Resolved') { b = 'bg-success'; i = 'fa-check-circle'; } else if (s === 'Pending') { b = 'bg-warning text-dark'; i = 'fa-hourglass-half'; } return `<span class="badge ${b}"><i class="fas ${i} me-1"></i>${s}</span>`; };
    const generatePriorityBadge = p => { let b = 'badge-priority-low', i = 'fa-arrow-down'; if (p === 'Urgent') { b = 'badge-priority-urgent'; i = 'fa-exclamation-circle'; } else if (p === 'High') { b = 'badge-priority-high'; i = 'fa-arrow-up'; } return `<span class="badge ${b}"><i class="fas ${i} me-1"></i>${p}</span>`; };

    const ticketsTable = $('#supportTicketsDataTable').DataTable({
        data: getFilteredTickets(),
        columns: [
            { data: 'id', render: d => `#${d}` }, { data: 'subject' }, { data: 'submissionTimestamp', render: data => new Date(data).toLocaleString() },
            { data: 'createdBy' }, { data: 'resolvedBy', defaultContent: 'N/A' },
            { data: 'status', render: generateStatusBadge }, { data: 'priority', render: generatePriorityBadge },
            {
                data: 'id', orderable: false, searchable: false,
                render: function (data, type, row) {
                    const isAdmin = teamMembers.some(u => u.name === currentUserIdentity);
                    const canChat = isAdmin || row.createdBy === currentUserIdentity;
                    let chatButton = canChat ? `<button class="btn btn-sm btn-success start-ticket-popup-chat-btn ms-1" data-ticket-id="${row.id}" data-ticket-subject="${row.subject}"><i class="fas fa-comments"></i></button>` : '';
                    return `<button class="btn btn-sm btn-info view-details-btn" data-ticket-id="${data}">View Details</button>${chatButton}`;
                }
            }
        ],
        order: [[2, 'desc']], pageLength: 5
    });

    $('#supportTicketsDataTable tbody').on('click', '.view-details-btn', function () {
        const ticketId = $(this).data('ticket-id').toString();
        const ticket = getTickets().find(t => t.id === ticketId);
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
            viewTicketModal.show();
        }
    });

    $(supportTicketForm).on('submit', function (e) {
        e.preventDefault();
        if (!this.checkValidity()) { e.stopPropagation(); $(this).addClass('was-validated'); return; }
        const now = new Date();
        const newTicket = { id: String(Date.now()).slice(-6), subject: $('#ticketSubject').val(), submissionTimestamp: now.toISOString(), createdBy: $('#fullName').val() || 'System', resolvedBy: 'Pending', description: $('#ticketDescription').val(), remarks: $('#ticketRemarks').val() || 'N/A', status: 'Pending', priority: $('#ticketPriority').val(), expiryDate: new Date($('#ticketExpiryDate').val()).toLocaleString() };
        const allTickets = getTickets();
        allTickets.unshift(newTicket);
        localStorage.setItem(ticketsLocalStorageKey, JSON.stringify(allTickets));
        if (newTicket.description) {
            const firstMessage = { sender: newTicket.createdBy, text: newTicket.description, timestamp: newTicket.submissionTimestamp };
            saveTicketChatMessage(newTicket.id, firstMessage);
        }
        ticketsTable.clear().rows.add(getFilteredTickets()).draw();
        this.reset();
        $(this).removeClass('was-validated');
        newTicketModal.hide();
        alert('Support ticket submitted successfully!');
    });

    $('#supportTicketsDataTable tbody').on('click', '.start-ticket-popup-chat-btn', function () {
        openTicketChat($(this).data('ticket-id').toString(), $(this).data('ticket-subject'));
    });
});