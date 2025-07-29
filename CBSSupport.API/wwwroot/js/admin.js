"use strict";

document.addEventListener('DOMContentLoaded', () => {

    // --- STATE AND CONFIGURATION ---
    const adminUserIdentity = "CBS Support";
    let currentUserIdentity = adminUserIdentity;
    let currentChatContext = {};
    const teamMembers = [{ name: "CBS Support", initials: "S", avatarClass: "avatar-bg-green" }, { name: "Admin User", initials: "A", avatarClass: "avatar-bg-purple" }];
    const customerList = [{ name: "Alzeena Limbu", initials: "A", avatarClass: "avatar-bg-purple" }, { name: "Soniya Basnet", initials: "S", avatarClass: "avatar-bg-red" }, { name: "Ram Shah", initials: "R", avatarClass: "avatar-bg-blue" }, { name: "Namsang Limbu", initials: "N", avatarClass: "avatar-bg-red" }];
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
    const sendReplyBtn = document.getElementById('send-reply-btn');
    const replyTextarea = document.getElementById('reply-textarea');

    // --- LOCALSTORAGE & SIGNALR ---
    const ticketsLocalStorageKey = 'supportTickets';
    const getTickets = () => JSON.parse(localStorage.getItem(ticketsLocalStorageKey)) || [];
    const saveTickets = (allTickets) => localStorage.setItem(ticketsLocalStorageKey, JSON.stringify(allTickets));
    const getChatHistory = (id) => JSON.parse(localStorage.getItem(id)) || [];
    const saveMessageToHistory = (id, data) => localStorage.setItem(id, JSON.stringify([...getChatHistory(id), data]));
    const connection = new signalR.HubConnectionBuilder().withUrl("/chathub").withAutomaticReconnect().build();

    // --- HELPER FUNCTIONS ---
    const formatTimestamp = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const createBadge = (text, type) => `<span class="badge rounded-pill bg-${(type || 'secondary').toLowerCase()}">${text}</span>`;
    const formatDateTime = (isoString) => isoString ? new Date(isoString).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const generateGroupName = (u1, u2) => [u1, u2].sort().join('_');
    const getAvatarDetails = (userName) => teamMembers.find(u => u.name === userName) || customerList.find(u => u.name === userName) || { initials: userName.substring(0, 1).toUpperCase(), avatarClass: "avatar-bg-blue" };
    const scrollToBottom = (element) => { if (element) { element.scrollTop = element.scrollHeight; } };
    const updateSendButtonState = () => { if (sendButton) { sendButton.disabled = connection.state !== "Connected" || (messageInput && messageInput.value.trim() === ""); } };

    // --- PAGE INITIALIZERS ---
    const initializedPages = {};
    const pageInitializers = {
        dashboard: function () {
            // This function remains unchanged
            const tickets = getTickets();
            document.getElementById('stat-total-tickets').textContent = tickets.length > 0 ? tickets.length.toLocaleString() : '2,300';
            document.getElementById('stat-no-reply').textContent = tickets.filter(t => t.status === 'Pending' && t.assignedTo === 'Unassigned').length;
            const recentTicketsList = document.getElementById('recent-tickets-list');
            recentTicketsList.innerHTML = '';
            const mockRecentTickets = [
                { date: 'Feb 08, 2024', title: 'The More Important the Work,...', desc: 'Yo Reddit! What\'s a small thing tha...', status: 'Overdue', color: '#dc3545' },
                { date: 'Feb 11, 2024', title: 'Yo Reddit! What\'s a small thing that a...', desc: 'Any mechanical keyboard enthusiast...', status: 'Open', color: '#0d6efd' },
                { date: 'Feb 05, 2024', title: 'Understanding color theory: the c...', desc: 'Understanding color theory: the c...', status: 'Completed', color: '#198754' },
                { date: 'Feb 05, 2024', title: 'Any mechanical keyboard enthusiast...', desc: 'How to design a product that can...', status: 'Pending', color: '#ffc107' },
            ];
            mockRecentTickets.forEach(ticket => {
                const item = document.createElement('div');
                item.className = 'recent-ticket-item';
                item.innerHTML = `<div class="recent-ticket-info"><div class="date-bar" style="background-color: ${ticket.color};"></div><div><strong>${ticket.title}</strong><small>${ticket.desc}</small></div></div><span class="badge badge-${ticket.status.toLowerCase()}">${ticket.status}</span>`;
                recentTicketsList.appendChild(item);
            });
            const centerTextPlugin = { id: 'centerText', beforeDraw: (chart) => { if (!chart.options.plugins.centerText) return; const { ctx, width, height } = chart; ctx.restore(); const text = chart.options.plugins.centerText.text; const total = chart.options.plugins.centerText.total; ctx.font = "bold 24px sans-serif"; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; const textX = Math.round(width / 2); const textY = Math.round(height / 2); ctx.fillText(total, textX, textY); ctx.font = "14px sans-serif"; ctx.fillStyle = '#6c757d'; ctx.fillText(text, textX, textY - 25); ctx.save(); } };
            new Chart(document.getElementById('ticketReplyTimeChart').getContext('2d'), { type: 'line', data: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], datasets: [{ data: [1200, 1900, 1300, 1500, 1200, 1800, 1679], borderColor: '#2ecc71', backgroundColor: 'rgba(46, 204, 113, 0.1)', fill: true, tension: 0.4, pointRadius: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, display: false }, x: { display: false } } } });
            new Chart(document.getElementById('ticketPriorityChart').getContext('2d'), { type: 'doughnut', data: { labels: ['Email', 'Messenger', 'Live Chat', 'Contact Form'], datasets: [{ data: [600, 200, 300, 400], backgroundColor: ['#3498db', '#f1c40f', '#9b59b6', '#2ecc71'], borderWidth: 0, cutout: '70%' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, centerText: { text: 'Total active tickets', total: '1,500' } } }, plugins: [centerTextPlugin] });
            new Chart(document.getElementById('averageTicketsChart').getContext('2d'), { type: 'bar', data: { labels: ['Nov 20', 'Nov 21', 'Nov 22', 'Nov 23', 'Nov 24', 'Nov 25', 'Nov 26'], datasets: [{ label: 'Avg. Ticket Solved', data: [2154, 500, 1200, 1300, 300, 1100, 1570], backgroundColor: '#2ecc71', borderRadius: 4 }, { label: 'Avg. Ticket Created', data: [500, 1200, 600, 900, 1900, 800, 600], backgroundColor: 'rgba(46, 204, 113, 0.2)', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', align: 'start' } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true } } } });
            document.getElementById('view-all-tickets-link').addEventListener('click', (e) => { e.preventDefault(); document.querySelector('.nav-link[data-page="ticket-management"]').click(); });
        },
        chats: function () {
            // This function remains unchanged
            function displayChatMessage(messageData, isHistory) { const isSent = messageData.sender === currentUserIdentity; const avatar = getAvatarDetails(messageData.sender); const messageRow = document.createElement('div'); messageRow.className = 'message-row ' + (isSent ? 'sent' : 'received'); messageRow.innerHTML = `<div class="avatar-initials ${avatar.avatarClass}">${avatar.initials}</div><div class="message-content"><div class="message-sender">${messageData.sender}</div><div class="message-bubble"><p class="message-text">${messageData.message || ''}</p></div><div class="message-meta"><span class="message-timestamp">${formatTimestamp(messageData.timestamp)}</span></div></div>`; chatPanelBody.appendChild(messageRow); if (!isHistory) scrollToBottom(chatPanelBody); }
            async function switchChatContext(contextData) { currentChatContext = contextData; document.querySelectorAll('.conversation-item.active').forEach(el => el.classList.remove('active')); const activeItem = document.querySelector(`.conversation-item[data-id='${contextData.id}']`); if (activeItem) activeItem.classList.add('active'); const partnerName = contextData.name || "Public Group Chat"; const partnerAvatar = getAvatarDetails(partnerName); const chatType = contextData.type === 'group' ? 'Group Chat' : 'Private Chat'; chatHeader.innerHTML = `<div class="avatar-initials ${partnerAvatar.avatarClass}">${partnerAvatar.initials}</div><div><div class="fw-bold">${partnerName}</div><small class="text-muted">${chatType}</small></div>`; chatPanelBody.innerHTML = ''; getChatHistory(currentChatContext.id).forEach(msg => displayChatMessage(msg, true)); scrollToBottom(chatPanelBody); if (contextData.type === 'private') { await connection.invoke("JoinPrivateChat", contextData.id); } }
            async function sendChatMessage() { const message = messageInput.value.trim(); if (!message) return; const messageData = { sender: currentUserIdentity, message: message, timestamp: new Date().toISOString() }; saveMessageToHistory(currentChatContext.id, messageData); displayChatMessage(messageData, false); try { const method = currentChatContext.type === 'group' ? "SendPublicMessage" : "SendPrivateMessage"; const args = currentChatContext.type === 'group' ? [currentUserIdentity, message] : [currentChatContext.id, currentUserIdentity, message]; await connection.invoke(method, ...args); } catch (err) { console.error("Error sending message via SignalR:", err); } finally { messageInput.value = ""; updateSendButtonState(); } }
            function renderAdminConversationList() { conversationListContainer.innerHTML = ''; const createChatItem = (type, id, name, subtext) => { const avatar = getAvatarDetails(name); return `<a href="#" class="list-group-item list-group-item-action conversation-item" data-type="${type}" data-id="${id}" data-name="${name}"><div class="d-flex w-100 align-items-center"><div class="avatar-initials ${avatar.avatarClass} me-3">${avatar.initials}</div><div class="flex-grow-1"><div class="fw-bold">${name}</div><small class="text-muted">${subtext}</small></div></div></a>`; }; conversationListContainer.innerHTML += createChatItem('group', 'public', 'Public Group Chat', 'Group Chat'); customerList.forEach(user => { conversationListContainer.innerHTML += createChatItem('private', generateGroupName(adminUserIdentity, user.name), user.name, 'Client Chat'); }); teamMembers.filter(u => u.name !== adminUserIdentity).forEach(user => { conversationListContainer.innerHTML += createChatItem('private', generateGroupName(adminUserIdentity, user.name), user.name, 'Team Chat'); }); }
            renderAdminConversationList();
            const firstItem = conversationListContainer.querySelector('.conversation-item');
            if (firstItem) { switchChatContext(firstItem.dataset); }
            conversationListContainer.addEventListener('click', (e) => { const item = e.target.closest('.conversation-item'); if (item) { e.preventDefault(); switchChatContext(item.dataset); } });
            sendButton.addEventListener("click", sendChatMessage);
            messageInput.addEventListener("keyup", (e) => { updateSendButtonState(); if (e.key === "Enter") sendChatMessage(); });
            updateSendButtonState();
        },
        'ticket-management': function () {
            // This function remains unchanged
            let ticketsTable = ticketsTableElement.DataTable({
                data: getTickets(),
                columns: [{ data: 'id' }, { data: 'subject' }, { data: 'createdBy' }, { data: 'assignedTo', defaultContent: 'Unassigned' }, { data: 'status', render: (data) => createBadge(data, data) }, { data: 'priority', render: (data) => createBadge(data || 'Normal', data || 'Normal') }, { data: 'submissionTimestamp', render: formatDateTime }],
                order: [[6, 'desc']], pageLength: 10, lengthChange: true, searching: true, info: true, dom: "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>>" + "<'row'<'col-sm-12'tr>>" + "<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>"
            });

            function populateTicketDetails(ticketId) {
                const ticket = getTickets().find(t => t.id === ticketId);
                if (!ticket) { ticketDetailPlaceholder.style.display = 'flex'; ticketDetailContent.style.display = 'none'; return; }
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

                conversationView.innerHTML = '';
                let conversation = ticket.conversation ? [...ticket.conversation] : [];
                if (ticket.description) {
                    conversation.unshift({ sender: ticket.createdBy, text: ticket.description, timestamp: ticket.submissionTimestamp });
                }

                if (conversation.length > 0) {
                    conversation.forEach(msg => {
                        const isAgentReply = msg.sender === adminUserIdentity || agents.includes(msg.sender);
                        const messageClass = isAgentReply ? 'sent' : 'received';
                        conversationView.innerHTML += `
                            <div class="message-row ${messageClass}">
                                <div class="message-content">
                                    <div class="message-bubble">
                                        <p>${msg.text}</p>
                                    </div>
                                    <div class="message-timestamp">${msg.sender} - ${formatDateTime(msg.timestamp)}</div>
                                </div>
                            </div>`;
                    });
                } else {
                    conversationView.innerHTML = `<div class="p-3 text-muted">No conversation history for this ticket.</div>`;
                }
                scrollToBottom(conversationView);
            }

            function handleReply() {
                const ticketId = detailTicketId.textContent.replace('#', '');
                const text = replyTextarea.value.trim();
                if (!ticketId || !text) return;
                let allTickets = getTickets();
                const ticketIndex = allTickets.findIndex(t => t.id === ticketId);
                if (ticketIndex > -1) {
                    const ticket = allTickets[ticketIndex];
                    if (!ticket.conversation) ticket.conversation = [];
                    ticket.conversation.push({ sender: adminUserIdentity, text: text, timestamp: new Date().toISOString(), isNote: false });
                    ticket.lastUpdate = new Date().toISOString();
                    saveTickets(allTickets);
                    ticketsTable.row(ticketsTableElement.find('tbody tr.table-active')).data(ticket).draw(false);
                    populateTicketDetails(ticketId);
                    replyTextarea.value = '';
                }
            }

            ticketsTableElement.on('click', 'tbody tr', function () { ticketsTable.$('tr.table-active').removeClass('table-active'); $(this).addClass('table-active'); const data = ticketsTable.row(this).data(); if (data) populateTicketDetails(data.id); });
            sendReplyBtn.addEventListener('click', handleReply);
            $('#filter-status, #filter-priority, #filter-agent').on('change', function () { $.fn.dataTable.ext.search.pop(); $.fn.dataTable.ext.search.push(function (settings, data, dataIndex) { const rowData = getTickets()[dataIndex]; if (!rowData) return false; const statusMatch = ($('#filter-status').val() === "" || rowData.status === $('#filter-status').val()); const priorityMatch = ($('#filter-priority').val() === "" || (rowData.priority || 'Normal') === $('#filter-priority').val()); const agentMatch = ($('#filter-agent').val() === "" || (rowData.assignedTo || 'Unassigned') === $('#filter-agent').val()); return statusMatch && priorityMatch && agentMatch; }); ticketsTable.draw(); });
            $('#filter-status').append(statuses.map(s => `<option value="${s}">${s}</option>`));
            $('#filter-priority').append(priorities.map(p => `<option value="${p}">${p}</option>`));
            $('#filter-agent').append(agents.filter(a => a !== 'Unassigned').map(a => `<option value="${a}">${a}</option>`));
            const allTickets = getTickets(); if (allTickets.length > 0) { populateTicketDetails(allTickets[0].id); ticketsTableElement.find('tbody tr:eq(0)').addClass('table-active'); }
        },
        'inquiry-management': function () {
            const inquiryLocalStorageKey = 'clientInquiries';
            const getInquiries = () => JSON.parse(localStorage.getItem(inquiryLocalStorageKey)) || [];
            const saveInquiries = (allInquiries) => localStorage.setItem(inquiryLocalStorageKey, JSON.stringify(allInquiries));
            const getInquiryChatHistory = (id) => JSON.parse(localStorage.getItem(`inquiry-chat-${id}`)) || [];
            const saveInquiryChatHistory = (id, history) => localStorage.setItem(`inquiry-chat-${id}`, JSON.stringify(history));

            let currentActiveInquiryId = null;

            const inquiryChatContent = document.getElementById('inquiry-chat-content');
            const inquiryChatPlaceholder = document.getElementById('inquiry-chat-placeholder');
            const inquiryChatConversation = document.getElementById('inquiry-chat-conversation');
            const inquiryReplyTextarea = document.getElementById('inquiry-reply-textarea');
            const sendInquiryReplyBtn = document.getElementById('send-inquiry-reply-btn');
            const inquiryStatusFilter = document.getElementById('inquiry-status-filter');

            const generateInquiryStatusBadge = (outcome) => {
                return outcome === 'Completed'
                    ? `<span class="badge bg-success">Completed</span>`
                    : `<span class="badge bg-warning text-dark">Pending</span>`;
            };

            // --- FIX: Corrected filtering logic and added pagination ---
            $.fn.dataTable.ext.search.push(
                function (settings, data, dataIndex, rowData) {
                    if (settings.nTable.id !== 'inquiriesDataTable') {
                        return true;
                    }
                    const selectedStatus = inquiryStatusFilter.value;
                    if (selectedStatus === "") return true;

                    // Treat items with no outcome property or any outcome other than 'Completed' as 'Pending'
                    const rowOutcome = rowData.outcome === 'Completed' ? 'Completed' : 'Pending';

                    return selectedStatus === rowOutcome;
                }
            );

            let inquiriesTable = $('#inquiriesDataTable').DataTable({
                data: getInquiries(),
                columns: [
                    { data: 'id' }, { data: 'topic' }, { data: 'inquiredBy' },
                    { data: 'date', render: (d) => d ? new Date(d).toLocaleString() : 'N/A' },
                    { data: 'outcome', render: (d) => generateInquiryStatusBadge(d) },
                    {
                        data: null, orderable: false, searchable: false,
                        render: (data, type, row) => {
                            if ((row.outcome || 'Pending') !== 'Completed') {
                                return `<div class="form-check d-flex justify-content-center">
                                            <input class="form-check-input mark-completed-checkbox" type="checkbox" data-inquiry-id="${row.id}">
                                        </div>`;
                            }
                            return '<div class="text-center text-success"><i class="fas fa-check-circle"></i></div>';
                        }
                    }
                ],
                order: [[3, 'desc']],
                pageLength: 10,
                lengthMenu: [[10, 20, 50, 100, -1], ['10', '20', '50', '100', 'All']],
                dom: "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>>" + "<'row'<'col-sm-12'tr>>" + "<'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>"
            });

            function populateInquiryChat(inquiryId) {
                currentActiveInquiryId = inquiryId;
                inquiryChatPlaceholder.style.display = 'none';
                inquiryChatContent.style.display = 'flex';
                inquiryChatConversation.innerHTML = '';
                const chatHistory = getInquiryChatHistory(inquiryId);
                if (chatHistory.length > 0) {
                    chatHistory.forEach(msg => {
                        const isAgentReply = msg.sender === adminUserIdentity;
                        const messageClass = isAgentReply ? 'sent' : 'received';
                        inquiryChatConversation.innerHTML += `
                            <div class="message-row ${messageClass}">
                                <div class="message-content">
                                    <div class="message-bubble"><p>${msg.text}</p></div>
                                    <div class="message-timestamp">${msg.sender} - ${formatDateTime(msg.timestamp)}</div>
                                </div>
                            </div>`;
                    });
                } else {
                    inquiryChatConversation.innerHTML = `<div class="p-3 text-muted">No conversation history. Start the conversation!</div>`;
                }
                scrollToBottom(inquiryChatConversation);
            }

            function handleInquiryReply() {
                const text = inquiryReplyTextarea.value.trim();
                if (!text || !currentActiveInquiryId) return;
                const messageData = { sender: adminUserIdentity, text: text, timestamp: new Date().toISOString() };
                const history = getInquiryChatHistory(currentActiveInquiryId);
                history.push(messageData);
                saveInquiryChatHistory(currentActiveInquiryId, history);
                populateInquiryChat(currentActiveInquiryId);
                inquiryReplyTextarea.value = '';
            }

            function markAsCompleted(inquiryId) {
                let allInquiries = getInquiries();
                const inquiryIndex = allInquiries.findIndex(i => i.id === inquiryId);
                if (inquiryIndex > -1) {
                    allInquiries[inquiryIndex].outcome = 'Completed';
                    saveInquiries(allInquiries);
                    inquiriesTable.row(function (idx, data, node) {
                        return data.id === inquiryId;
                    }).data(allInquiries[inquiryIndex]).draw(); // Use .draw() to re-apply filters
                }
            }

            $('#inquiriesDataTable tbody').on('click', 'tr', function () {
                // Prevent row click from firing if the click was on the checkbox
                if ($(event.target).is('input.mark-completed-checkbox')) {
                    return;
                }
                inquiriesTable.$('tr.table-active').removeClass('table-active');
                $(this).addClass('table-active');
                const rowData = inquiriesTable.row(this).data();
                if (rowData) {
                    populateInquiryChat(rowData.id);
                }
            });

            $('#inquiriesDataTable tbody').on('change', '.mark-completed-checkbox', function () {
                const inquiryId = $(this).data('inquiry-id');
                if (confirm("DO YOU MARK THIS AS COMPLETED?")) {
                    markAsCompleted(inquiryId);
                } else {
                    $(this).prop('checked', false);
                }
            });

            inquiryStatusFilter.addEventListener('change', () => {
                inquiriesTable.draw();
            });

            sendInquiryReplyBtn.addEventListener('click', handleInquiryReply);
            inquiryReplyTextarea.addEventListener('keyup', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleInquiryReply();
                }
            });
        }
    };

    // --- MAIN INITIALIZATION & NAVIGATION ---
    function initializeAdminPanel() {
        $('.admin-sidebar .nav-link').on('click', function (e) {
            e.preventDefault();
            const pageName = $(this).data('page');
            $('.admin-sidebar .nav-link.active').removeClass('active');
            $(this).addClass('active');
            $('.admin-page.active').removeClass('active');
            $('#' + pageName + '-page').addClass('active');
            if (!initializedPages[pageName]) {
                if (pageInitializers[pageName]) {
                    pageInitializers[pageName]();
                    initializedPages[pageName] = true;
                }
            }
        });
        const initialPage = $('.admin-sidebar .nav-link.active').data('page');
        if (initialPage && pageInitializers[initialPage]) {
            pageInitializers[initialPage]();
            initializedPages[initialPage] = true;
        }
    }

    // --- REAL-TIME EVENT HANDLERS ---
    connection.on("ReceivePublicMessage", (messageId, sender, msg, time, initials) => { if (document.getElementById('chats-page').classList.contains('active')) { const data = { sender, message: msg, timestamp: new Date(time) }; saveMessageToHistory('public', data); if (currentChatContext.id === 'public') { displayChatMessage(data, false); } } });
    connection.on("ReceivePrivateMessage", (messageId, groupName, sender, msg, time, initials) => { if (document.getElementById('chats-page').classList.contains('active')) { const data = { sender, message: msg, timestamp: new Date(time) }; saveMessageToHistory(groupName, data); if (currentChatContext.id === groupName) { displayChatMessage(data, false); } } });
    connection.start().then(() => {
        console.log("SignalR Connected (Admin).");
        initializeAdminPanel();
    }).catch(err => console.error("SignalR Connection Error: ", err));
});