"use strict";

document.addEventListener('DOMContentLoaded', () => {

    let currentUser = { name: "Admin", id: null };
    let currentClientId = null;
    const agents = ["Sijal", "Shovan", "Alzeena", "Samana", "Darshan", "Anuj", "Avay", "Nikesh", "Salina", "Safal", "Imon", "Bigya", "Unassigned"];
    const priorities = ["Low", "Normal", "High", "Urgent"];
    let ticketPriorityChart = null;

    let mainChatContext = {};
    let lastMainChatMessageDate = null;
    let ticketsTable = null;
    let inquiriesTable = null;

    const floatingChatContainer = document.getElementById('floating-chat-container');
    const conversationListContainer = document.getElementById("conversation-list-container");
    const mainChatPanelBody = document.getElementById("chat-panel-body");
    const mainMessageInput = document.getElementById("message-input");
    const mainSendButton = document.getElementById("send-button");
    const mainChatHeader = document.getElementById("chat-header");

    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/chathub")
        .withAutomaticReconnect()
        .build();

    const formatTimestamp = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const escapeHtml = (text) => {
        if (text === null || typeof text === 'undefined') return '';
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    };
    const scrollToBottom = (element) => {
        if (element) {
            element.scrollTop = element.scrollHeight;
        }
    };
    const formatDateForSeparator = (dStr) => {
        const d = new Date(dStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === today.toDateString()) return "Today";
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

    function initializeAdminChatSidebar() {
        $(document).on('click', '.admin-chat-section-toggle', function (e) {
            e.stopPropagation();
            const target = $(this).data('target');
            const content = $('#' + target);
            const toggle = $(this);

            content.toggleClass('collapsed');
            toggle.toggleClass('expanded');
        });

        $(document).on('click', '#refresh-conversations-btn', function () {
            if (currentClientId) {
                refreshAdminConversations();
            }
        });
    }

    async function createGroupChatConversation(clientId) {
        if (!clientId) {
            throw new Error("Client ID is required to create group chat");
        }

        const initialMessage = {
            Instruction: "Group chat conversation started",
            ClientId: parseInt(clientId),
            InsertUser: currentUser.id,
            InstCategoryId: 100,
            ServiceId: 3,
            Remarks: "Admin initiated group chat",
            DateTime: new Date().toISOString(),
            Status: true,
            InstChannel: "chat"
        };

        const response = await fetch('/v1/api/instructions/support-group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(initialMessage)
        });

        if (!response.ok) {
            throw new Error(`Failed to create group chat: ${response.statusText}`);
        }

        const savedMessage = await response.json();
        return savedMessage.instructionId || savedMessage.id;
    }

    function renderAdminSidebar(sidebarData) {

        $('#group-chats, #private-chats, #internal-chats, #ticket-chats, #inquiry-chats').empty();

        if (sidebarData.groupChats && sidebarData.groupChats.length > 0) {
            sidebarData.groupChats.forEach(chat => {
                const chatItem = createAdminConversationItem(chat, 'group');
                $('#group-chats').append(chatItem);
            });
        } else {
            $('#group-chats').html('<div class="admin-chat-loading">No group chat available</div>');
        }

        if (sidebarData.privateChats && sidebarData.privateChats.length > 0) {
            sidebarData.privateChats.forEach(chat => {
                const chatItem = createAdminConversationItem(chat, 'private');
                $('#private-chats').append(chatItem);
            });
        } else {
            $('#private-chats').html('<div class="admin-chat-loading">No private chats</div>');
        }

        if (sidebarData.internalChats && sidebarData.internalChats.length > 0) {
            sidebarData.internalChats.forEach(chat => {
                const chatItem = createAdminConversationItem(chat, 'internal');
                $('#internal-chats').append(chatItem);
            });
        } else {
            $('#internal-chats').html('<div class="admin-chat-loading">No internal chats</div>');
        }

        if (sidebarData.ticketChats && sidebarData.ticketChats.length > 0) {
            sidebarData.ticketChats.forEach(chat => {
                const chatItem = createAdminConversationItem(chat, 'ticket');
                $('#ticket-chats').append(chatItem);
            });
        } else {
            $('#ticket-chats').html('<div class="admin-chat-loading">No ticket chats</div>');
        }

        if (sidebarData.inquiryChats && sidebarData.inquiryChats.length > 0) {
            sidebarData.inquiryChats.forEach(chat => {
                const chatItem = createAdminConversationItem(chat, 'inquiry');
                $('#inquiry-chats').append(chatItem);
            });
        } else {
            $('#inquiry-chats').html('<div class="admin-chat-loading">No inquiry chats</div>');
        }
    }

    function createAdminConversationItem(itemData, type) {
        const avatarClass = getAvatarClass(type);
        const avatarIcon = getAvatarIcon(type, itemData);

        const item = $(`
            <a href="#" class="admin-conversation-item" 
               data-id="${itemData.conversationId}" 
               data-name="${escapeHtml(itemData.displayName)}" 
               data-type="${type}" 
               data-route="${itemData.route}">
                <div class="d-flex w-100 align-items-center">
                    <div class="admin-avatar-initials ${avatarClass} me-3">
                        ${avatarIcon}
                    </div>
                    <div class="flex-grow-1">
                        <div class="admin-conversation-title">${escapeHtml(itemData.displayName)}</div>
                        <small class="admin-conversation-subtitle">${escapeHtml(itemData.subtitle || 'No recent messages')}</small>
                    </div>
                </div>
            </a>
        `);

        return item;
    }

    function getAvatarClass(type) {
        const classes = {
            'private': 'admin-avatar-bg-purple',
            'internal': 'admin-avatar-bg-blue',
            'ticket': 'admin-avatar-bg-orange',
            'inquiry': 'admin-avatar-bg-cyan',
            'group': 'admin-avatar-bg-success'
        };
        return classes[type] || 'admin-avatar-bg-secondary';
    }

    function getAvatarIcon(type, itemData) {
        const icons = {
            'private': '<i class="fas fa-user"></i>',
            'internal': '<i class="fas fa-building"></i>',
            'ticket': '<i class="fas fa-ticket-alt"></i>',
            'inquiry': '<i class="fas fa-question-circle"></i>',
            'group': '<i class="fas fa-users"></i>'
        };
        return icons[type] || (itemData?.avatarInitials || '?');
    }

    async function refreshAdminConversations() {
        if (!currentClientId) return;

        $('#refresh-conversations-btn .fas').addClass('fa-spin');
        $('.admin-chat-loading').show();

        try {
            const response = await fetch(`/v1/api/instructions/sidebar/${currentClientId}`);
            const sidebarData = await response.json();
            renderAdminSidebar(sidebarData);
        } catch (error) {
            console.error('Error refreshing conversations:', error);
        } finally {
            $('#refresh-conversations-btn .fas').removeClass('fa-spin');
            $('.admin-chat-loading').hide();
        }
    }

    function updateAdminChatHeader(context) {
        $('.admin-chat-placeholder').hide();
        $('.admin-chat-title').text(context.name);
        $('.admin-chat-subtitle').text(`${context.type.charAt(0).toUpperCase() + context.type.slice(1)} Chat`);
        $('#chat-info-btn, #chat-settings-btn').show();
    }

    async function loadAdminChatMessages(conversationId) {
        const chatBody = $('#chat-panel-body');
        chatBody.html('<div class="text-center p-4"><div class="spinner-border"></div><div class="mt-2">Loading messages...</div></div>');

        try {
            const numericId = parseInt(conversationId, 10);
            if (isNaN(numericId)) {
                throw new Error(`Invalid conversation ID: ${conversationId}`);
            }

            console.log("ADMIN: Loading messages for conversation ID:", numericId);

            const response = await fetch(`/v1/api/instructions/messages/${numericId}`);
            if (!response.ok) {
                throw new Error(`Failed to load messages: ${response.statusText}`);
            }

            const messages = await response.json();
            console.log("ADMIN: Received messages:", messages);

            if (!Array.isArray(messages)) {
                throw new Error('Expected messages to be an array, received: ' + typeof messages);
            }

            chatBody.empty();
            lastMainChatMessageDate = null;

            if (messages.length === 0) {
                chatBody.html('<div class="text-center text-muted p-4">No messages yet. Start the conversation!</div>');
            } else {
                messages.forEach(msg => displayMainChatMessage(msg, true));
                scrollToBottom(chatBody[0]);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            chatBody.html(`<div class="text-center text-danger p-4">Error loading messages: ${error.message}</div>`);
        }
    }

    function openFloatingChatBox(item, type) {
        const id = item.id;
        const clientName = item.clientName;
        const chatBoxId = `chatbox-${type}-${id}`;
        if (document.getElementById(chatBoxId)) {
            document.getElementById(chatBoxId).classList.remove('collapsed');
            return;
        }

        const title = `#${id} - ${escapeHtml(item.subject || item.topic)} (${escapeHtml(clientName)})`;

        const chatBox = document.createElement('div');
        chatBox.className = 'floating-chat-box';
        chatBox.id = chatBoxId;
        chatBox.dataset.id = id;

        chatBox.innerHTML = `
           <div class="chat-box-header">
               <span class="chat-box-title">${title}</span>
               <div class="chat-box-actions">
                   <button class="action-minimize" title="Minimize"><i class="fas fa-minus"></i></button>
                   <button class="action-close" title="Close"><i class="fas fa-times"></i></button>
               </div>
           </div>
        <div class="chat-box-body"></div>
        <div class="chat-box-footer">
            <textarea class="form-control" rows="1" placeholder="Type your reply..."></textarea>
            <button class="btn btn-primary action-send" title="Send"><i class="fas fa-paper-plane"></i></button>
        </div>`;

        floatingChatContainer.appendChild(chatBox);
        loadAndRenderFloatingChatMessages(id, chatBox.querySelector('.chat-box-body'));
    }

    function openEnhancedFloatingChatBox(item, type) {
        const id = item.id;
        const clientName = item.clientName;
        const chatBoxId = `chatbox-${type}-${id}`;

        if (document.getElementById(chatBoxId)) {
            document.getElementById(chatBoxId).classList.remove('collapsed');
            return;
        }

        const title = `#${id} - ${escapeHtml(item.subject || item.topic)} (${escapeHtml(clientName)})`;
        const typeIcon = type === 'tkt' ? 'fa-ticket-alt' : 'fa-question-circle';

        const chatBox = document.createElement('div');
        chatBox.className = 'floating-chat-box';
        chatBox.id = chatBoxId;
        chatBox.dataset.id = id;
        chatBox.dataset.type = type;

        chatBox.innerHTML = `
            <div class="chat-box-header">
                <span class="chat-box-title">
                    <i class="fas ${typeIcon} me-2"></i>${title}
                </span>
                <div class="chat-box-actions">
                    <button class="action-minimize" title="Minimize">
                        <i class="fas fa-minus"></i>
                    </button>
                    <button class="action-maximize" title="Open in Main Chat" data-conversation-id="${id}">
                        <i class="fas fa-expand"></i>
                    </button>
                    <button class="action-close" title="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="chat-box-body"></div>
            <div class="chat-box-footer">
                <textarea class="form-control" rows="1" placeholder="Type your reply..."></textarea>
                <button class="btn btn-primary action-send" title="Send">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>`;

        floatingChatContainer.appendChild(chatBox);
        loadAndRenderFloatingChatMessages(id, chatBox.querySelector('.chat-box-body'));

        $(chatBox).find('.action-maximize').on('click', function () {
            const conversationId = $(this).data('conversation-id');
            $('[data-page="chats"]').click();
            setTimeout(() => {
                $(`.admin-conversation-item[data-id="${conversationId}"]`).click();
            }, 100);
            chatBox.remove();
        });
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
        } catch (err) {
            container.innerHTML = '<p class="text-danger p-3">Error loading messages.</p>';
        }
    }

    function addMainChatDateSeparator(msgDateStr) {
        if (!mainChatPanelBody) return;
        const dateStr = new Date(msgDateStr).toDateString();
        if (lastMainChatMessageDate !== dateStr) {
            lastMainChatMessageDate = dateStr;
            const ds = document.createElement('div');
            ds.className = 'date-separator';
            ds.textContent = formatDateForSeparator(msgDateStr);
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

        let postUrl;
        if (mainChatContext.route === 'support-group') {
            postUrl = "/v1/api/instructions/support-group";
        } else {
            postUrl = "/v1/api/instructions/reply";
        }

        const payload = {
            Instruction: text,
            InstructionId: parseInt(mainChatContext.id, 10),
            ClientId: currentClientId,
            InsertUser: currentUser.id,
            InstCategoryId: 100,
            ServiceId: 3,
            Remarks: "Message from admin panel"
        };

        console.log("ADMIN: Sending message to", postUrl, "with payload:", payload);

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
            console.log("ADMIN: Message saved successfully:", savedMessage);

            displayMainChatMessage(savedMessage);
            await connection.invoke("SendAdminMessage", savedMessage);

            mainMessageInput.value = '';

        } catch (err) {
            console.error("sendMainChatMessage error:", err);
            alert(`Failed to send message: ${err.message}`);
        }
    }

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
            console.log("ADMIN: Initializing chats page for client:", currentClientId);

            if (!currentClientId) {
                renderAdminSidebar({
                    groupChats: [],
                    privateChats: [],
                    internalChats: [],
                    ticketChats: [],
                    inquiryChats: []
                });
                return;
            }

            $('#group-chats, #private-chats, #internal-chats, #ticket-chats, #inquiry-chats').html('<div class="admin-chat-loading"><div class="spinner-border spinner-border-sm me-2"></div>Loading...</div>');

            try {
                console.log("ADMIN: Loading conversations for client:", currentClientId);
                const response = await fetch(`/v1/api/instructions/sidebar/${currentClientId}`);
                if (!response.ok) {
                    throw new Error(`Failed to load sidebar: ${response.statusText}`);
                }

                const sidebarData = await response.json();
                console.log("ADMIN: Sidebar data loaded:", sidebarData);

                renderAdminSidebar(sidebarData);
            } catch (error) {
                console.error('Error loading conversations:', error);
                $('#group-chats, #private-chats, #internal-chats, #ticket-chats, #inquiry-chats').html('<div class="admin-chat-loading text-danger">Error loading chats</div>');
            }
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

        initializeAdminChatSidebar();

        $(document).on('click', '.admin-conversation-item', async function (e) {
            e.preventDefault();
            const $this = $(this);

            const conversationId = $this.data('id');
            const route = $this.data('route');

            if (conversationId === "0" && route === 'support-group') {
                console.log("ADMIN: Creating new group chat for client:", currentClientId);
                try {
                    const newConversationId = await createGroupChatConversation(currentClientId);
                    $this.attr('data-id', newConversationId);

                    mainChatContext = {
                        id: parseInt(newConversationId, 10),
                        name: $this.data('name'),
                        route: route,
                        type: $this.data('type')
                    };
                } catch (error) {
                    console.error("Failed to create group chat:", error);
                    alert("Failed to create group chat. Please try again.");
                    return;
                }
            } else {
                const numericId = parseInt(conversationId, 10);

                if (isNaN(numericId)) {
                    console.error("Invalid conversation ID:", conversationId);
                    alert("Invalid conversation ID. Please try again.");
                    return;
                }

                mainChatContext = {
                    id: numericId,
                    name: $this.data('name'),
                    route: route,
                    type: $this.data('type')
                };
            }

            console.log("ADMIN: Switched to conversation:", mainChatContext);

            $('.admin-conversation-item.active').removeClass('active');
            $this.addClass('active').removeClass('has-unread');

            updateAdminChatHeader(mainChatContext);

            $('#message-input, #send-button').prop('disabled', false);

            try {
                await connection.invoke("JoinPrivateChat", mainChatContext.id.toString());
                console.log(`ADMIN: Successfully joined SignalR group for conversation ${mainChatContext.id}`);
            } catch (error) {
                console.error(`ADMIN: Failed to join SignalR group for conversation ${mainChatContext.id}:`, error);
            }

            await loadAdminChatMessages(mainChatContext.id);
        });

        $(conversationListContainer).on('click', '.conversation-item', async function (e) {
            e.preventDefault();
            mainChatContext = {
                id: $(this).data('id'),
                name: $(this).data('name'),
                route: $(this).data('route')
            };

            $('.conversation-item.active').removeClass('active');
            $(this).addClass('active');

            if (mainChatHeader) {
                mainChatHeader.innerHTML = `<span>${escapeHtml(mainChatContext.name)}</span>`;
            }

            if (mainMessageInput) mainMessageInput.disabled = false;
            if (mainSendButton) mainSendButton.disabled = false;

            try {
                await connection.invoke("JoinPrivateChat", mainChatContext.id.toString());
                console.log(`ADMIN: Successfully joined SignalR group for conversation ${mainChatContext.id}`);
            } catch (error) {
                console.error(`ADMIN: Failed to join SignalR group for conversation ${mainChatContext.id}:`, error);
            }

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

        $('#ticketsTable tbody').on('click', '.start-chat-btn', function () {
            const data = ticketsTable.row($(this).parents('tr')).data();
            if (data) openEnhancedFloatingChatBox(data, 'tkt');
        });

        $('#inquiriesDataTable tbody').on('click', '.start-chat-btn', function () {
            const data = inquiriesTable.row($(this).parents('tr')).data();
            if (data) openEnhancedFloatingChatBox(data, 'inq');
        });

        $(floatingChatContainer).on('click', e => {
            const chatBox = e.target.closest('.floating-chat-box');
            if (!chatBox) return;

            if (e.target.closest('.action-close')) {
                chatBox.remove();
                return;
            }

            if (e.target.closest('.action-minimize') || e.target.closest('.chat-box-header')) {
                chatBox.classList.toggle('collapsed');
                return;
            }

            if (e.target.closest('.action-send')) {
                const textarea = chatBox.querySelector('textarea');
                const text = textarea.value.trim();
                if (!text) return;

                const payload = {
                    Instruction: text,
                    InstructionId: parseInt(chatBox.dataset.id, 10),
                    ClientId: currentClientId,
                    InsertUser: currentUser.id,
                    Remarks: "Message from admin panel (floating)"
                };

                fetch(`/v1/api/instructions/reply`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                    .then(res => res.json())
                    .then(savedMessage => {
                        const container = chatBox.querySelector('.chat-box-body');
                        const senderName = currentUser.name || 'Admin';
                        const msgRow = document.createElement('div');
                        msgRow.className = 'message-row sent';
                        msgRow.innerHTML = `<div class="message-content"><div class="message-bubble"><p class="message-text">${escapeHtml(text)}</p></div><span class="message-timestamp">${senderName} - ${formatTimestamp(new Date())}</span></div>`;
                        container.appendChild(msgRow);
                        scrollToBottom(container);

                        connection.invoke("SendAdminMessage", savedMessage);
                    })
                    .catch(err => {
                        console.error('Error sending floating chat message:', err);
                        alert('Failed to send message. Please try again.');
                    });

                textarea.value = '';
            }
        });

        $(mainSendButton).on('click', sendMainChatMessage);
        $(mainMessageInput).on('keyup', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMainChatMessage();
            }
        });

        $('#logout-button').on('click', function (e) {
            e.preventDefault();
            window.location.href = '/Login/Logout';
        });

        console.log("ADMIN: All event handlers wired successfully");
    }

    function setupSignalRListeners() {
        connection.on("ReceivePrivateMessage", (message) => {
            console.log("ADMIN RECEIVER: Hub broadcast received. Message object:", message);
            console.log("ADMIN RECEIVER: Current user ID:", currentUser.id);
            console.log("ADMIN RECEIVER: Message insertUser:", message.insertUser);
            console.log("ADMIN RECEIVER: Message clientAuthUserId:", message.clientAuthUserId);
            console.log("ADMIN RECEIVER: Current mainChatContext.id:", mainChatContext.id);

            if (message.insertUser === currentUser.id || message.clientAuthUserId === currentUser.id) {
                console.log("ADMIN RECEIVER: Ignoring own message broadcast.");
                return;
            }

            const conversationId = message.instructionId;
            if (!conversationId) {
                console.error("ADMIN RECEIVER: Received message with no instructionId!", message);
                return;
            }

            console.log(`ADMIN RECEIVER: Processing message for conversation ${conversationId}`);

            const floatingChat = document.getElementById(`chatbox-tkt-${conversationId}`) ||
                document.getElementById(`chatbox-inq-${conversationId}`);
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

            if (String(mainChatContext.id) === String(conversationId)) {
                console.log(`ADMIN RECEIVER: Message for open main chat #${conversationId}. Calling displayMainChatMessage.`);
                displayMainChatMessage(message);
            } else {
                console.log(`ADMIN RECEIVER: Message for different conversation. mainChatContext.id=${mainChatContext.id}, message conversationId=${conversationId}`);
            }

            const convItem = document.querySelector(`.conversation-item[data-id="${conversationId}"]`) ||
                document.querySelector(`.admin-conversation-item[data-id="${conversationId}"]`);
            if (convItem) {
                convItem.classList.add('has-unread');
                const subtitle = convItem.querySelector('.text-muted, .admin-conversation-subtitle');
                if (subtitle) {
                    subtitle.textContent = message.instruction;
                }
            }

            if (!$('#chats-page').hasClass('active')) {
                console.log("ADMIN RECEIVER: New client message received while not on chats page");

                const chatsNavLink = document.querySelector('[data-page="chats"]');
                if (chatsNavLink && !chatsNavLink.classList.contains('has-notification')) {
                    chatsNavLink.classList.add('has-notification');
                    const badge = document.createElement('span');
                    badge.className = 'badge bg-danger ms-2 notification-badge';
                    badge.textContent = '!';
                    chatsNavLink.appendChild(badge);
                }

                if (Notification.permission === "granted") {
                    new Notification("New Message", {
                        body: `${message.senderName}: ${message.instruction}`,
                        icon: "/images/notification-icon.png"
                    });
                }
            }
        });

        connection.on("NewTicket", (ticket) => {
            if (String(ticket.clientId) === String(currentClientId)) {
                if ($('#dashboard-page').hasClass('active')) { pageInitializers.dashboard(); }
                if (ticketsTable) { ticketsTable.ajax.reload(null, false); }
            }
        });
    }

    async function init() {
        try {
            await connection.start();
            if ('Notification' in window && Notification.permission === 'default') {
                await Notification.requestPermission();
            }

            console.log("ADMIN: SignalR connection state:", connection.state);

            try {
                await connection.invoke("JoinPrivateChat", "test-group");
                console.log("ADMIN: SignalR test group join successful");
            } catch (error) {
                console.error("ADMIN: SignalR test group join failed:", error);
            }

            setupSignalRListeners();

            const meResp = await fetch('/v1/api/accounts/me');
            if (meResp.ok) {
                currentUser = await meResp.json();
                console.log("ADMIN: Current user loaded:", currentUser);
            }
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

            console.log("ADMIN: Initialization completed successfully");

        } catch (err) {
            console.error("Initialization failed:", err);
            $('body').html('<div class="alert alert-danger m-5"><strong>Error:</strong> Could not initialize admin panel. Please check the connection and API status.</div>');
        }
    }

    init();
});