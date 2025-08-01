﻿"use strict";

document.addEventListener("DOMContentLoaded", () => {
    // --- Fullscreen Toggle ---
    const fullscreenBtn = document.getElementById("fullscreen-btn");

    if (fullscreenBtn) {
        const fullscreenIcon = fullscreenBtn.querySelector("i");

        fullscreenBtn.addEventListener("click", toggleFullscreen);

        document.addEventListener("fullscreenchange", () => {
            if (document.fullscreenElement) {
                fullscreenIcon.classList.remove("fa-expand");
                fullscreenIcon.classList.add("fa-compress");
                fullscreenBtn.title = "Exit Fullscreen";
            } else {
                fullscreenIcon.classList.remove("fa-compress");
                fullscreenIcon.classList.add("fa-expand");
                fullscreenBtn.title = "Enter Fullscreen";
            }
        });
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement
                .requestFullscreen()
                .catch((err) =>
                    console.error(
                        `Error enabling full-screen: ${err.message} (${err.name})`
                    )
                );
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }

    // --- State, Mock Data, DOM Refs ---
    const supportAgentIdentity = "CBS Support";
    let currentUserIdentity = supportAgentIdentity;
    let currentChatContext = {};
    let typingTimeout = null;

    const teamMembers = [
        { name: "CBS Support", initials: "S", avatarClass: "avatar-bg-green" },
        { name: "Admin User", initials: "A", avatarClass: "avatar-bg-purple" },
    ];

    const customerList = [
        { name: "Alzeena Limbu", initials: "A", avatarClass: "avatar-bg-purple" },
        { name: "Soniya Basnet", initials: "S", avatarClass: "avatar-bg-red" },
        { name: "Ram Shah", initials: "R", avatarClass: "avatar-bg-blue" },
        { name: "Namsang Limbu", initials: "N", avatarClass: "avatar-bg-red" },
    ];

    const inquiryList = [
        {
            id: "#INQ-345",
            topic: "Pricing for Enterprise Plan",
            inquiredBy: "Ram Shah",
            date: "2024-09-05 10:42 AM",
            outcome: "Info Sent",
        },
        {
            id: "#INQ-340",
            topic: "API Access Question",
            inquiredBy: "Admin User",
            date: "2024-08-22 03:15 PM",
            outcome: "Info Sent",
        },
    ];

    const roleSwitcher = document.getElementById("role-switcher");
    const conversationListContainer = document.getElementById(
        "conversation-list-container"
    );
    const messageInput = document.getElementById("message-input");
    const sendButton = document.getElementById("send-button");
    const chatPanelBody = document.getElementById("chat-panel-body");
    const chatHeader = document.getElementById("chat-header");
    const typingIndicator = document.getElementById("typing-indicator");
    const attachmentButton = document.getElementById("attachment-button");
    const fileInput = document.getElementById("file-input");

    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/chathub")
        .withAutomaticReconnect()
        .build();

    // --- Helper Functions ---
    const formatTimestamp = (d) =>
        new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const formatDateForSeparator = (dStr) => {
        const d = new Date(dStr);
        const t = new Date();
        const y = new Date(t);
        y.setDate(y.getDate() - 1);
        if (d.toDateString() === t.toDateString()) return "Today";
        if (d.toDateString() === y.toDateString()) return "Yesterday";
        return d.toLocaleDateString([], {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    const getUserRole = (userName) =>
        teamMembers.some((m) => m.name === userName) ? "Team Member" : "Customer";

    const updateSendButtonState = () =>
    (sendButton.disabled =
        connection.state !== "Connected" ||
        (!messageInput.value.trim() && !fileInput.files.length));

    const scrollToBottom = () =>
        (chatPanelBody.scrollTop = chatPanelBody.scrollHeight);

    const generateGroupName = (u1, u2) => [u1, u2].sort().join("_");

    const getAvatarDetails = (userName) =>
        teamMembers.find((u) => u.name === userName) ||
        customerList.find((u) => u.name === userName) || {
            initials: userName.substring(0, 1).toUpperCase(),
            avatarClass: "avatar-bg-blue",
        };

    // --- File Upload ---
    async function uploadFile(file) {
        const maxFileSize = 10 * 1024 * 1024;
        if (file.size > maxFileSize) {
            alert(`Error: File size cannot exceed ${maxFileSize / 1024 / 1024} MB.`);
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            messageInput.placeholder = "Uploading file...";
            attachmentButton.disabled = true;
            sendButton.disabled = true;

            const response = await fetch("/api/FileUpload/UploadFile", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || "File upload failed.");
            }

            const result = await response.json();
            const textMessage = messageInput.value.trim();
            const method =
                currentChatContext.type === "group"
                    ? "SendPublicMessage"
                    : "SendPrivateMessage";
            const args =
                currentChatContext.type === "group"
                    ? [currentUserIdentity, textMessage, result.url, result.name, result.type]
                    : [
                        currentChatContext.id,
                        currentUserIdentity,
                        textMessage,
                        result.url,
                        result.name,
                        result.type,
                    ];

            await connection.invoke(method, ...args);
            messageInput.value = "";
        } catch (error) {
            console.error("Upload error:", error);
            alert(`Upload Error: ${error.message}`);
        } finally {
            messageInput.placeholder = "Type a message...";
            attachmentButton.disabled = false;
            fileInput.value = "";
            updateSendButtonState();
        }
    }

    // --- Chat History ---
    const getChatHistory = (id) => JSON.parse(localStorage.getItem(id)) || [];

    function updateMessageInHistory(chatId, messageId, updateFn) {
        const history = getChatHistory(chatId);
        const messageIndex = history.findIndex((m) => m.id === messageId);
        if (messageIndex > -1) {
            updateFn(history[messageIndex]);
            localStorage.setItem(chatId, JSON.stringify(history));
        }
    }

    // --- Seen Observer ---
    const seenObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const messageEl = entry.target;
                    const messageId = parseInt(messageEl.dataset.messageId, 10);
                    connection
                        .invoke("MarkAsSeen", messageId, currentUserIdentity)
                        .catch((err) => console.error("MarkAsSeen error:", err));
                    seenObserver.unobserve(messageEl);
                }
            });
        },
        { threshold: 0.8 }
    );

    // --- UI Rendering ---
    let lastMessageDate = null;

    function displayMessage(messageData, isHistory) {
        const messageDate = new Date(messageData.timestamp).toDateString();
        if (lastMessageDate !== messageDate) {
            lastMessageDate = messageDate;
            const ds = document.createElement("div");
            ds.className = "date-separator";
            ds.textContent = formatDateForSeparator(messageData.timestamp);
            chatPanelBody.appendChild(ds);
        }

        const isSent = messageData.sender === currentUserIdentity;
        const avatar = getAvatarDetails(messageData.sender);
        const messageRow = document.createElement("div");
        messageRow.className = `message-row ${isSent ? "sent" : "received"}`;
        messageRow.id = `msg-${messageData.id}`;
        messageRow.dataset.messageId = messageData.id;
        messageData.seenBy = messageData.seenBy || [];

        const avatarTooltip = `${messageData.sender} - ${getUserRole(
            messageData.sender
        )}`;
        const getReceiptHtml = (msg) => {
            let iconClass = "receipt-sent fas fa-check";
            let tooltip = "Sent";
            if ((msg.seenBy || []).length > 0) {
                iconClass = "receipt-seen fas fa-check-double";
                tooltip = `Seen by: ${msg.seenBy.map((u) => u.name).join(", ")}`;
            }
            return `<span class="read-receipt ${iconClass}" data-bs-toggle="tooltip" title="${tooltip}"></span>`;
        };

        const readReceiptHtml = isSent ? getReceiptHtml(messageData) : "";
        let messageContentHtml = "";
        if (messageData.fileUrl) {
            const isImage = (messageData.fileType || "").startsWith("image/");
            if (isImage) {
                messageContentHtml = `<a href="${messageData.fileUrl}" target="_blank"><img src="${messageData.fileUrl}" alt="${messageData.fileName}" class="attachment-preview-image"/></a>`;
            } else {
                messageContentHtml = `<div class="message-attachment"><i class="fas fa-file-alt attachment-icon"></i><div class="attachment-info"><span class="attachment-name">${messageData.fileName}</span><a href="${messageData.fileUrl}" target="_blank" class="attachment-link">Download</a></div></div>`;
            }
        }
        if (messageData.message) {
            messageContentHtml += `<div class="message-bubble"><p class="message-text">${messageData.message}</p></div>`;
        }

        messageRow.innerHTML = `
      <div class="avatar-initials ${avatar.avatarClass}" data-bs-toggle="tooltip" title="${avatarTooltip}">${avatar.initials}</div>
      <div class="message-content">
        <div class="message-sender">${messageData.sender}</div>
        ${messageContentHtml}
        <div class="message-meta">
          <span class="message-timestamp">${formatTimestamp(
            messageData.timestamp
        )}</span>
          ${readReceiptHtml}
        </div>
      </div>
    `;

        chatPanelBody.appendChild(messageRow);
        messageRow
            .querySelectorAll('[data-bs-toggle="tooltip"]')
            .forEach(
                (el) => new bootstrap.Tooltip(el, { boundary: document.body })
            );

        const hasSeen = messageData.seenBy.some(
            (u) => u.name === currentUserIdentity
        );
        if (!hasSeen && messageData.sender !== currentUserIdentity) {
            seenObserver.observe(messageRow);
        }

        if (!isHistory) scrollToBottom();
    }

    function renderSidebar(role, isAdmin) {
        conversationListContainer.innerHTML = "";

        const createChatItem = (type, id, name, subtext, iconClass) => {
            const avatar = getAvatarDetails(name);
            return `
        <a href="#" class="list-group-item list-group-item-action conversation-item" data-type="${type}" data-id="${id}" data-name="${name}">
          <div class="d-flex w-100 align-items-center">
            <div class="avatar-initials ${avatar.avatarClass} me-3">${avatar.initials}</div>
            <div class="flex-grow-1">
              <div class="fw-bold">${name}</div>
              <small class="text-muted">${subtext}</small>
            </div>
            <div class="icon ms-2"><i class="fas ${iconClass}"></i></div>
          </div>
        </a>`;
        };

        conversationListContainer.innerHTML += createChatItem(
            "group",
            "public",
            "Public Group Chat",
            "Group Chat",
            "fa-users"
        );

        if (isAdmin) {
            let accordionHtml = '<div class="accordion" id="sidebarAccordion">';
            if (role === supportAgentIdentity) {
                let customerItems = "";
                customerList.forEach((user) => {
                    customerItems += createChatItem(
                        "private",
                        generateGroupName(role, user.name),
                        user.name,
                        "Private Chat",
                        "fa-user"
                    );
                });
                accordionHtml += `
          <div class="accordion-item">
            <h2 class="accordion-header" id="headingSupport">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSupport">Support</button>
            </h2>
            <div id="collapseSupport" class="accordion-collapse collapse">
              <div class="list-group list-group-flush">${customerItems}</div>
            </div>
          </div>`;
            }

            let teamItems = "";
            teamMembers
                .filter((u) => u.name !== role)
                .forEach((user) => {
                    teamItems += createChatItem(
                        "private",
                        generateGroupName(role, user.name),
                        user.name,
                        "Private Chat",
                        "fa-user"
                    );
                });
            accordionHtml += `
        <div class="accordion-item">
          <h2 class="accordion-header" id="headingTeams">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTeams">Teams</button>
          </h2>
          <div id="collapseTeams" class="accordion-collapse collapse">
            <div class="list-group list-group-flush">${teamItems}</div>
          </div>
        </div>`;
            accordionHtml += "</div>";
            conversationListContainer.innerHTML += accordionHtml;
        } else {
            conversationListContainer.innerHTML += createChatItem(
                "private",
                generateGroupName(role, supportAgentIdentity),
                supportAgentIdentity,
                "Private Chat",
                "fa-headset"
            );
        }
    }

    async function switchChatContext(contextData) {
        currentChatContext = contextData;
        document
            .querySelectorAll(".conversation-item.active")
            .forEach((el) => el.classList.remove("active"));
        const activeItem = document.querySelector(
            `.conversation-item[data-id="${contextData.id}"]`
        );
        if (activeItem) activeItem.classList.add("active");

        const partnerName = contextData.name || "Public Group Chat";
        const partnerAvatar = getAvatarDetails(partnerName);
        const chatType = contextData.type === "group" ? "Group Chat" : "Private Chat";
        chatHeader.innerHTML = `
      <div class="avatar-initials ${partnerAvatar.avatarClass}">${partnerAvatar.initials}</div>
      <div>
        <div class="fw-bold">${partnerName}</div>
        <small class="text-muted">${chatType}</small>
      </div>
    `;

        chatPanelBody.innerHTML = "";
        lastMessageDate = null;
        getChatHistory(currentChatContext.id).forEach((msg) =>
            displayMessage(msg, true)
        );
        scrollToBottom();

        if (contextData.type === "private") {
            await connection.invoke("JoinPrivateChat", contextData.id);
        }
    }

    // --- Core Logic ---
    async function sendMessage() {
        const message = messageInput.value.trim();
        const file = fileInput.files[0];

        if (!message && !file) return;

        if (file) {
            await uploadFile(file);
        } else {
            try {
                const method =
                    currentChatContext.type === "group"
                        ? "SendPublicMessage"
                        : "SendPrivateMessage";
                const args =
                    currentChatContext.type === "group"
                        ? [currentUserIdentity, message, null, null, null]
                        : [currentChatContext.id, currentUserIdentity, message, null, null, null];

                await connection.invoke(method, ...args);
                messageInput.value = "";
                updateSendButtonState();
            } catch (err) {
                console.error("Error sending message:", err);
            }
        }
    }

    function setViewForRole(role) {
        currentUserIdentity = role;
        renderSidebar(role, teamMembers.some((u) => u.name === role));
        const firstItem = conversationListContainer.querySelector(
            ".conversation-item"
        );
        if (firstItem) switchChatContext(firstItem.dataset);
    }

    // --- Event Listeners ---
    roleSwitcher.innerHTML = [...teamMembers, ...customerList]
        .map((u) => `<option value="${u.name}">Role: ${u.name}</option>`)
        .join("");
    roleSwitcher.addEventListener("change", (e) => setViewForRole(e.target.value));
    conversationListContainer.addEventListener("click", (e) => {
        const item = e.target.closest(".conversation-item");
        if (item) {
            e.preventDefault();
            switchChatContext(item.dataset);
        }
    });
    sendButton.addEventListener("click", sendMessage);
    messageInput.addEventListener("keyup", (e) => {
        updateSendButtonState();
        if (e.key === "Enter") sendMessage();
    });
    attachmentButton.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => updateSendButtonState());

    // --- SignalR Event Handlers ---
    connection.on(
        "ReceivePublicMessage",
        (messageId, sender, msg, time, initials, fileUrl, fileName, fileType) => {
            const data = {
                id: messageId,
                sender,
                message: msg,
                timestamp: time,
                initials,
                fileUrl,
                fileName,
                fileType,
                seenBy: [],
            };
            if (sender === currentUserIdentity) {
                data.seenBy.push({ name: currentUserIdentity, time });
            }
            const history = getChatHistory("public");
            history.push(data);
            localStorage.setItem("public", JSON.stringify(history));
            if (currentChatContext.id === "public") displayMessage(data, false);
        }
    );

    connection.on(
        "ReceivePrivateMessage",
        (messageId, groupName, sender, msg, time, initials, fileUrl, fileName, fileType) => {
            const data = {
                id: messageId,
                sender,
                message: msg,
                timestamp: time,
                initials,
                fileUrl,
                fileName,
                fileType,
                seenBy: [],
            };
            if (sender === currentUserIdentity) {
                data.seenBy.push({ name: currentUserIdentity, time });
            }
            const history = getChatHistory(groupName);
            history.push(data);
            localStorage.setItem(groupName, JSON.stringify(history));
            if (currentChatContext.id === groupName) displayMessage(data, false);
        }
    );

    connection.on("MessageSeen", (messageId, userName, seenTime) => {
        updateMessageInHistory(currentChatContext.id, messageId, (message) => {
            if (!message.seenBy.some((u) => u.name === userName)) {
                message.seenBy.push({ name: userName, time: seenTime });
            }
        });

        const messageEl = document.getElementById(`msg-${messageId}`);
        if (messageEl && messageEl.closest("#chat-panel-body")) {
            const receiptEl = messageEl.querySelector(".read-receipt");
            if (receiptEl) {
                const message = getChatHistory(currentChatContext.id).find(
                    (m) => m.id === messageId
                );
                const tooltip = bootstrap.Tooltip.getInstance(receiptEl);
                const newTitle = `Seen by: ${message.seenBy.map((u) => u.name).join(", ")}`;
                receiptEl.className = "read-receipt receipt-seen fas fa-check-double";
                if (tooltip) {
                    tooltip.setContent({ ".tooltip-inner": newTitle });
                } else {
                    receiptEl.setAttribute("title", newTitle);
                    new bootstrap.Tooltip(receiptEl, { boundary: document.body });
                }
            }
        }
    });

    connection
        .start()
        .then(() => {
            console.log("SignalR Connected.");
            setViewForRole(supportAgentIdentity);
            updateSendButtonState();
        })
        .catch((err) => console.error("SignalR Connection Error: ", err));

    // --- Ticket & Inquiry System ---
    const supportSubjects = [
        { text: "TRAINING" },
        { text: "MIGRATION" },
        { text: "SETUPS" },
        { text: "CORRECTION" },
        { text: "BUGS FIX" },
        { text: "NEW FEATURES" },
        { text: "FEATURE ENCHANCEMENT" },
        { text: "BACKEND WORKAROUND" },
    ];

    const subjectDropdown = $("#ticketSubject");
    const editSubjectDropdown = $("#edit-ticketSubject");
    subjectDropdown.append(
        '<option value="" disabled selected>Select a subject...</option>'
    );
    supportSubjects.forEach((s) => {
        const o = `<option value="${s.text}">${s.text}</option>`;
        subjectDropdown.append(o);
        editSubjectDropdown.append(o);
    });

    $("#inquiriesDataTable").DataTable({
        data: inquiryList,
        columns: [
            { data: "id" },
            { data: "topic" },
            { data: "inquiredBy" },
            { data: "date" },
            {
                data: "outcome",
                render: (o) => `<span class="badge bg-info">${o}</span>`,
            },
        ],
        pageLength: 5,
        lengthChange: false,
        searching: true,
        info: false,
        language: {
            search: "",
            searchPlaceholder: "Search inquiries...",
            emptyTable: "No inquiries yet — let us know how we can help!",
        },
    });

    const ticketsLocalStorageKey = "supportTickets";
    const supportTicketForm = document.getElementById("supportTicketForm");
    const editTicketForm = document.getElementById("editTicketForm");
    const newTicketModal = new bootstrap.Modal(
        document.getElementById("newSupportTicketModal")
    );
    const viewTicketModal = new bootstrap.Modal(
        document.getElementById("viewTicketDetailsModal")
    );

    const getTickets = () =>
        JSON.parse(localStorage.getItem(ticketsLocalStorageKey)) || [];
    const getFilteredTickets = () =>
        getTickets().filter((t) => t.status && t.status !== "Open");

    const generateStatusBadge = (s) => {
        let b = "bg-secondary",
            i = "fa-question-circle";
        if (s === "Resolved") {
            b = "bg-success";
            i = "fa-check-circle";
        } else if (s === "Pending") {
            b = "bg-warning text-dark";
            i = "fa-hourglass-half";
        }
        return `<span class="badge ${b}"><i class="fas ${i} me-1"></i>${s}</span>`;
    };

    const generatePriorityBadge = (p) => {
        let b = "badge-priority-low",
            i = "fa-arrow-down";
        if (p === "Urgent") {
            b = "badge-priority-urgent";
            i = "fa-exclamation-circle";
        } else if (p === "High") {
            b = "badge-priority-high";
            i = "fa-arrow-up";
        }
        return `<span class="badge ${b}"><i class="fas ${i} me-1"></i>${p}</span>`;
    };

    const ticketsTable = $("#supportTicketsDataTable").DataTable({
        data: getFilteredTickets(),
        columns: [
            { data: "id", render: (d) => `#${d}` },
            { data: "subject", defaultContent: "N/A" },
            {
                data: "submissionTimestamp",
                defaultContent: "N/A",
                render: (data, type, row) => {
                    if (!data) return "N/A";
                    if (type === "display") {
                        return new Date(data).toLocaleString([], {
                            year: "numeric",
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                        });
                    }
                    return data;
                },
            },
            { data: "createdBy", defaultContent: "N/A" },
            { data: "resolvedBy", defaultContent: "N/A" },
            { data: "status", render: generateStatusBadge, defaultContent: "" },
            {
                data: "priority",
                render: generatePriorityBadge,
                defaultContent: "Low",
            },
            {
                data: "id",
                orderable: false,
                searchable: false,
                render: (data, type, row) => {
                    let chatButton = "";
                    const isAdmin = teamMembers.some(
                        (u) => u.name === currentUserIdentity
                    );
                    if (isAdmin && row.createdBy && row.createdBy !== currentUserIdentity) {
                        chatButton = `<button class="btn btn-sm btn-success start-chat-btn ms-1" data-ticket-id="${row.id}" aria-label="Chat with ${row.createdBy}"><i class="fas fa-comments"></i></button>`;
                    }
                    return `<button class="btn btn-sm btn-info view-details-btn" data-ticket-id="${data}">View Details</button>${chatButton}`;
                },
            },
        ],
        pageLength: 5,
        lengthChange: true,
        lengthMenu: [
            [5, 10, 20, -1],
            ["Show 5", "Show 10", "Show 20", "Show All"],
        ],
        searching: true,
        order: [[2, "desc"]],
        language: {
            search: "",
            searchPlaceholder: "Search tickets...",
            emptyTable: "No support tickets found.",
            lengthMenu: "_MENU_",
        },
        dom: '<"row mb-3"<"col-sm-12 col-md-auto"l><"col-sm-12 col-md-auto ms-md-auto"f>>rtip',
    });

    $("#supportTicketsDataTable_filter input, #inquiriesDataTable_filter input").before(
        '<i class="fas fa-search search-icon"></i>'
    );

    $(supportTicketForm).on("submit", function (e) {
        e.preventDefault();
        if (!this.checkValidity()) {
            e.stopPropagation();
            $(this).addClass("was-validated");
            return;
        }

        try {
            const now = new Date();
            const newTicket = {
                id: String(Date.now()).slice(-6),
                subject: $("#ticketSubject").val(),
                submissionTimestamp: now.toISOString(),
                createdBy: $("#fullName").val() || "System",
                resolvedBy: "Pending",
                description: $("#ticketDescription").val(),
                remarks: $("#ticketRemarks").val() || "N/A",
                status: "Pending",
                priority: $("#ticketPriority").val(),
                expiryDate: new Date($("#ticketExpiryDate").val()).toLocaleString(),
            };

            const allTickets = getTickets();
            allTickets.unshift(newTicket);
            localStorage.setItem(ticketsLocalStorageKey, JSON.stringify(allTickets));
            ticketsTable.clear().rows.add(getFilteredTickets()).draw();
            this.reset();
            $(this).removeClass("was-validated");
            newTicketModal.hide();
            alert("Support ticket submitted successfully!");
        } catch (error) {
            console.error("Error submitting ticket:", error);
            alert(
                "An error occurred while submitting the ticket. Please check the console for details."
            );
        }
    });

    const setViewModalMode = (m) => {
        if (m === "edit") {
            $("#ticket-details-view").hide();
            $("#editTicketForm").show();
            $("#editTicketBtn, #closeModalBtn").hide();
            $("#saveChangesBtn, #cancelEditBtn").show();
        } else {
            $("#ticket-details-view").show();
            $("#editTicketForm").hide();
            $("#editTicketBtn, #closeModalBtn").show();
            $("#saveChangesBtn, #cancelEditBtn").hide();
            $("#editTicketForm").removeClass("was-validated");
        }
    };

    $("#supportTicketsDataTable tbody").on("click", ".view-details-btn", function () {
        const ticketId = $(this).data("ticket-id").toString();
        const ticket = getTickets().find((t) => t.id === ticketId);
        if (ticket) {
            $("#details-id").text(`#${ticket.id}`);
            $("#details-status").html(generateStatusBadge(ticket.status || "Pending"));
            $("#details-priority").html(generatePriorityBadge(ticket.priority || "Low"));
            $("#details-subject").text(ticket.subject || "N/A");
            $("#details-date").text(
                ticket.submissionTimestamp
                    ? new Date(ticket.submissionTimestamp).toLocaleString()
                    : "N/A"
            );
            $("#details-expiryDate").text(ticket.expiryDate || "N/A");
            $("#details-createdBy").text(ticket.createdBy || "N/A");
            $("#details-resolvedBy").text(ticket.resolvedBy || "N/A");
            $("#details-description").text(ticket.description || "N/A");
            $("#details-remarks").text(ticket.remarks || "N/A");
            $("#edit-ticketId").val(ticket.id);
            $("#edit-fullName").val(ticket.createdBy || "");
            $("#edit-ticketSubject").val(ticket.subject || "");
            $("#edit-ticketPriority").val(ticket.priority || "Low");
            const expiryForInput = ticket.expiryDate
                ? new Date(ticket.expiryDate).toISOString().slice(0, 16)
                : "";
            $("#edit-ticketExpiryDate").val(expiryForInput);
            $("#edit-ticketDescription").val(ticket.description || "");
            $("#edit-ticketRemarks").val(ticket.remarks || "");
            setViewModalMode("view");
            viewTicketModal.show();
        }
    });

    $("#supportTicketsDataTable tbody").on("click", ".start-chat-btn", function () {
        const ticketId = $(this).data("ticket-id").toString();
        const ticket = getTickets().find((t) => t.id === ticketId);
        if (ticket && ticket.createdBy) {
            const ticketCreatorName = ticket.createdBy;
            const matchedCustomer = customerList.find((c) =>
                ticketCreatorName.includes(c.name)
            );

            if (matchedCustomer) {
                const customerChatName = matchedCustomer.name;
                const conversationItem = document.querySelector(
                    `.conversation-item[data-name="${customerChatName}"]`
                );

                if (conversationItem) {
                    const collapsedParent = conversationItem.closest(
                        ".accordion-collapse.collapse:not(.show)"
                    );
                    if (collapsedParent) {
                        new bootstrap.Collapse(collapsedParent).show();
                    }
                    conversationItem.click();
                } else {
                    alert(
                        `Could not find the conversation UI element for "${customerChatName}".`
                    );
                }
            } else {
                alert(
                    `A chat with a user matching "${ticketCreatorName}" is not available in your conversation list.`
                );
            }
        }
    });

    $("#editTicketBtn").on("click", () => setViewModalMode("edit"));
    $("#cancelEditBtn").on("click", () => setViewModalMode("view"));

    $(editTicketForm).on("submit", function (e) {
        e.preventDefault();
        if (!this.checkValidity()) {
            e.stopPropagation();
            $(this).addClass("was-validated");
            return;
        }

        const ticketId = $("#edit-ticketId").val();
        const allTickets = getTickets();
        const ticketIndex = allTickets.findIndex((t) => t.id === ticketId);
        if (ticketIndex > -1) {
            allTickets[ticketIndex].createdBy = $("#edit-fullName").val();
            allTickets[ticketIndex].subject = $("#edit-ticketSubject").val();
            allTickets[ticketIndex].submissionTimestamp = new Date().toISOString();
            allTickets[ticketIndex].description = $("#edit-ticketDescription").val();
            allTickets[ticketIndex].remarks =
                $("#edit-ticketRemarks").val() || "N/A";
            allTickets[ticketIndex].priority = $("#edit-ticketPriority").val();
            allTickets[ticketIndex].expiryDate = new Date(
                $("#edit-ticketExpiryDate").val()
            ).toLocaleString();
            localStorage.setItem(ticketsLocalStorageKey, JSON.stringify(allTickets));

            $("#details-subject").text(allTickets[ticketIndex].subject);
            $("#details-createdBy").text(allTickets[ticketIndex].createdBy);
            $("#details-date").text(
                new Date(allTickets[ticketIndex].submissionTimestamp).toLocaleString()
            );
            $("#details-description").text(allTickets[ticketIndex].description);
            $("#details-remarks").text(allTickets[ticketIndex].remarks);
            $("#details-priority").html(
                generatePriorityBadge(allTickets[ticketIndex].priority)
            );
            $("#details-expiryDate").text(allTickets[ticketIndex].expiryDate);

            ticketsTable.clear().rows.add(getFilteredTickets()).draw();
        }

        setViewModalMode("view");
    });
});