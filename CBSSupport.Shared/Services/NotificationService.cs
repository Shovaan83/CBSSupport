using CBSSupport.Shared.Models;
using CBSSupport.Shared.Services;
using Dapper;
using Npgsql;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;

namespace CBSSupport.Shared.Services
{
    public class NotificationService : INotificationService
    {
        private readonly string _connectionString;

        public NotificationService(string connectionString)
        {
            _connectionString = connectionString;
            DefaultTypeMap.MatchNamesWithUnderscores = true;
        }

        public async Task<Notification> CreateNotificationAsync(Notification notification)
        {
            var sql = @"
                INSERT INTO digital.notifications (
                    user_id, admin_user_id, type, title, message, data, 
                    is_read, created_at, related_entity_id, related_entity_type
                )
                VALUES (
                    @UserId, @AdminUserId, @Type, @Title, @Message, @Data,
                    @IsRead, @CreatedAt, @RelatedEntityId, @RelatedEntityType
                )
                RETURNING id;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                notification.Id = await connection.ExecuteScalarAsync<long>(sql, notification);
                return notification;
            }
        }

        public async Task<IEnumerable<Notification>> GetUserNotificationsAsync(long userId, bool includeRead = false)
        {
            var sql = @"
                SELECT * FROM digital.notifications 
                WHERE user_id = @UserId AND (@IncludeRead = true OR is_read = false)
                ORDER BY created_at DESC
                LIMIT 50;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.QueryAsync<Notification>(sql, new { UserId = userId, IncludeRead = includeRead });
            }
        }

        public async Task<IEnumerable<Notification>> GetAdminNotificationsAsync(long adminUserId, bool includeRead = false)
        {
            var sql = @"
                SELECT * FROM digital.notifications 
                WHERE (admin_user_id = @AdminUserId OR admin_user_id IS NULL) 
                AND (@IncludeRead = true OR is_read = false)
                ORDER BY created_at DESC
                LIMIT 50;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.QueryAsync<Notification>(sql, new { AdminUserId = adminUserId, IncludeRead = includeRead });
            }
        }

        public async Task<bool> MarkAsReadAsync(long notificationId)
        {
            var sql = @"
                UPDATE digital.notifications 
                SET is_read = true, read_at = CURRENT_TIMESTAMP 
                WHERE id = @NotificationId;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                var rowsAffected = await connection.ExecuteAsync(sql, new { NotificationId = notificationId });
                return rowsAffected > 0;
            }
        }

        public async Task<bool> MarkAllAsReadAsync(long userId, bool isAdmin = false)
        {
            var sql = isAdmin ?
                @"UPDATE digital.notifications SET is_read = true, read_at = CURRENT_TIMESTAMP 
                  WHERE (admin_user_id = @UserId OR admin_user_id IS NULL) AND is_read = false;" :
                @"UPDATE digital.notifications SET is_read = true, read_at = CURRENT_TIMESTAMP 
                  WHERE user_id = @UserId AND is_read = false;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                var rowsAffected = await connection.ExecuteAsync(sql, new { UserId = userId });
                return rowsAffected > 0;
            }
        }

        public async Task<int> GetUnreadCountAsync(long userId, bool isAdmin = false)
        {
            var sql = isAdmin ?
                @"SELECT COUNT(*) FROM digital.notifications 
                  WHERE (admin_user_id = @UserId OR admin_user_id IS NULL) AND is_read = false;" :
                @"SELECT COUNT(*) FROM digital.notifications 
                  WHERE user_id = @UserId AND is_read = false;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.ExecuteScalarAsync<int>(sql, new { UserId = userId });
            }
        }

        public async Task<bool> DeleteNotificationAsync(long notificationId)
        {
            var sql = @"DELETE FROM digital.notifications WHERE id = @NotificationId;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                var rowsAffected = await connection.ExecuteAsync(sql, new { NotificationId = notificationId });
                return rowsAffected > 0;
            }
        }

        public async Task NotifyNewTicketAsync(long ticketId, string ticketSubject, string clientName)
        {
            var notification = new Notification
            {
                AdminUserId = null, 
                Type = "new_ticket",
                Title = "New Support Ticket",
                Message = $"New ticket created by {clientName}: {ticketSubject}",
                Data = JsonSerializer.Serialize(new { ticketId, action = "view_ticket" }),
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
                RelatedEntityId = ticketId,
                RelatedEntityType = "ticket"
            };

            await CreateNotificationAsync(notification);
        }

        public async Task NotifyNewInquiryAsync(long inquiryId, string inquiryTopic, string clientName)
        {
            var notification = new Notification
            {
                AdminUserId = null, 
                Type = "new_inquiry",
                Title = "New Inquiry",
                Message = $"New inquiry from {clientName}: {inquiryTopic}",
                Data = JsonSerializer.Serialize(new { inquiryId, action = "view_inquiry" }),
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
                RelatedEntityId = inquiryId,
                RelatedEntityType = "inquiry"
            };

            await CreateNotificationAsync(notification);
        }

        public async Task NotifyNewMessageAsync(long conversationId, string senderName, string message, long? recipientUserId = null, long? recipientAdminId = null)
        {
            var notification = new Notification
            {
                UserId = recipientUserId,
                AdminUserId = recipientAdminId,
                Type = "new_message",
                Title = "New Message",
                Message = $"{senderName}: {(message.Length > 50 ? message.Substring(0, 50) + "..." : message)}",
                Data = JsonSerializer.Serialize(new { conversationId, action = "open_chat" }),
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
                RelatedEntityId = conversationId,
                RelatedEntityType = "message"
            };

            await CreateNotificationAsync(notification);
        }

        public async Task NotifyTicketUpdatedAsync(long ticketId, string ticketSubject, string status, long userId)
        {
            var notification = new Notification
            {
                UserId = userId,
                Type = "ticket_updated",
                Title = "Ticket Updated",
                Message = $"Your ticket '{ticketSubject}' has been updated. Status: {status}",
                Data = JsonSerializer.Serialize(new { ticketId, action = "view_ticket" }),
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
                RelatedEntityId = ticketId,
                RelatedEntityType = "ticket"
            };

            await CreateNotificationAsync(notification);
        }

        public async Task NotifyInquiryUpdatedAsync(long inquiryId, string inquiryTopic, string outcome, long userId)
        {
            var notification = new Notification
            {
                UserId = userId,
                Type = "inquiry_updated",
                Title = "Inquiry Updated",
                Message = $"Your inquiry '{inquiryTopic}' has been updated. Outcome: {outcome}",
                Data = JsonSerializer.Serialize(new { inquiryId, action = "view_inquiry" }),
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
                RelatedEntityId = inquiryId,
                RelatedEntityType = "inquiry"
            };

            await CreateNotificationAsync(notification);
        }
    }
}