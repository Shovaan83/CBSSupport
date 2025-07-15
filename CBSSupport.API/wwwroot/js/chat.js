document.addEventListener("DOMContentLoaded", function () {

    // --- Element References ---
    const conversationListContainer = document.getElementById('conversation-list-container');
    const chatBody = document.getElementById('chat-panel-body');

    // --- Initial Load ---
    const initialActiveItem = conversationListContainer.querySelector('.conversation-item.active');
    if (initialActiveItem) {
        updateChatPanel(initialActiveItem);
    }

    // --- Event Handling ---
    conversationListContainer.addEventListener('click', function (e) {
        const targetItem = e.target.closest('.conversation-item');
        if (!targetItem) return;

        e.preventDefault();

        conversationListContainer.querySelectorAll('.conversation-item').forEach(item => item.classList.remove('active'));
        targetItem.classList.add('active');

        updateChatPanel(targetItem);
    });

    /**
     * Updates the middle chat panel based on the selected conversation.
     * @param {HTMLElement} selectedItem - The conversation item that was clicked.
     */
    function updateChatPanel(selectedItem) {
        const type = selectedItem.dataset.type;
        const username = selectedItem.dataset.username;
        const initials = selectedItem.dataset.initials;

        // --- Update Chat Header ---
        const partnerNameEl = document.getElementById('chat-partner-name');
        const partnerStatusEl = document.getElementById('chat-partner-status');
        const headerAvatarEl = document.getElementById('chat-header-avatar');

        partnerNameEl.textContent = username;
        headerAvatarEl.textContent = initials; // Set the letter inside the div

        // Update avatar background color to match the list
        const avatarInList = selectedItem.querySelector('.avatar-initials');
        headerAvatarEl.className = avatarInList.className; // Copies all classes, including color

        if (type === 'support') {
            partnerStatusEl.textContent = `Online - Agent: Sarah`;
        } else { // 'colleague'
            partnerStatusEl.textContent = `Online`;
        }

        // --- Update Chat Body with Simulated Messages ---
        chatBody.innerHTML = '';
        if (type === 'support') {
            addMessage('Hello, I have a question about my last invoice.', 'sent');
            addMessage('Hi there! This is Sarah from support. I can certainly help you with that.', 'received');
        } else { // 'colleague'
            addMessage('Hey John, do you have the Q3 report ready?', 'sent');
            addMessage('Yep, just finishing it up. I\'ll send it over in about 10 minutes.', 'received');
        }
    }

    /**
     * Helper function to add message bubbles to the UI.
     */
    function addMessage(text, type) {
        const row = document.createElement('div');
        row.className = `message-row ${type}`;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = text;

        row.appendChild(bubble);
        chatBody.appendChild(row);
        chatBody.scrollTop = chatBody.scrollHeight;
    }
});