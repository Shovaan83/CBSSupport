using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using CBSSupport.Shared.Services;
using CBSSupport.Shared.Models;
using System;
using System.Threading.Tasks;
using System.Linq.Expressions;

namespace CBSSupport.API.Hubs
{
    [Authorize]
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
            try
            {
                if (string.IsNullOrEmpty(groupName))
                {
                    _logger.LogWarning("JoinPrivateChat called with empty groupName by connection {ConnectionId}", Context.ConnectionId);
                    throw new HubException("Group name cannot be empty");
                }

                if (!System.Text.RegularExpressions.Regex.IsMatch(groupName, @"^[a-zA-Z0-9\-_]+$"))
                {
                    throw new HubException("Invalid group name format");
                }

                if (Context.User?.Identity == null || !Context.User.Identity.IsAuthenticated)
                {
                    _logger.LogWarning("JoinPrivateChat called by unauthenticated user with connection {ConnectionId}", Context.ConnectionId);
                    throw new HubException("User must be authenticated to join private chat");
                }

                var userName = Context.User.Identity.Name ?? "Anonymous";
                _logger.LogInformation("User '{UserName}' attempting to join group '{GroupName}' with connection ID {ConnectionId}", userName, groupName, Context.ConnectionId);

                await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
                _logger.LogInformation("SUCCESS: User '{UserName}' joined group '{GroupName}'", userName, groupName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CRITICAL ERROR in JoinPrivateChat for group {GroupName} and connection {ConnectionId}", groupName, Context.ConnectionId);
                throw new HubException($"Failed to join chat: {ex.Message}");
            }
        }

        //public async Task SendPrivateMessage(string groupName, string senderName, string message, string fileUrl = null, string fileName = null, string fileType = null)
        //{
        //    try
        //    {
        //        if (string.IsNullOrEmpty(groupName))
        //        {
        //            _logger.LogWarning("SendPrivateMessage was called with a null or empty groupName.");
        //            return;
        //        }

        //        long messageId = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        //        string initials = !string.IsNullOrEmpty(senderName) ? senderName.Substring(0, 1).ToUpper() : "?";

        //        await Clients.Group(groupName).SendAsync("ReceivePrivateMessage", messageId, groupName, senderName, message, DateTime.UtcNow, initials, fileUrl, fileName, fileType);
        //    }
        //    catch (Exception ex)
        //    {
        //        _logger.LogError(ex, "Error occured in SendPrivateMessage for group {GroupName}", groupName);
        //        throw;
        //    }
        //}

        // In your ChatHub class

        //public async Task SendPrivateMessage(string groupName, string message)
        //{
        //    try
        //    {
        //        if (string.IsNullOrEmpty(groupName))
        //        {
        //            _logger.LogWarning("SendPrivateMessage called with empty groupName.");
        //            return;
        //        }

        //        // --- NEW LOGIC: The Hub now gets the user info from the connection context ---
        //        // This is more secure because the client can't fake who they are.
        //        string senderName = Context.User.FindFirst("FullName")?.Value ?? "Unknown User";
        //        string senderIdStr = Context.User.FindFirst("UserId")?.Value;

        //        // The Hub is now responsible for creating the full message object to broadcast.
        //        var messageToBroadcast = new
        //        {
        //            id = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        //            groupName = groupName,
        //            senderName = senderName,
        //            instruction = message,
        //            datetime = DateTime.UtcNow,
        //            insertUser = int.TryParse(senderIdStr, out var senderId) ? senderId : 0
        //        };

        //        // Broadcast the full object.
        //        await Clients.Group(message.InstructionId.ToString()).SendAsync("ReceivePrivateMessage", message);
        //    }
        //    catch (Exception ex)
        //    {
        //        _logger.LogError(ex, "Error occurred in SendPrivateMessage for group {GroupName}", groupName);
        //        throw;
        //    }
        //}

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
                InstTypeId = 100, 
                Status = true,
                InstChannel = "chat",
                IpAddress = Context.GetHttpContext()?.Connection.RemoteIpAddress?.ToString()
            };

            ChatMessage savedTicket = await _chatService.CreateInstructionTicketAsync(newTicket);
            await Clients.Caller.SendAsync("NewTicketCreated", savedTicket);
        }

        public async Task SendAdminMessage(ChatMessage message)
        {
            try
            {
                if (message == null || !message.InstructionId.HasValue)
                {
                    _logger.LogWarning("SendAdminMessage called with invalid message object");
                    return;
                }

                _logger.LogInformation("HUB: Received Admin Message. Broadcasting to group {GroupId}", message.InstructionId.Value);

                await Clients.Group(message.InstructionId.Value.ToString()).SendAsync("ReceivePrivateMessage", message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SendAdminMessage for ConversationId {ConversationId}", message?.InstructionId);
            }
        }

        public async Task SendClientMessage(ChatMessage message)
        {
            try
            {
                if (message == null || !message.InstructionId.HasValue)
                {
                    _logger.LogWarning("SendClientMessage called with invalid message object");
                    return;
                }

                _logger.LogInformation("HUB: Received Client Message. Broadcasting to group {GroupId}", message.InstructionId.Value);

                await Clients.Group(message.InstructionId.Value.ToString()).SendAsync("ReceivePrivateMessage", message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SendClientMessage for ConversationId {ConversationId}", message?.InstructionId);
            }
        }
    }
}