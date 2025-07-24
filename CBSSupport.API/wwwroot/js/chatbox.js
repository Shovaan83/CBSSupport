document.addEventListener("DOMContentLoaded", function () {

    const userListItems = document.querySelectorAll('.user-list-item');
    const chatUsernameHeader = document.getElementById('chat-username-header');
    const messageInput = document.getElementById('message-input');
    const chatBody = document.getElementById('chat-body');

    // Add a click event listener to each user in the list
    userListItems.forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();

            // --- UI Update Logic ---

            // 1. Manage the 'active' state for visual feedback
            userListItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
             
            // 2. Get username from the clicked item's data attribute
            const selectedUsername = this.dataset.username;

            // 3. Update the chat header
            chatUsernameHeader.textContent = selectedUsername;

            // 4. Update the message input placeholder
            messageInput.placeholder = `Type a message to ${selectedUsername}...`;

            // 5. (SIMULATION) Clear the chat and add mock messages for the selected user
            chatBody.innerHTML = ''; // Clear existing messages
            if (selectedUsername === 'John Smith') {
                addMessage('Hello, I need to check the status of ticket #84011.', 'received');
                addMessage('Hi John, one moment while I pull that up for you.', 'sent');
            } else {
                addMessage('Hey, I have a question about my last invoice.', 'received');
                addMessage('Hello Jane, of course. I can see your invoice #INV-0042. What is your question?', 'sent');
            }
        });
    });

    // Helper function to add message bubbles to the UI
    function addMessage(text, type) {
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${type}`;

        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
        messageBubble.textContent = text;

        messageRow.appendChild(messageBubble);
        chatBody.appendChild(messageRow);
        chatBody.scrollTop = chatBody.scrollHeight;
    }
});