"use strict";

document.addEventListener("DOMContentLoaded", () => {
    let currentUser = {
        name: serverData.currentUserName,
        id: serverData.currentUserId,
    };

    let currentClient = {
        id: serverData.currentClientId,
        name: serverData.currentUserName
    };

    let currentChatContext = {};
    let lastMessageDate = null;
    let notifications = [];
    let notificationSound = null;
    let unreadCount = 0;

    const fullscreenBtn = document.getElementById("fullscreen-btn");
    const messageInput = document.getElementById("message-input");
    const sendButton = document.getElementById("send-button");
    const chatPanelBody = document.getElementById("chat-panel-body");
    const chatHeader = document.getElementById("chat-header");
    const fileInput = document.getElementById("file-input");
    const attachmentButton = document.getElementById("attachment-button");
    const notificationBell = document.querySelector('[data-bs-target="#notificationsModal"]');

    const supportTicketsTable = $('#supportTicketsDataTable');
    const inquiriesTable = $('#inquiriesDataTable');

    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/chathub")
        .withAutomaticReconnect()
        .build();

    const initializeNotifications = () => {
        notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmgfCDGH0fPTgjMGHm7A7+OZRA0PVqzn77BdGAg+ltryxnkpBSl+zPLaizsIGGS57OihUg4LTKXh8bllHgg2jdXzzn0vBSF1xe/glEILElyx6OyrWBUIQ5zd8sFuIAUuhM/z1YU2Bhxqvu7mnEoODlOq5O+zYBoGPJPY88p9KwUme8rx3I4+CRZiturqpVQOC0ml4PK8aB4GM4nU8tGAMgYfcsLu45ZFDBFYrebe9cJ+Jg==');
        notificationSound.volume = 0.3;

        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    };

    const showDesktopNotification = (title, body, icon = '/images/infobrain-logo.jpg') => {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body: body,
                icon: icon,
                badge: icon,
                tag: 'chat-notification',
                requireInteraction: false
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            setTimeout(() => notification.close(), 5000);
        }
    };

    const playNotificationSound = () => {
        if (notificationSound) {
            notificationSound.play().catch(e => console.log('Could not play notification sound:', e));
        }
    };

    const updateNotificationBadge = () => {
        if (notificationBell) {
            let badge = notificationBell.querySelector('.notification-badge');
            if (unreadCount > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'notification-badge position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger';
                    badge.style.fontSize = '0.7rem';
                    notificationBell.appendChild(badge);
                }
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = 'block';
            } else if (badge) {
                badge.style.display = 'none';
            }
        }
    };

    const addNotification = (notification) => {
        notifications.unshift({
            id: Date.now(),
            ...notification,
            timestamp: new Date(),
            read: false
        });

        if (notifications.length > 50) {
            notifications = notifications.slice(0, 50);
        }

        updateNotificationsList();
    };

    const updateNotificationsList = () => {
        const notificationsContainer = document.querySelector('#notificationsModal .modal-body .list-group');
        if (!notificationsContainer) return;

        notificationsContainer.innerHTML = '';

        if (notifications.length === 0) {
            notificationsContainer.innerHTML = `
                <div class="list-group-item text-center text-muted">
                    <i class="fas fa-bell-slash mb-2"></i>
                    <p class="mb-0">No notifications</p>
                </div>
            `;
            return;
        }

        notifications.forEach(notification => {
            const item = document.createElement('div');
            item.className = `list-group-item list-group-item-action ${!notification.read ? 'bg-light border-start border-primary border-3' : ''}`;
            item.innerHTML = `
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${escapeHtml(notification.title || 'New Message')}</h6>
                    <small class="text-muted">${formatNotificationTime(notification.timestamp)}</small>
                </div>
                <p class="mb-1">${escapeHtml(notification.message || '')}</p>
                <small class="text-muted">
                    ${notification.senderName ? `From: ${escapeHtml(notification.senderName)}` : ''}
                    ${notification.conversationId ? ` | Chat #${notification.conversationId}` : ''}
                </small>
            `;

            item.addEventListener('click', () => {
                if (notification.conversationId) {
                    const convItem = document.querySelector(`.conversation-item[data-id="${notification.conversationId}"]`);
                    if (convItem) {
                        convItem.click();
                    }
                }
                notification.read = true;
                updateNotificationsList();
                updateUnreadCount();
            });

            notificationsContainer.appendChild(item);
        });
    };

    const formatNotificationTime = (timestamp) => {
        const now = new Date();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    const updateUnreadCount = () => {
        unreadCount = notifications.filter(n => !n.read).length;
        updateNotificationBadge();
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const validateFile = (file) => {
        const maxSize = 10 * 1024 * 1024;
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain', 'application/zip', 'application/x-zip-compressed'
        ];

        if (file.size > maxSize) {
            throw new Error(`File size must be less than ${formatFileSize(maxSize)}`);
        }

        if (!allowedTypes.includes(file.type)) {
            throw new Error('File type not allowed. Please select an image, PDF, Word document, text, or zip file.');
        }

        return true;
    };

    const uploadFile = async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/FileUpload/UploadFile', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'File upload failed');
            }

            const result = await response.json();
            console.log('File uploaded successfully:', result);
            return result;
        } catch (error) {
            console.error('File upload error:', error);
            throw error;
        }
    };

    const updateFileInputDisplay = () => {
        const existingPreview = document.querySelector('.file-preview');
        if (existingPreview) {
            existingPreview.remove();
        }

        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const preview = document.createElement('div');
            preview.className = 'file-preview p-2 mb-2 border rounded bg-light';
            preview.innerHTML = `
                <div class="d-flex align-items-center">
                    <i class="fas fa-paperclip me-2 text-primary"></i>
                    <span class="file-name flex-grow-1">${escapeHtml(file.name)}</span>
                    <small class="text-muted me-2">${formatFileSize(file.size)}</small>
                    <button class="btn btn-sm btn-outline-danger" onclick="clearFileSelection()" type="button">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;

            const chatFooter = document.querySelector('.chat-footer');
            const typingIndicator = document.getElementById('typing-indicator');
            if (chatFooter && typingIndicator) {
                chatFooter.insertBefore(preview, typingIndicator);
            }
        }
    };

    window.clearFileSelection = () => {
        if (fileInput) {
            fileInput.value = '';
            updateSendButtonState();
        }
    };

    const createAttachmentHtml = (attachmentInfo) => {
        if (!attachmentInfo || !attachmentInfo.url) return '';

        const isImage = attachmentInfo.type && attachmentInfo.type.startsWith('image/');

        if (isImage) {
            return `
                <div class="message-attachment mt-2">
                    <img src="${escapeHtml(attachmentInfo.url)}" 
                         alt="${escapeHtml(attachmentInfo.name || 'Image')}" 
                         class="attachment-image img-fluid rounded shadow-sm"
                         style="max-width: 250px; max-height: 200px; cursor: pointer;"
                         onclick="window.open('${escapeHtml(attachmentInfo.url)}', '_blank')">
                    <div class="mt-1">
                        <small class="text-muted">${escapeHtml(attachmentInfo.name || 'Image')}</small>
                    </div>
                </div>
            `;
        } else {
            const fileIcon = getFileIcon(attachmentInfo.type);
            return `
                <div class="message-attachment mt-2">
                    <a href="${escapeHtml(attachmentInfo.url)}" 
                       target="_blank" 
                       class="attachment-link d-inline-flex align-items-center p-2 border rounded text-decoration-none bg-light">
                        <i class="fas ${fileIcon} me-2 text-primary"></i>
                        <span class="flex-grow-1">${escapeHtml(attachmentInfo.name || 'Download File')}</span>
                        <small class="text-muted ms-2">
                            <i class="fas fa-download"></i>
                        </small>
                    </a>
                </div>
            `;
        }
    };

    const getFileIcon = (mimeType) => {
        if (!mimeType) return 'fa-file';

        if (mimeType.includes('pdf')) return 'fa-file-pdf';
        if (mimeType.includes('word') || mimeType.includes('document')) return 'fa-file-word';
        if (mimeType.includes('text')) return 'fa-file-text';
        if (mimeType.includes('zip')) return 'fa-file-archive';
        if (mimeType.includes('image')) return 'fa-file-image';

        return 'fa-file';
    };

    const formatTimestamp = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const updateSendButtonState = () => {
        if (!sendButton || !messageInput) return;

        const hasText = messageInput.value.trim().length > 0;
        const hasFile = fileInput && fileInput.files.length > 0;
        const isConnected = connection.state === signalR.HubConnectionState.Connected;
        const hasActiveChat = currentChatContext && currentChatContext.id;

        const shouldEnable = isConnected && hasActiveChat && (hasText || hasFile);

        sendButton.disabled = !shouldEnable;
        sendButton.classList.toggle('btn-primary', shouldEnable);
        sendButton.classList.toggle('btn-secondary', !shouldEnable);
        updateFileInputDisplay();

        console.log('Send button state updated:', {
            disabled: sendButton.disabled,
            hasText,
            hasFile,
            isConnected,
            hasActiveChat,
            connectionState: connection.state
        });
    };

    const scrollToBottom = () => {
        if (chatPanelBody) {
            chatPanelBody.scrollTop = chatPanelBody.scrollHeight;
        }
    };

    function escapeHtml(text) {
        if (text === null || typeof text === 'undefined') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    const generatePriorityBadge = (priority) => {
        const p = priority ? priority.toLowerCase() : 'normal';
        const badgeClass = `badge-priority-${p}`;
        return `<span class="badge ${badgeClass}">${escapeHtml(priority || 'Normal')}</span>`;
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

    function addDateSeparatorIfNeeded(msgDateStr) {
        if (!chatPanelBody) return;
        const dateStr = new Date(msgDateStr).toDateString();
        if (lastMessageDate !== dateStr) {
            lastMessageDate = dateStr;
            const ds = document.createElement("div");
            ds.className = "date-separator text-center my-3";
            ds.innerHTML = `<span class="badge bg-secondary">${formatDateForSeparator(msgDateStr)}</span>`;
            chatPanelBody.appendChild(ds);
        }
    }

    if (attachmentButton) {
        attachmentButton.addEventListener('click', () => {
            fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    validateFile(file);
                    console.log('File selected:', file.name, formatFileSize(file.size));
                } catch (error) {
                    alert(error.message);
                    fileInput.value = '';
                    return;
                }
            }
            updateSendButtonState();
        });
    }

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

    function displayMessage(msg, isHistory = false) {
        if (!chatPanelBody) {
            console.error("CRITICAL: displayMessage was called but 'chatPanelBody' is null!");
            return;
        }

        if (!msg || !msg.dateTime) {
            console.error("Invalid message object received:", msg);
            return;
        }

        addDateSeparatorIfNeeded(msg.dateTime);

        const isSent = msg.clientAuthUserId != null && msg.clientAuthUserId === currentUser.id;
        // ✅ CONSISTENT: Use consistent sender names - fixed logic
        const senderName = msg.senderName || (isSent ? currentUser.name : "Administrator");

        const row = document.createElement('div');
        row.className = `message-row ${isSent ? 'sent' : 'received'} mb-3`;

        let attachmentHtml = '';
        if (msg.attachmentId) {
            try {
                const attachmentInfo = JSON.parse(msg.attachmentId);
                attachmentHtml = createAttachmentHtml(attachmentInfo);
            } catch (e) {
                console.error('Error parsing attachment info:', e);
            }
        }

        row.innerHTML = `
        <div class="message-bubble p-3 rounded shadow-sm ${isSent ? 'bg-primary text-white ms-auto' : 'bg-light'}">
            <div class="message-sender fw-bold mb-1 ${isSent ? 'text-white-50' : 'text-muted'}">${escapeHtml(senderName)}</div>
            ${msg.instruction ? `<p class="message-text mb-2">${escapeHtml(msg.instruction)}</p>` : ''}
            ${attachmentHtml}
            <div class="message-timestamp text-end mt-2">
                <small class="${isSent ? 'text-white-50' : 'text-muted'}">${formatTimestamp(msg.dateTime)}</small>
            </div>
        </div>`;

        chatPanelBody.appendChild(row);

        if (!isHistory) {
            scrollToBottom();

            if (!isSent && (!document.hasFocus() || currentChatContext.id != msg.instructionId)) {
                showDesktopNotification(
                    `New message from ${senderName}`,
                    msg.instruction || '📎 Attachment',
                    '/images/infobrain-logo.jpg'
                );
                playNotificationSound();

                addNotification({
                    title: `New Message`,
                    message: msg.instruction || '📎 File attachment',
                    senderName: senderName,
                    conversationId: msg.instructionId,
                    type: 'message'
                });

                unreadCount++;
                updateNotificationBadge();
            }
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
        item.className = 'list-group-item list-group-item-action conversation-item border-0 rounded mb-1';
        item.dataset.id = itemData.conversationId;
        item.dataset.name = itemData.displayName;
        item.dataset.type = type;
        item.dataset.route = itemData.route;

        item.innerHTML = `
            <div class="d-flex w-100 align-items-center">
                <div class="avatar-initials ${itemData.avatarClass || 'avatar-bg-secondary'} me-3 rounded-circle d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                    ${itemData.avatarInitials || '?'}
                </div>
                <div class="flex-grow-1">
                    <div class="fw-bold">${escapeHtml(itemData.displayName)}</div>
                    <small class="text-muted">${escapeHtml(itemData.subtitle)}</small>
                </div>
                <div class="unread-indicator d-none">
                    <span class="badge bg-danger rounded-pill">•</span>
                </div>
            </div>`;

        return item;
    }

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
        currentChatContext = {
            id: contextData.id,
            name: contextData.name,
            type: contextData.type,
            route: contextData.route
        };

        console.log("CLIENT: Switched chat context to:", currentChatContext);

        const activeItem = document.querySelector(`.conversation-item[data-id="${currentChatContext.id}"]`);
        if (activeItem) {
            activeItem.classList.add("active");
            const unreadIndicator = activeItem.querySelector('.unread-indicator');
            if (unreadIndicator) {
                unreadIndicator.classList.add('d-none');
            }
        }

        document.querySelectorAll(".conversation-item.active").forEach(el => {
            if (el !== activeItem) el.classList.remove("active");
        });

        if (chatHeader) {
            chatHeader.innerHTML = `
                <div class="d-flex align-items-center">
                    <div class="fw-bold">${escapeHtml(currentChatContext.name)}</div>
                    <div class="ms-auto">
                        <span class="badge bg-success" id="connection-status">Connected</span>
                    </div>
                </div>`;
        }

        updateSendButtonState();

        try {
            await connection.invoke("JoinPrivateChat", currentChatContext.id);
            await loadMessagesForConversation(currentChatContext.id);
        } catch (err) {
            console.error("Error switching chat context:", err);
        }
    }

    async function loadMessagesForConversation(conversationId) {
        if (!chatPanelBody) return;
        chatPanelBody.innerHTML = '<div class="text-center p-3"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
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
            chatPanelBody.innerHTML = `<div class="alert alert-danger m-3">Error loading messages: ${error.message}</div>`;
        }
    }

    async function sendMessage() {
        console.log('Send message called');

        if (!messageInput || !currentChatContext.route) {
            console.error('Missing messageInput or currentChatContext.route');
            return;
        }

        const messageText = messageInput.value.trim();
        const hasFile = fileInput && fileInput.files.length > 0;

        if (!messageText && !hasFile) {
            console.log('No message text or file to send');
            return;
        }

        if (!currentChatContext.route) {
            alert("Please select a conversation to send a message.");
            return;
        }

        const originalButtonContent = sendButton.innerHTML;
        sendButton.disabled = true;
        sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

        try {
            let attachmentInfo = null;

            if (hasFile) {
                const file = fileInput.files[0];
                console.log('Uploading file:', file.name);

                sendButton.innerHTML = '<i class="fas fa-cloud-upload-alt fa-spin"></i> Uploading...';

                try {
                    attachmentInfo = await uploadFile(file);
                    console.log('File uploaded successfully:', attachmentInfo);
                } catch (error) {
                    console.error('File upload failed:', error);
                    alert(`File upload failed: ${error.message}`);
                    return;
                }
            }

            sendButton.innerHTML = '<i class="fas fa-paper-plane fa-spin"></i> Sending...';

            const postUrl = `/v1/api/instructions/reply`;

            const chatMessage = {
                Instruction: messageText || `📎 ${attachmentInfo?.name || 'File attachment'}`,
                ClientId: currentClient.id,
                ClientAuthUserId: currentUser.id,
                InsertUser: 1,
                InstructionId: parseInt(currentChatContext.id, 10),
                InstCategoryId: 100,
                ServiceId: 3,
                Remarks: "Message from web chat",
                AttachmentId: attachmentInfo ? JSON.stringify(attachmentInfo) : null
            };

            console.log("SENDING THIS OBJECT:", JSON.stringify(chatMessage, null, 2));

            const response = await fetch(postUrl, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(chatMessage),
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(errorData.message || "Failed to send message.");
            }

            const savedMessage = await response.json();
            console.log("CLIENT SIDE: Invoking 'SendClientMessage' with message object:", savedMessage);

            await connection.invoke("SendClientMessage", savedMessage, false);

            messageInput.value = '';
            if (fileInput) {
                fileInput.value = '';
            }

            const existingPreview = document.querySelector('.file-preview');
            if (existingPreview) {
                existingPreview.remove();
            }

            updateSendButtonState();

            console.log('Message sent successfully');
        } catch (error) {
            console.error("Error sending message:", error);
            alert(`Error: ${error.message}`);
        } finally {
            sendButton.innerHTML = originalButtonContent;
            updateSendButtonState();
        }
    }

    function initializeTicketSystem() {
        const newTicketBtn = document.getElementById("newSupportTicketBtn");
        const newInquiryBtn = document.getElementById("newInquiryBtn");

        const createTicketModalEl = document.getElementById("newSupportTicketModal");
        const createInquiryModalEl = document.getElementById("newInquiryModal");

        const createTicketModal = createTicketModalEl ? new bootstrap.Modal(createTicketModalEl) : null;
        const createInquiryModal = createInquiryModalEl ? new bootstrap.Modal(createInquiryModalEl) : null;

        const createTicketForm = document.getElementById("supportTicketForm");
        const createInquiryForm = document.getElementById("inquiryForm");

        if (newTicketBtn) {
            newTicketBtn.addEventListener("click", () => {
                if (createTicketModal) createTicketModal.show();
            });
        }

        if (createTicketForm) {
            createTicketForm.addEventListener("submit", async (e) => {
                e.preventDefault();

                const subjectSelect = document.getElementById("ticketSubject");
                const descriptionInput = document.getElementById("ticketDescription");
                const remarksInput = document.getElementById("ticketRemarks");
                const expiryDateInput = document.getElementById("ticketExpiryDate");

                if (!subjectSelect) {
                    console.error("Could not find element with ID 'ticketSubject'.");
                    alert("An error occurred. Could not find the subject field");
                    return;
                }

                const ticketTypeRoute = subjectSelect.value;
                const description = descriptionInput.value;
                const remarks = remarksInput.value;
                const expiryDate = expiryDateInput.value;
                const priority = document.getElementById("ticketPriority").value;

                if (!ticketTypeRoute || !description) {
                    alert("Please fill all the required fields for the ticket.");
                    return;
                }

                const submitBtn = document.querySelector('button[form="supportTicketForm"][type="submit"]');
                if (!submitBtn) {
                    console.error("Could not find submit button for support ticket form");
                    alert("An error occurred. Could not find the submit button.");
                    return;
                }

                const originalText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

                const chatMessage = {
                    Instruction: description,
                    Remarks: remarks,
                    Priority: priority,
                    expiryDate: expiryDate,
                    InstructionId: null,
                    ClientId: currentClient.id,
                    ClientAuthUserId: currentUser.id,
                    InsertUser: 1,
                    InstCategoryId: 101,
                    ServiceId: 3,
                };

                try {
                    const response = await fetch(`/v1/api/instructions/${ticketTypeRoute}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(chatMessage)
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || "Failed to create ticket.");
                    }

                    await loadSidebarForClient(currentClient.id);

                    addNotification({
                        title: 'Ticket Created',
                        message: 'Your support ticket has been created successfully',
                        type: 'success'
                    });

                    alert("Ticket created successfully!");
                    if (createTicketModal) createTicketModal.hide();
                    createTicketForm.reset();
                } catch (error) {
                    console.error("Error creating ticket:", error);
                    alert(`Error: ${error.message}`);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            });
        }

        if (newInquiryBtn) {
            newInquiryBtn.addEventListener("click", () => {
                if (createInquiryModal) createInquiryModal.show();
            });
        }

        if (createInquiryForm) {
            createInquiryForm.addEventListener("submit", async (e) => {
                e.preventDefault();

                const subjectSelect = document.getElementById("inquirySubject");
                const messageInputInquiry = document.getElementById("inquiryMessage");

                if (!subjectSelect) {
                    console.error("Could not find element with ID 'inquirySubject'.");
                    alert("An error occurred. Could not find the subject field.");
                    return;
                }

                const inquiryType = subjectSelect.value;
                const message = messageInputInquiry.value;

                let inquiryRoute;

                if (inquiryType === "Account Inquiry") {
                    inquiryRoute = "inquiry/accounts";
                } else if (inquiryType === "Sales and Management") {
                    inquiryRoute = "inquiry/sales";
                } else {
                    alert("Please select a valid inquiry type.");
                    return;
                }

                const submitBtn = document.querySelector('button[form="inquiryForm"][type="submit"]');
                if (!submitBtn) {
                    console.error("Could not find submit button for inquiry form");
                    alert("An error occurred. Could not find the submit button.");
                    return;
                }

                const originalText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

                const chatMessage = {
                    Instruction: message,
                    InstructionId: null,
                    ClientId: currentClient.id,
                    ClientAuthUserId: currentUser.id,
                    InsertUser: 1,
                    InstCategoryId: 102,
                    ServiceId: 3,
                };

                try {
                    const response = await fetch(`/v1/api/instructions/${inquiryRoute}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(chatMessage)
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || `Failed to create inquiry: ${response.statusText}`);
                    }

                    await loadSidebarForClient(currentClient.id);

                    addNotification({
                        title: 'Inquiry Sent',
                        message: 'Your inquiry has been sent successfully',
                        type: 'success'
                    });

                    alert("Inquiry sent successfully!");

                    if (createInquiryModal) createInquiryModal.hide();
                    createInquiryForm.reset();
                } catch (error) {
                    console.error("Error creating inquiry:", error);
                    alert(`Error: ${error.message}`);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            });
        }
    }

    connection.on("ReceivePrivateMessage", (message) => {
        console.log("CLIENT SIDE: 'ReceivePrivateMessage' event fired. Message received:", message);

        const conversationId = message.instructionId;

        console.log(`CLIENT RECEIVER: Comparing incoming message ID (${conversationId}) with currently open chat ID (${currentChatContext.id})`);

        if (currentChatContext && String(currentChatContext.id) === String(conversationId)) {
            displayMessage(message, false);
        } else {
            const convItem = document.querySelector(`.conversation-item[data-id="${conversationId}"]`);
            if (convItem) {
                convItem.classList.add('has-unread');
                const subtitle = convItem.querySelector('.text-muted');
                if (subtitle) {
                    subtitle.textContent = message.instruction || '📎 Attachment';
                }

                const unreadIndicator = convItem.querySelector('.unread-indicator');
                if (unreadIndicator) {
                    unreadIndicator.classList.remove('d-none');
                }
            }
        }
    });

    connection.onreconnecting((error) => {
        console.log('SignalR reconnecting:', error);
        updateSendButtonState();
        const statusBadge = document.getElementById('connection-status');
        if (statusBadge) {
            statusBadge.className = 'badge bg-warning';
            statusBadge.textContent = 'Reconnecting...';
        }
    });

    connection.onreconnected((connectionId) => {
        console.log('SignalR reconnected:', connectionId);
        updateSendButtonState();
        const statusBadge = document.getElementById('connection-status');
        if (statusBadge) {
            statusBadge.className = 'badge bg-success';
            statusBadge.textContent = 'Connected';
        }
    });

    connection.onclose((error) => {
        console.log('SignalR connection closed:', error);
        updateSendButtonState();
        const statusBadge = document.getElementById('connection-status');
        if (statusBadge) {
            statusBadge.className = 'badge bg-danger';
            statusBadge.textContent = 'Disconnected';
        }
    });

    async function init() {
        try {
            initializeNotifications();

            await connection.start();
            console.log("SignalR Connected.");
            updateSendButtonState();

            await loadSidebarForClient(currentClient.id);

        } catch (err) {
            console.error("Initialization Error: ", err);
            if (chatHeader) {
                chatHeader.innerHTML = `<div class="alert alert-danger">Connection Failed: ${err.message}</div>`;
            }
            updateSendButtonState();
            return;
        }

        if (supportTicketsTable.length) {
            const dt = supportTicketsTable.DataTable({
                "ajax": { "url": `/v1/api/instructions/tickets/${currentClient.id}`, "dataSrc": "data" },
                "columns": [
                    { "data": "id", "title": "ID", "render": (d) => `#${d}` },
                    { "data": "subject", "title": "Subject", "render": (data, type, row) => `<div><strong>${escapeHtml(data)}</strong><div class="text-muted small">Created: ${new Date(row.date).toLocaleDateString()}</div></div>` },
                    { "data": "status", "title": "Status", "render": (data) => `<span class="badge badge-status-${(data || 'pending').toLowerCase().replace(' ', '-')}">${escapeHtml(data || 'Pending')}</span>` },
                    { "data": "priority", "title": "Priority", "render": (data) => generatePriorityBadge(data) },
                    { "data": null, "title": "Actions", "orderable": false, "className": "text-start", "defaultContent": `<div class="action-buttons"><button class="btn btn-sm btn-outline-primary view-details-btn" title="View Details"><i class="fas fa-eye"></i></button></div>` }
                ],
                "order": [[0, 'desc']],
                "language": { "emptyTable": "You have not created any support tickets yet." },
                "pageLength": 10,
                "responsive": true
            });

            supportTicketsTable.on('click', '.view-details-btn', function () {
                const rowData = dt.row($(this).parents('tr')).data();
                if (!rowData) return;

                $('#details-id').text(rowData.id);
                $('#details-subject').text(rowData.subject);
                $('#details-date').text(new Date(rowData.date).toLocaleString());
                $('#details-createdBy').text(rowData.createdBy || 'N/A');
                $('#details-resolvedBy').text(rowData.resolvedBy || 'N/A');
                $('#details-status').html(`<span class="badge badge-status-${(rowData.status || 'pending').toLowerCase()}">${escapeHtml(rowData.status || 'Pending')}</span>`);
                $('#details-priority').html(generatePriorityBadge(rowData.priority));
                $('#details-description').text(rowData.instruction || 'No description provided.');

                try {
                    const remarksObj = JSON.parse(rowData.remarks);
                    $('#details-remarks').text(remarksObj.message || 'N/A');
                } catch (e) {
                    $('#details-remarks').text(rowData.remarks || 'N/A');
                }

                const editButton = $('#editTicketBtn');
                if (rowData.status !== 'Resolved') {
                    editButton.show();
                    editButton.data('ticketId', rowData.id);
                } else {
                    editButton.hide();
                }

                new bootstrap.Modal(document.getElementById('viewTicketDetailsModal')).show();
            });
        }

        if (inquiriesTable.length) {
            inquiriesTable.DataTable({
                "ajax": {
                    "url": `/v1/api/instructions/inquiries/${currentClient.id}`,
                    "dataSrc": "data"
                },
                "columns": [
                    { "data": "id" },
                    { "data": "topic" },
                    { "data": "inquiredBy" },
                    { "data": "date", "render": function (data) { return new Date(data).toLocaleDateString(); } },
                    { "data": "outcome" }
                ],
                "pageLength": 10,
                "responsive": true
            });
        }

        initializeTicketSystem();

        const conversationListPanel = document.getElementById("conversation-list-panel");
        if (conversationListPanel) {
            conversationListPanel.addEventListener('click', (e) => {
                const conversationItem = e.target.closest('.conversation-item');
                if (!conversationItem) return;
                e.preventDefault();
                switchChatContext(conversationItem.dataset);
            });
        }

        const clientSwitcher = document.getElementById("client-switcher");
        if (clientSwitcher) {
            clientSwitcher.addEventListener('change', (e) => {
                const newClientId = parseInt(e.target.value, 10);
                if (isNaN(newClientId)) return;
                currentClient.id = newClientId;
                loadSidebarForClient(newClientId);
                if ($.fn.DataTable.isDataTable(supportTicketsTable)) {
                    supportTicketsTable.DataTable().ajax.url(`/v1/api/instructions/tickets/${newClientId}`).load();
                }
                if ($.fn.DataTable.isDataTable(inquiriesTable)) {
                    inquiriesTable.DataTable().ajax.url(`/v1/api/instructions/inquiries/${newClientId}`).load();
                }
            });
        }

        if (sendButton) {
            sendButton.addEventListener("click", (e) => {
                e.preventDefault();
                console.log('Send button clicked');
                sendMessage();
            });
        }

        if (messageInput) {
            messageInput.addEventListener("input", () => {
                updateSendButtonState();
            });

            messageInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    console.log('Enter key pressed');
                    sendMessage();
                }
            });

            messageInput.addEventListener("focus", () => {
                if (currentChatContext.id) {
                    notifications.forEach(n => {
                        if (n.conversationId == currentChatContext.id) {
                            n.read = true;
                        }
                    });
                    updateUnreadCount();
                }
            });
        }

        updateSendButtonState();

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && currentChatContext.id) {
                notifications.forEach(n => {
                    if (n.conversationId == currentChatContext.id) {
                        n.read = true;
                    }
                });
                updateUnreadCount();
            }
        });

        console.log("Chat system initialized successfully");
    }

    init();
});