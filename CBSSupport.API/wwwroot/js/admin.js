    "use strict";


    document.addEventListener('DOMContentLoaded', () => {

        // --- 1. STATE AND CONFIGURATION ---
        let currentUser = { name: "Admin", id: null };
        let currentClientId = null;
        const agents = ["Sijal", "Shovan", "Alzeena", "Samana", "Darshan", "Anuj", "Avay", "Nikesh", "Salina", "Safal", "Imon", "Bigya", "Unassigned"];
        const priorities = ["Low", "Normal", "High", "Urgent"];
        let ticketPriorityChart = null;

        let mainChatContext = {};
        let lastMainChatMessageDate = null;
        let ticketsTable = null;
        let inquiriesTable = null;

        // --- 2. DOM ELEMENT REFERENCES ---
        const floatingChatContainer = document.getElementById('floating-chat-container');
        const conversationListContainer = document.getElementById("conversation-list-container");
        const mainChatPanelBody = document.getElementById("chat-panel-body");
        const mainMessageInput = document.getElementById("message-input");
        const mainSendButton = document.getElementById("send-button");
        const mainChatHeader = document.getElementById("chat-header");

        // --- 3. SIGNALR CONNECTION ---
        const connection = new signalR.HubConnectionBuilder()
            .withUrl("/chathub")
            .withAutomaticReconnect()
            .build();

        // --- 4. HELPERS ---
        const formatTimestamp = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const escapeHtml = (text) => {
            if (text === null || typeof text === 'undefined') return '';
            const d = document.createElement('div'); d.textContent = text; return d.innerHTML;
        };
        const scrollToBottom = (element) => { if (element) { element.scrollTop = element.scrollHeight; } };
        const formatDateForSeparator = (dStr) => {
            const d = new Date(dStr); const today = new Date(); const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1); if (d.toDateString() === today.toDateString()) return "Today";
            if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
            return d.toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });
        };
        const generatePriorityBadge = (priority) => {
            const p = priority ? priority.toLowerCase() : 'normal';
            return `<span class="badge badge-priority-${p}">${escapeHtml(priority || 'Normal')}</span>`;
        };
        const generateStatusBadge = (status) => {
            const s = status ? status.toLowerCase().replace(' ', '-') : 'pending';
            return `<span class="badge badge-status-${s}">${escapeHtml(status || 'Pending')}</span>`;
        };

        // --- 5. CORE LOGIC: FLOATING CHAT ---
        function openFloatingChatBox(item, type) {
            const id = item.id;
            const clientName = item.clientName;
            const chatBoxId = `chatbox-${type}-${id}`;
            if (document.getElementById(chatBoxId)) {
                document.getElementById(chatBoxId).classList.remove('collapsed'); return;
            }

            const title = `#${id} - ${escapeHtml(item.subject || item.topic)} ({escapeHtml(clientName)})`;

            const chatBox = document.createElement('div');
            chatBox.className = 'floating-chat-box'; chatBox.id = chatBoxId; chatBox.dataset.id = id; 

            chatBox.innerHTML = `
               <div class="chat-box-header"><span class="chat-box-title">${title}</span><div class="chat-box-actions"><button class="action-minimize" title="Minimize"><i class="fas fa-minus"></i></button><button class="action-close" title="Close"><i class="fas fa-times"></i></button></div></div>
            <div class="chat-box-body"></div>
            <div class="chat-box-footer"><textarea class="form-control" rows="1" placeholder="Type your reply..."></textarea><button class="btn btn-primary action-send" title="Send"><i class="fas fa-paper-plane"></i></button></div>`;

            floatingChatContainer.appendChild(chatBox);
            loadAndRenderFloatingChatMessages(id, chatBox.querySelector('.chat-box-body'));
        }

        async function loadAndRenderFloatingChatMessages(conversationId, container) {

            container.innerHTML = '<div class="text-center p-3"><div class="spinner-border spinner-border-sm"></div></div>';
            try {
                const res = await fetch(`/v1/api/instructions/messages/${conversationId}`);
                if (!res.ok) throw new Error("Failed to load messages");
                const messages = await res.json();
                container.innerHTML = '';
                messages.forEach(msg => {
                    const isSent = msg.insertUser === currentUser.id;
                    const messageClass = isSent ? 'sent' : 'received';
                    const senderName = msg.senderName || (isSent ? currentUser.name : 'Client');
                    container.innerHTML += `<div class="message-row ${messageClass}"><div class="message-content"><div class="message-bubble"><p class="message-text">${escapeHtml(msg.instruction)}</p></div><span class="message-timestamp">${escapeHtml(senderName)} - ${formatTimestamp(msg.dateTime)}</span></div></div>`

                });
                scrollToBottom(container);
            } catch (err) { container.innerHTML = '<p class="text-danger p-3">Error loading messages.</p>'; }
        }

        // --- 6. CORE LOGIC: MAIN CHAT PAGE ---
        function addMainChatDateSeparator(msgDateStr) {
            if (!mainChatPanelBody) return;
            const dateStr = new Date(msgDateStr).toDateString();
            if (lastMainChatMessageDate !== dateStr) {
                lastMainChatMessageDate = dateStr;
                const ds = document.createElement('div'); ds.className = 'date-separator'; ds.textContent = formatDateForSeparator(msgDateStr);
                mainChatPanelBody.appendChild(ds);
            }
        }

        function displayMainChatMessage(msg, isHistory = false) {
            if (!mainChatPanelBody) return;

            addMainChatDateSeparator(msg.dateTime);

            const isSent = msg.insertUser === currentUser.id;
            const senderName = msg.senderName || (isSent ? currentUser.name : 'Client');
            const senderId = msg.insertUser || msg.clientAuthUserId;
            const lastGroup = mainChatPanelBody.lastElementChild;


            const isNewGroup = !lastGroup || lastGroup.dataset.senderId !== String(senderId);

            if (isNewGroup) {
                const group = document.createElement('div');
                group.className = `message-group ${isSent ? 'sent' : 'received'}`;
                group.dataset.senderId = senderId;

                group.innerHTML = `
                <div class="message-cluster">
                    <div class="message-sender">${escapeHtml(senderName)}</div>
                    <div class="message-bubble">
                        <p class="message-text">${escapeHtml(msg.instruction || '')}</p>
                        <div class="message-timestamp">${formatTimestamp(msg.dateTime)}</div>
                    </div>
                </div>
                <div class="chat-avatar">${escapeHtml(senderName).substring(0, 1)}</div>`;

                mainChatPanelBody.appendChild(group);
            } else {
                const lastCluster = lastGroup.querySelector('.message-cluster');
                if (lastCluster) {
                    const bubble = document.createElement('div');
                    bubble.className = 'message-bubble';
                    bubble.innerHTML = `
                    <p class="message-text">${escapeHtml(msg.instruction || '')}</p>
                    <div class="message-timestamp">${formatTimestamp(msg.dateTime)}</div>`;
                    lastCluster.appendChild(bubble);
                }
            }

            if (!isHistory) {
                scrollToBottom(mainChatPanelBody);
            }
        }

        async function sendMainChatMessage() {
            const text = mainMessageInput.value.trim();
            if (!text || !mainChatContext.id) return;

            const postUrl = "/v1/api/instructions/reply";

            const payload = {
                Instruction: text,
                InstructionId: parseInt(mainChatContext.id, 10), 
                ClientId: currentClientId,
                InsertUser: currentUser.id,
                InstCategoryId: 100,
                ServiceId: 3,
                Remarks: "Message from admin panel"
            };

            try {
                const response = await fetch(postUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: "Unknown API error" }));
                    throw new Error(errorData.message || "API call failed");
                }

                const savedMessage = await response.json();

                displayMainChatMessage(savedMessage);
                await connection.invoke("SendAdminMessage", savedMessage);

                mainMessageInput.value = '';

            } catch (err) {
                console.error("sendMainChatMessage error:", err);
                alert(`Failed to send message: ${err.message}`);
            }
        }

        // --- 7. PAGE INITIALIZERS ---
        const initializedPages = {};

        const pageInitializers = {

            dashboard: async function () {
                if (!currentClientId) {
                    try {
                        const statsRes = await fetch('/v1/api/dashboard/stats/all');
                        if (!statsRes.ok) throw new Error("Failed to fetch aggregate stats");
                        const stats = await statsRes.json();

                        $('#stat-total-tickets').text(stats.totalTickets);
                        $('#stat-open-tickets').text(stats.openTickets);
                        $('#stat-resolved-tickets').text(stats.resolvedTickets);
                        $('#stat-total-inquiries').text(stats.totalInquiries);

                        const ticketsRes = await fetch('/v1/api/instructions/tickets/all');
                        if (!ticketsRes.ok) throw new Error("Failed to fetch all recent tickets");
                        const allTickets = await ticketsRes.json();
                        const ticketData = allTickets.data || [];

                        const recentTicketsList = $('#recent-tickets-list');
                        recentTicketsList.empty();
                        if (ticketData.length > 0) {
                            ticketData.slice(0, 5).forEach(ticket => {
                                const lastUpdate = new Date(ticket.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                                const itemHtml = `
                        <div class="recent-ticket-item">
                            <div class="recent-ticket-info">
                                <strong>#${ticket.id} - ${escapeHtml(ticket.clientName)}</strong>
                                <small>Subject: ${escapeHtml(ticket.subject)} | Last Update: ${lastUpdate}</small>
                            </div>
                            ${generatePriorityBadge(ticket.priority)}
                        </div>`;
                                recentTicketsList.append(itemHtml);
                            });
                        } else {
                            recentTicketsList.html('<p class="text-muted p-3">There are no recent tickets.</p>');
                        }

                        const priorityCounts = { Low: 0, Normal: 0, High: 0, Urgent: 0 };
                        let activeTickets = 0;
                        ticketData.forEach(ticket => {
                            if (ticket.status !== 'Resolved') {
                                activeTickets++;
                                const priority = ticket.priority || 'Normal';
                                if (priorityCounts.hasOwnProperty(priority)) {
                                    priorityCounts[priority]++;
                                }
                            }
                        });

                        const chartCanvas = document.getElementById('ticketPriorityChart');
                        if (chartCanvas) {
                            $('#ticketPriorityChart').show();
                            if (ticketPriorityChart) ticketPriorityChart.destroy();

                            const centerTextPlugin = {
                                id: 'centerText',
                                beforeDraw: (chart) => {
                                    const { ctx, width, height } = chart;
                                    ctx.restore();
                                    const text = "Total active tickets";
                                    const total = chart.options.plugins.centerText.total;
                                    ctx.font = "bold 20px sans-serif";
                                    ctx.textBaseline = 'middle';
                                    ctx.textAlign = 'center';
                                    const textX = Math.round(width / 2);
                                    const textY = Math.round(height / 2);
                                    ctx.fillText(total, textX, textY + 10);
                                    ctx.font = "12px sans-serif";
                                    ctx.fillStyle = '#6c757d';
                                    ctx.fillText(text, textX, textY - 10);
                                    ctx.save();
                                }
                            };

                            ticketPriorityChart = new Chart(chartCanvas.getContext('2d'), {
                                type: 'doughnut',
                                data: {
                                    labels: ['Low', 'Normal', 'High', 'Urgent'],
                                    datasets: [{
                                        data: [priorityCounts.Low, priorityCounts.Normal, priorityCounts.High, priorityCounts.Urgent],
                                        backgroundColor: ['#3b82f6', '#22c55e', '#f97316', '#ef4444'],
                                        borderWidth: 0,
                                    }]
                                },
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    cutout: '70%',
                                    plugins: {
                                        legend: {
                                            position: 'bottom',
                                            labels: { usePointStyle: true, boxWidth: 8, padding: 20 }
                                        },
                                        centerText: { total: activeTickets }
                                    }
                                },
                                plugins: [centerTextPlugin]
                            });
                        }

                    } catch (err) {
                        console.error("Dashboard 'All Clients' init error:", err);
                    }
                    return;
                }

                try {
                    $('#ticketPriorityChart').show();

                    const ticketsRes = await fetch(`/v1/api/instructions/tickets/${currentClientId}`);
                    const inquiriesRes = await fetch(`/v1/api/instructions/inquiries/${currentClientId}`);
                    if (!ticketsRes.ok || !inquiriesRes.ok) throw new Error("Failed to fetch dashboard data for the selected client");

                    const tickets = await ticketsRes.json();
                    const inquiries = await inquiriesRes.json();
                    const ticketData = tickets.data || [];
                    const inquiryData = inquiries.data || [];

                    $('#stat-total-tickets').text(ticketData.length);
                    $('#stat-open-tickets').text(ticketData.filter(t => t.status !== 'Resolved').length);
                    $('#stat-resolved-tickets').text(ticketData.filter(t => t.status === 'Resolved').length);
                    $('#stat-total-inquiries').text(inquiryData.length);

                    const recentTicketsList = $('#recent-tickets-list');
                    recentTicketsList.empty();
                    if (ticketData.length > 0) {
                        ticketData.slice(0, 5).forEach(ticket => {
                            const lastUpdate = new Date(ticket.date).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                            const itemHtml = `
                    <div class="recent-ticket-item">
                        <div class="recent-ticket-info">
                            <strong>#${ticket.id} - ${escapeHtml(ticket.subject)}</strong>
                            <small>Created by: ${escapeHtml(ticket.createdBy)} | Last Update: ${lastUpdate}</small>
                        </div>
                        ${generatePriorityBadge(ticket.priority)}
                    </div>`;
                            recentTicketsList.append(itemHtml);
                        });
                    } else {
                        recentTicketsList.html('<p class="text-muted p-3">This client has no recent tickets.</p>');
                    }

                    const priorityCounts = { Low: 0, Normal: 0, High: 0, Urgent: 0 };
                    let activeTickets = 0;
                    ticketData.forEach(ticket => {
                        if (ticket.status !== 'Resolved') {
                            activeTickets++;
                            const priority = ticket.priority || 'Normal';
                            if (priorityCounts.hasOwnProperty(priority)) {
                                priorityCounts[priority]++;
                            }
                        }
                    });

                    const chartCanvas = document.getElementById('ticketPriorityChart');
                    if (chartCanvas) {
                        if (ticketPriorityChart) ticketPriorityChart.destroy();

                        const centerTextPlugin = {
                            id: 'centerText',
                            beforeDraw: (chart) => {
                                const { ctx, width, height } = chart;
                                ctx.restore();
                                const text = "Active tickets";
                                const total = chart.options.plugins.centerText.total;
                                ctx.font = "bold 20px sans-serif";
                                ctx.textBaseline = 'middle';
                                ctx.textAlign = 'center';
                                const textX = Math.round(width / 2);
                                const textY = Math.round(height / 2);
                                ctx.fillText(total, textX, textY + 10);
                                ctx.font = "12px sans-serif";
                                ctx.fillStyle = '#6c757d';
                                ctx.fillText(text, textX, textY - 10);
                                ctx.save();
                            }
                        };

                        ticketPriorityChart = new Chart(chartCanvas.getContext('2d'), {
                            type: 'doughnut',
                            data: {
                                labels: ['Low', 'Normal', 'High', 'Urgent'],
                                datasets: [{
                                    data: [priorityCounts.Low, priorityCounts.Normal, priorityCounts.High, priorityCounts.Urgent],
                                    backgroundColor: ['#3b82f6', '#22c55e', '#f97316', '#ef4444'],
                                    borderWidth: 0,
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                cutout: '70%',
                                plugins: {
                                    legend: {
                                        position: 'bottom',
                                        labels: { usePointStyle: true, boxWidth: 8, padding: 20 }
                                    },
                                    centerText: { total: activeTickets }
                                }
                            },
                            plugins: [centerTextPlugin]
                        });
                    }
                } catch (err) {
                    console.error("Dashboard 'Specific Client' init error:", err);
                }
            }, 
            chats: async function () {
                if (!currentClientId) return;
                conversationListContainer.innerHTML = '<div class="p-3 text-center"><div class="spinner-border spinner-border-sm"></div></div>';
                try {
                    const res = await fetch(`/v1/api/instructions/sidebar/${currentClientId}`);
                    const data = await res.json();
                    conversationListContainer.innerHTML = '';
                    const allConversations = [...(data.privateChats || []), ...(data.internalChats || []), ...(data.ticketChats || []), ...(data.inquiryChats || [])];
                    allConversations.forEach(c => conversationListContainer.innerHTML += `<a href="#" class="list-group-item list-group-item-action conversation-item" data-id="${c.conversationId}" data-name="${escapeHtml(c.displayName)}" data-route="${c.route}"><div><strong>${escapeHtml(c.displayName)}</strong></div><small class="text-muted text-truncate">${escapeHtml(c.subtitle)}</small></a>`);
                } catch (err) { conversationListContainer.innerHTML = '<p class="text-danger p-3">Could not load chats.</p>'; }
            },
            'ticket-management': function () {
                const url = `/v1/api/instructions/tickets/all`;
                if ($.fn.DataTable.isDataTable('#ticketsTable')) {
                    $('#ticketsTable').DataTable().ajax.url(url).load();
                } else {
                    ticketsTable = $('#ticketsTable').DataTable({
                        ajax: { url: url, dataSrc: 'data' },
                        columns: [
                            { data: 'id', title: 'ID' },
                            { data: 'clientName', title: 'Client' },
                            { data: 'date', title: 'Date', render: d => new Date(d).toLocaleDateString() },
                            { data: 'subject', title: 'Subject' },
                            { data: 'createdBy', title: 'Created By' },
                            { data: 'status', title: 'Status', render: (d) => generateStatusBadge(d) },
                            { data: 'priority', title: 'Priority', render: (d) => generatePriorityBadge(d) },
                            { data: null, title: 'Actions', orderable: false, className: "text-center", render: (data, type, row) => `<div class="action-buttons"><button class="btn-icon-action start-chat-btn" data-type="tkt" title="Open Chat"><i class="fas fa-comments"></i></button></div>` }
                        ],
                        order: [[0, 'desc']],
                    });
                }
            },

            'inquiry-management': function () {
                const url = `/v1/api/instructions/inquiries/all`;

                if ($.fn.DataTable.isDataTable('#inquiriesDataTable')) {
                    $('#inquiriesDataTable').DataTable().ajax.url(url).load();
                } else {
                    inquiriesTable = $('#inquiriesDataTable').DataTable({
                        ajax: { url: url, dataSrc: 'data' },
                        columns: [
                            { data: 'id', title: 'ID' },
                            { data: 'clientName', title: 'Client' },
                            { data: 'topic', title: 'Topic' },
                            { data: 'inquiredBy', title: 'Inquired By' },
                            { data: 'date', title: 'Date', render: d => new Date(d).toLocaleDateString() },
                            { data: 'outcome', title: 'Outcome' }
                        ],
                        order: [[0, 'desc']],
                        language: {
                            emptyTable: "No inquiries found."
                        }
                    });
                }
            }
        };
        // --- 8. EVENT HANDLERS ---
        function wireEvents() {
            $('.admin-sidebar .nav-link').on('click', function (e) {
                e.preventDefault();
                const pageName = $(this).data('page');

                $('.admin-sidebar .nav-link.active').removeClass('active');
                $(this).addClass('active');
                $('.admin-page.active').removeClass('active');
                $('#' + pageName + '-page').addClass('active');

                if (pageName === 'chats') {
                    const chatsNavLink = document.querySelector('[data-page="chats"]');
                    if (chatsNavLink) {
                        chatsNavLink.classList.remove('has-notification');
                        const badge = chatsNavLink.querySelector('.notification-badge');
                        if (badge) badge.remove();
                    }
                }

                if (pageInitializers[pageName]) {
                    pageInitializers[pageName]();
                }
            });

            $('.client-switcher').on('change', function () {
                const selectedClientId = $(this).val();
                currentClientId = selectedClientId;


                $('.client-switcher').val(selectedClientId);

                const activePage = $('.admin-sidebar .nav-link.active').data('page');

                if (activePage === 'dashboard' || activePage === 'chats') {
                    pageInitializers[activePage]();
                }

                if (ticketsTable) {
                    const clientName = $(this).find('option:selected').text();
                    const searchTerm = selectedClientId ? `^${clientName}$` : '';
                    ticketsTable.column(1).search(searchTerm, true, false).draw();
                }
                if (inquiriesTable) {
                    const clientName = $(this).find('option:selected').text();
                    const searchTerm = selectedClientId ? `^${clientName}$` : '';
                    inquiriesTable.column(1).search(searchTerm, true, false).draw();
                }
            });

            $('#ticketsTable tbody').on('click', '.start-chat-btn', function () {
                const data = ticketsTable.row($(this).parents('tr')).data();
                if (data) openFloatingChatBox(data, 'tkt');
            });

            $(floatingChatContainer).on('click', e => {
                const chatBox = e.target.closest('.floating-chat-box'); if (!chatBox) return;
                if (e.target.closest('.action-close')) { chatBox.remove(); return; }
                if (e.target.closest('.action-minimize') || e.target.closest('.chat-box-header')) { chatBox.classList.toggle('collapsed'); return; }
                if (e.target.closest('.action-send')) {
                    const textarea = chatBox.querySelector('textarea'); const text = textarea.value.trim(); if (!text) return;
                    const payload = { Instruction: text, InstructionId: parseInt(chatBox.dataset.id, 10), ClientId: currentClientId, InsertUser: currentUser.id, Remarks: "Message from admin panel (floating)" };
                    fetch(`/v1/api/instructions/support-private`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                        .then(res => res.json()).then(savedMessage => { connection.invoke("SendAdminMessage", savedMessage); });
                    textarea.value = '';
                }
            });

            $(mainSendButton).on('click', sendMainChatMessage);
            $(mainMessageInput).on('keyup', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMainChatMessage(); } });

            $(conversationListContainer).on('click', '.conversation-item', async function (e) {
                e.preventDefault();
                mainChatContext = { id: $(this).data('id'), name: $(this).data('name'), route: $(this).data('route') };

                $('.conversation-item.active').removeClass('active');
                $(this).addClass('active');

                if (mainChatHeader) {
                    mainChatHeader.innerHTML = `<span>${escapeHtml(mainChatContext.name)}</span>`;
                }

                if (mainMessageInput) mainMessageInput.disabled = false;
                if (mainSendButton) mainSendButton.disabled = false;

                mainChatPanelBody.innerHTML = '<div class="text-center p-3"><div class="spinner-border spinner-border-sm"></div></div>';
                try {
                    const res = await fetch(`/v1/api/instructions/messages/${mainChatContext.id}`);
                    const messages = await res.json();
                    mainChatPanelBody.innerHTML = '';
                    lastMainChatMessageDate = null;
                    messages.forEach(msg => displayMainChatMessage(msg, true));
                    scrollToBottom(mainChatPanelBody);
                } catch (err) {
                    mainChatPanelBody.innerHTML = '<p class="text-danger p-3">Could not load messages.</p>';
                }
            });

            $('#logout-button').on('click', function (e) {
                e.preventDefault();
                window.location.href = '/Login/Logout';
            });
        }

        // --- 9. REAL-TIME HANDLERS ---
        function setupSignalRListeners() {
            connection.on("ReceivePrivateMessage", (message) => {
                console.log("ADMIN RECEIVER: Hub broadcast received. Message object:", message);

                // ✅ FIX: Check for both insertUser and clientAuthUserId to filter admin messages properly
                if (message.insertUser === currentUser.id || message.clientAuthUserId === currentUser.id) {
                    console.log("ADMIN RECEIVER: Ignoring own message broadcast.");
                    return;
                }

                const conversationId = message.instructionId;
                if (!conversationId) {
                    console.error("ADMIN RECEIVER: Received message with no instructionId!", message);
                    return;
                }

                // ✅ FIX: Handle floating chat messages first
                const floatingChat = document.getElementById(`chatbox-tkt-${conversationId}`);
                if (floatingChat && !floatingChat.classList.contains('collapsed')) {
                    console.log(`ADMIN RECEIVER: Message for open floating chat #${conversationId}. Appending message.`);
                    const container = floatingChat.querySelector('.chat-box-body');
                    const senderName = message.senderName || 'Client';

                    const msgRow = document.createElement('div');
                    msgRow.className = `message-row received`;
                    msgRow.innerHTML = `<div class="message-content"><div class="message-bubble"><p class="message-text">${escapeHtml(message.instruction)}</p></div><span class="message-timestamp">${escapeHtml(senderName)} - ${formatTimestamp(message.dateTime)}</span></div>`;

                    container.appendChild(msgRow);
                    scrollToBottom(container);
                    return;
                }

                // ✅ FIX: Handle main chat messages regardless of which page is active
                if (String(mainChatContext.id) === String(conversationId)) {
                    console.log(`ADMIN RECEIVER: Message for open main chat #${conversationId}. Calling displayMainChatMessage.`);
                    displayMainChatMessage(message);
                }

                // ✅ FIX: Always update conversation list with new messages
                const convItem = document.querySelector(`.conversation-item[data-id="${conversationId}"]`);
                if (convItem) {
                    convItem.classList.add('has-unread');
                    const subtitle = convItem.querySelector('.text-muted');
                    if (subtitle) {
                        subtitle.textContent = message.instruction;
                    }
                }

                // ✅ NEW: Add notification for client messages when not on chats page
                if (!$('#chats-page').hasClass('active')) {
                    console.log("ADMIN RECEIVER: New client message received while not on chats page");

                    // Add visual indicator to the Chats tab
                    const chatsNavLink = document.querySelector('[data-page="chats"]');
                    if (chatsNavLink && !chatsNavLink.classList.contains('has-notification')) {
                        chatsNavLink.classList.add('has-notification');
                        // Add a badge or indicator
                        const badge = document.createElement('span');
                        badge.className = 'badge bg-danger ms-2 notification-badge';
                        badge.textContent = '!';
                        chatsNavLink.appendChild(badge);
                    }

                    // Optional: Show browser notification
                    if (Notification.permission === "granted") {
                        new Notification("New Message", {
                            body: `${message.senderName}: ${message.instruction}`,
                            icon: "/images/notification-icon.png" // Add your icon path
                        });
                    }
                }
            }); // ✅ FIXED: Proper closing for ReceivePrivateMessage handler

            connection.on("NewTicket", (ticket) => {
                if (String(ticket.clientId) === String(currentClientId)) {
                    if ($('#dashboard-page').hasClass('active')) { pageInitializers.dashboard(); }
                    if (ticketsTable) { ticketsTable.ajax.reload(null, false); }
                }
            });
        }

        // --- 10. INITIALIZATION ---
        async function init() {
            try {
                await connection.start();
                if ('Notification' in window && Notification.permission === 'default') {
                    await Notification.requestPermission();
                }

                setupSignalRListeners();

                const meResp = await fetch('/v1/api/accounts/me');
                if (meResp.ok) currentUser = await meResp.json();
                $('#admin-username-display').text(currentUser.name);

                const clientsResp = await fetch('/v1/api/clients');
                if (clientsResp.ok) {
                    const clients = await clientsResp.json();
                    let optionsHtml = '<option value="">All Clients</option>';
                    optionsHtml += clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

                    $('.client-switcher').html(optionsHtml);

                    currentClientId = "";
                    $('.client-switcher').val("");

                    wireEvents();

                    if (pageInitializers.dashboard) {
                        await pageInitializers.dashboard();
                        initializedPages.dashboard = true;
                    }

                }
            } catch (err) {
                console.error("Initialization failed:", err);
                $('body').html('<div class="alert alert-danger m-5"><strong>Error:</strong> Could not initialize admin panel. Please check the connection and API status.</div>');
            }
        }
        init();
    });