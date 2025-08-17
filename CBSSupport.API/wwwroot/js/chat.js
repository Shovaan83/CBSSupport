"use strict";

document.addEventListener("DOMContentLoaded", () => {
    // --- Globals & State ---

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
    let currentTicketData = null;

    // --- DOM References ---
    const fullscreenBtn = document.getElementById("fullscreen-btn");
    const messageInput = document.getElementById("message-input");
    const sendButton = document.getElementById("send-button");
    const chatPanelBody = document.getElementById("chat-panel-body");
    const chatHeader = document.getElementById("chat-header");
    const fileInput = document.getElementById("file-input");

    const supportTicketsTableE1 = $('#supportTicketsDataTable');
    const inquiriesTableE1 = $('#inquiriesDataTable');

    // --- SignalR Connection ---
    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/chathub", {
            accessTokenFactory: () => {
                return localStorage.getItem("accessToken") || "";
            }
        })
        .withAutomaticReconnect()
        .build();

    // --- Helper Functions ---
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
            ds.className = "date-separator";
            ds.textContent = formatDateForSeparator(msgDateStr);
            chatPanelBody.appendChild(ds);
        }
    }

    function populateEditTicketForm(ticketData) {
        currentTicketData = ticketData;

        $('#edit-ticketId').val(ticketData.id);
        $('#edit-fullName').val(ticketData.createdBy || ''); 

        let priority = 'Normal';
        try {
            if (ticketData.remarks) {
                const remarksObj = JSON.parse(ticketData.remarks);
                priority = remarksObj.priority || 'Normal';
            }
        } catch (e) {
            priority = ticketData.priority || 'Normal';
        }

        $('#edit-ticketPriority').val(priority); // Fixed: added #
        $('#edit-ticketDescription').val(ticketData.instruction || ''); // Fixed: added #

        let userRemarks = '';
        try {
            if (ticketData.remarks) {
                const remarksObj = JSON.parse(ticketData.remarks);
                userRemarks = remarksObj.userremarks || '';
            }
        } catch (e) {
            userRemarks = ticketData.remarks || '';
        }

        $('#edit-ticketRemarks').val(userRemarks);

        if (ticketData.expiryDate) {
            const expiryDate = new Date(ticketData.expiryDate);
            const formattedDate = expiryDate.toISOString().slice(0, 16);
            $('#edit-ticketExpiryDate').val(formattedDate);
        }

        const subjectMap = {
            110: 'ticket/training',
            111: 'ticket/migration',
            112: 'ticket/setup',
            113: 'ticket/correction',
            114: 'ticket/bug-fix',
            115: 'ticket/new-feature',
            116: 'ticket/feature-enhancement',
            117: 'ticket/backend-workaround'
        };

        const subjectOptions = `
            <option value="" disabled>Select a subject...</option>
            <option value="ticket/training">Training</option>
            <option value="ticket/migration">Migration</option>
            <option value="ticket/setup">Setup</option>
            <option value="ticket/correction">Correction</option>
            <option value="ticket/bug-fix">Bug Fix</option>
            <option value="ticket/new-feature">New Feature Request</option>
            <option value="ticket/feature-enhancement">Feature Enhancement</option>
            <option value="ticket/backend-workaround">Backend Workaround</option>
        `;

        $('#edit-ticketSubject').html(subjectOptions);

        const selectedSubject = subjectMap[ticketData.instTypeId] || '';
        if (selectedSubject) {
            $('#edit-ticketSubject').val(selectedSubject);
        }
    } 

    async function saveTicketChanges() {
        if (!currentTicketData) {
            alert('No ticket data available for editing.');
            return;
        }

        const form = document.getElementById('editTicketForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const ticketId = $('#edit-ticketId').val();

        let expiryDate = $('#edit-ticketExpiryDate').val();
        if (expiryDate) {
            expiryDate = new Date(expiryDate).toISOString();
        }

        const updatedTicket = {
            Id: parseInt(ticketId, 10),
            Instruction: $('#edit-ticketDescription').val(),
            Priority: $('#edit-ticketPriority').val(),
            Remarks: $('#edit-ticketRemarks').val(),
            ExpiryDate: expiryDate,
            EditUser: currentUser.id,
            EditDate: new Date().toISOString(),
            ClientId: currentClient.id,
            ClientAuthUserId: currentUser.id,
            InsertUser: currentUser.id,
            InstCategoryId: 101,
            ServiceId: 3
        };

        console.log("UPDATE PAYLOAD:", JSON.stringify(updatedTicket, null, 2));

        try {
            const response = await fetch(`/v1/api/instructions/update/${ticketId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTicket)
            });

            const responseText = await response.text();
            console.log("Server response:", responseText);

            if (!response.ok) {
                let errorData;
                try {
                    errorData = JSON.parse(responseText);
                } catch (e) {
                    errorData = { message: responseText || 'Unknown server error' };
                }
                console.error("Server validation errors:", errorData);
                throw new Error(errorData.message || 'Failed to update ticket.');
            }

            alert('Ticket updated successfully!');
            toggleEditMode(false);

            const tables = $.fn.dataTable.tables(true);
            if (tables.length > 0) {
                $(tables).DataTable().ajax.reload(null, false);
            }

            closeTicketModal();

        } catch (error) {
            console.error('Error updating ticket:', error);
            alert(`Error: ${error.message}`);
        }
    }

    function closeTicketModal() {
        const modalElement = document.getElementById('viewTicketDetailsModal');
        const modalInstance = bootstrap.Modal.getInstance(modalElement);

        if (modalInstance) {
            modalInstance.hide();
        }

        setTimeout(() => {

            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => backdrop.remove());

            document.body.classList.remove('modal-open');

            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }, 150); 
    }

    function toggleEditMode(isEditMode) {
        if (isEditMode) {
            $('#ticket-details-view').hide();
            $('#editTicketForm').show();

            $('#editTicketBtn').hide();
            $('#saveChangesBtn').show();
            $('#cancelEditBtn').show();
            $('#closeModalBtn').text('Cancel');
        } else {
            $('#ticket-details-view').show();
            $('#editTicketForm').hide();

            $('#editTicketBtn').show();
            $('#saveChangesBtn').hide();
            $('#cancelEditBtn').hide();
            $('#closeModalBtn').text('Close');
        }
    }

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
        const senderName = msg.senderName || "Support";

        const row = document.createElement('div');
        row.className = `message-row ${isSent ? 'sent' : 'received'}`;

        row.innerHTML = `
        <div class="message-bubble">
            <div class="message-sender">${escapeHtml(senderName)}</div>
            <p class="message-text">${escapeHtml(msg.instruction || '')}</p>
            <div class="message-timestamp">${formatTimestamp(msg.dateTime)}</div>
        </div>`;

        chatPanelBody.appendChild(row);

        if (!isHistory) {
            scrollToBottom();
        }
    }

    function renderSidebar(sidebarData) {
        const containers = {
            private: document.getElementById('private-chat-list'),
            internal: document.getElementById('internal-chat-list'),
        };
        Object.values(containers).forEach(container => { if (container) container.innerHTML = ''; });

        sidebarData.privateChats?.forEach(item => containers.private?.appendChild(createConversationItem(item, 'private')));
        sidebarData.internalChats?.forEach(item => containers.internal?.appendChild(createConversationItem(item, 'internal')));
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
        currentChatContext = {
            id: contextData.id,
            name: contextData.name,
            type: contextData.type,
            route: contextData.route
        };

        console.log("CLIENT: Switched chat context to:", currentChatContext);

        document.querySelectorAll(".conversation-item.active").forEach(el => el.classList.remove("active"));
        const activeItem = document.querySelector(`.conversation-item[data-id="${currentChatContext.id}"]`);
        if (activeItem) activeItem.classList.add("active");

        chatHeader.innerHTML = `<div><div class="fw-bold">${escapeHtml(currentChatContext.name)}</div></div>`;
        if (connection.state !== signalR.HubConnectionState.Connected) {
            console.warn("SignalR connection not ready, waiting...");
            await connection.start();
        }

        try {
            await connection.invoke("JoinPrivateChat", currentChatContext.id.toString());
            await loadMessagesForConversation(currentChatContext.id);
        } catch (error) {
            console.error("Failed to join private chat:", error);
            alert("Failed to join chat. Please try again.");
        }
    }

    async function loadMessagesForConversation(conversationId) {
        if (!chatPanelBody) return;
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
    async function sendMessage() {
        if (!messageInput || !currentChatContext.route) return;
        const messageText = messageInput.value.trim();
        if (!messageText) {
            alert("Please enter a message.");
            return;
        }

        if (!currentChatContext.route) {
            alert("Please select a conversation to send a message.");
            return;
        }

        // Validate that we have the required data
        if (!currentUser.id || currentUser.id <= 0) {
            console.error("Invalid currentUser.id:", currentUser.id);
            alert("User authentication error. Please refresh and try again.");
            return;
        }

        if (!currentClient.id || currentClient.id <= 0) {
            console.error("Invalid currentClient.id:", currentClient.id);
            alert("Client information error. Please refresh and try again.");
            return;
        }

        console.log("DEBUG: Sending message with:", {
            messageText,
            userId: currentUser.id,
            clientId: currentClient.id,
            instructionId: currentChatContext.id
        });

        const postUrl = `/v1/api/instructions/reply`;

        const chatMessage = {
            Instruction: messageText,
            ClientId: parseInt(currentClient.id, 10),
            ClientAuthUserId: parseInt(currentUser.id, 10),
            InsertUser: 1,
            InstructionId: parseInt(currentChatContext.id, 10),
            InstCategoryId: 100,
            ServiceId: 3,
            Remarks: "Message from web chat",
            DateTime: new Date().toISOString(),
            Status: true,
            InstChannel: "chat"
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
                console.error("Server validation errors:", errorData);

                if (errorData.errors) {
                    const errorMessages = Object.entries(errorData.errors)
                        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
                        .join('\n');
                    throw new Error(`Validation errors:\n${errorMessages}`);
                }

                throw new Error(errorData.message || errorData.title || "Failed to send message.");
            }

            const savedMessage = await response.json();
            console.log("CLIENT SIDE: Invoking 'SendClientMessage' with message object:", savedMessage);

            await connection.invoke("SendClientMessage", savedMessage);

            messageInput.value = '';
            updateSendButtonState();
        } catch (error) {
            console.error("Error sending message:", error);
            alert(`Error: ${error.message}`);
        }
    }

    // --- Ticket & Inquiry System ---
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
                const descriptionInput = document.getElementById("ticketDescription")
                const remarksInput = document.getElementById("ticketRemarks")
                const expiryDateInput = document.getElementById("ticketExpiryDate")

                if (!subjectSelect) {
                    console.error("Could not find element with ID 'ticketSubject'.");
                    alert("An error occured. Could not find the subject field");
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

                    alert("Ticket created successfully!");
                    if (createTicketModal) createTicketModal.hide();
                    createTicketForm.reset();
                } catch (error) {
                    console.error("Error creating ticket:", error);
                    alert(error.message);
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
                const messageInput = document.getElementById("inquiryMessage");

                if (!subjectSelect) {
                    console.error("Could not find element with ID 'inquirySubject'.");
                    alert("An error occurred. Could not find the subject field.");
                    return;
                }

                const inquiryType = subjectSelect.value;
                const message = messageInput.value;

                let inquiryRoute;

                if (inquiryType === "Account Inquiry") {
                    inquiryRoute = "inquiry/accounts";
                } else if (inquiryType === "Sales and Management") {
                    inquiryRoute = "inquiry/sales";
                } else {
                    alert("Please select a valid inquiry type.");
                    return;
                }

                const chatMessage = {
                    Instruction: message,
                    InstructionId: null,
                    ClientId: currentClient.id,
                    ClientAuthUserId: currentUser.id,
                    InsertUser: currentClient.id,
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
                    alert("Inquiry sent successfully!");

                    if (createInquiryModal) createInquiryModal.hide();
                    createInquiryForm.reset();
                }
                catch (error) {
                    console.error("Error creating inquiry:", error);
                    alert(`Error: ${error.message}`);
                }
            });
        }
    }

    // --- SignalR Event Handlers ---
    connection.on("ReceivePrivateMessage", (message) => {
        console.log("CLIENT SIDE: 'ReceivePrivateMessage' event fired. Message received:", message);

        const conversationId = message.instructionId;

        console.log(`CLIENT RECEIVER: Comparing incoming message ID (${conversationId}) with currently open chat ID (${currentChatContext.id})`);

        if (currentChatContext && String(currentChatContext.id) === String(conversationId)) {
            displayMessage(message, false);
        }
        else {
            const convItem = document.querySelector(`.conversation-item[data-id="${conversationId}"]`);
            if (convItem) {
                convItem.classList.add('has-unread');
                const subtitle = convItem.querySelector('.text-muted');
                if (subtitle) {
                    subtitle.textContent = message.instruction;
                }
            }
        }
    });

    async function init() {
        try {
            await connection.start();
            console.log("SignalR Connected.");
            updateSendButtonState();

            await loadSidebarForClient(currentClient.id);

        } catch (err) {
            console.error("Initialization Error: ", err);
            if (chatHeader) chatHeader.innerHTML = `<div class="text-danger">Connection Failed</div>`;
            return;
        }

        let ticketsDataTable = null;
        if (supportTicketsTableE1.length) {
            ticketsDataTable = supportTicketsTableE1.DataTable({
                "ajax": { "url": `/v1/api/instructions/tickets/${currentClient.id}`, "dataSrc": "data" },
                "columns": [
                    { "data": "id", "title": "ID" },
                    { "data": "subject", "title": "Subject" },
                    { "data": "date", "title": "Date", "render": data => new Date(data).toLocaleDateString() },
                    { "data": "status", "title": "Status" },
                    {
                        "data": "priority",
                        "title": "Priority",
                        "render": (data) => generatePriorityBadge(data)
                    },
                    {
                        "data": null,
                        "title": "Actions",
                        "orderable": false,
                        "className": "text-center",
                        "defaultContent": `
            <div class="action-buttons">
                <button class="btn-icon-action view-details-btn" title="View Details"><i class="fas fa-eye"></i></button>
                <button class="btn-icon-action start-chat-btn" title="Open Chat"><i class="fas fa-comments"></i></button>
            </div>`
                    }
                ],
                "order": [[0, 'desc']],
                "language": { "emptyTable": "You have not created any support tickets yet." }
            });

            ticketsDataTable.on('click', '.view-details-btn', function () {
                const rowData = ticketsDataTable.row($(this).parents('tr')).data();
                if (!rowData) return;

                currentTicketData = rowData;

                const context = {
                    id: rowData.id,
                    name: rowData.subject,
                    type: 'ticket',
                    route: `/v1/api/instructions/tickets/${rowData.id}`
                };

                switchChatContext(context);

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
                    $('#details-remarks').text(remarksObj.userremarks || 'N/A');
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

                toggleEditMode(false);

                new bootstrap.Modal(document.getElementById('viewTicketDetailsModal')).show();
            });
        }

        let inquiriesDataTable = null;
        if (inquiriesTableE1.length) {
            inquiriesDataTable = inquiriesTableE1.DataTable({
                "ajax": {
                    "url": `/v1/api/instructions/inquiries/${currentClient.id}`,
                    "dataSrc": "data"
                },
                "columns": [
                    { "data": "id", "title": "ID" },
                    { "data": "topic", "title": "Topic" },
                    { "data": "inquiredBy", "title": "Inquired By" },
                    { "data": "date", "title": "Date", "render": data => new Date(data).toLocaleDateString() },
                    {
                        "data": null,
                        "title": "Actions",
                        "orderable": false,
                        "className": "text-center",
                        "defaultContent": `
            <div class="action-buttons">
                <button class="btn-icon-action start-chat-btn" title="Open Chat"><i class="fas fa-comments"></i></button>
            </div>`
                    }
                ]
            });

            inquiriesDataTable.on('click', '.start-chat-btn', function () {
                const rowData = inquiriesDataTable.row($(this).parents('tr')).data();
                if (!rowData) return;

                const route = `inquiry/${rowData.topic.toLowerCase().replace(/\s+/g, '-')}`;

                switchChatContext({
                    id: rowData.id,
                    name: `#${rowData.id} - ${rowData.topic}`,
                    route: route
                });
            });
        }

        initializeTicketSystem();

        $(document).on('click', '#editTicketBtn', function () {
            if (currentTicketData) {
                populateEditTicketForm(currentTicketData);
                toggleEditMode(true);
            }
        });

        $(document).on('click', '#saveChangesBtn', function () {
            saveTicketChanges();
        });

        $(document).on('click', '#cancelEditBtn', function () {
            toggleEditMode(false);
        });

        $(document).on('click', '#closeModalBtn', function () {
            if ($('#editTicketForm').is(':visible')) {
                toggleEditMode(false);
            }
            closeTicketModal();
        });

        $(document).on('submit', '#editTicketForm', function (e) {
            e.preventDefault();
            saveTicketChanges();
        });

        const ticketModal = document.getElementById('viewTicketDetailsModal');
        if (ticketModal) {
            ticketModal.addEventListener('hidden.bs.modal', function () {
                toggleEditMode(false);

                setTimeout(() => {
                    const backdrops = document.querySelectorAll('.modal-backdrop');
                    backdrops.forEach(backdrop => backdrop.remove());
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                    document.body.style.paddingRight = '';
                }, 50);
            });
        }

        const conversationListPanel = document.getElementById("conversation-list-panel");
        if (conversationListPanel) {
            conversationListPanel.addEventListener('click', (e) => {
                const conversationItem = e.target.closest('.conversation-item');
                if (!conversationItem) return;
                e.preventDefault();
                switchChatContext(conversationItem.dataset);
            });
        }

        if (sendButton) sendButton.addEventListener("click", sendMessage);
        if (messageInput) {
            messageInput.addEventListener("keyup", (e) => {
                updateSendButtonState();
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            });
        }

        if (ticketsDataTable) {
            supportTicketsTableE1.on('click', '.start-chat-btn', function () {
                const rowData = ticketsDataTable.row($(this).parents('tr')).data();
                if (!rowData) return;

                const route = `ticket/${rowData.subject.toLowerCase().replace(/\s+/g, '-')}`;

                switchChatContext({
                    id: rowData.id,
                    name: `#${rowData.id} - ${rowData.subject}`,
                    route: route
                });
            });

            supportTicketsTableE1.on('click', '.view-details-btn', function () {
                const rowData = ticketsDataTable.row($(this).parents('tr')).data();
                if (!rowData) return;
                const route = `ticket/${rowData.subject.toLowerCase().replace(/\s+/g, '-')}`;

                switchChatContext({
                    id: rowData.id,
                    name: `#${rowData.id} - ${rowData.subject}`,
                    route: route
                });

                new bootstrap.Modal(document.getElementById('viewTicketDetailsModal')).show();
            });
        }

        if (inquiriesDataTable) {
            inquiriesTableE1.on('click', '.start-chat-btn', function () {
                const rowData = inquiriesDataTable.row($(this).parents('tr')).data();
                if (!rowData) return;

                const route = `inquiry/${rowData.topic.toLowerCase().replace(/\s+/g, '-')}`;

                switchChatContext({
                    id: rowData.id,
                    name: `#${rowData.id} - ${rowData.topic}`,
                    route: route
                });
            });
        }
    }

    init();
});