document.addEventListener("DOMContentLoaded", function () {

    const conversationList = document.getElementById('conversation-list');
    const chatHeaderUser = document.getElementById('chat-header-user');
    const detailsUsername = document.getElementById('details-username');
    const detailsAvatar = document.getElementById('details-avatar');
    const chatPanelBody = document.getElementById('chat-panel-body');

    // Use event delegation on the parent list
    conversationList.addEventListener('click', function (e) {
        // Find the clicked conversation item
        const targetItem = e.target.closest('.conversation-item');
        if (!targetItem) return;

        // Prevent default link behavior
        e.preventDefault();

        // Remove active class from all items
        conversationList.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to the clicked item
        targetItem.classList.add('active');

        // Get user data from data attributes
        const username = targetItem.dataset.username;
        const userImg = targetItem.dataset.img;

        // --- UPDATE THE UI ---

        // 1. Update Chat Header
        chatHeaderUser.textContent = username;

        // 2. Update Details Panel
        detailsUsername.textContent = username;
        detailsAvatar.src = userImg;

        // 3. Simulate loading new messages
        chatPanelBody.innerHTML = ''; // Clear previous messages
        if (username === 'John Smith') {
            addMessage('Hello, I need to check the status of ticket #84011.', 'received');
            addMessage('Hi John, one moment while I pull that up for you.', 'sent');
        } else {
            addMessage('Hey, I have a question about my last invoice.', 'received');
            addMessage('Hello Jane, of course. I can see your invoice #INV-0042. What is your question?', 'sent');
        }
    });

    // Helper function to add message bubbles
    function addMessage(text, type) {
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${type}`;

        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
        messageBubble.textContent = text;

        messageRow.appendChild(messageBubble);
        chatPanelBody.appendChild(messageRow);
        chatPanelBody.scrollTop = chatPanelBody.scrollHeight;
    }
});