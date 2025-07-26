"use strict";

console.log("chat.js script has been loaded and is starting.");

document.addEventListener("DOMContentLoaded", function () {

    const fullscreenBtn = document.getElementById('fullscreen-btn');

    if (fullscreenBtn) {
        const fullscreenIcon = fullscreenBtn.querySelector('i');

        fullscreenBtn.addEventListener('click', toggleFullscreen);

        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement) {
                fullscreenIcon.classList.remove('fa-expand');
                fullscreenIcon.classList.add('fa-compress');
                fullscreenBtn.title = "Exit Fullscreen";
            } else {
                fullscreenIcon.classList.remove('fa-compress');
                fullscreenIcon.classList.add('fa-expand');
                fullscreenBtn.title = "Enter Fullscreen";
            }
        });
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
                .catch(err => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }
    console.log("DOMContentLoaded event has fired. The HTML page should be ready.");

    // --- Element References ---
    const userListContainer = document.getElementById('user-list-container');
    const messagesList = document.getElementById('messagesList');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    console.log("Searching for key elements:");
    console.log(" - Found userListContainer:", userListContainer);
    console.log(" - Found messagesList:", messagesList);
    console.log(" - Found messageInput:", messageInput);
    console.log(" - Found sendButton:", sendButton);

    if (!userListContainer || !messagesList || !messageInput || !sendButton) {
        console.error("CRITICAL ERROR: One or more essential HTML elements were not found. The script cannot continue. Please check the IDs in your Support.cshtml file.");
        return; // Stops the execution to prevent further errors
    }

    console.log("All elements found successfully. Initializing SignalR and event listeners...");

    let currentConversationId = null;
    let myUsername = "Client";

    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/chathub")
        .withAutomaticReconnect()
        .build();

    connection.on("ReceiveMessage", (conversationId, user, message, timestamp) => {
        if (conversationId === currentConversationId && user !== myUsername) {
            addMessageToChat(user, message, timestamp, false);
        }
    });

    function addMessageToChat(user, message, timestamp, isSentByMe) {
        const messageContainer = document.createElement('div');
        messageContainer.classList.add('d-flex', 'flex-row', isSentByMe ? 'justify-content-end' : 'justify-content-start');
        const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const myAvatarUrl = "https://i.pravatar.cc/150?img=10";
        const theirAvatarUrl = "https://mdbcdn.b-cdn.net/img/Photos/new-templates/bootstrap-chat/ava1-bg.webp";
        const sanitizedMessage = message.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
        let messageHtml = '';
        if (isSentByMe) {
            messageHtml = `<div><p class="small p-2 me-3 mb-1 text-white rounded-3 bg-primary">${sanitizedMessage}</p><p class="small me-3 mb-3 rounded-3 text-muted">${time}</p></div><img src="${myAvatarUrl}" alt="my avatar" style="width: 45px; height: 100%;" class="rounded-circle">`;
        } else {
            messageHtml = `<img src="${theirAvatarUrl}" alt="their avatar" style="width: 45px; height: 100%;"><p class="small p-2 ms-3 mb-1 rounded-3 bg-body-tertiary">${sanitizedMessage}</p><p class="small ms-3 mb-3 rounded-3 text-muted float-end">${time}</p></div>`;
        }
        messageContainer.innerHTML = messageHtml;
        messagesList.appendChild(messageContainer);
        messagesList.scrollTop = messagesList.scrollHeight;
    }

    function sendMessage() {
        const message = messageInput.value;
        if (message && message.trim() && currentConversationId) {
            connection.invoke("SendMessage", currentConversationId, myUsername, message).catch(err => console.error("SendMessage error: ", err.toString()));
            addMessageToChat(myUsername, message, new Date(), true);
            messageInput.value = "";
            messageInput.focus();
        }
    }

    async function switchConversation(selectedItem) {
        userListContainer.querySelectorAll('li.p-2').forEach(item => item.style.backgroundColor = '');
        selectedItem.style.backgroundColor = '#f5f5f5';
        currentConversationId = selectedItem.dataset.conversationId;
        messagesList.innerHTML = '';
        try {
            await connection.invoke("JoinConversationRoom", currentConversationId);
            console.log(`Joined room: conversation-${currentConversationId}`);
            addMessageToChat('System', `You are now viewing conversation ${currentConversationId}.`, new Date(), false);
        } catch (e) { console.error(`Failed to join room: ${e}`); }
    }

    userListContainer.addEventListener('click', function (e) {
        const targetItem = e.target.closest('li.p-2');
        if (targetItem) {
            switchConversation(targetItem);
        }
    });

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage();
        }
    });

    async function startSignalR() {
        try {
            await connection.start();
            console.log("SignalR Connected.");
            messageInput.disabled = false;
            sendButton.disabled = false;
        } catch (err) {
            console.error("SignalR Connection Failed: ", err);
            setTimeout(startSignalR, 5000);
        }
    }

    startSignalR();
});