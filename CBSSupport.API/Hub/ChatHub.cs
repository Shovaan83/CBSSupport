using Microsoft.AspNetCore.SignalR;
using CBSSupport.Shared.Services; // Your service interface
using CBSSupport.Shared.Models;   // Your model
using System;
using System.Threading.Tasks;

namespace CBSSupport.API.Hubs // Ensure this namespace matches your project structure
{
    public class ChatHub : Hub
    {
        private readonly IChatService _chatService;

        public ChatHub(IChatService chatService)
        {
            _chatService = chatService;
        }

        // --- METHOD TO HANDLE SENDING AND RECEIVING MESSAGES ---
        // This method is called by the client-side JavaScript.
        public async Task SendPublicMessage(string senderName, string message)
        {
            // In a real application, you would get the user's name from an authenticated context.
            // e.g., var senderName = Context.User.Identity.Name;

            // Generate avatar initials from the sender's name
            string initials = !string.IsNullOrEmpty(senderName) ? senderName.Substring(0, 1).ToUpper() : "?";

            // Broadcast the received message to ALL connected clients.
            // The method name "ReceiveMessage" must exactly match the client-side listener.
            await Clients.All.SendAsync("ReceiveMessage", senderName, message, DateTime.UtcNow, initials);

            // In a production system, you would also save the message to a database here.
        }

        // --- Existing methods below are unchanged ---

        public async Task GetMyConversations()
        {
            // This is a placeholder for your existing logic
            long mockClientAuthUserId = 1;
            var tickets = await _chatService.GetInstructionTicketsForUserAsync(mockClientAuthUserId);
            await Clients.Caller.SendAsync("ReceiveConversationList", tickets);
        }

        public async Task CreateTicket(string subject)
        {
            // This is a placeholder for your existing logic
            long mockClientAuthUserId = 1;
            int mockInsertUser = 1;

            var newTicket = new ChatMessage
            {
                DateTime = DateTime.UtcNow,
                InstCategoryId = 1,
                InstTypeId = 1,
                Instruction = subject,
                Status = true,
                ClientAuthUserId = mockClientAuthUserId,
                InsertUser = mockInsertUser,
                InstChannel = "WebApp"
            };

            long newId = await _chatService.CreateInstructionTicketAsync(newTicket);
            newTicket.Id = newId;
            await Clients.Caller.SendAsync("NewTicketCreated", newTicket);
        }
    }
}