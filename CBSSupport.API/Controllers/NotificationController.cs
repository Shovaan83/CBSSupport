using CBSSupport.Shared.Services;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace CBSSupport.API.Controllers
{
    [ApiController]
    [Route("v1/api/[controller]")]
    public class NotificationController : ControllerBase
    {
        private readonly INotificationService _notificationService;

        public NotificationController(INotificationService notificationService)
        {
            _notificationService = notificationService;
        }

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserNotifications(long userId, [FromQuery] bool includeRead = false)
        {
            try
            {
                var notifications = await _notificationService.GetUserNotificationsAsync(userId, includeRead);
                return Ok(notifications);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to load notifications", error = ex.Message });
            }
        }

        [HttpGet("admin/{adminUserId}")]
        public async Task<IActionResult> GetAdminNotifications(long adminUserId, [FromQuery] bool includeRead = false)
        {
            try
            {
                var notifications = await _notificationService.GetAdminNotificationsAsync(adminUserId, includeRead);
                return Ok(notifications);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to load notifications", error = ex.Message });
            }
        }

        [HttpGet("user/{userId}/count")]
        public async Task<IActionResult> GetUserUnreadCount(long userId)
        {
            try
            {
                var count = await _notificationService.GetUnreadCountAsync(userId, false);
                return Ok(new { count });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to get unread count", error = ex.Message });
            }
        }

        [HttpGet("admin/{adminUserId}/count")]
        public async Task<IActionResult> GetAdminUnreadCount(long adminUserId)
        {
            try
            {
                var count = await _notificationService.GetUnreadCountAsync(adminUserId, true);
                return Ok(new { count });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to get unread count", error = ex.Message });
            }
        }

        [HttpPut("{notificationId}/read")]
        public async Task<IActionResult> MarkAsRead(long notificationId)
        {
            try
            {
                var success = await _notificationService.MarkAsReadAsync(notificationId);
                if (success)
                {
                    return Ok(new { message = "Notification marked as read" });
                }
                return NotFound(new { message = "Notification not found" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to mark notification as read", error = ex.Message });
            }
        }

        [HttpPut("user/{userId}/read-all")]
        public async Task<IActionResult> MarkAllUserNotificationsAsRead(long userId)
        {
            try
            {
                await _notificationService.MarkAllAsReadAsync(userId, false);
                return Ok(new { message = "All notifications marked as read" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to mark notifications as read", error = ex.Message });
            }
        }

        [HttpPut("admin/{adminUserId}/read-all")]
        public async Task<IActionResult> MarkAllAdminNotificationsAsRead(long adminUserId)
        {
            try
            {
                await _notificationService.MarkAllAsReadAsync(adminUserId, true);
                return Ok(new { message = "All notifications marked as read" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to mark notifications as read", error = ex.Message });
            }
        }

        [HttpDelete("{notificationId}")]
        public async Task<IActionResult> DeleteNotification(long notificationId)
        {
            try
            {
                var success = await _notificationService.DeleteNotificationAsync(notificationId);
                if (success)
                {
                    return Ok(new { message = "Notification deleted" });
                }
                return NotFound(new { message = "Notification not found" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to delete notification", error = ex.Message });
            }
        }
    }
}