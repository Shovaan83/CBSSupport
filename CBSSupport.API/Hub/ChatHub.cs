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

        public async Task SendPublicMessage(string senderName, string message, string fileUrl = null, string fileName = null, string fileType = null)
        {
            long messageId = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            string initials = !string.IsNullOrEmpty(senderName) ? senderName.Substring(0, 1).ToUpper() : "?";
            await Clients.All.SendAsync("ReceivePublicMessage", messageId, senderName, message, DateTime.UtcNow, initials, fileUrl, fileName, fileType);
        }

        public async Task MarkAsSeen(long messageId, string userName)
        {
            try
            {
                var seenTime = DateTime.UtcNow;
                // In a real app, you would persist this via _chatService
                await Clients.All.SendAsync("MessageSeen", messageId, userName, seenTime);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"An error occurred in MarkAsSeen: {ex.Message}");
            }
        }

        public async Task JoinPrivateChat(string groupName)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        }

        public async Task SendPrivateMessage(string groupName, string senderName, string message, string fileUrl = null, string fileName = null, string fileType = null)
        {
            long messageId = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            string initials = !string.IsNullOrEmpty(senderName) ? senderName.Substring(0, 1).ToUpper() : "?";
            await Clients.Group(groupName).SendAsync("ReceivePrivateMessage", messageId, groupName, senderName, message, DateTime.UtcNow, initials, fileUrl, fileName, fileType);
        }

        public async Task UserIsTyping(string groupName, string userName)
        {
            await Clients.Group(groupName).SendAsync("ReceiveTypingNotification", groupName, userName, true);
        }

        public async Task UserStoppedTyping(string groupName, string userName)
        {
            await Clients.Group(groupName).SendAsync("ReceiveTypingNotification", groupName, userName, false);
        }

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