"use strict";

document.addEventListener('DOMContentLoaded', () => {

    // --- STATE AND CONFIGURATION ---
    const supportAgentIdentity = "CBS Support";
    let currentUserIdentity = supportAgentIdentity; // Default role
    let currentChatContext = {}; // Info about the active chat

    // --- MOCK USER DATA ---
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
    const conversationAccordion = document.getElementById("conversationGroupsAccordion");
    const teamListContainer = document.getElementById("team-list");
    const supportListContainer = document.getElementById("support-list");
    const groupChatAccordionItem = document.getElementById("group-chat-accordion-item");
    const teamChatAccordionItem = document.getElementById("team-chat-accordion-item");
    const supportChatAccordionItem = document.getElementById("support-chat-accordion-item");

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
    const generateGroupName = (u1, u2) => [u1, u2].sort().join('__'); // Use double underscore to be safe
    const getAvatarDetails = (userName) => teamMembers.find(u => u.name === userName) || customerList.find(u => u.name === userName) || { name: userName, initials: userName.charAt(0).toUpperCase(), avatarClass: "avatar-bg-blue" };

    // --- LOCALSTORAGE CHAT HISTORY ---
    const getChatHistory = (id) => JSON.parse(localStorage.getItem(`chat_${id}`)) || [];
    const saveMessageToHistory = (id, data) => localStorage.setItem(`chat_${id}`, JSON.stringify([...getChatHistory(id), data]));

    // --- UI RENDERING FUNCTIONS ---
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

    function renderConversationLists() {
        teamListContainer.innerHTML = '';
        supportListContainer.innerHTML = '';

        teamMembers.filter(u => u.name !== currentUserIdentity).forEach(user => {
            const html = `
                <a href="#" class="list-group-item conversation-item" data-type="private" data-id="${generateGroupName(currentUserIdentity, user.name)}" data-name="${user.name}">
                    <div class="avatar-initials ${user.avatarClass} me-3">${user.initials}</div>
                    <div class="flex-grow-1"><div class="fw-bold">${user.name}</div><small class="text-muted">Internal Chat</small></div>
                    <div class="icon ms-2"><i class="fas fa-user-friends"></i></div>
                </a>`;
            teamListContainer.innerHTML += html;
        });

        customerList.forEach(user => {
            const html = `
                <a href="#" class="list-group-item conversation-item" data-type="private" data-id="${generateGroupName(currentUserIdentity, user.name)}" data-name="${user.name}">
                    <div class="avatar-initials ${user.avatarClass} me-3">${user.initials}</div>
                    <div class="flex-grow-1"><div class="fw-bold">${user.name}</div><small class="text-muted">Customer Support</small></div>
                    <div class="icon ms-2"><i class="fas fa-headset"></i></div>
                </a>`;
            supportListContainer.innerHTML += html;
        });
    }

    // --- CORE LOGIC ---
    async function switchChatContext(contextData) {
        currentChatContext = contextData;

        document.querySelectorAll('.conversation-item.active').forEach(el => el.classList.remove('active'));
        const activeItem = document.querySelector(`.conversation-item[data-id='${contextData.id}']`);
        if (activeItem) activeItem.classList.add('active');

        const partnerDetails = getAvatarDetails(contextData.name);
        chatHeader.innerHTML = `
            <div class="avatar-initials ${partnerDetails.avatarClass}">${partnerDetails.initials}</div>
            <div>
                <div class="fw-bold">${contextData.name}</div>
                <small class="text-muted">${contextData.type === 'group' ? 'Group Conversation' : 'Private Chat'}</small>
            </div>`;

        chatPanelBody.innerHTML = ''; // Clear previous messages
        getChatHistory(contextData.id).forEach(displayMessage);
        scrollToBottom();

        // Join the SignalR group for private or group chats
        if (contextData.type === 'private' || contextData.type === 'group') {
            await connection.invoke("JoinPrivateChat", contextData.id);
        }
    }

    async function sendMessage() {
        const message = messageInput.value.trim();
        if (!message || !currentChatContext.id) return;

        try {
            const method = currentChatContext.type === 'group' ? "SendPublicMessage" : "SendPrivateMessage";
            const args = currentChatContext.type === 'group'
                ? [currentChatContext.id, currentUserIdentity, message] // Group needs groupName, sender, message
                : [currentChatContext.id, currentUserIdentity, message]; // Private also uses groupName, sender, message

            await connection.invoke(method, ...args);
            messageInput.value = "";
            updateSendButtonState();
        } catch (err) {
            console.error("Error sending message:", err);
        }
    }

    function setViewForRole(role) {
        currentUserIdentity = role;
        const isAdmin = teamMembers.some(u => u.name === role);

        // Show/hide accordion sections based on role
        groupChatAccordionItem.style.display = isAdmin ? 'block' : 'none';
        teamChatAccordionItem.style.display = isAdmin ? 'block' : 'none';
        supportChatAccordionItem.style.display = isAdmin ? 'block' : 'none';

        renderConversationLists(); // Re-render lists to exclude self

        if (isAdmin) {
            // Admin default view: select the public group chat
            document.querySelector('.conversation-item[data-id="public"]').click();
        } else {
            // Customer view: only one chat context is possible (with support)
            // We create a "virtual" chat item for the customer to talk to support
            const customerChatId = generateGroupName(role, supportAgentIdentity);
            const context = {
                type: 'private',
                id: customerChatId,
                name: supportAgentIdentity
            };
            switchChatContext(context);
            // Hide the conversation list panel for a cleaner customer UI
            document.getElementById('conversation-list-panel').style.display = 'none';
            // Adjust grid to fill space
            document.querySelector('.dashboard-container').style.gridTemplateColumns = '45fr 55fr';
        }
    }

    // --- INITIALIZATION & EVENT LISTENERS ---

    // Populate Role Switcher
    roleSwitcher.innerHTML = teamMembers.map(u => `<option value="${u.name}">Role: ${u.name}</option>`).join('') +
        customerList.map(u => `<option value="${u.name}">Role: ${u.name}</option>`).join('');

    // Event Listeners
    roleSwitcher.addEventListener('change', (e) => window.location.reload()); // Simple reload to reset state
    conversationAccordion.addEventListener('click', (e) => {
        const item = e.target.closest('.conversation-item');
        if (item) {
            e.preventDefault();
            switchChatContext(item.dataset);
        }
    });
    messageInput.addEventListener("keyup", (e) => {
        updateSendButtonState();
        if (e.key === "Enter" && !sendButton.disabled) sendButton.click();
    });
    sendButton.addEventListener("click", sendMessage);

    // --- SIGNALR EVENT HANDLERS ---
    connection.on("ReceivePublicMessage", (group, sender, msg, time) => {
        const data = { sender, message: msg, timestamp: time };
        saveMessageToHistory(group, data);
        if (currentChatContext.id === group) {
            displayMessage(data);
            scrollToBottom();
        }
    });

    connection.on("ReceivePrivateMessage", (group, sender, msg, time) => {
        const data = { sender, message: msg, timestamp: time };
        saveMessageToHistory(group, data);
        if (currentChatContext.id === group) {
            displayMessage(data);
            scrollToBottom();
        }
    });

    // Start connection and initialize view
    connection.start().then(() => {
        console.log("SignalR Connected.");
        // Persist role selection across reloads
        const savedRole = sessionStorage.getItem('chatRole') || supportAgentIdentity;
        roleSwitcher.value = savedRole;
        setViewForRole(savedRole);
        roleSwitcher.addEventListener('change', (e) => {
            sessionStorage.setItem('chatRole', e.target.value);
            window.location.reload();
        });
        updateSendButtonState();
    }).catch(err => console.error("SignalR Connection Error: ", err));
});