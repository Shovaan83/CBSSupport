using Microsoft.AspNetCore.SignalR;
using CBSSupport.Shared.Services;
using CBSSupport.Shared.Models;
using System;
using System.Threading.Tasks;
using System.Linq.Expressions;
using Microsoft.Extensions.Logging;

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
            _logger.LogInformation("Connection {ConnectionId} joined group {GroupName}", Context.ConnectionId, groupName);
        }

        // NEW: Method for admins to join admin notification group
        public async Task JoinAdminNotifications()
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "AdminNotifications");
            _logger.LogInformation("Admin connection {ConnectionId} joined admin notifications group", Context.ConnectionId);
        }

        // NEW: Method for admins to join all conversation groups they need to monitor
        public async Task JoinAllAdminGroups()
        {
            try
            {
                // Join the general admin notifications group
                await Groups.AddToGroupAsync(Context.ConnectionId, "AdminNotifications");

                // Get all active conversations and join their groups
                var allTickets = await _chatService.GetAllTicketsAsync();
                foreach (var ticket in allTickets)
                {
                    await Groups.AddToGroupAsync(Context.ConnectionId, ticket.Id.ToString());
                }

                var allInquiries = await _chatService.GetAllInquiriesAsync();
                foreach (var inquiry in allInquiries)
                {
                    await Groups.AddToGroupAsync(Context.ConnectionId, inquiry.Id.ToString());
                }

                _logger.LogInformation("Admin connection {ConnectionId} joined all monitoring groups", Context.ConnectionId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error joining admin groups for connection {ConnectionId}", Context.ConnectionId);
            }
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
                InstTypeId = 100,
                Status = true,
                InstChannel = "chat",
                IpAddress = Context.GetHttpContext()?.Connection.RemoteIpAddress?.ToString()
            };

            ChatMessage savedTicket = await _chatService.CreateInstructionTicketAsync(newTicket);
            await Clients.Caller.SendAsync("NewTicketCreated", savedTicket);

            // NEW: Add admin to the new ticket's group
            if (savedTicket.InstructionId.HasValue)
            {
                await Clients.Group("AdminNotifications").SendAsync("NewTicketGroup", savedTicket.InstructionId.Value.ToString());
            }
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

        public async Task SendClientMessage(ChatMessage message, bool isNewConversation)
        {
            try
            {
                if (message == null || !message.InstructionId.HasValue)
                {
                    _logger.LogWarning("SendClientMessage called with invalid message object");
                    return;
                }

                _logger.LogInformation("HUB: Received Client Message for conversation {GroupId}. Is new: {isNew}", message.InstructionId.Value, isNewConversation);

                await Clients.Group(message.InstructionId.Value.ToString()).SendAsync("ReceivePrivateMessage", message);

                // --- FIXED NOTIFICATION LOGIC ---
                string notificationType = isNewConversation ? "new_ticket" : "new_message";
                string title = isNewConversation ?
                    $"New Request #{message.InstructionId}" :
                    $"Reply in #{message.InstructionId}";

                var notification = new
                {
                    type = notificationType,
                    senderName = message.SenderName ?? "A client",
                    message = message.Instruction,
                    timestamp = DateTime.UtcNow,
                    conversationId = message.InstructionId,
                    title = title
                };

                // Send notification to AdminNotifications group instead of all clients
                await Clients.Group("AdminNotifications").SendAsync("ReceiveAdminNotification", notification);
                _logger.LogInformation("HUB: Admin notification sent to AdminNotifications group for conversation {GroupId}.", message.InstructionId.Value);

                // If it's a new conversation, ensure admins join the new conversation group
                if (isNewConversation)
                {
                    await Clients.Group("AdminNotifications").SendAsync("JoinNewConversationGroup", message.InstructionId.Value.ToString());
                }
                // --- END FIXED NOTIFICATION LOGIC ---
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SendClientMessage for ConversationId {ConversationId}", message?.InstructionId);
            }
        }

        public override async Task OnConnectedAsync()
        {
            _logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            _logger.LogInformation("Client disconnected: {ConnectionId}", Context.ConnectionId);
            await base.OnDisconnectedAsync(exception);
        }
    }
}