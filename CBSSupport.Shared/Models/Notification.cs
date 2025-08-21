using System;

namespace CBSSupport.Shared.Models
{
    public class Notification
    {
        public long Id { get; set; }
        public long? UserId { get; set; }
        public long? AdminUserId { get; set; }
        public string Type { get; set; } = string.Empty; 
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? Data { get; set; } 
        public bool IsRead { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ReadAt { get; set; }
        public long? RelatedEntityId { get; set; } 
        public string? RelatedEntityType { get; set; } 
    }
}