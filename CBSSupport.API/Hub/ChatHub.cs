using Microsoft.AspNetCore.SignalR;
using CBSSupport.Shared.Services; // Your service interface
using CBSSupport.Shared.Models;   // Your models
using System;
using System.Threading.Tasks;

namespace CBSSupport.API.Hubs
{
    public class ChatHub : Hub
    {
        private readonly IChatService _chatService;

        // The constructor remains the same, using your service.
        public ChatHub(IChatService chatService)
        {
            _chatService = chatService;
        }

        /// <param name="groupName">The unique name of the chat group to join.</param>
        public async Task JoinPrivateChat(string groupName)
        {
            // Adds the current user's connection to a SignalR group.
            // This is essential for targeting messages to the correct clients.
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        }

        /// <summary>
        /// Sends a message to all members of a specific private group.
        /// </summary>
        /// <param name="groupName">The target group, like "Admin User__Ram Shah".</param>
        /// <param name="senderName">The name of the user sending the message.</param>
        /// <param name="message">The content of the message.</param>
        public async Task SendPrivateMessage(string groupName, string senderName, string message)
        {
            // Broadcasts the message ONLY to clients who have joined this specific group.
            // The client-side JS listens for "ReceivePrivateMessage".
            await Clients.Group(groupName).SendAsync("ReceivePrivateMessage", groupName, senderName, message, DateTime.UtcNow);
        }

        /// <summary>
        /// Sends a message to a public group, like the "Public Group Chat".
        /// This works just like private messaging but uses a well-known groupName.
        /// </summary>
        /// <param name="groupName">The target group, which will be "public".</param>
        /// <param name="senderName">The name of the user sending the message.</param>
        /// <param name="message">The content of the message.</param>
        public async Task SendPublicMessage(string groupName, string senderName, string message)
        {
            // Broadcasts the message to everyone in the "public" group.
            // The client-side JS listens for "ReceivePublicMessage".
            await Clients.Group(groupName).SendAsync("ReceivePublicMessage", groupName, senderName, message, DateTime.UtcNow);
        }


        // =================================================================
        // == TICKET & DATA PERSISTENCE METHODS (From your code) ==
        // These methods handle creating/retrieving data from your service.
        // =================================================================

        /// <summary>
        /// Called from JS when the client connects to get their existing conversations.
        /// (This functionality can be expanded later).
        /// </summary>
        public async Task GetMyConversations()
        {
            // TODO: Get the real user ID after implementing authentication.
            long mockClientAuthUserId = 1;

            var tickets = await _chatService.GetInstructionTicketsForUserAsync(mockClientAuthUserId);
            // Send the list only to the caller.
            await Clients.Caller.SendAsync("ReceiveConversationList", tickets);
        }

        /// <summary>
        /// Called from JS when a user starts a new conversation from scratch.
        /// (This could be used for a "Start New Chat" button).
        /// </summary>
        /// <param name="subject">The initial subject of the new ticket/conversation.</param>
        public async Task CreateTicket(string subject)
        {
            // TODO: Get real user/client IDs from the authenticated context.
            long mockClientAuthUserId = 1;
            int mockInsertUser = 1;

            var newTicket = new ChatMessage
            {
                DateTime = DateTime.UtcNow,
                InstCategoryId = 1, // Example: 'Client Chat'
                InstTypeId = 1,     // Example: 'Support Chat'
                Instruction = subject,
                Status = true,      // true = Open
                ClientAuthUserId = mockClientAuthUserId,
                InsertUser = mockInsertUser,
                InstChannel = "WebApp"
            };

            long newId = await _chatService.CreateInstructionTicketAsync(newTicket);
            newTicket.Id = newId;

            // Send the newly created ticket back to the caller so they can open it.
            await Clients.Caller.SendAsync("NewTicketCreated", newTicket);
        }
    }
}