"use strict";

document.addEventListener("DOMContentLoaded", () => {
    // --- Globals & State ---
    let currentUser = {
        name: serverData.currentUserName,
        id: parseInt(serverData.currentUserId, 10)
    };
    let currentClient = { id: 3, name: "Default Client" };
    let currentChatContext = {};

    // --- DOM References ---
    const fullscreenBtn = document.getElementById("fullscreen-btn");
    const conversationsContainer = document.getElementById("conversations-container");
    const clientSwitcher = document.getElementById("client-switcher");
    const messageInput = document.getElementById("message-input");
    const sendButton = document.getElementById("send-button");
    const chatPanelBody = document.getElementById("chat-panel-body");
    const chatHeader = document.getElementById("chat-header");
    const attachmentButton = document.getElementById("attachment-button");
    const fileInput = document.getElementById("file-input");

    // --- SignalR Connection ---
    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/chathub")
        .withAutomaticReconnect()
        .build();

    // --- Helper & UI Functions ---
    const formatTimestamp = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const updateSendButtonState = () => {
        if (!sendButton) return;
        sendButton.disabled = connection.state !== "Connected" || (!messageInput.value.trim() && fileInput.files.length === 0);
    };

    const scrollToBottom = () => {
        chatPanelBody.scrollTop = chatPanelBody.scrollHeight;
    };

    function escapeHtml(text) {
        if (text === null || typeof text === 'undefined') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    const formatDateForSeparator = (dStr) => {
        const d = new Date(dStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === today.toDateString()) return "Today";
        if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
        return d.toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });
    };

    // --- Fullscreen Toggle ---
    if (fullscreenBtn) {
        const fullscreenIcon = fullscreenBtn.querySelector("i");
        fullscreenBtn.addEventListener("click", () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => console.error(err.message));
            } else if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        });
        document.addEventListener("fullscreenchange", () => {
            if (document.fullscreenElement) {
                fullscreenIcon.classList.remove("fa-expand");
                fullscreenIcon.classList.add("fa-compress");
            } else {
                fullscreenIcon.classList.remove("fa-compress");
                fullscreenIcon.classList.add("fa-expand");
            }
        });
    }

    // --- UI Rendering ---
    let lastMessageDate = null;

    function displayMessage(msg, isHistory = false) {
        if (!msg || !msg.dateTime) {
            console.error("Invalid message object received:", msg);
            return;
        }
        const messageDate = new Date(msg.dateTime).toDateString();
        if (lastMessageDate !== messageDate) {
            lastMessageDate = messageDate;
            const ds = document.createElement("div");
            ds.className = "date-separator";
            ds.textContent = formatDateForSeparator(msg.dateTime);
            chatPanelBody.appendChild(ds);
        }
        const senderName = msg.senderName || (msg.insertUser === currentUser.id ? currentUser.name : "Support");
        const isSent = senderName === currentUser.name;
        const messageRow = document.createElement("div");
        messageRow.className = `message-row ${isSent ? "sent" : "received"}`;
        messageRow.id = `msg-${msg.id}`;
        messageRow.dataset.messageId = msg.id;

        messageRow.innerHTML = `
          <div class="avatar-initials avatar-bg-blue" title="${escapeHtml(senderName)}">${escapeHtml(senderName).substring(0, 1)}</div>
          <div class="message-content">
            <div class="message-sender">${escapeHtml(senderName)}</div>
            <div class="message-bubble">
                <p class="message-text">${escapeHtml(msg.instruction)}</p>
            </div>
            <div class="message-meta">
              <span class="message-timestamp">${formatTimestamp(msg.dateTime)}</span>
              ${isSent ? `<span class="read-receipt fas fa-check" title="Sent"></span>` : ''}
            </div>
          </div>`;
        chatPanelBody.appendChild(messageRow);

        if (!isHistory) {
            scrollToBottom();
        }
    }

    function renderSidebar(sidebarData) {
        const containers = {
            private: document.getElementById('private-chat-list'),
            internal: document.getElementById('internal-chat-list'),
            ticket: document.getElementById('ticket-chat-list'),
            inquiry: document.getElementById('inquiry-chat-list'),
        };
        Object.values(containers).forEach(container => { if (container) container.innerHTML = ''; });

        sidebarData.privateChats?.forEach(item => containers.private?.appendChild(createConversationItem(item, 'private')));
        sidebarData.internalChats?.forEach(item => containers.internal?.appendChild(createConversationItem(item, 'internal')));
        sidebarData.ticketChats?.forEach(item => containers.ticket?.appendChild(createConversationItem(item, 'ticket')));
        sidebarData.inquiryChats?.forEach(item => containers.inquiry?.appendChild(createConversationItem(item, 'inquiry')));
    }

    function createConversationItem(itemData, type) {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action conversation-item';
        item.dataset.id = itemData.conversationId;
        item.dataset.name = itemData.displayName;
        item.dataset.type = type;
        item.dataset.route = itemData.route; 

        item.innerHTML = `
            <div class="d-flex w-100 align-items-center">
                <div class="avatar-initials ${itemData.avatarClass || 'avatar-bg-secondary'} me-3">${itemData.avatarInitials || '?'}</div>
                <div class="flex-grow-1">
                    <div class="fw-bold">${escapeHtml(itemData.displayName)}</div>
                    <small class="text-muted">${escapeHtml(itemData.subtitle)}</small>
                </div>
            </div>`;

        return item;
    }

    // --- Core Chat Logic ---
    async function loadSidebarForClient(clientId) {
        try {
            const response = await fetch(`/v1/api/instructions/sidebar/${clientId}`);
            if (!response.ok) throw new Error(`Failed to load sidebar: ${response.statusText}`);
            const sidebarData = await response.json();
            renderSidebar(sidebarData);
        } catch (error) {
            console.error("Error loading sidebar:", error);
        }
    }

    async function switchChatContext(contextData) {
        currentChatContext = contextData;
        document.querySelectorAll(".conversation-item.active").forEach(el => el.classList.remove("active"));
        const activeItem = document.querySelector(`.conversation-item[data-id="${currentChatContext.id}"]`);
        if (activeItem) activeItem.classList.add("active");

        chatHeader.innerHTML = `<div><div class="fw-bold">${escapeHtml(currentChatContext.name)}</div></div>`;
        await connection.invoke("JoinPrivateChat", currentChatContext.id).catch(err => console.error(err));
        await loadMessagesForConversation(currentChatContext.id);
    }

    async function loadMessagesForConversation(conversationId) {
        chatPanelBody.innerHTML = '<div class="text-center p-3"><div class="spinner-border" role="status"></div></div>';
        lastMessageDate = null;
        try {
            const response = await fetch(`/v1/api/instructions/messages/${conversationId}`);
            if (!response.ok) throw new Error(`Failed to load messages: ${response.statusText}`);
            const messages = await response.json();
            chatPanelBody.innerHTML = '';
            messages.forEach(msg => displayMessage(msg, true));
            scrollToBottom();
        } catch (error) {
            console.error("Error loading messages:", error);
            chatPanelBody.innerHTML = `<p class="text-danger p-3">Error loading messages.</p>`;
        }
    }

    // --- Core Chat Logic (Sending Messages) ---
    async function handleSendMessage() {
        const messageText = messageInput.value.trim();
        if (messageText) {
            await sendMessage();
        }
    }

    async function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText) return;

        if (!currentChatContext.route) {
            alert("Please select a conversation to send a message.");
            return;
        }

        const postUrl = `/v1/api/instructions/${currentChatContext.route}`;

        const chatMessage = {
            Instruction: messageText,
            ClientId: currentClient.id,
            ClientAuthUserId: currentUser.id,
            InsertUser: currentUser.id,
            InstructionId: parseInt(currentChatContext.id, 10),
            InstCategoryId: 100,
            ServiceId: 3,        
            Remarks: "Message from web chat",
        };

        console.log("SENDING THIS OBJECT:", JSON.stringify(chatMessage, null, 2));

        try {
            const response = await fetch(postUrl, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chatMessage),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to send message.");
            }

            const savedMessage = await response.json();

            await connection.invoke("SendPrivateMessage",
                savedMessage.instructionId.toString(),
                currentUser.name,
                savedMessage.instruction
            );

            displayMessage(savedMessage);

            messageInput.value = '';
            updateSendButtonState();
        } catch (error) {
            console.error("Error sending message:", error);
            alert(`Error: ${error.message}`);
        }
    }

    // --- Ticket & Inquiry System ---

    function initializeTicketSystem() {
        const newTicketBtn = document.getElementById("new-ticket-btn");
        const createTicketModalEl = document.getElementById("createTicketModal");
        if (!createTicketModalEl) return;

        const createTicketModal = new bootstrap.Modal(createTicketModalEl);
        const createTicketForm = document.getElementById("createTicketForm");

        if (newTicketBtn) {
            newTicketBtn.addEventListener("click", () => createTicketModal.show());
        }

        if (createTicketForm) {
            createTicketForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const formData = new FormData(createTicketForm);
                const ticketTypeRoute = formData.get("ticketType");
                const chatMessage = {
                    Instruction: formData.get("ticketMessage"),
                    Remarks: formData.get("ticketSubject"),
                    InstructionId: 0,
                    ClientId: currentClient.id,
                    ClientAuthUserId: currentUser.id,
                    InsertUser: currentUser.id,
                };
                try {
                    const response = await fetch(`/v1/api/instructions/${ticketTypeRoute}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(chatMessage)
                    });
                    if (!response.ok) throw new Error("Failed to create ticket.");

                    await loadSidebarForClient(currentClient.id);
                    alert("Ticket created successfully!");
                    createTicketModal.hide();
                    createTicketForm.reset();
                } catch (error) {
                    console.error("Error creating ticket:", error);
                    alert(error.message);
                }
            });
        }
    }

    // --- SignalR Event Handlers ---
    connection.on("ReceivePrivateMessage", (messageId, groupName, senderName, message, time, initials) => {
        if (String(currentChatContext.id) === String(groupName) && senderName !== currentUser.name) {
            const msg = {
                id: messageId,
                senderName,
                instruction: message,
                datetime: time
            };
            displayMessage(msg);
        }
    });

    // --- Initialization ---
    async function init() {
        const clientSwitcher = document.getElementById("client-switcher");
        const conversationListPanel = document.getElementById("conversation-list-panel");;

        if (conversationListPanel) {
            conversationListPanel.addEventListener('click', (e) => {
                const conversationItem = e.target.closest('.conversation-item');

                if (!conversationItem) {
                    return;
                }

                e.preventDefault();
                switchChatContext(conversationItem.dataset);
            });
        }

        if (clientSwitcher) {
            clientSwitcher.addEventListener('change', (e) => {
                const newClientId = parseInt(e.target.value, 10);
                if (isNaN(newClientId)) return;
                currentClient.id = newClientId;
                loadSidebarForClient(newClientId);
            });
        }

        if (sendButton) sendButton.addEventListener("click", handleSendMessage);

        if (messageInput) {
            messageInput.addEventListener("keyup", (e) => {
                updateSendButtonState();
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                }
            });
        }

        initializeTicketSystem();

        try {
            await connection.start();
            console.log("SignalR Connected.");
            updateSendButtonState();

            await loadSidebarForClient(currentClient.id);

        } catch (err) {
            console.error("Initialization Error: ", err);
            if (chatHeader) chatHeader.innerHTML = `<div class="text-danger">Connection Failed</div>`;
        }
    }

    init();
});