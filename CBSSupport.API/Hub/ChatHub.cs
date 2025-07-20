using Microsoft.AspNetCore.SignalR;
using CBSSupport.Shared.Services;
using CBSSupport.Shared.Models;
using System;
using System.Threading.Tasks;

namespace CBSSupport.API.Hubs
{
    public class ChatHub : Hub
    {
        private readonly IChatService _chatService;

        public ChatHub(IChatService chatService)
        {
            _chatService = chatService;
        }

        // --- METHOD FOR PUBLIC GROUP CHAT ---
        public async Task SendPublicMessage(string senderName, string message)
        {
            string initials = !string.IsNullOrEmpty(senderName) ? senderName.Substring(0, 1).ToUpper() : "?";
            // Broadcast to ALL connected clients
            await Clients.All.SendAsync("ReceivePublicMessage", senderName, message, DateTime.UtcNow, initials);
        }

        // --- NEW: METHOD FOR JOINING A PRIVATE CHAT GROUP ---
        public async Task JoinPrivateChat(string groupName)
        {
            // Adds the current user's connection to a specific group (e.g., "Admin_RamShah")
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        }

        // --- NEW: METHOD FOR SENDING A PRIVATE MESSAGE ---
        public async Task SendPrivateMessage(string groupName, string senderName, string message)
        {
            string initials = !string.IsNullOrEmpty(senderName) ? senderName.Substring(0, 1).ToUpper() : "?";
            // Broadcast a message ONLY to clients in the specified group
            await Clients.Group(groupName).SendAsync("ReceivePrivateMessage", groupName, senderName, message, DateTime.UtcNow, initials);
        }

        // --- Existing ticket methods remain unchanged ---
        public async Task GetMyConversations()
        {
            long mockClientAuthUserId = 1;
            var tickets = await _chatService.GetInstructionTicketsForUserAsync(mockClientAuthUserId);
            await Clients.Caller.SendAsync("ReceiveConversationList", tickets);
        }

        public async Task CreateTicket(string subject)
        {
            long mockClientAuthUserId = 1;
            int mockInsertUser = 1;
            var newTicket = new ChatMessage { /* ... */ };
            long newId = await _chatService.CreateInstructionTicketAsync(newTicket);
            newTicket.Id = newId;
            await Clients.Caller.SendAsync("NewTicketCreated", newTicket);
        }
    }
}