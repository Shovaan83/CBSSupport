﻿/**
 * Admin Panel SignalR Module
 * Handles all SignalR connection and real-time communication
 */
"use strict";

window.AdminSignalR = (() => {

    // ============================================
    // 🔐 CONNECTION MANAGEMENT
    // ============================================

    let connection = null;

    async function initialize() {
        try {
            connection = new signalR.HubConnectionBuilder()
                .withUrl("/chathub")
                .withAutomaticReconnect()
                .build();

            setupConnectionEvents();
            await connection.start();

            console.log("✅ AdminSignalR: Connection established successfully");
            return connection;
        } catch (error) {
            console.error("❌ AdminSignalR: Connection failed:", error);
            throw error;
        }
    }

    function setupConnectionEvents() {
        if (!connection) return;

        // Connection state events
        connection.onreconnecting(() => {
            console.log("🔄 AdminSignalR: Attempting to reconnect...");
        });

        connection.onreconnected(() => {
            console.log("✅ AdminSignalR: Reconnected successfully");
        });

        connection.onclose(() => {
            console.log("❌ AdminSignalR: Connection closed");
        });

        // Setup message handlers
        setupMessageHandlers();
    }

    // ============================================
    // 📨 MESSAGE HANDLERS
    // ============================================

    function setupMessageHandlers() {
        if (!connection) return;

        // Receive private messages
        connection.on("ReceivePrivateMessage", (message) => {
            console.log("📨 AdminSignalR: ReceivePrivateMessage received:", message);

            const currentUser = window.AdminCore?.getCurrentUser();
            if (!currentUser) return;

            // Ignore own messages
            if (message.insertUser === currentUser.id || message.clientAuthUserId === currentUser.id) {
                console.log("📨 AdminSignalR: Ignoring own message broadcast");
                return;
            }

            const conversationId = message.instructionId;
            if (!conversationId) {
                console.error("📨 AdminSignalR: Received message with no instructionId:", message);
                return;
            }

            // Handle floating chat updates
            handleFloatingChatMessage(conversationId, message);

            // Handle main chat updates
            if (window.AdminChat) {
                window.AdminChat.handleIncomingMessage(message);
            }

            // Update conversation list
            updateConversationItem(conversationId, message);

            // Show notification if not on chats page
            handleChatPageNotification(message);

            // Load new notifications
            if (window.AdminNotifications) {
                window.AdminNotifications.loadNotifications();
            }
        });

        // New ticket notifications
        connection.on("NewTicket", (ticket) => {
            console.log("🎫 AdminSignalR: New ticket received:", ticket);

            const currentClientId = window.AdminCore?.getCurrentClientId();
            if (String(ticket.clientId) === String(currentClientId)) {
                // Refresh dashboard if active
                if ($('#dashboard-page').hasClass('active') && window.AdminDashboard) {
                    window.AdminDashboard.loadEnhancedDashboardData(currentClientId);
                }

                // Refresh tickets table
                if (window.AdminTickets) {
                    const ticketsTable = window.AdminTickets.getTicketsTable();
                    if (ticketsTable) {
                        ticketsTable.ajax.reload(null, false);
                    }
                }
            }

            // Load notifications
            if (window.AdminNotifications) {
                window.AdminNotifications.loadNotifications();
            }
        });

        // General notifications
        connection.on("ReceiveNotification", (notification) => {
            console.log("🔔 AdminSignalR: Notification received:", notification);

            // Show browser notification if permission granted
            if (Notification.permission === "granted") {
                new Notification(notification.title, {
                    body: notification.message,
                    icon: "/images/notification-icon.png"
                });
            }

            // Load notifications
            if (window.AdminNotifications) {
                window.AdminNotifications.loadNotifications();
            }

            // Show toast notification
            if (window.AdminUtils) {
                window.AdminUtils.showNotification(notification.message, 'info');
            }
        });

        // Ticket status updates
        connection.on("TicketStatusUpdated", (data) => {
            console.log("🎫 AdminSignalR: Ticket status updated:", data);

            if (window.AdminTickets) {
                const ticketsTable = window.AdminTickets.getTicketsTable();
                if (ticketsTable) {
                    ticketsTable.ajax.reload(null, false);
                }
            }

            if (window.AdminUtils) {
                window.AdminUtils.showNotification(`Ticket #${data.ticketId} status updated`, 'info');
            }
        });

        // Inquiry status updates
        connection.on("InquiryStatusUpdated", (data) => {
            console.log("❓ AdminSignalR: Inquiry status updated:", data);

            if (window.AdminInquiries) {
                const inquiriesTable = window.AdminInquiries.getInquiriesTable();
                if (inquiriesTable) {
                    inquiriesTable.ajax.reload(null, false);
                }
            }

            if (window.AdminUtils) {
                window.AdminUtils.showNotification(`Inquiry #${data.inquiryId} status updated`, 'info');
            }
        });
    }

    // ============================================
    // 🎯 MESSAGE HANDLING HELPERS
    // ============================================

    function handleFloatingChatMessage(conversationId, message) {
        const floatingChat = document.getElementById(`chatbox-tkt-${conversationId}`) ||
            document.getElementById(`chatbox-inq-${conversationId}`);

        if (floatingChat && !floatingChat.classList.contains('collapsed')) {
            console.log(`📨 AdminSignalR: Message for open floating chat #${conversationId}`);
            const container = floatingChat.querySelector('.chat-box-body');
            const senderName = message.senderName || 'Client';

            const msgRow = document.createElement('div');
            msgRow.className = 'message-row received';
            msgRow.innerHTML = `
                <div class="message-content">
                    <div class="message-bubble">
                        <p class="message-text">${AdminUtils.escapeHtml(message.instruction)}</p>
                    </div>
                    <span class="message-timestamp">${AdminUtils.escapeHtml(senderName)} - ${AdminUtils.formatTimestamp(message.dateTime)}</span>
                </div>`;

            container.appendChild(msgRow);
            AdminUtils.scrollToBottom(container);
        }
    }

    function updateConversationItem(conversationId, message) {
        const convItem = document.querySelector(`.conversation-item[data-id="${conversationId}"]`) ||
            document.querySelector(`.admin-conversation-item[data-id="${conversationId}"]`);

        if (convItem) {
            convItem.classList.add('has-unread');
            const subtitle = convItem.querySelector('.text-muted, .admin-conversation-subtitle');
            if (subtitle) {
                subtitle.textContent = message.instruction;
            }
        }
    }

    function handleChatPageNotification(message) {
        if (!$('#chats-page').hasClass('active')) {
            console.log("📨 AdminSignalR: New client message received while not on chats page");

            const chatsNavLink = document.querySelector('[data-page="chats"]');
            if (chatsNavLink && !chatsNavLink.classList.contains('has-notification')) {
                chatsNavLink.classList.add('has-notification');
                const badge = document.createElement('span');
                badge.className = 'badge bg-danger ms-2 notification-badge';
                badge.textContent = '!';
                chatsNavLink.appendChild(badge);
            }

            // Show browser notification
            if (Notification.permission === "granted") {
                new Notification("New Message", {
                    body: `${message.senderName}: ${message.instruction}`,
                    icon: "/images/notification-icon.png"
                });
            }
        }
    }

    // ============================================
    // 📤 SEND FUNCTIONS
    // ============================================

    async function sendAdminMessage(message) {
        try {
            if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
                throw new Error("SignalR connection not available");
            }

            console.log("📤 AdminSignalR: Sending admin message:", message);
            await connection.invoke("SendAdminMessage", message);
        } catch (error) {
            console.error("❌ AdminSignalR: Error sending admin message:", error);
            throw error;
        }
    }

    async function joinPrivateChat(chatId) {
        try {
            if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
                throw new Error("SignalR connection not available");
            }

            console.log(`📤 AdminSignalR: Joining private chat: ${chatId}`);
            await connection.invoke("JoinPrivateChat", chatId.toString());
        } catch (error) {
            console.error("❌ AdminSignalR: Error joining private chat:", error);
            throw error;
        }
    }

    async function notifyTicketCreated(ticketData) {
        try {
            if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
                console.warn("⚠️ AdminSignalR: Connection not available for ticket notification");
                return;
            }

            await connection.invoke("NotifyTicketCreated", ticketData);
        } catch (error) {
            console.error("❌ AdminSignalR: Error notifying ticket created:", error);
        }
    }

    async function notifyInquiryCreated(inquiryData) {
        try {
            if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
                console.warn("⚠️ AdminSignalR: Connection not available for inquiry notification");
                return;
            }

            await connection.invoke("NotifyInquiryCreated", inquiryData);
        } catch (error) {
            console.error("❌ AdminSignalR: Error notifying inquiry created:", error);
        }
    }

    // ============================================
    // 🔗 PUBLIC API
    // ============================================

    return {
        initialize,
        getConnection: () => connection,
        sendAdminMessage,
        joinPrivateChat,
        notifyTicketCreated,
        notifyInquiryCreated
    };
})();