using CBSSupport.Shared.Services;
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace CBSSupport.API.Hubs
{
    public class ChatHub : Hub
    {
        private readonly INotificationService _notificationService;

        public ChatHub(INotificationService notificationService)
        {
            _notificationService = notificationService;
        }

        public async Task JoinGroup(string groupName)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        }

        public async Task LeaveGroup(string groupName)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        }

        public async Task SendAdminMessage(object message)
        {
            await Clients.All.SendAsync("ReceivePrivateMessage", message);
        }

        public async Task SendPrivateMessage(string user, string message, object fullMessage)
        {
            await Clients.User(user).SendAsync("ReceivePrivateMessage", fullMessage);
            await Clients.Caller.SendAsync("ReceivePrivateMessage", fullMessage);
        }

        public async Task NotifyNewTicket(object ticket)
        {
            await Clients.All.SendAsync("NewTicket", ticket);

            // Create notification for admins
            var ticketData = ticket as dynamic;
            if (ticketData != null)
            {
                await _notificationService.NotifyNewTicketAsync(
                    ticketData.id,
                    ticketData.subject ?? "New Ticket",
                    ticketData.clientName ?? "Unknown Client"
                );

                // Send notification to all admin clients
                var notification = new
                {
                    Type = "new_ticket",
                    Title = "New Support Ticket",
                    Message = $"New ticket created by {ticketData.clientName}: {ticketData.subject}",
                    CreatedAt = DateTime.UtcNow,
                    IsRead = false
                };

                await Clients.All.SendAsync("NewNotification", notification);
            }
        }

        public async Task NotifyNewInquiry(object inquiry)
        {
            await Clients.All.SendAsync("NewInquiry", inquiry);

            // Create notification for admins
            var inquiryData = inquiry as dynamic;
            if (inquiryData != null)
            {
                await _notificationService.NotifyNewInquiryAsync(
                    inquiryData.id,
                    inquiryData.topic ?? "New Inquiry",
                    inquiryData.clientName ?? "Unknown Client"
                );

                // Send notification to all admin clients
                var notification = new
                {
                    Type = "new_inquiry",
                    Title = "New Inquiry",
                    Message = $"New inquiry from {inquiryData.clientName}: {inquiryData.topic}",
                    CreatedAt = DateTime.UtcNow,
                    IsRead = false
                };

                await Clients.All.SendAsync("NewNotification", notification);
            }
        }

        public async Task NotifyNewMessage(object messageData)
        {
            var data = messageData as dynamic;
            if (data != null)
            {
                await _notificationService.NotifyNewMessageAsync(
                    data.conversationId ?? 0,
                    data.senderName ?? "Unknown",
                    data.message ?? "",
                    data.recipientUserId,
                    data.recipientAdminId
                );

                // Send notification to specific recipients
                var notification = new
                {
                    Type = "new_message",
                    Title = "New Message",
                    Message = $"{data.senderName}: {data.message}",
                    CreatedAt = DateTime.UtcNow,
                    IsRead = false
                };

                if (data.recipientUserId != null)
                {
                    await Clients.User(data.recipientUserId.ToString()).SendAsync("NewNotification", notification);
                }
                if (data.recipientAdminId != null)
                {
                    await Clients.User(data.recipientAdminId.ToString()).SendAsync("NewNotification", notification);
                }
            }
        }
    }
}