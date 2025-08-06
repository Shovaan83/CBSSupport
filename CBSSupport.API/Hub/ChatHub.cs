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
        private readonly ILogger<ChatHub> _logger;

        public ChatHub(IChatService chatService, ILogger<ChatHub> logger)
        {
            _chatService = chatService;
            _logger = logger;
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

            // Broadcast a message with all the new data ONLY to clients in the specified group.
            await Clients.Group(groupName).SendAsync("ReceivePrivateMessage", messageId, groupName, senderName, message, DateTime.UtcNow, initials, fileUrl, fileName, fileType);
        }

        public async Task UserIsTyping(string groupName, string userName)
        {
            await Clients.GroupExcept(groupName, Context.ConnectionId).SendAsync("ReceiveTypingNotification", groupName, userName, true);
        }

        public async Task UserStoppedTyping(string groupName, string userName)
        {
            await Clients.GroupExcept(groupName, Context.ConnectionId).SendAsync("ReceiveTypingNotification", groupName, userName, false);
        }

        public async Task GetMyConversations(long clientId)
        {
            try
            {
                var sidebarData = await _chatService.GetSidebarForUserAsync(0, clientId);
                await Clients.Caller.SendAsync("ReceivesSidebarData", sidebarData);
            }
            catch (Exception ex)
            {
                _logger.LogError("An error occurred in GetMyConversations for client ID {ClientId}", clientId);
                _logger.LogError(ex, "Full exception details for the error above.");
            }
        }

        public async Task CreateTicket(string subject)
        {
            var newTicket = new ChatMessage
            {
                Instruction = subject,
                InstTypeId = 100, // Default to support group
                Status = true,
                InstChannel = "chat",
                IpAddress = Context.GetHttpContext()?.Connection.RemoteIpAddress?.ToString()
            };

            ChatMessage savedTicket = await _chatService.CreateInstructionTicketAsync(newTicket);
            await Clients.Caller.SendAsync("NewTicketCreated", savedTicket);
        }
    }
}