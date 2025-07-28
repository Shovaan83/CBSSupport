"use strict";

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE AND CONFIGURATION ---
    const adminUserIdentity = "CBS Support";
    let currentUserIdentity = adminUserIdentity;
    let currentChatContext = {};
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
    const inquiryList = [
        { id: "#INQ-345", topic: "Pricing for Enterprise Plan", inquiredBy: "Ram Shah", date: "2024-09-05 10:42 AM", outcome: "Info Sent" },
        { id: "#INQ-340", topic: "API Access Question", inquiredBy: "Admin User", date: "2024-08-22 03:15 PM", outcome: "Info Sent" }
    ];
    const agents = ["John Doe", "Jane Smith", "Unassigned"];
    const statuses = ["Pending", "On Hold", "Resolved"];
    const priorities = ["Low", "Normal", "High"];

    // --- DOM ELEMENT REFERENCES ---
    const conversationListContainer = document.getElementById("conversation-list-container");
    const messageInput = document.getElementById("message-input");
    const sendButton = document.getElementById("send-button");
    const chatPanelBody = document.getElementById("chat-panel-body");
    const chatHeader = document.getElementById("chat-header");
    const ticketsTableElement = $('#ticketsTable');
    const detailTicketId = document.getElementById('detail-ticket-id');
    const detailTicketSubject = document.getElementById('detail-ticket-subject');
    const detailStatus = document.getElementById('detail-status');
    const detailPriority = document.getElementById('detail-priority');
    const detailAssignee = document.getElementById('detail-assignee');
    const detailCreatedBy = document.getElementById('detail-createdby');
    const conversationView = document.getElementById('ticket-conversation-view');
    const ticketDetailContent = document.getElementById('ticket-detail-content');
    const ticketDetailPlaceholder = document.getElementById('ticket-detail-placeholder');

    // --- LOCALSTORAGE & SIGNALR ---
    const ticketsLocalStorageKey = 'supportTickets';
    const getTickets = () => JSON.parse(localStorage.getItem(ticketsLocalStorageKey)) || [];
    const getChatHistory = (id) => JSON.parse(localStorage.getItem(id)) || [];
    const connection = new signalR.HubConnectionBuilder().withUrl("/chathub").withAutomaticReconnect().build();

    // --- HELPER FUNCTIONS ---
    const formatTimestamp = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const createBadge = (text, type) => `<span class="badge rounded-pill bg-${(type || 'secondary').toLowerCase()}">${text}</span>`;
    const formatDateTime = (isoString) => isoString ? new Date(isoString).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const generateGroupName = (u1, u2) => [u1, u2].sort().join('_');
    const getAvatarDetails = (userName) => teamMembers.find(u => u.name === userName) || customerList.find(u => u.name === userName) || { initials: userName.substring(0, 1).toUpperCase(), avatarClass: "avatar-bg-blue" };
    const scrollToBottom = () => chatPanelBody.scrollTop = chatPanelBody.scrollHeight;

    // --- PAGE NAVIGATION ---
    function setupAdminNavigation() {
        $('.admin-sidebar .nav-link').on('click', function (e) {
            e.preventDefault();
            $('.admin-sidebar .nav-link.active').removeClass('active');
            $(this).addClass('active');
            const pageId = $(this).data('page') + '-page';
            $('.admin-page.active').removeClass('active');
            $('#' + pageId).addClass('active');
        });
    }

    // --- CHATS PAGE LOGIC ---
    function initializeChatsPage() {
        let displayChatMessage, switchChatContext, sendChatMessage, renderAdminConversationList;

        displayChatMessage = function (messageData, isHistory) {
            const isSent = messageData.sender === currentUserIdentity;
            const avatar = getAvatarDetails(messageData.sender);
            const messageRow = document.createElement('div');
            messageRow.className = 'message-row ' + (isSent ? 'sent' : 'received');
            messageRow.innerHTML = `
                <div class="avatar-initials ${avatar.avatarClass}">${avatar.initials}</div>
                <div class="message-content">
                    <div class="message-sender">${messageData.sender}</div>
                    <div class="message-bubble"><p class="message-text">${messageData.message || ''}</p></div>
                    <div class="message-meta"><span class="message-timestamp">${formatTimestamp(messageData.timestamp)}</span></div>
                </div>`;
            chatPanelBody.appendChild(messageRow);
            if (!isHistory) scrollToBottom();
        };

        switchChatContext = async function (contextData) {
            currentChatContext = contextData;
            document.querySelectorAll('.conversation-item.active').forEach(el => el.classList.remove('active'));
            const activeItem = document.querySelector(`.conversation-item[data-id='${contextData.id}']`);
            if (activeItem) activeItem.classList.add('active');
            const partnerName = contextData.name || "Public Group Chat";
            const partnerAvatar = getAvatarDetails(partnerName);
            const chatType = contextData.type === 'group' ? 'Group Chat' : 'Private Chat';
            chatHeader.innerHTML = `
                <div class="avatar-initials ${partnerAvatar.avatarClass}">${partnerAvatar.initials}</div>
                <div>
                    <div class="fw-bold">${partnerName}</div>
                    <small class="text-muted">${chatType}</small>
                </div>`;
            chatPanelBody.innerHTML = '';
            getChatHistory(currentChatContext.id).forEach(msg => displayChatMessage(msg, true));
            scrollToBottom();
            if (contextData.type === 'private') {
                await connection.invoke("JoinPrivateChat", contextData.id);
            }
        };

        sendChatMessage = async function () {
            const message = messageInput.value.trim();
            if (!message) return;
            try {
                const method = currentChatContext.type === 'group' ? "SendPublicMessage" : "SendPrivateMessage";
                const args = currentChatContext.type === 'group' ? [currentUserIdentity, message] : [currentChatContext.id, currentUserIdentity, message];
                await connection.invoke(method, ...args);
                messageInput.value = "";
            } catch (err) {
                console.error("Error sending message:", err);
            }
        };

        renderAdminConversationList = function () {
            conversationListContainer.innerHTML = '';
            const createChatItem = (type, id, name, subtext) => {
                const avatar = getAvatarDetails(name);
                return `
                    <a href="#" class="list-group-item list-group-item-action conversation-item" data-type="${type}" data-id="${id}" data-name="${name}">
                        <div class="d-flex w-100 align-items-center">
                            <div class="avatar-initials ${avatar.avatarClass} me-3">${avatar.initials}</div>
                            <div class="flex-grow-1">
                                <div class="fw-bold">${name}</div>
                                <small class="text-muted">${subtext}</small>
                            </div>
                        </div>
                    </a>`;
            };
            conversationListContainer.innerHTML += createChatItem('group', 'public', 'Public Group Chat', 'Group Chat');
            customerList.forEach(user => {
                conversationListContainer.innerHTML += createChatItem('private', generateGroupName(adminUserIdentity, user.name), user.name, 'Client Chat');
            });
            teamMembers.filter(u => u.name !== adminUserIdentity).forEach(user => {
                conversationListContainer.innerHTML += createChatItem('private', generateGroupName(adminUserIdentity, user.name), user.name, 'Team Chat');
            });
        };

        renderAdminConversationList();
        const firstItem = conversationListContainer.querySelector('.conversation-item');
        if (firstItem) { switchChatContext(firstItem.dataset); }
        conversationListContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.conversation-item');
            if (item) {
                e.preventDefault();
                switchChatContext(item.dataset);
            }
        });
        sendButton.addEventListener("click", sendChatMessage);
        messageInput.addEventListener("keyup", (e) => {
            if (e.key === "Enter") sendChatMessage();
        });
    }

    // --- TICKET MANAGEMENT PAGE LOGIC ---
    function initializeTicketManagementPage() {
        let ticketsTable = ticketsTableElement.DataTable({
            data: getTickets(),
            columns: [
                { data: 'id' },
                { data: 'subject' },
                { data: 'createdBy' },
                { data: 'assignedTo', defaultContent: 'Unassigned' },
                { data: 'status', render: (data) => createBadge(data, data) },
                { data: 'priority', render: (data) => createBadge(data || 'Normal', data || 'Normal') },
                { data: 'submissionTimestamp', render: formatDateTime }
            ],
            order: [[6, 'desc']],
            pageLength: 10,
            lengthChange: true,
            searching: true,
            info: true,
            dom: "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>>" +
                "<'row'<'col-sm-12'tr>>" +
                "<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>"
        });

        function populateTicketDetails(ticketId) {
            const ticket = getTickets().find(t => t.id === ticketId);
            if (!ticket) {
                ticketDetailPlaceholder.style.display = 'flex';
                ticketDetailContent.style.display = 'none';
                return;
            }
            ticketDetailPlaceholder.style.display = 'none';
            ticketDetailContent.style.display = 'flex';
            ticketDetailContent.style.flexDirection = 'column';
            ticketDetailContent.style.height = '100%';
            detailTicketId.textContent = `#${ticket.id}`;
            detailTicketSubject.textContent = ticket.subject;
            detailCreatedBy.value = ticket.createdBy;
            detailStatus.innerHTML = statuses.map(s => `<option value="${s}" ${s === ticket.status ? 'selected' : ''}>${s}</option>`).join('');
            detailPriority.innerHTML = priorities.map(p => `<option value="${p}" ${p === (ticket.priority || 'Normal') ? 'selected' : ''}>${p}</option>`).join('');
            detailAssignee.innerHTML = agents.map(a => `<option value="${a}" ${a === (ticket.assignedTo || 'Unassigned') ? 'selected' : ''}>${a}</option>`).join('');
            conversationView.innerHTML = `<div class="p-3 text-muted">Conversation view for ticket #${ticket.id}</div>`;
        }

        ticketsTableElement.on('click', 'tbody tr', function () {
            ticketsTable.$('tr.table-active').removeClass('table-active');
            $(this).addClass('table-active');
            const data = ticketsTable.row(this).data();
            if (data) populateTicketDetails(data.id);
        });

        $('#filter-status, #filter-priority, #filter-agent').on('change', function () {
            const statusFilter = $('#filter-status').val();
            const priorityFilter = $('#filter-priority').val();
            const agentFilter = $('#filter-agent').val();

            ticketsTable.column(4).search(statusFilter ? '^' + statusFilter + '$' : '', true, false);
            ticketsTable.column(5).search(priorityFilter ? '^' + priorityFilter + '$' : '', true, false);
            ticketsTable.column(3).search(agentFilter ? '^' + agentFilter + '$' : '', true, false);

            ticketsTable.draw();
        });

        $('#filter-status').append(statuses.map(s => `<option value="${s}">${s}</option>`));
        $('#filter-priority').append(priorities.map(p => `<option value="${p}">${p}</option>`));
        $('#filter-agent').append(agents.filter(a => a !== 'Unassigned').map(a => `<option value="${a}">${a}</option>`));

        const allTickets = getTickets();
        if (allTickets.length > 0) {
            populateTicketDetails(allTickets[0].id);
            ticketsTableElement.find('tbody tr:eq(0)').addClass('table-active');
        }
    }

    // --- ENQUIRY MANAGEMENT PAGE LOGIC ---
    function initializeEnquiryManagementPage() {
        $('#inquiriesDataTable').DataTable({
            data: inquiryList,
            columns: [
                { data: 'id' },
                { data: 'topic' },
                { data: 'inquiredBy' },
                { data: 'date' },
                { data: 'outcome', render: o => `<span class="badge bg-info">${o}</span>` }
            ],
            pageLength: 10,
            lengthChange: true,
            searching: true,
            info: true,
            dom: "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>>" +
                "<'row'<'col-sm-12'tr>>" +
                "<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>"
        });
    }

    // --- MAIN INITIALIZATION & SIGNALR ---
    function initializeAdminPanel() {
        setupAdminNavigation();
        initializeChatsPage();
        initializeTicketManagementPage();
        initializeEnquiryManagementPage();
    }

    connection.on("ReceivePublicMessage", (messageId, sender, msg, time, initials) => {
        const data = { id: messageId, sender, message: msg, timestamp: time, initials };
        if (currentChatContext.id === 'public') { displayChatMessage(data, false); }
    });

    connection.on("ReceivePrivateMessage", (messageId, groupName, sender, msg, time, initials) => {
        const data = { id: messageId, sender, message: msg, timestamp: time, initials };
        if (currentChatContext.id === groupName) { displayChatMessage(data, false); }
    });

    connection.start().then(() => {
        console.log("SignalR Connected (Admin).");
        initializeAdminPanel();
    }).catch(err => console.error("SignalR Connection Error: ", err));
});