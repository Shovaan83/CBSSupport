using CBSSupport.Shared.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace CBSSupport.Shared.Services
{
    public interface INotificationService
    {
        Task<Notification> CreateNotificationAsync(Notification notification);
        Task<IEnumerable<Notification>> GetUserNotificationsAsync(long userId, bool includeRead = false);
        Task<IEnumerable<Notification>> GetAdminNotificationsAsync(long adminUserId, bool includeRead = false);
        Task<bool> MarkAsReadAsync(long notificationId);
        Task<bool> MarkAllAsReadAsync(long userId, bool isAdmin = false);
        Task<int> GetUnreadCountAsync(long userId, bool isAdmin = false);
        Task<bool> DeleteNotificationAsync(long notificationId);

        // Helper methods for creating specific notifications
        Task NotifyNewTicketAsync(long ticketId, string ticketSubject, string clientName);
        Task NotifyNewInquiryAsync(long inquiryId, string inquiryTopic, string clientName);
        Task NotifyNewMessageAsync(long conversationId, string senderName, string message, long? recipientUserId = null, long? recipientAdminId = null);
        Task NotifyTicketUpdatedAsync(long ticketId, string ticketSubject, string status, long userId);
        Task NotifyInquiryUpdatedAsync(long inquiryId, string inquiryTopic, string outcome, long userId);
    }
}