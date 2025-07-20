"use strict";

document.addEventListener('DOMContentLoaded', () => {

    // --- STATE AND CONFIGURATION ---
    const supportAgentIdentity = "CBS Support";
    let currentUserIdentity = supportAgentIdentity; // This will change based on the role switcher
    let activeSidebarTab = 'group';
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
    const dashboardBody = document.body;
    const roleSwitcher = document.getElementById("role-switcher");
    const sidebarNav = document.getElementById("sidebar-nav-container");
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
    const getAvatarDetails = (userName) => teamMembers.find(u => u.name === userName) || customerList.find(u => u.name === userName) || { initials: "?", avatarClass: "avatar-bg-blue" };

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

    function renderSidebarList() {
        conversationListContainer.innerHTML = '';
        let listToRender = [];
        let chatType = 'private';

        if (activeSidebarTab === 'support') {
            listToRender = customerList;
        } else if (activeSidebarTab === 'teams') {
            listToRender = teamMembers.filter(u => u.name !== currentUserIdentity);
        }

        listToRender.forEach(user => {
            conversationListContainer.innerHTML += `
                <a href="#" class="conversation-item" data-type="${chatType}" data-id="${generateGroupName(currentUserIdentity, user.name)}" data-name="${user.name}">
                    <div class="avatar-initials ${user.avatarClass} me-3">${getAvatarDetails(user.name).initials}</div>
                    <div class="flex-grow-1"><div class="fw-bold">${user.name}</div><small class="text-muted">${chatType} Chat</small></div>
                    <div class="icon ms-2"><i class="fas ${chatType === 'private' ? 'fa-user-friends' : 'fa-headset'}"></i></div>
                </a>`;
        });
    }

    // --- CORE LOGIC ---
    async function switchChatContext(contextData) {
        currentChatContext = contextData;
        document.querySelectorAll('.conversation-item.active').forEach(el => el.classList.remove('active'));
        const activeItem = document.querySelector(`.conversation-item[data-id='${contextData.id}']`);
        if (activeItem) activeItem.classList.add('active');

        const partnerAvatar = getAvatarDetails(contextData.name);
        chatHeader.innerHTML = `
            <div class="avatar-initials ${partnerAvatar.avatarClass}">${partnerAvatar.initials}</div>
            <div><div class="fw-bold">${contextData.name}</div><small class="text-muted">${contextData.type} Chat</small></div>`;

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
            // *** THE FIX IS HERE ***
            // Instead of using a hardcoded name, we use the currently selected role's identity.
            const senderName = currentUserIdentity;

            const method = currentChatContext.type === 'group' ? "SendPublicMessage" : "SendPrivateMessage";
            const args = currentChatContext.type === 'group' ? [senderName, message] : [currentChatContext.id, senderName, message];

            await connection.invoke(method, ...args);
            messageInput.value = "";
            updateSendButtonState();
        } catch (err) {
            console.error("Error sending message:", err);
        }
    }

    function handleTabClick(e) {
        e.preventDefault();
        const tab = e.target.dataset.tab;
        if (!tab) return;

        activeSidebarTab = tab;
        document.querySelectorAll('#sidebar-nav-container .nav-link').forEach(l => l.classList.remove('active'));
        e.target.classList.add('active');

        if (tab === 'group') {
            conversationListContainer.innerHTML = '';
            switchChatContext({ type: 'group', id: 'public', name: 'Public Group Chat' });
        } else {
            renderSidebarList();
            const firstItem = conversationListContainer.querySelector('.conversation-item');
            if (firstItem) {
                switchChatContext(firstItem.dataset);
            } else {
                chatPanelBody.innerHTML = '<div class="text-center p-3">No one to chat with in this section.</div>';
                chatHeader.innerHTML = '';
            }
        }
    }

    function setViewForRole(role) {
        currentUserIdentity = role;
        const isAdmin = teamMembers.some(u => u.name === role);

        dashboardBody.className = isAdmin ? 'role-admin' : 'role-customer';
        sidebarNav.style.display = isAdmin ? 'block' : 'none';

        if (isAdmin) {
            document.querySelector('.nav-link[data-tab="group"]').click();
        } else {
            // Customer view: only one chat context is possible (with support)
            switchChatContext({ type: 'private', id: generateGroupName(role, supportAgentIdentity), name: supportAgentIdentity });
        }
    }

    // --- INITIALIZATION ---
    roleSwitcher.innerHTML = teamMembers.map(u => `<option value="${u.name}">Role: ${u.name}</option>`).join('') +
        customerList.map(u => `<option value="${u.name}">Role: ${u.name}</option>`).join('');

    sidebarNav.addEventListener('click', handleTabClick);
    roleSwitcher.addEventListener('change', (e) => setViewForRole(e.target.value));
    conversationListContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.conversation-item');
        if (item) { e.preventDefault(); switchChatContext(item.dataset); }
    });
    messageInput.addEventListener("keyup", (e) => { updateSendButtonState(); if (e.key === "Enter") sendButton.click(); });
    sendButton.addEventListener("click", sendMessage);

    connection.on("ReceivePublicMessage", (sender, msg, time, initials) => {
        const data = { sender, message: msg, timestamp: time, initials };
        saveMessageToHistory('public', data);
        if (currentChatContext.id === 'public') { displayMessage(data); scrollToBottom(); }
    });
    connection.on("ReceivePrivateMessage", (group, sender, msg, time, initials) => {
        const data = { sender, message: msg, timestamp: time, initials };
        saveMessageToHistory(group, data);
        if (currentChatContext.id === group) { displayMessage(data); scrollToBottom(); }
    });

    connection.start().then(() => {
        console.log("SignalR Connected.");
        setViewForRole(supportAgentIdentity); // Initialize as default support agent
        updateSendButtonState();
    }).catch(err => console.error("SignalR Connection Error: ", err));
});