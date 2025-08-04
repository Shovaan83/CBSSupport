"use strict";

document.addEventListener('DOMContentLoaded', () => {

    // --- STATE AND CONFIGURATION ---
    const adminUserIdentity = "Admin User";
    let currentUserIdentity = adminUserIdentity;
    let currentChatContext = {};
    const teamMembers = [{ name: "CBS Support", initials: "S", avatarClass: "avatar-bg-green" }, { name: "Admin User", initials: "A", avatarClass: "avatar-bg-purple" }];
    const customerList = [{ name: "Alzeena Limbu", initials: "A", avatarClass: "avatar-bg-purple" }, { name: "Soniya Basnet", initials: "S", avatarClass: "avatar-bg-red" }, { name: "Ram Shah", initials: "R", avatarClass: "avatar-bg-blue" }, { name: "Namsang Limbu", initials: "N", avatarClass: "avatar-bg-red" }];

    const internalStaff = [
        { name: "Numa Limbu", initials: "N", avatarClass: "avatar-bg-blue" },
        { name: "Shreecha Limbu", initials: "S", avatarClass: "avatar-bg-green" },
        { name: "Shreya Rai", initials: "S", avatarClass: "avatar-bg-red" },
        { name: "Saikshya Shrestha", initials: "S", avatarClass: "avatar-bg-purple" }
    ];

    const agents = ["Neewa Limbu", "Shreya Rai", "Shreecha Limbu", "Saikshya Shrestha", "Unassigned"];
    const statuses = ["Pending", "On Hold", "Resolved"];
    const priorities = ["Low", "Normal", "High", "Urgent"];

    // --- DOM ELEMENT REFERENCES ---
    const conversationListContainer = document.getElementById("conversation-list-container");
    const messageInput = document.getElementById("message-input");
    const sendButton = document.getElementById("send-button");
    const chatPanelBody = document.getElementById("chat-panel-body");
    const chatHeader = document.getElementById("chat-header");
    const attachmentButton = document.getElementById('attachment-button');
    const fileInput = document.getElementById('file-input');
    const filePreviewContainer = document.getElementById("file-preview-container");
    const ticketsTableElement = $('#ticketsTable');
    const detailTicketId = document.getElementById('detail-ticket-id');
    const detailTicketSubject = document.getElementById('detail-ticket-subject');
    const detailStatus = document.getElementById('detail-status');
    const detailPriority = document.getElementById('detail-priority');
    const detailAssignee = document.getElementById('detail-assignee');
    const detailCreatedBy = document.getElementById('detail-createdby');
    const ticketDetailContent = document.getElementById('ticket-detail-content');
    const ticketDetailPlaceholder = document.getElementById('ticket-detail-placeholder');
    const floatingChatContainer = document.getElementById('floating-chat-container');

    // --- LOCALSTORAGE & SIGNALR ---
    const ticketsLocalStorageKey = 'supportTickets';
    const getTickets = () => JSON.parse(localStorage.getItem(ticketsLocalStorageKey)) || [];
    const saveTickets = (allTickets) => localStorage.setItem(ticketsLocalStorageKey, JSON.stringify(allTickets));
    const getChatHistory = (id) => JSON.parse(localStorage.getItem(id)) || [];
    const saveMessageToHistory = (id, data) => {
        const history = getChatHistory(id);
        history.push(data);
        localStorage.setItem(id, JSON.stringify(history));
    };

    const getTicketChatHistory = (ticketId) => JSON.parse(localStorage.getItem(`ticket-chat-${ticketId}`)) || [];
    const saveTicketChatMessage = (ticketId, messageData) => {
        const history = getTicketChatHistory(ticketId);
        history.push(messageData);
        localStorage.setItem(`ticket-chat-${ticketId}`, JSON.stringify(history));
    };

    const connection = new signalR.HubConnectionBuilder().withUrl("/chathub").withAutomaticReconnect().build();

    // --- HELPER FUNCTIONS ---
    const formatTimestamp = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formatDateTime = (isoString) => isoString ? new Date(isoString).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const generateGroupName = (u1, u2) => [u1, u2].sort().join('_');
    const getAvatarDetails = (userName) => teamMembers.find(u => u.name === userName) || internalStaff.find(u => u.name === userName) || customerList.find(u => u.name === userName) || { initials: userName.substring(0, 1).toUpperCase(), avatarClass: "avatar-bg-blue" };
    const scrollToBottom = (element) => { if (element) { element.scrollTop = element.scrollHeight; } };
    const updateSendButtonState = () => { if (sendButton) { const hasFile = fileInput && fileInput.files.length > 0; sendButton.disabled = connection.state !== "Connected" || (messageInput && messageInput.value.trim() === "" && !hasFile); } };
    const generateStatusBadge = (status) => `<span class="badge-status badge-status-${(status || 'Pending').toLowerCase().replace(' ', '.')}">${status || 'Pending'}</span>`;
    const generatePriorityBadge = (priority) => `<span class="badge-priority badge-priority-${(priority || 'Normal').toLowerCase()}">${priority || 'Normal'}</span>`;

    async function uploadFileAndSendMessage(file, msgInput, attachBtn, sendBtn, filePrevContainer) {
        const maxFileSize = 10 * 1024 * 1024;
        if (file.size > maxFileSize) {
            alert(`Error: File size cannot exceed ${maxFileSize / 1024 / 1024} MB.`);
            if (filePrevContainer) filePrevContainer.style.display = 'none';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        try {
            if (msgInput) msgInput.placeholder = "Uploading file...";
            if (attachBtn) attachBtn.disabled = true;
            if (sendBtn) sendBtn.disabled = true;

            const response = await fetch('/api/FileUpload/UploadFile', { method: 'POST', body: formData });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'File upload failed.');
            }
            const result = await response.json();
            const textMessage = msgInput ? msgInput.value.trim() : "";
            const method = currentChatContext.type === 'group' ? "SendPublicMessage" : "SendPrivateMessage";
            const args = currentChatContext.type === 'group'
                ? [currentUserIdentity, textMessage, result.url, result.name, result.type]
                : [currentChatContext.id, currentUserIdentity, textMessage, result.url, result.name, result.type];

            await connection.invoke(method, ...args);

            if (msgInput) msgInput.value = '';
            if (fileInput) fileInput.value = '';
            if (filePrevContainer) {
                filePrevContainer.innerHTML = '';
                filePrevContainer.style.display = 'none';
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert(`Upload Error: ${error.message}`);
        } finally {
            if (msgInput) msgInput.placeholder = "Type a message...";
            if (attachBtn) attachBtn.disabled = false;
            updateSendButtonState();
        }
    }

    // --- PAGE INITIALIZERS ---
    const initializedPages = {};
    const pageInitializers = {
        dashboard: function () {
            const tickets = getTickets();
            ['ticketReplyTimeChart', 'ticketPriorityChart', 'averageTicketsChart'].forEach(id => { const chart = Chart.getChart(id); if (chart) chart.destroy(); });
            document.getElementById('stat-total-tickets').textContent = tickets.length.toLocaleString();
            document.getElementById('stat-no-reply').textContent = tickets.filter(t => t.status === 'Pending' && (t.assignedTo === 'Unassigned' || !t.assignedTo)).length;
            const recentTicketsList = document.getElementById('recent-tickets-list');
            recentTicketsList.innerHTML = '';
            const recentTickets = [...tickets].sort((a, b) => new Date(b.lastUpdate || b.submissionTimestamp) - new Date(a.lastUpdate || a.submissionTimestamp)).slice(0, 4);
            if (recentTickets.length > 0) {
                recentTickets.forEach(ticket => {
                    const item = document.createElement('div');
                    item.className = 'recent-ticket-item';
                    item.innerHTML = `<div class="recent-ticket-info"><div><strong>#${ticket.id} - ${ticket.subject}</strong><small>Created by: ${ticket.createdBy} | Last Update: ${formatDateTime(ticket.lastUpdate || ticket.submissionTimestamp)}</small></div></div>${generatePriorityBadge(ticket.priority)}`;
                    recentTicketsList.appendChild(item);
                });
            } else { recentTicketsList.innerHTML = '<p class="text-muted text-center p-3">No recent tickets.</p>'; }
            const weeklyTicketsData = { labels: [], data: [] };
            for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); weeklyTicketsData.labels.push(d.toLocaleDateString('en-US', { weekday: 'short' })); const count = tickets.filter(t => new Date(t.submissionTimestamp).toDateString() === d.toDateString()).length; weeklyTicketsData.data.push(count); }
            new Chart(document.getElementById('ticketReplyTimeChart').getContext('2d'), { type: 'line', data: { labels: weeklyTicketsData.labels, datasets: [{ data: weeklyTicketsData.data, borderColor: '#2ecc71', backgroundColor: 'rgba(46, 204, 113, 0.1)', fill: true, tension: 0.4, pointRadius: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }, x: {} } } });
            const priorityCounts = priorities.reduce((acc, p) => ({ ...acc, [p]: 0 }), {});
            tickets.forEach(t => { priorityCounts[t.priority || 'Normal']++; });
            const centerTextPlugin = { id: 'centerText', beforeDraw: (chart) => { if (!chart.options.plugins.centerText) return; const { ctx, width, height } = chart; ctx.restore(); const text = chart.options.plugins.centerText.text; const total = chart.options.plugins.centerText.total; ctx.font = "bold 24px sans-serif"; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; const textX = Math.round(width / 2); const textY = Math.round(height / 2); ctx.fillText(total, textX, textY); ctx.font = "14px sans-serif"; ctx.fillStyle = '#6c757d'; ctx.fillText(text, textX, textY - 25); ctx.save(); } };
            new Chart(document.getElementById('ticketPriorityChart').getContext('2d'), { type: 'doughnut', data: { labels: Object.keys(priorityCounts), datasets: [{ data: Object.values(priorityCounts), backgroundColor: ['#3b82f6', '#22c55e', '#f97316', '#ef4444'], borderWidth: 0, cutout: '70%' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, centerText: { text: 'Total active tickets', total: tickets.length } } }, plugins: [centerTextPlugin] });
            const dailyData = { labels: [], created: [], resolved: [] };
            for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const dateStr = d.toDateString(); dailyData.labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })); dailyData.created.push(tickets.filter(t => new Date(t.submissionTimestamp).toDateString() === dateStr).length); dailyData.resolved.push(tickets.filter(t => t.status === 'Resolved' && t.lastUpdate && new Date(t.lastUpdate).toDateString() === dateStr).length); }
            new Chart(document.getElementById('averageTicketsChart').getContext('2d'), { type: 'bar', data: { labels: dailyData.labels, datasets: [{ label: 'Avg. Ticket Solved', data: dailyData.resolved, backgroundColor: '#2ecc71', borderRadius: 4 }, { label: 'Avg. Ticket Created', data: dailyData.created, backgroundColor: 'rgba(46, 204, 113, 0.2)', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', align: 'start' } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } } } });
            document.getElementById('view-all-tickets-link').addEventListener('click', (e) => { e.preventDefault(); document.querySelector('.nav-link[data-page="ticket-management"]').click(); });
        },
        chats: function () {
            const conversationSearchInput = document.getElementById('conversation-search');
            function displayFilePreview(file) {
                const isImage = file.type.startsWith('image/');
                const iconClass = isImage ? '' : 'fas fa-file-alt file-preview-icon';
                const thumbnail = isImage ? `<img src="${URL.createObjectURL(file)}" class="file-preview-thumbnail" alt="Preview">` : `<i class="${iconClass}"></i>`;
                filePreviewContainer.innerHTML = `<div class="file-preview-item">${thumbnail}<span class="file-preview-name">${file.name}</span><button type="button" id="remove-file-preview" class="btn-close" aria-label="Remove file"></button></div>`;
                filePreviewContainer.style.display = 'block';
                document.getElementById('remove-file-preview').addEventListener('click', removeFilePreview);
            }
            function removeFilePreview() {
                fileInput.value = ''; filePreviewContainer.innerHTML = ''; filePreviewContainer.style.display = 'none'; updateSendButtonState();
            }
            function displayChatMessage(messageData, isHistory) {
                const isSent = messageData.sender === currentUserIdentity; const messageClass = isSent ? 'sent' : 'received'; const avatar = getAvatarDetails(messageData.sender);
                const messageRow = document.createElement('div'); messageRow.className = `message-row ${messageClass}`;
                let bubbleContent = '';
                if (messageData.fileUrl) { const isImage = (messageData.fileType || '').startsWith('image/'); if (isImage) { bubbleContent += `<a href="${messageData.fileUrl}" target="_blank"><img src="${messageData.fileUrl}" alt="${messageData.fileName}" class="attachment-preview-image"/></a>`; } else { bubbleContent += `<div class="message-attachment"><i class="fas fa-file-alt"></i><span>${messageData.fileName} <a href="${messageData.fileUrl}" target="_blank" class="attachment-link">Download</a></span></div>`; } }
                if (messageData.message) { bubbleContent += `<p class="message-text">${messageData.message}</p>`; }
                const isImageOnly = messageData.fileUrl && !messageData.message && (messageData.fileType || '').startsWith('image/'); const bubbleClass = isImageOnly ? 'message-bubble image-only' : 'message-bubble';
                const messageHtml = `${!isSent ? `<div class="avatar-initials ${avatar.avatarClass}" title="${messageData.sender}">${avatar.initials}</div>` : ''}<div class="message-content">${!isSent ? `<div class="message-sender small fw-bold">${messageData.sender}</div>` : ''}<div class="${bubbleClass}">${bubbleContent}</div><div class="message-meta"><span class="message-timestamp">${formatTimestamp(messageData.timestamp)}</span></div></div>`;
                messageRow.innerHTML = messageHtml; chatPanelBody.appendChild(messageRow);
                if (!isHistory) { scrollToBottom(chatPanelBody); }
            }
            pageInitializers.chats.displayChatMessage = displayChatMessage;
            async function switchChatContext(contextData) {
                currentChatContext = contextData; document.querySelectorAll('.conversation-item.active').forEach(el => el.classList.remove('active')); const activeItem = document.querySelector(`.conversation-item[data-id='${contextData.id}']`); if (activeItem) activeItem.classList.add('active'); const partnerName = contextData.name || "Public Group Chat"; const partnerAvatar = getAvatarDetails(partnerName); const chatType = contextData.type === 'group' ? 'Group Chat' : 'Private Chat'; chatHeader.innerHTML = `<div class="avatar-initials ${partnerAvatar.avatarClass}">${partnerAvatar.initials}</div><div><div class="fw-bold">${partnerName}</div><small class="text-muted">${chatType}</small></div>`; chatPanelBody.innerHTML = ''; getChatHistory(currentChatContext.id).forEach(msg => displayChatMessage(msg, true)); scrollToBottom(chatPanelBody); if (contextData.type === 'private' || contextData.type === 'group') { await connection.invoke("JoinPrivateChat", contextData.id); }
            }
            async function sendChatMessage() {
                const message = messageInput.value.trim(); const file = fileInput ? fileInput.files[0] : null; if (!message && !file) return;
                if (file) { await uploadFileAndSendMessage(file, messageInput, attachmentButton, sendButton, filePreviewContainer); } else { try { const method = currentChatContext.type === 'group' ? "SendPublicMessage" : "SendPrivateMessage"; const args = currentChatContext.type === 'group' ? [currentUserIdentity, message, null, null, null] : [currentChatContext.id, currentUserIdentity, message, null, null, null]; await connection.invoke(method, ...args); if (messageInput) messageInput.value = ""; } catch (err) { console.error("Error sending message via SignalR:", err); } }
                updateSendButtonState();
            }
            function renderAdminConversationList() {
                conversationListContainer.innerHTML = ''; const createChatItem = (type, id, name, subtext, iconClass) => { const avatar = getAvatarDetails(name); return `<a href="#" class="list-group-item list-group-item-action conversation-item" data-type="${type}" data-id="${id}" data-name="${name}"><div class="d-flex w-100 align-items-center"><div class="avatar-initials ${avatar.avatarClass} me-3">${avatar.initials}</div><div class="flex-grow-1"><div class="fw-bold">${name}</div><small class="text-muted">${subtext}</small></div><div class="icon ms-2"><i class="fas ${iconClass}"></i></div></div></a>`; };
                let html = createChatItem('group', 'public', 'Public Group Chat', 'Group Chat', 'fa-users');
                let accordionHtml = '<div class="accordion" id="sidebarAccordion">'; const allStaff = [...teamMembers, ...internalStaff];
                const teamItems = allStaff.filter(u => u.name !== adminUserIdentity).map(user => createChatItem('private', generateGroupName(adminUserIdentity, user.name), user.name, 'Team Chat', 'fa-user')).join('');
                accordionHtml += `<div class="accordion-item"><h2 class="accordion-header" id="headingTeams"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTeams">Teams</button></h2><div id="collapseTeams" class="accordion-collapse collapse"><div class="list-group list-group-flush">${teamItems}</div></div></div>`;
                const customerItems = customerList.map(user => createChatItem('private', generateGroupName(adminUserIdentity, user.name), user.name, 'Customer Chat', 'fa-user-tie')).join('');
                accordionHtml += `<div class="accordion-item"><h2 class="accordion-header" id="headingCustomers"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseCustomers">Customers</button></h2><div id="collapseCustomers" class="accordion-collapse collapse"><div class="list-group list-group-flush">${customerItems}</div></div></div>`;
                accordionHtml += '</div>'; html += accordionHtml; conversationListContainer.innerHTML = html;
            }
            renderAdminConversationList();
            const firstItem = conversationListContainer.querySelector('.conversation-item'); if (firstItem) { switchChatContext(firstItem.dataset); }
            conversationListContainer.addEventListener('click', (e) => { const item = e.target.closest('.conversation-item'); if (item) { e.preventDefault(); switchChatContext(item.dataset); } });
            sendButton.addEventListener("click", sendChatMessage); messageInput.addEventListener("keyup", (e) => { updateSendButtonState(); if (e.key === "Enter") sendChatMessage(); });
            conversationSearchInput.addEventListener('input', () => { const searchTerm = conversationSearchInput.value.toLowerCase().trim(); const conversationItems = conversationListContainer.querySelectorAll('.conversation-item'); conversationItems.forEach(item => { const itemName = item.querySelector('.fw-bold').textContent.toLowerCase(); if (itemName.includes(searchTerm)) { item.classList.remove('d-none'); } else { item.classList.add('d-none'); } }); });
            if (attachmentButton) attachmentButton.addEventListener('click', () => fileInput.click());
            if (fileInput) fileInput.addEventListener('change', () => { if (fileInput.files.length > 0) { displayFilePreview(fileInput.files[0]); } else { removeFilePreview(); } updateSendButtonState(); });
            updateSendButtonState();
        },
        'ticket-management': function () {
            let currentDetailTicketId = null;
            let ticketsTable = ticketsTableElement.DataTable({
                destroy: true, data: getTickets(),
                columns: [
                    { data: 'id' }, { data: 'subject' }, { data: 'createdBy' }, { data: 'assignedTo', defaultContent: 'Unassigned' },
                    { data: 'status', render: generateStatusBadge }, { data: 'priority', render: generatePriorityBadge },
                    { data: 'lastUpdate', render: (d, t, r) => formatDateTime(d || r.submissionTimestamp), defaultContent: '' },
                    { data: null, orderable: false, searchable: false, render: function (data, type, row) { const resolveControl = (row.status !== 'Resolved') ? `<div class="form-check form-check-inline me-2" title="Mark as Resolved"><input class="form-check-input mark-resolved-checkbox" type="checkbox" data-ticket-id="${row.id}"></div>` : `<div class="text-success text-center me-2" title="Resolved"><i class="fas fa-check-circle"></i></div>`; const chatButton = `<button class="btn btn-sm btn-primary start-ticket-chat-btn" data-ticket-id="${row.id}"><i class="fas fa-comments me-1"></i>Chat</button>`; return `<div class="d-flex align-items-center justify-content-center">${resolveControl}${chatButton}</div>`; } }
                ],
                order: [[6, 'desc']], pageLength: 10, lengthMenu: [[10, 20, 25, -1], ['10', '20', '25', 'All']], searching: true, info: true,
                dom: "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>><'row'<'col-sm-12'tr>><'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>"
            });
            function updateTicketAndRedraw(ticketId, updateFn) {
                let allTickets = getTickets(); const ticketIndex = allTickets.findIndex(t => t.id.toString() === ticketId.toString());
                if (ticketIndex > -1) { updateFn(allTickets[ticketIndex]); allTickets[ticketIndex].lastUpdate = new Date().toISOString(); saveTickets(allTickets); ticketsTable.row(function (idx, data, node) { return data.id.toString() === ticketId.toString(); }).data(allTickets[ticketIndex]).draw(false); }
            }
            function populateTicketDetails(ticketId) {
                currentDetailTicketId = ticketId; const ticket = getTickets().find(t => t.id.toString() === ticketId.toString());
                if (!ticket) { ticketDetailPlaceholder.style.display = 'flex'; ticketDetailContent.style.display = 'none'; return; }
                ticketDetailPlaceholder.style.display = 'none'; ticketDetailContent.style.display = 'block';
                detailTicketId.textContent = `#${ticket.id}`; detailTicketSubject.textContent = ticket.subject; detailCreatedBy.value = ticket.createdBy;
                detailStatus.innerHTML = statuses.map(s => `<option value="${s}" ${s === ticket.status ? 'selected' : ''}>${s}</option>`).join('');
                detailPriority.innerHTML = priorities.map(p => `<option value="${p}" ${p === (ticket.priority || 'Normal') ? 'selected' : ''}>${p}</option>`).join('');
                detailAssignee.innerHTML = agents.map(a => `<option value="${a}" ${a === (ticket.assignedTo || 'Unassigned') ? 'selected' : ''}>${a}</option>`).join('');
            }
            function renderChatMessagesInPopup(ticketId, container) {
                container.innerHTML = ''; const history = getTicketChatHistory(ticketId);
                if (history.length > 0) { history.forEach(msg => { const isAgentReply = msg.sender === adminUserIdentity || agents.includes(msg.sender); const messageClass = isAgentReply ? 'sent' : 'received'; const messageHtml = `<div class="message-row ${messageClass}"><div class="message-content"><div class="message-bubble"><p class="message-text">${msg.text}</p></div><span class="message-timestamp">${msg.sender} - ${formatDateTime(msg.timestamp)}</span></div></div>`; container.innerHTML += messageHtml; }); }
                else { container.innerHTML = `<p class="text-muted text-center small p-3">No conversation history. Start the conversation!</p>`; }
                scrollToBottom(container);
            }
            function openChatBox(ticket) {
                const existingChatBox = document.getElementById(`chatbox-${ticket.id}`);
                if (existingChatBox) { existingChatBox.classList.remove('collapsed'); existingChatBox.querySelector('textarea').focus(); return; }
                const chatBox = document.createElement('div'); chatBox.className = 'floating-chat-box'; chatBox.id = `chatbox-${ticket.id}`; chatBox.dataset.ticketId = ticket.id;
                chatBox.innerHTML = ` <div class="chat-box-header"> <span class="chat-box-title">#${ticket.id} - ${ticket.createdBy}</span> <div class="chat-box-actions"> <button class="action-minimize" title="Minimize"><i class="fas fa-minus"></i></button> <button class="action-close" title="Close"><i class="fas fa-times"></i></button> </div> </div> <div class="chat-box-body"></div> <div class="chat-box-footer"> <textarea class="form-control" rows="1" placeholder="Type your reply..."></textarea> <button class="btn btn-primary action-send" title="Send"><i class="fas fa-paper-plane"></i></button> </div> `;
                floatingChatContainer.appendChild(chatBox); const chatBody = chatBox.querySelector('.chat-box-body'); renderChatMessagesInPopup(ticket.id, chatBody);
            }
            ticketsTableElement.off('click').on('click', 'tbody tr', function (e) { if ($(e.target).closest('.start-ticket-chat-btn, .mark-resolved-checkbox').length) return; ticketsTable.$('tr.table-active').removeClass('table-active'); $(this).addClass('table-active'); const data = ticketsTable.row(this).data(); if (data) populateTicketDetails(data.id); });
            ticketsTableElement.off('click', '.start-ticket-chat-btn').on('click', '.start-ticket-chat-btn', function (e) { e.stopPropagation(); const ticketId = $(this).data('ticket-id').toString(); const ticket = getTickets().find(t => t.id === ticketId); if (ticket) openChatBox(ticket); });
            ticketsTableElement.off('change', '.mark-resolved-checkbox').on('change', '.mark-resolved-checkbox', function () { const ticketId = $(this).data('ticket-id').toString(); if (confirm("Are you sure you want to mark this ticket as Resolved?")) { updateTicketAndRedraw(ticketId, ticket => { ticket.status = 'Resolved'; ticket.resolvedBy = ticket.assignedTo !== 'Unassigned' ? ticket.assignedTo : adminUserIdentity; }); } else { $(this).prop('checked', false); } });
            $(floatingChatContainer).off('click').on('click', e => {
                const chatBox = e.target.closest('.floating-chat-box'); if (!chatBox) return; const ticketId = chatBox.dataset.ticketId;
                if (e.target.closest('.chat-box-header') && !e.target.closest('.chat-box-actions')) { chatBox.classList.toggle('collapsed'); }
                if (e.target.closest('.action-minimize')) { chatBox.classList.add('collapsed'); } if (e.target.closest('.action-close')) { chatBox.remove(); }
                if (e.target.closest('.action-send')) {
                    const textarea = chatBox.querySelector('textarea'); const text = textarea.value.trim(); if (!text) return;
                    const messageData = { sender: adminUserIdentity, text: text, timestamp: new Date().toISOString() };
                    saveTicketChatMessage(ticketId, messageData); renderChatMessagesInPopup(ticketId, chatBox.querySelector('.chat-box-body'));
                    updateTicketAndRedraw(ticketId, () => { }); textarea.value = ''; textarea.focus();
                }
            });
            $(floatingChatContainer).off('keyup').on('keyup', 'textarea', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $(this).closest('.chat-box-footer').find('.action-send').click(); } });
            $(ticketDetailContent).off('change').on('change', '#detail-assignee, #detail-status, #detail-priority', function () {
                if (!currentDetailTicketId) return;
                updateTicketAndRedraw(currentDetailTicketId, ticket => { ticket.assignedTo = $('#detail-assignee').val(); ticket.status = $('#detail-status').val(); ticket.priority = $('#detail-priority').val(); });
            });
            $('#filter-status, #filter-priority, #filter-agent').off('change').on('change', function () { $.fn.dataTable.ext.search.pop(); $.fn.dataTable.ext.search.push(function (settings, data, dataIndex) { const rowData = ticketsTable.row(dataIndex).data(); if (!rowData) return false; const statusMatch = ($('#filter-status').val() === "" || rowData.status === $('#filter-status').val()); const priorityMatch = ($('#filter-priority').val() === "" || (rowData.priority || 'Normal') === $('#filter-priority').val()); const agentMatch = ($('#filter-agent').val() === "" || (rowData.assignedTo || 'Unassigned') === $('#filter-agent').val()); return statusMatch && priorityMatch && agentMatch; }); ticketsTable.draw(); });
            $('#filter-status').html('<option value="">All Statuses</option>' + statuses.map(s => `<option value="${s}">${s}</option>`));
            $('#filter-priority').html('<option value="">All Priorities</option>' + priorities.map(p => `<option value="${p}">${p}</option>`));
            $('#filter-agent').html('<option value="">All Agents</option>' + agents.map(a => `<option value="${a}">${a}</option>`));
            const allTickets = getTickets(); if (allTickets.length > 0) { const firstTicketId = allTickets.sort((a, b) => new Date(b.lastUpdate || b.submissionTimestamp) - new Date(a.lastUpdate || a.submissionTimestamp))[0].id; populateTicketDetails(firstTicketId); ticketsTable.row(function (idx, data, node) { return data.id.toString() === firstTicketId.toString(); }).nodes().to$().addClass('table-active'); }
        },
        'inquiry-management': function () {
            const inquiryLocalStorageKey = 'clientInquiries';
            const getInquiries = () => JSON.parse(localStorage.getItem(inquiryLocalStorageKey)) || [];
            const saveInquiries = (allInquiries) => localStorage.setItem(inquiryLocalStorageKey, JSON.stringify(allInquiries));
            const getInquiryChatHistory = (id) => JSON.parse(localStorage.getItem(`inquiry-chat-${id}`)) || [];
            const saveInquiryChatHistory = (id, history) => localStorage.setItem(`inquiry-chat-${id}`, JSON.stringify(history));

            // This variable needs to be accessible to the 'draw' event listener, but reset on init
            let currentActiveInquiryId = null;

            const inquiryChatContent = document.getElementById('inquiry-chat-content');
            const inquiryChatPlaceholder = document.getElementById('inquiry-chat-placeholder');
            const inquiryChatConversation = document.getElementById('inquiry-chat-conversation');
            const inquiryStatusFilter = document.getElementById('inquiry-status-filter');
            const inquiryMessageInput = document.getElementById('inquiry-message-input');
            const inquirySendBtn = document.getElementById('inquiry-send-btn');
            const generateInquiryStatusBadge = (outcome) => { return outcome === 'Completed' ? `<span class="badge bg-success">Completed</span>` : `<span class="badge bg-warning text-dark">Pending</span>`; };

            let inquiriesTable = $('#inquiriesDataTable').DataTable({
                destroy: true, data: getInquiries(),
                columns: [{ data: 'id' }, { data: 'topic' }, { data: 'inquiredBy' }, { data: 'date', render: (d) => d ? new Date(d).toLocaleString() : 'N/A' }, { data: 'outcome', render: (d) => generateInquiryStatusBadge(d || 'Pending') }, { data: null, orderable: false, searchable: false, render: (data, type, row) => { return (row.outcome || 'Pending') !== 'Completed' ? `<div class="form-check d-flex justify-content-center"><input class="form-check-input mark-completed-checkbox" type="checkbox" data-inquiry-id="${row.id}"></div>` : '<div class="text-center text-success"><i class="fas fa-check-circle"></i></div>'; } }],
                order: [[3, 'desc']], pageLength: 10, lengthMenu: [[10, 20, 50, -1], ['10', '20', '50', 'All']],
                dom: "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>><'row'<'col-sm-12'tr>><'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>"
            });

            inquiriesTable.on('draw.dt', function () {
                if (currentActiveInquiryId) {
                    $('#inquiriesDataTable tbody tr').each(function () {
                        const rowData = inquiriesTable.row(this).data();
                        if (rowData && rowData.id === currentActiveInquiryId) {
                            $(this).addClass('table-active');
                        }
                    });
                }
            });

            function populateInquiryChat(inquiryId) {
                const inquiry = getInquiries().find(i => i.id === inquiryId); if (!inquiry) return;
                currentActiveInquiryId = inquiryId;
                // ✅ FIX: Store the active ID directly on the DOM element to use as the source of truth.
                inquiryChatContent.dataset.activeInquiryId = inquiryId;
                inquiryChatPlaceholder.style.display = 'none'; inquiryChatContent.style.display = 'flex'; document.getElementById('inquiry-chat-header').textContent = `Inquiry: ${inquiry.topic}`;
                inquiryChatConversation.innerHTML = ''; const chatHistory = getInquiryChatHistory(inquiryId);
                if (chatHistory.length > 0) { chatHistory.forEach(msg => { const isAgentReply = msg.sender === adminUserIdentity; const messageClass = isAgentReply ? 'sent' : 'received'; inquiryChatConversation.innerHTML += `<div class="message-row ${messageClass}"><div class="message-content"><div class="message-bubble"><p>${msg.text}</p></div><div class="message-timestamp">${msg.sender} - ${formatDateTime(msg.timestamp)}</div></div></div>`; }); }
                else { inquiryChatConversation.innerHTML = `<div class="p-3 text-muted text-center">No conversation history. Start the conversation!</div>`; }
                scrollToBottom(inquiryChatConversation);
            }

            function handleInquiryReply() {
                // ✅ FIX: Read the active ID directly from the chat container to prevent using a stale ID.
                const activeId = inquiryChatContent.dataset.activeInquiryId;
                const text = inquiryMessageInput.value.trim();
                if (!text || !activeId) return;

                const messageData = { sender: adminUserIdentity, text: text, timestamp: new Date().toISOString() };
                const history = getInquiryChatHistory(activeId);
                history.push(messageData);
                saveInquiryChatHistory(activeId, history);
                populateInquiryChat(activeId); // Refresh using the correct ID
                inquiryMessageInput.value = '';
                inquiryMessageInput.focus();
            }

            function markAsCompleted(inquiryId) {
                let allInquiries = getInquiries(); const inquiryIndex = allInquiries.findIndex(i => i.id === inquiryId);
                if (inquiryIndex > -1) { allInquiries[inquiryIndex].outcome = 'Completed'; saveInquiries(allInquiries); inquiriesTable.row(function (idx, data, node) { return data.id === inquiryId; }).data(allInquiries[inquiryIndex]).draw(false); }
            }

            $.fn.dataTable.ext.search.pop(); $.fn.dataTable.ext.search.push(function (settings, data, dataIndex) { if (settings.nTable.id !== 'inquiriesDataTable') return true; const selectedStatus = inquiryStatusFilter.value; if (selectedStatus === "") return true; const rowData = inquiriesTable.row(dataIndex).data(); return selectedStatus === (rowData.outcome || 'Pending'); });
            $('#inquiriesDataTable tbody').off('click').on('click', 'tr', function (event) { if ($(event.target).is('input.mark-completed-checkbox')) { return; } inquiriesTable.$('tr.table-active').removeClass('table-active'); $(this).addClass('table-active'); const rowData = inquiriesTable.row(this).data(); if (rowData) { populateInquiryChat(rowData.id); } });
            $('#inquiriesDataTable tbody').off('change').on('change', '.mark-completed-checkbox', function () { const inquiryId = $(this).data('inquiry-id'); if (confirm("Are you sure you want to mark this inquiry as completed?")) { markAsCompleted(inquiryId); } else { $(this).prop('checked', false); } });
            inquiryStatusFilter.addEventListener('change', () => { inquiriesTable.draw(); });
            inquirySendBtn.addEventListener('click', handleInquiryReply);
            inquiryMessageInput.addEventListener('keyup', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleInquiryReply(); } });

            const inquiries = getInquiries();
            if (inquiries.length > 0) {
                const firstInquiry = inquiries[0];
                populateInquiryChat(firstInquiry.id);
                // Use a slight delay to ensure DataTables has drawn the rows before adding the class
                setTimeout(() => {
                    const firstRow = inquiriesTable.row(0).node();
                    if (firstRow) $(firstRow).addClass('table-active');
                }, 100);
            }
        }
    };

    // --- MAIN INITIALIZATION & NAVIGATION ---
    function initializeAdminPanel() {
        $('.admin-sidebar .nav-link').on('click', function (e) {
            e.preventDefault(); const pageName = $(this).data('page');
            $('.admin-sidebar .nav-link.active').removeClass('active'); $(this).addClass('active');
            $('.admin-page.active').removeClass('active'); $('#' + pageName + '-page').addClass('active');
            if (pageInitializers[pageName]) { pageInitializers[pageName](); initializedPages[pageName] = true; }
        });
        const initialPage = $('.admin-sidebar .nav-link.active').data('page');
        if (pageInitializers[initialPage]) { pageInitializers[initialPage](); initializedPages[initialPage] = true; }
    }

    // --- REAL-TIME EVENT HANDLERS ---
    connection.on("ReceivePublicMessage", (messageId, sender, msg, time, initials, fileUrl, fileName, fileType) => {
        const data = { id: messageId, sender, message: msg, timestamp: time, fileUrl, fileName, fileType }; saveMessageToHistory('public', data);
        if (currentChatContext.id === 'public' && pageInitializers.chats.displayChatMessage) { pageInitializers.chats.displayChatMessage(data, false); }
    });
    connection.on("ReceivePrivateMessage", (messageId, groupName, sender, msg, time, initials, fileUrl, fileName, fileType) => {
        const data = { id: messageId, sender, message: msg, timestamp: time, fileUrl, fileName, fileType }; saveMessageToHistory(groupName, data);
        if (currentChatContext.id === groupName && pageInitializers.chats.displayChatMessage) { pageInitializers.chats.displayChatMessage(data, false); }
    });

    window.addEventListener('storage', (event) => {
        if (event.key.startsWith('ticket-chat-')) {
            const ticketId = event.key.replace('ticket-chat-', '');
            const chatBox = document.getElementById(`chatbox-${ticketId}`);
            if (chatBox) {
                const chatBody = chatBox.querySelector('.chat-box-body');
                renderChatMessagesInPopup(ticketId, chatBody);
            }
        }
        if (event.key.startsWith('inquiry-chat-')) {
            const inquiryId = event.key.replace('inquiry-chat-', '');
            const activeId = document.getElementById('inquiry-chat-content').dataset.activeInquiryId;
            if (activeId === inquiryId) {
                // Find the populateInquiryChat function if it exists on the page
                const initializer = initializedPages['inquiry-management'];
                if (initializer) {
                    // This is a bit of a hack, but we need to re-run the populate function.
                    // A better long-term solution would be a more robust state management system.
                    const chatContent = document.getElementById('inquiry-chat-content');
                    const history = JSON.parse(event.newValue || '[]');
                    const conversation = document.getElementById('inquiry-chat-conversation');
                    conversation.innerHTML = '';
                    if (history.length > 0) {
                        history.forEach(msg => {
                            const isAgentReply = msg.sender === adminUserIdentity;
                            const messageClass = isAgentReply ? 'sent' : 'received';
                            conversation.innerHTML += `<div class="message-row ${messageClass}"><div class="message-content"><div class="message-bubble"><p>${msg.text}</p></div><div class="message-timestamp">${msg.sender} - ${formatDateTime(msg.timestamp)}</div></div></div>`;
                        });
                    } else {
                        conversation.innerHTML = `<div class="p-3 text-muted text-center">No conversation history. Start the conversation!</div>`;
                    }
                    scrollToBottom(conversation);
                }
            }
        }
    });

    connection.start().then(() => {
        console.log("SignalR Connected (Admin).");
        initializeAdminPanel();
    }).catch(err => console.error("SignalR Connection Error: ", err));
});

