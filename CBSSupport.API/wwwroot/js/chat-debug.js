// Debug version of sendMessage function with enhanced logging
async function sendMessageDebug(fileInfo = null) {
    const messageText = messageInput.value.trim();
    if (!messageText && !fileInfo) return;

    if (!currentChatContext.id || !currentChatContext.type) {
        alert("Please select a conversation first.");
        return;
    }

    if (currentChatContext.id === 'public_group') {
        currentChatContext.route = 'support-group';
    }

    if (!currentChatContext.route) {
        alert("Unsupported chat type for sending messages.");
        return;
    }

    const postUrl = `/v1/api/instructions/${currentChatContext.route}`;

    const chatMessage = {
        Instruction: messageText,
        ClientId: currentClient.id,
        ClientAuthUserId: currentUser.id,
        InsertUser: currentUser.id,
        InstructionId: parseInt(currentChatContext.id, 10),
        InstCategoryId: 100,
        ServiceId: 3,
        Remarks: "Hello",
    };

    console.log("=== CHAT DEBUG INFO ===");
    console.log("1. Request URL:", postUrl);
    console.log("2. Request Body:", JSON.stringify(chatMessage, null, 2));
    console.log("3. Current User:", currentUser);
    console.log("4. Current Client:", currentClient);
    console.log("5. Current Context:", currentChatContext);
    console.log("6. Cookies:", document.cookie);

    try {
        const response = await fetch(postUrl, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(chatMessage),
            credentials: 'include' // IMPORTANT: Include cookies for authentication
        });

        console.log("7. Response Status:", response.status);
        console.log("8. Response Headers:", response.headers);

        const responseText = await response.text();
        console.log("9. Response Body:", responseText);

        if (!response.ok) {
            let errorData;
            try {
                errorData = JSON.parse(responseText);
            } catch {
                errorData = { message: responseText || `HTTP ${response.status}: ${response.statusText}` };
            }

            console.error("10. Error Details:", errorData);
            throw new Error(errorData.message || "Failed to send Message.");
        }

        const savedMessage = JSON.parse(responseText);
        console.log("11. Saved Message:", savedMessage);

        // Rest of the SignalR code...
        if (currentChatContext.type === 'group') {
            await connection.invoke("SendPublicMessage",
                currentUser.name,
                savedMessage.instruction
            );
        }
        else {
            await connection.invoke("SendPrivateMessage",
                savedMessage.instructionId.toString(),
                currentUser.name,
                savedMessage.instruction
            );
        }

        displayMessage(savedMessage);

        messageInput.value = '';
        fileInput.value = '';
        updateSendButtonState();
    }
    catch (error) {
        console.error("12. Final Error:", error);
        alert(`Error: ${error.message}`);
    }
}

// Replace the original sendMessage function
window.sendMessage = sendMessageDebug;

console.log("=== CHAT DEBUG MODE ENABLED ===");
console.log("Check console for detailed request/response information");