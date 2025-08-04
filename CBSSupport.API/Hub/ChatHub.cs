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
            await Clients.All.SendAsync("MessageSeen", messageId, userName, DateTime.UtcNow);
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

        // ✅ CHANGE: Added methods to broadcast typing status to other clients in a group.
        public async Task UserIsTyping(string groupName, string userName)
        {
            // We broadcast to others in the group, excluding the caller who is typing.
            await Clients.GroupExcept(groupName, Context.ConnectionId).SendAsync("ReceiveTypingNotification", groupName, userName, true);
        }

        public async Task UserStoppedTyping(string groupName, string userName)
        {
            await Clients.GroupExcept(groupName, Context.ConnectionId).SendAsync("ReceiveTypingNotification", groupName, userName, false);
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