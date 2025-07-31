"use strict";

document.addEventListener('DOMContentLoaded', () => {

    // --- STATE AND CONFIGURATION ---
    const adminUserIdentity = "CBS Support";
    let currentUserIdentity = adminUserIdentity;
    let currentChatContext = {};
    const teamMembers = [{ name: "CBS Support", initials: "S", avatarClass: "avatar-bg-green" }, { name: "Admin User", initials: "A", avatarClass: "avatar-bg-purple" }];
    const customerList = [{ name: "Alzeena Limbu", initials: "A", avatarClass: "avatar-bg-purple" }, { name: "Soniya Basnet", initials: "S", avatarClass: "avatar-bg-red" }, { name: "Ram Shah", initials: "R", avatarClass: "avatar-bg-blue" }, { name: "Namsang Limbu", initials: "N", avatarClass: "avatar-bg-red" }];

    // MODIFICATION: Updated the list of agent names as requested.
    const agents = ["Sijal", "Shovan", "Alzeena", "Samana", "Darshan", "Anuj", "Avay", "Nikesh", "Salina", "Safal", "Imon", "Bigya", "Unassigned"];

    const statuses = ["Pending", "On Hold", "Resolved"];
    const priorities = ["Low", "Normal", "High", "Urgent"];

    // --- DOM ELEMENT REFERENCES ---
    const floatingChatContainer = document.getElementById('floating-chat-container');
    const assignInquiryModal = new bootstrap.Modal(document.getElementById('assignInquiryModal'));
    const confirmInquiryAssignBtn = document.getElementById('confirmInquiryAssignBtn');

    // --- LOCALSTORAGE & HELPERS ---
    const formatDateTime = (isoString) => isoString ? new Date(isoString).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const scrollToBottom = (element) => { if (element) { element.scrollTop = element.scrollHeight; } };
    const getAvatarDetails = (userName) => teamMembers.find(u => u.name === userName) || customerList.find(u => u.name === userName) || { initials: userName.substring(0, 1).toUpperCase(), avatarClass: "avatar-bg-blue" };

    const ticketsLocalStorageKey = 'supportTickets';
    const getTickets = () => JSON.parse(localStorage.getItem(ticketsLocalStorageKey)) || [];
    const getTicketChatHistory = (ticketId) => JSON.parse(localStorage.getItem(`ticket-chat-${ticketId}`)) || [];
    const saveTicketChatMessage = (ticketId, messageData) => {
        const history = getTicketChatHistory(ticketId);
        history.push(messageData);
        localStorage.setItem(`ticket-chat-${ticketId}`, JSON.stringify(history));
    };

    const inquiryLocalStorageKey = 'clientInquiries';
    const getInquiries = () => JSON.parse(localStorage.getItem(inquiryLocalStorageKey)) || [];
    const saveInquiries = (allInquiries) => localStorage.setItem(inquiryLocalStorageKey, JSON.stringify(allInquiries));
    const getInquiryChatHistory = (id) => JSON.parse(localStorage.getItem(`inquiry-chat-${id}`)) || [];
    const saveInquiryChatMessage = (id, messageData) => {
        const history = getInquiryChatHistory(id);
        history.push(messageData);
        localStorage.setItem(`inquiry-chat-${id}`, JSON.stringify(history));
    };

    // --- REFACTORED CHAT HELPERS (FIX FOR FLOATING CHAT) ---
    function renderTicketChatMessages(ticketId, container) {
        const history = getTicketChatHistory(ticketId);
        container.innerHTML = '';
        if (history.length > 0) {
            history.forEach(msg => {
                const isAgentReply = agents.includes(msg.sender) || teamMembers.some(tm => tm.name === msg.sender);
                const messageClass = isAgentReply ? 'sent' : 'received';
                container.innerHTML += `<div class="message-row ${messageClass}"><div class="message-content"><div class="message-bubble"><p class="message-text">${msg.text}</p></div><span class="message-timestamp">${msg.sender} - ${formatDateTime(msg.timestamp)}</span></div></div>`;
            });
        } else {
            container.innerHTML = `<p class="text-muted text-center small p-3">No messages yet. Start the conversation!</p>`;
        }
        scrollToBottom(container);
    }

    function renderInquiryChatMessages(inquiryId, container) {
        container.innerHTML = '';
        const history = getInquiryChatHistory(inquiryId);
        if (history.length > 0) {
            history.forEach(msg => {
                const isAgentReply = agents.includes(msg.sender) || teamMembers.some(tm => tm.name === msg.sender);
                const messageClass = isAgentReply ? 'sent' : 'received';
                container.innerHTML += `<div class="message-row ${messageClass}"><div class="message-content"><div class="message-bubble"><p class="message-text">${msg.text}</p></div><span class="message-timestamp">${msg.sender} - ${formatDateTime(msg.timestamp)}</span></div></div>`;
            });
        } else {
            container.innerHTML = `<p class="text-muted text-center small p-3">No messages yet. Start the conversation!</p>`;
        }
        scrollToBottom(container);
    }

    // --- PAGE INITIALIZERS ---
    const initializedPages = {};
    const pageInitializers = {
        dashboard: function () {
            // Unchanged dashboard logic...
            const tickets = getTickets();
            document.getElementById('stat-total-tickets').textContent = tickets.length > 0 ? tickets.length.toLocaleString() : '2,300';
            document.getElementById('stat-no-reply').textContent = tickets.filter(t => t.status === 'Pending' && t.assignedTo === 'Unassigned').length;
            const recentTicketsList = document.getElementById('recent-tickets-list'); recentTicketsList.innerHTML = '';
            const mockRecentTickets = [{ date: 'Feb 08, 2024', title: 'The More Important the Work,...', desc: 'Yo Reddit! What\'s a small thing tha...', status: 'Overdue', color: '#dc3545' }, { date: 'Feb 11, 2024', title: 'Yo Reddit! What\'s a small thing that a...', desc: 'Any mechanical keyboard enthusiast...', status: 'Open', color: '#0d6efd' }, { date: 'Feb 05, 2024', title: 'Understanding color theory: the c...', desc: 'Understanding color theory: the c...', status: 'Completed', color: '#198754' }, { date: 'Feb 05, 2024', title: 'Any mechanical keyboard enthusiast...', desc: 'How to design a product that can...', status: 'Pending', color: '#ffc107' },];
            mockRecentTickets.forEach(ticket => { const item = document.createElement('div'); item.className = 'recent-ticket-item'; item.innerHTML = `<div class="recent-ticket-info"><div class="date-bar" style="background-color: ${ticket.color};"></div><div><strong>${ticket.title}</strong><small>${ticket.desc}</small></div></div><span class="badge badge-${ticket.status.toLowerCase()}">${ticket.status}</span>`; recentTicketsList.appendChild(item); });
            const centerTextPlugin = { id: 'centerText', beforeDraw: (chart) => { if (!chart.options.plugins.centerText) return; const { ctx, width, height } = chart; ctx.restore(); const text = chart.options.plugins.centerText.text; const total = chart.options.plugins.centerText.total; ctx.font = "bold 24px sans-serif"; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; const textX = Math.round(width / 2); const textY = Math.round(height / 2); ctx.fillText(total, textX, textY); ctx.font = "14px sans-serif"; ctx.fillStyle = '#6c757d'; ctx.fillText(text, textX, textY - 25); ctx.save(); } };
            new Chart(document.getElementById('ticketReplyTimeChart').getContext('2d'), { type: 'line', data: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], datasets: [{ data: [1200, 1900, 1300, 1500, 1200, 1800, 1679], borderColor: '#2ecc71', backgroundColor: 'rgba(46, 204, 113, 0.1)', fill: true, tension: 0.4, pointRadius: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, display: false }, x: { display: false } } } });
            new Chart(document.getElementById('ticketPriorityChart').getContext('2d'), { type: 'doughnut', data: { labels: ['Email', 'Messenger', 'Live Chat', 'Contact Form'], datasets: [{ data: [600, 200, 300, 400], backgroundColor: ['#3498db', '#f1c40f', '#9b59b6', '#2ecc71'], borderWidth: 0, cutout: '70%' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, centerText: { text: 'Total active tickets', total: '1,500' } } }, plugins: [centerTextPlugin] });
            new Chart(document.getElementById('averageTicketsChart').getContext('2d'), { type: 'bar', data: { labels: ['Nov 20', 'Nov 21', 'Nov 22', 'Nov 23', 'Nov 24', 'Nov 25', 'Nov 26'], datasets: [{ label: 'Avg. Ticket Solved', data: [2154, 500, 1200, 1300, 300, 1100, 1570], backgroundColor: '#2ecc71', borderRadius: 4 }, { label: 'Avg. Ticket Created', data: [500, 1200, 600, 900, 1900, 800, 600], backgroundColor: 'rgba(46, 204, 113, 0.2)', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', align: 'start' } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true } } } });
            document.getElementById('view-all-tickets-link').addEventListener('click', (e) => { e.preventDefault(); document.querySelector('.nav-link[data-page="ticket-management"]').click(); });
        },
        chats: function () {
            // Unchanged chat page logic
        },
        'ticket-management': function () {
            const ticketsTableElement = $('#ticketsTable');
            const detailTicketId = document.getElementById('detail-ticket-id');
            const detailTicketSubjectContainer = document.getElementById('detail-ticket-subject-container');
            const detailTicketStatusBadge = document.getElementById('detail-ticket-status-badge');
            const detailPriority = document.getElementById('detail-priority');
            const detailAssignee = document.getElementById('detail-assignee');
            const detailCreatedBy = document.getElementById('detail-createdby');
            const ticketDetailContent = document.getElementById('ticket-detail-content');
            const ticketDetailPlaceholder = document.getElementById('ticket-detail-placeholder');

            const generateTicketStatusBadge = (status) => { status = status || 'Pending'; let badgeClass = 'bg-warning text-dark'; if (status === 'Resolved') badgeClass = 'bg-success'; if (status === 'On Hold') badgeClass = 'bg-secondary'; return `<span class="badge ${badgeClass}">${status}</span>`; };
            const generateTicketPriorityBadge = (priority) => { priority = priority || 'Normal'; let badgeClass = 'bg-success'; if (priority === 'High') badgeClass = 'bg-warning text-dark'; if (priority === 'Urgent') badgeClass = 'bg-danger'; if (priority === 'Low') badgeClass = 'bg-primary'; return `<span class="badge ${badgeClass}">${priority}</span>`; };

            let ticketsTable = ticketsTableElement.DataTable({
                data: getTickets(),
                columns: [
                    { data: 'id' }, { data: 'subject' }, { data: 'createdBy' },
                    { data: 'assignedTo', defaultContent: 'Unassigned' },
                    { data: 'status', render: (d) => generateTicketStatusBadge(d) },
                    { data: 'priority', render: (d) => generateTicketPriorityBadge(d) },
                    {
                        data: null, orderable: false, searchable: false,
                        render: (data, type, row) => {
                            const chatButton = `<button class="btn btn-sm btn-primary start-ticket-chat-btn" data-ticket-id="${row.id}"><i class="fas fa-comments"></i></button>`;
                            let actionControl = (row.status || 'Pending') !== 'Resolved'
                                ? `<div class="form-check d-flex justify-content-center"><input class="form-check-input mark-resolved-checkbox" type="checkbox" data-ticket-id="${row.id}" title="Mark as Resolved"></div>`
                                : `<div class="text-center text-success" title="Resolved"><i class="fas fa-check-circle"></i></div>`;
                            return `<div class="d-flex justify-content-center align-items-center gap-2">${actionControl}${chatButton}</div>`;
                        }
                    }
                ],
                order: [[0, 'desc']], pageLength: 10,
            });

            function populateTicketDetails(ticketId) {
                const ticket = getTickets().find(t => t.id === ticketId);
                if (!ticket) { ticketDetailPlaceholder.style.display = 'flex'; ticketDetailContent.style.display = 'none'; return; }
                ticketDetailPlaceholder.style.display = 'none';
                ticketDetailContent.style.display = 'flex';
                detailTicketId.textContent = `#${ticket.id}`;
                detailTicketSubjectContainer.textContent = ticket.subject;
                detailCreatedBy.value = ticket.createdBy;
                detailTicketStatusBadge.innerHTML = generateTicketStatusBadge(ticket.status);
                detailPriority.innerHTML = priorities.map(p => `<option value="${p}" ${p === (ticket.priority || 'Normal') ? 'selected' : ''}>${p}</option>`).join('');
                detailAssignee.innerHTML = agents.map(a => `<option value="${a}" ${a === (ticket.assignedTo || 'Unassigned') ? 'selected' : ''}>${a}</option>`).join('');
            }
            function markTicketAsResolved(ticketId) {
                let allTickets = getTickets();
                const ticketIndex = allTickets.findIndex(t => t.id === ticketId);
                if (ticketIndex > -1) {
                    allTickets[ticketIndex].status = 'Resolved';
                    localStorage.setItem(ticketsLocalStorageKey, JSON.stringify(allTickets));
                    ticketsTable.row(function (idx, data, node) { return data.id === ticketId; }).data(allTickets[ticketIndex]).draw();
                    const currentDetailId = detailTicketId.textContent.replace('#', '');
                    if (currentDetailId === ticketId) { populateTicketDetails(ticketId); }
                }
            }

            function openTicketChatBox(ticket) {
                const chatBoxId = `chatbox-tkt-${ticket.id}`;
                const existingChatBox = document.getElementById(chatBoxId);
                if (existingChatBox) { existingChatBox.classList.remove('collapsed'); existingChatBox.querySelector('textarea').focus(); return; }
                const chatBox = document.createElement('div');
                chatBox.className = 'floating-chat-box';
                chatBox.id = chatBoxId;
                chatBox.innerHTML = `
                    <div class="chat-box-header"><span class="chat-box-title">#${ticket.id} - ${ticket.createdBy}</span><div class="chat-box-actions"><button class="action-minimize" title="Minimize"><i class="fas fa-minus"></i></button><button class="action-close" title="Close"><i class="fas fa-times"></i></button></div></div>
                    <div class="chat-box-body"></div>
                    <div class="chat-box-footer"><textarea class="form-control" rows="1" placeholder="Type your reply..."></textarea><button class="btn btn-primary action-send" title="Send"><i class="fas fa-paper-plane"></i></button></div>`;
                floatingChatContainer.appendChild(chatBox);
                renderTicketChatMessages(ticket.id, chatBox.querySelector('.chat-box-body'));
            }

            ticketsTableElement.on('click', 'tbody tr', function (e) {
                if ($(e.target).closest('button, .form-check-input').length) return;
                ticketsTable.$('tr.table-active').removeClass('table-active');
                $(this).addClass('table-active');
                const data = ticketsTable.row(this).data();
                if (data) populateTicketDetails(data.id);
            });
            ticketsTableElement.on('change', '.mark-resolved-checkbox', function () {
                const ticketId = $(this).data('ticket-id').toString();
                if (confirm("DO YOU MARK THIS TICKET AS RESOLVED?")) { markTicketAsResolved(ticketId); } else { $(this).prop('checked', false); }
            });
            ticketsTableElement.on('click', '.start-ticket-chat-btn', function (e) {
                e.stopPropagation();
                const ticketId = $(this).data('ticket-id').toString();
                const ticket = getTickets().find(t => t.id === ticketId);
                if (ticket) openTicketChatBox(ticket);
            });

            const allTickets = getTickets(); if (allTickets.length > 0) { populateTicketDetails(allTickets[0].id); ticketsTableElement.find('tbody tr:eq(0)').addClass('table-active'); }
        },
        'inquiry-management': function () {
            let inquiriesTable = null;
            let inquiryToUpdate = {};

            const inquiryDetailContent = document.getElementById('inquiry-detail-content');
            const inquiryDetailPlaceholder = document.getElementById('inquiry-detail-placeholder');
            const detailInquiryId = document.getElementById('detail-inquiry-id');
            const detailInquiryTopicContainer = document.getElementById('detail-inquiry-topic-container');
            const detailInquiryOutcomeBadge = document.getElementById('detail-inquiry-outcome-badge');
            const detailInquiryAssignee = document.getElementById('detail-inquiry-assignee');
            const detailInquiryCreatedBy = document.getElementById('detail-inquiry-createdby');
            const inquiryStatusFilter = document.getElementById('inquiry-status-filter');

            const generateInquiryStatusBadge = (outcome) => {
                return (outcome || 'Pending') === 'Completed' ? `<span class="badge bg-success">Completed</span>` : `<span class="badge bg-warning text-dark">Pending</span>`;
            };

            function markInquiryAsCompleted(inquiryId) {
                let allInquiries = getInquiries();
                const inquiryIndex = allInquiries.findIndex(i => i.id === inquiryId);
                if (inquiryIndex > -1) {
                    allInquiries[inquiryIndex].outcome = 'Completed';
                    saveInquiries(allInquiries);
                    inquiriesTable.row(function (idx, data, node) { return data.id === inquiryId; }).data(allInquiries[inquiryIndex]).draw();
                    if (detailInquiryId.textContent === `#${inquiryId}`) {
                        populateInquiryDetails(inquiryId);
                    }
                }
            }

            function initializeInquiriesTable() {
                inquiriesTable = $('#inquiriesDataTable').DataTable({
                    data: getInquiries(),
                    columns: [
                        { data: 'id' }, { data: 'topic' }, { data: 'inquiredBy' },
                        { data: 'assignedTo', defaultContent: 'Unassigned' },
                        { data: 'outcome', render: (d) => generateInquiryStatusBadge(d || 'Pending') },
                        {
                            data: null, orderable: false, searchable: false,
                            render: (data, type, row) => {
                                let actionControl = (row.outcome || 'Pending') !== 'Completed'
                                    ? `<div class="form-check d-flex justify-content-center"><input class="form-check-input mark-inquiry-completed-checkbox" type="checkbox" data-inquiry-id="${row.id}" title="Mark as Completed"></div>`
                                    : `<div class="text-center text-success" title="Completed"><i class="fas fa-check-circle"></i></div>`;
                                const viewButton = `<button class="btn btn-sm btn-secondary view-inquiry-details-btn" data-inquiry-id="${row.id}" title="View Details"><i class="fas fa-eye"></i></button>`;
                                const chatButton = `<button class="btn btn-sm btn-primary start-inquiry-chat-btn" data-inquiry-id="${row.id}"><i class="fas fa-comments"></i></button>`;
                                return `<div class="d-flex justify-content-center align-items-center gap-2">${actionControl}${viewButton}${chatButton}</div>`;
                            }
                        }
                    ],
                    order: [[0, 'desc']], pageLength: 10,
                });
            }

            function populateInquiryDetails(inquiryId) {
                const inquiry = getInquiries().find(i => i.id === inquiryId);
                if (!inquiry) {
                    inquiryDetailPlaceholder.style.display = 'flex';
                    inquiryDetailContent.style.display = 'none';
                    return;
                }
                inquiryDetailPlaceholder.style.display = 'none';
                inquiryDetailContent.style.display = 'flex';

                detailInquiryId.textContent = `#${inquiry.id}`;
                detailInquiryTopicContainer.textContent = inquiry.topic;
                detailInquiryCreatedBy.textContent = inquiry.inquiredBy;
                detailInquiryOutcomeBadge.innerHTML = generateInquiryStatusBadge(inquiry.outcome || 'Pending');

                detailInquiryAssignee.innerHTML = agents.map(a => `<option value="${a}" ${a === (inquiry.assignedTo || 'Unassigned') ? 'selected' : ''}>${a}</option>`).join('');
                detailInquiryAssignee.dataset.inquiryId = inquiry.id;
                detailInquiryAssignee.dataset.oldValue = inquiry.assignedTo || 'Unassigned';
            }

            function openInquiryChatBox(inquiry) {
                const chatBoxId = `chatbox-inq-${inquiry.id}`;
                const existingChatBox = document.getElementById(chatBoxId);
                if (existingChatBox) { existingChatBox.classList.remove('collapsed'); existingChatBox.querySelector('textarea').focus(); return; }
                const chatBox = document.createElement('div');
                chatBox.className = 'floating-chat-box'; chatBox.id = chatBoxId;
                chatBox.innerHTML = `
                    <div class="chat-box-header"><span class="chat-box-title">#${inquiry.id} - ${inquiry.inquiredBy}</span><div class="chat-box-actions"><button class="action-minimize" title="Minimize"><i class="fas fa-minus"></i></button><button class="action-close" title="Close"><i class="fas fa-times"></i></button></div></div>
                    <div class="chat-box-body"></div>
                    <div class="chat-box-footer"><textarea class="form-control" rows="1" placeholder="Type your reply..."></textarea><button class="btn btn-primary action-send" title="Send"><i class="fas fa-paper-plane"></i></button></div>`;
                floatingChatContainer.appendChild(chatBox);
                renderInquiryChatMessages(inquiry.id, chatBox.querySelector('.chat-box-body'));
            }

            initializeInquiriesTable();

            $('#inquiriesDataTable tbody').on('click', 'tr', function (e) {
                if ($(e.target).closest('button, .form-check-input').length) return;
                inquiriesTable.$('tr.table-active').removeClass('table-active');
                $(this).addClass('table-active');
                const data = inquiriesTable.row(this).data();
                if (data) populateInquiryDetails(data.id);
            });
            $('#inquiriesDataTable tbody').on('click', '.view-inquiry-details-btn', function (e) {
                e.stopPropagation();
                const inquiryId = $(this).data('inquiry-id');
                const inquiry = getInquiries().find(i => i.id === inquiryId);
                if (inquiry) {
                    $('#details-inquiry-id').text(inquiry.id);
                    $('#details-inquiry-outcome').html(generateInquiryStatusBadge(inquiry.outcome || 'Pending'));
                    $('#details-inquiry-topic').text(inquiry.topic || 'N/A');
                    $('#details-inquiry-date').text(inquiry.date ? new Date(inquiry.date).toLocaleString() : 'N/A');
                    $('#details-inquiry-inquiredBy').text(inquiry.inquiredBy || 'N/A');
                    $('#details-inquiry-message').text(inquiry.message || 'N/A');
                    new bootstrap.Modal(document.getElementById('viewInquiryDetailsModal')).show();
                }
            });
            $('#inquiriesDataTable tbody').on('click', '.start-inquiry-chat-btn', function (e) {
                e.stopPropagation();
                const inquiryId = $(this).data('inquiry-id').toString();
                const inquiry = getInquiries().find(i => i.id === inquiryId);
                if (inquiry) openInquiryChatBox(inquiry);
            });
            $('#inquiriesDataTable tbody').on('change', '.mark-inquiry-completed-checkbox', function () {
                const inquiryId = $(this).data('inquiry-id').toString();
                if (confirm("Mark this inquiry as Completed?")) {
                    markInquiryAsCompleted(inquiryId);
                } else { $(this).prop('checked', false); }
            });

            $(inquiryStatusFilter).on('change', function () {
                inquiriesTable.column(4).search(this.value).draw();
            });

            $(detailInquiryAssignee).on('change', function () {
                const inquiryId = this.dataset.inquiryId;
                const oldValue = this.dataset.oldValue;
                const newValue = $(this).val();

                inquiryToUpdate = { id: inquiryId, newAssignee: newValue };
                $('#assignInquiryModalBody').text(`Are you sure you want to assign this inquiry to ${newValue}?`);
                assignInquiryModal.show();

                $(this).val(oldValue);
            });

            $(confirmInquiryAssignBtn).on('click', function () {
                let allInquiries = getInquiries();
                const inquiryIndex = allInquiries.findIndex(i => i.id === inquiryToUpdate.id);
                if (inquiryIndex > -1) {
                    allInquiries[inquiryIndex].assignedTo = inquiryToUpdate.newAssignee;
                    saveInquiries(allInquiries);

                    inquiriesTable.row(function (idx, data, node) { return data.id === inquiryToUpdate.id; }).data(allInquiries[inquiryIndex]).draw(false);

                    if (detailInquiryId.textContent === `#${inquiryToUpdate.id}`) {
                        populateInquiryDetails(inquiryToUpdate.id);
                    }
                }
                assignInquiryModal.hide();
                inquiryToUpdate = {};
            });

            const allInquiries = getInquiries();
            if (allInquiries.length > 0) {
                populateInquiryDetails(allInquiries[0].id);
                $('#inquiriesDataTable tbody tr:eq(0)').addClass('table-active');
            }
        }
    };

    // --- MAIN INITIALIZATION & FLOATING CHAT HANDLER ---
    function initializeAdminPanel() {
        $('.admin-sidebar .nav-link').on('click', function (e) { e.preventDefault(); const pageName = $(this).data('page'); $('.admin-sidebar .nav-link.active').removeClass('active'); $(this).addClass('active'); $('.admin-page.active').removeClass('active'); $('#' + pageName + '-page').addClass('active'); if (!initializedPages[pageName]) { if (pageInitializers[pageName]) { pageInitializers[pageName](); initializedPages[pageName] = true; } } });
        const initialPage = $('.admin-sidebar .nav-link.active').data('page');
        if (initialPage && pageInitializers[initialPage]) { pageInitializers[initialPage](); initializedPages[initialPage] = true; }
    }

    $(floatingChatContainer).on('click', e => {
        const chatBox = e.target.closest('.floating-chat-box');
        if (!chatBox) return;
        if (e.target.closest('.action-close')) { chatBox.remove(); return; }
        if (e.target.closest('.action-minimize') || (e.target.closest('.chat-box-header') && !e.target.closest('.chat-box-actions'))) {
            chatBox.classList.toggle('collapsed'); return;
        }

        if (e.target.closest('.action-send')) {
            const textarea = chatBox.querySelector('textarea');
            const text = textarea.value.trim();
            if (!text) return;
            const messageData = { sender: adminUserIdentity, text: text, timestamp: new Date().toISOString() };

            if (chatBox.id.startsWith('chatbox-inq-')) {
                const inquiryId = chatBox.id.replace('chatbox-inq-', '');
                saveInquiryChatMessage(inquiryId, messageData);
                renderInquiryChatMessages(inquiryId, chatBox.querySelector('.chat-box-body'));
            } else if (chatBox.id.startsWith('chatbox-tkt-')) {
                const ticketId = chatBox.id.replace('chatbox-tkt-', '');
                saveTicketChatMessage(ticketId, messageData);
                renderTicketChatMessages(ticketId, chatBox.querySelector('.chat-box-body'));
            }
            textarea.value = '';
            textarea.focus();
        }
    });

    $(floatingChatContainer).on('keyup', 'textarea', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $(this).closest('.chat-box-footer').find('.action-send').click(); }
    });

    initializeAdminPanel();
    const connection = new signalR.HubConnectionBuilder().withUrl("/chathub").withAutomaticReconnect().build();
    connection.start().then(() => { console.log("SignalR Connected (Admin)."); }).catch(err => console.error("SignalR Connection Error: ", err));
});