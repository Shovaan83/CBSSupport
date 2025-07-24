"use strict";

document.addEventListener('DOMContentLoaded', () => {

    // --- STATE AND CONFIGURATION ---
    const supportAgentIdentity = "CBS Support";
    let currentUserIdentity = supportAgentIdentity;
    let currentChatContext = {};

    // --- MOCK DATA ---
    const teamMembers = [
        { name: "CBS Support", initials: "S", avatarClass: "avatar-bg-green" },
        { name: "Admin User", initials: "A", avatarClass: "avatar-bg-purple" }
    ];
    const customerList = [
        { name: "Alzeena Limbu", initials: "A", avatarClass: "avatar-bg-purple" },
        { name: "Soniya Basnet", initials: "S", avatarClass: "avatar-bg-red" },
        { name: "Ram Shah", initials: "R", avatarClass: "avatar-bg-blue" },
        { name: "Namsang Limbu", initials: "N", avatarClass: "avatar-bg-red" }
    ];

    // --- DOM ELEMENT REFERENCES ---
    const roleSwitcher = document.getElementById("role-switcher");
    const conversationListContainer = document.getElementById("conversation-list-container");
    const messageInput = document.getElementById("message-input");
    const sendButton = document.getElementById("send-button");
    const chatPanelBody = document.getElementById("chat-panel-body");
    const chatHeader = document.getElementById("chat-header");

    // --- SIGNALR CONNECTION ---
    const connection = new signalR.HubConnectionBuilder().withUrl("/chathub").withAutomaticReconnect().build();

    // --- HELPER FUNCTIONS ---
    const formatTimestamp = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updateSendButtonState = () => sendButton.disabled = connection.state !== "Connected" || messageInput.value.trim() === "";
    const scrollToBottom = () => chatPanelBody.scrollTop = chatPanelBody.scrollHeight;
    const generateGroupName = (u1, u2) => [u1, u2].sort().join('_');
    const getAvatarDetails = (userName) => teamMembers.find(u => u.name === userName) || customerList.find(u => u.name === userName) || { initials: userName.substring(0, 1).toUpperCase(), avatarClass: "avatar-bg-blue" };

    // --- CHAT HISTORY ---
    const getChatHistory = (id) => JSON.parse(localStorage.getItem(id)) || [];
    const saveMessageToHistory = (id, data) => localStorage.setItem(id, JSON.stringify([...getChatHistory(id), data]));

    // --- UI RENDERING ---
    function displayMessage(messageData) {
        const isSent = messageData.sender === currentUserIdentity;
        const avatar = getAvatarDetails(messageData.sender);
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${isSent ? 'sent' : 'received'}`;
        messageRow.innerHTML = `
            <div class="avatar-initials ${avatar.avatarClass}">${avatar.initials}</div>
            <div class="message-content">
                <div class="message-header"><span class="message-sender">${messageData.sender}</span></div>
                <div class="message-bubble"><p class="message-text">${messageData.message}</p></div>
                <span class="message-timestamp">${formatTimestamp(messageData.timestamp)}</span>
            </div>`;
        chatPanelBody.appendChild(messageRow);
    }

    // MODIFIED: This is the new, refactored function to build the sidebar with accordions for admins
    function renderSidebar(role, isAdmin) {
        conversationListContainer.innerHTML = '';

        // Helper to create a single clickable chat item (which goes inside an accordion or stands alone)
        const createChatItem = (type, id, name, subtext, iconClass) => {
            const avatar = getAvatarDetails(name);
            return `
                <a href="#" class="list-group-item list-group-item-action conversation-item" data-type="${type}" data-id="${id}" data-name="${name}">
                    <div class="d-flex w-100 align-items-center">
                        <div class="avatar-initials ${avatar.avatarClass} me-3">${avatar.initials}</div>
                        <div class="flex-grow-1"><div class="fw-bold">${name}</div><small class="text-muted">${subtext}</small></div>
                        <div class="icon ms-2"><i class="fas ${iconClass}"></i></div>
                    </div>
                </a>`;
        };

        // All roles get a standalone Public Group Chat item at the top
        conversationListContainer.innerHTML += createChatItem('group', 'public', 'Public Group Chat', 'Group Chat', 'fa-users');

        if (isAdmin) {
            let accordionHtml = '<div class="accordion" id="sidebarAccordion">';

            // "Support" accordion is only for the main support agent
            if (role === supportAgentIdentity) {
                let customerItems = '';
                customerList.forEach(user => {
                    customerItems += createChatItem('private', generateGroupName(role, user.name), user.name, 'Private Chat', 'fa-headset');
                });
                accordionHtml += `
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="headingSupport">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSupport">Support</button>
                        </h2>
                        <div id="collapseSupport" class="accordion-collapse collapse" data-bs-parent="#sidebarAccordion">
                            <div class="list-group list-group-flush">${customerItems}</div>
                        </div>
                    </div>`;
            }

            // "Teams" accordion is for all staff members
            let teamItems = '';
            teamMembers.filter(u => u.name !== role).forEach(user => {
                teamItems += createChatItem('private', generateGroupName(role, user.name), user.name, 'Private Chat', 'fa-user-friends');
            });
            accordionHtml += `
                <div class="accordion-item">
                    <h2 class="accordion-header" id="headingTeams">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTeams">Teams</button>
                    </h2>
                    <div id="collapseTeams" class="accordion-collapse collapse" data-bs-parent="#sidebarAccordion">
                         <div class="list-group list-group-flush">${teamItems}</div>
                    </div>
                </div>`;

            accordionHtml += '</div>';
            conversationListContainer.innerHTML += accordionHtml;

        } else {
            // Customers get a simple standalone item for support chat
            conversationListContainer.innerHTML += createChatItem('private', generateGroupName(role, supportAgentIdentity), supportAgentIdentity, 'Private Chat', 'fa-headset');
        }
    }

    // --- CORE LOGIC ---
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
        getChatHistory(contextData.id).forEach(displayMessage);
        scrollToBottom();
        if (contextData.type === 'private') {
            await connection.invoke("JoinPrivateChat", contextData.id);
        }
    }

    async function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;
        try {
            const senderName = currentUserIdentity;
            const method = currentChatContext.type === 'group' ? "SendPublicMessage" : "SendPrivateMessage";
            const args = currentChatContext.type === 'group' ? [senderName, message] : [currentChatContext.id, senderName, message];
            await connection.invoke(method, ...args);
            messageInput.value = "";
            updateSendButtonState();
        } catch (err) { console.error("Error sending message:", err); }
    }

    function setViewForRole(role) {
        currentUserIdentity = role;
        const isAdmin = teamMembers.some(u => u.name === role);
        renderSidebar(role, isAdmin);
        const firstItem = conversationListContainer.querySelector('.conversation-item');
        if (firstItem) {
            switchChatContext(firstItem.dataset);
        }
    }

    // --- INITIALIZATION ---
    roleSwitcher.innerHTML = teamMembers.map(u => `<option value="${u.name}">Role: ${u.name}</option>`).join('') + customerList.map(u => `<option value="${u.name}">Role: ${u.name}</option>`).join('');
    roleSwitcher.addEventListener('change', (e) => setViewForRole(e.target.value));
    conversationListContainer.addEventListener('click', (e) => { const item = e.target.closest('.conversation-item'); if (item) { e.preventDefault(); switchChatContext(item.dataset); } });
    messageInput.addEventListener("keyup", (e) => { updateSendButtonState(); if (e.key === "Enter") sendButton.click(); });
    sendButton.addEventListener("click", sendMessage);

    connection.on("ReceivePublicMessage", (sender, msg, time, initials) => { const data = { sender, message: msg, timestamp: time, initials }; saveMessageToHistory('public', data); if (currentChatContext.id === 'public') { displayMessage(data); scrollToBottom(); } });
    connection.on("ReceivePrivateMessage", (group, sender, msg, time, initials) => { const data = { sender, message: msg, timestamp: time, initials }; saveMessageToHistory(group, data); if (currentChatContext.id === group) { displayMessage(data); scrollToBottom(); } });

    connection.start().then(() => { console.log("SignalR Connected."); setViewForRole(supportAgentIdentity); updateSendButtonState(); }).catch(err => console.error("SignalR Connection Error: ", err));

    // --- TICKET & INQUIRY SYSTEM LOGIC --- (This entire section is unchanged)
    const supportSubjects = [{ text: "TRAINING" }, { text: "MIGRATION" }, { text: "SETUPS" }, { text: "CORRECTION" }, { text: "BUGS FIX" }, { text: "NEW FEATURES" }, { text: "FEATURE ENCHANCEMENT" }, { text: "BACKEND WORKAROUND" }];
    const subjectDropdown = $('#ticketSubject'), editSubjectDropdown = $('#edit-ticketSubject');
    subjectDropdown.append('<option value="" disabled selected>Select a subject...</option>');
    supportSubjects.forEach(s => { const o = `<option value="${s.text}">${s.text}</option>`; subjectDropdown.append(o); editSubjectDropdown.append(o); });
    $('#inquiriesDataTable').DataTable({ "pageLength": 5, "lengthChange": false, "searching": true, "info": false, "language": { "search": "", "searchPlaceholder": "Search inquiries..." } });
    const ticketsLocalStorageKey = 'supportTickets', supportTicketForm = document.getElementById('supportTicketForm'), editTicketForm = document.getElementById('editTicketForm'), newTicketModal = new bootstrap.Modal(document.getElementById('newSupportTicketModal')), viewTicketModal = new bootstrap.Modal(document.getElementById('viewTicketDetailsModal'));
    const getTickets = () => JSON.parse(localStorage.getItem(ticketsLocalStorageKey)) || [], getFilteredTickets = () => getTickets().filter(t => t.status && t.status !== 'Open');
    const generateStatusBadge = s => { let b = 'bg-secondary', i = 'fa-question-circle'; if (s === 'Resolved') { b = 'bg-success'; i = 'fa-check-circle'; } else if (s === 'Pending') { b = 'bg-warning text-dark'; i = 'fa-hourglass-half'; } return `<span class="badge ${b}"><i class="fas ${i} me-1"></i>${s}</span>`; };
    const ticketsTable = $('#supportTicketsDataTable').DataTable({
        data: getFilteredTickets(),
        columns: [{ data: 'id', render: d => `#${d}` }, { data: 'subject' }, { data: 'submissionTimestamp', defaultContent: 'N/A' }, { data: 'createdBy' }, { data: 'resolvedBy' }, { data: 'status', render: generateStatusBadge }, { data: 'id', render: d => `<button class="btn btn-sm btn-info view-details-btn" data-ticket-id="${d}">View Details</button>`, orderable: false, searchable: false }],
        pageLength: 5, lengthChange: true, lengthMenu: [[5, 10, 20, -1], ['Show 5', 'Show 10', 'Show 20', 'Show All']], searching: true,
        order: [[2, 'desc']], language: { search: "", searchPlaceholder: "Search tickets...", emptyTable: "No support tickets found.", lengthMenu: "_MENU_" },
        dom: '<"row mb-3"<"col-sm-12 col-md-auto"l><"col-sm-12 col-md-auto ms-md-auto"f>>rtip'
    });
    $('#supportTicketsDataTable_filter input').before('<i class="fas fa-search search-icon"></i>');
    $('#inquiriesDataTable_filter input').before('<i class="fas fa-search search-icon"></i>');
    $(supportTicketForm).on('submit', function (e) { e.preventDefault(); if (!this.checkValidity()) { e.stopPropagation(); $(this).addClass('was-validated'); return; } const now = new Date(); const newTicket = { id: String(Date.now()).slice(-6), subject: $('#ticketSubject').val(), submissionTimestamp: now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), createdBy: $('#fullName').val() || 'System', resolvedBy: 'Pending', accountNumber: $('#accountNumber').val() || 'N/A', description: $('#ticketDescription').val(), remarks: $('#ticketRemarks').val() || 'N/A', status: 'Pending' }; const allTickets = getTickets(); allTickets.unshift(newTicket); localStorage.setItem(ticketsLocalStorageKey, JSON.stringify(allTickets)); ticketsTable.clear().rows.add(getFilteredTickets()).draw(); this.reset(); $(this).removeClass('was-validated'); newTicketModal.hide(); });
    const setViewModalMode = m => { if (m === 'edit') { $('#ticket-details-view').hide(); $('#editTicketForm').show(); $('#editTicketBtn, #closeModalBtn').hide(); $('#saveChangesBtn, #cancelEditBtn').show(); } else { $('#ticket-details-view').show(); $('#editTicketForm').hide(); $('#editTicketBtn, #closeModalBtn').show(); $('#saveChangesBtn, #cancelEditBtn').hide(); $('#editTicketForm').removeClass('was-validated'); } };
    $('#supportTicketsDataTable tbody').on('click', '.view-details-btn', function () { const ticketId = $(this).data('ticket-id').toString(), ticket = getTickets().find(t => t.id === ticketId); if (ticket) { $('#details-id').text(`#${ticket.id}`); $('#details-status').html(generateStatusBadge(ticket.status)); $('#details-subject').text(ticket.subject); $('#details-date').text(ticket.submissionTimestamp); $('#details-createdBy').text(ticket.createdBy); $('#details-account').text(ticket.accountNumber); $('#details-resolvedBy').text(ticket.resolvedBy); $('#details-description').text(ticket.description); $('#details-remarks').text(ticket.remarks || 'N/A'); $('#edit-ticketId').val(ticket.id); $('#edit-fullName').val(ticket.createdBy); $('#edit-accountNumber').val(ticket.accountNumber); $('#edit-ticketSubject').val(ticket.subject); $('#edit-ticketDescription').val(ticket.description); $('#edit-ticketRemarks').val(ticket.remarks); setViewModalMode('view'); viewTicketModal.show(); } });
    $('#editTicketBtn').on('click', () => setViewModalMode('edit'));
    $('#cancelEditBtn').on('click', () => setViewModalMode('view'));
    $(editTicketForm).on('submit', function (e) { e.preventDefault(); if (!this.checkValidity()) { e.stopPropagation(); $(this).addClass('was-validated'); return; } const ticketId = $('#edit-ticketId').val(), allTickets = getTickets(), ticketIndex = allTickets.findIndex(t => t.id === ticketId); if (ticketIndex > -1) { const now = new Date(), updatedTimestamp = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); allTickets[ticketIndex].createdBy = $('#edit-fullName').val(); allTickets[ticketIndex].accountNumber = $('#edit-accountNumber').val(); allTickets[ticketIndex].subject = $('#edit-ticketSubject').val(); allTickets[ticketIndex].description = $('#edit-ticketDescription').val(); allTickets[ticketIndex].remarks = $('#edit-ticketRemarks').val() || 'N/A'; allTickets[ticketIndex].submissionTimestamp = updatedTimestamp; localStorage.setItem(ticketsLocalStorageKey, JSON.stringify(allTickets)); ticketsTable.clear().rows.add(getFilteredTickets()).draw(); $('#details-date').text(allTickets[ticketIndex].submissionTimestamp); $('#details-subject').text(allTickets[ticketIndex].subject); $('#details-createdBy').text(allTickets[ticketIndex].createdBy); $('#details-account').text(allTickets[ticketIndex].accountNumber); $('#details-description').text(allTickets[ticketIndex].description); $('#details-remarks').text(allTickets[ticketIndex].remarks); } setViewModalMode('view'); });
});