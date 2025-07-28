using System;
using System.Collections.Generic;

namespace CBSSupport.Shared.Models
{
    public enum TicketStatus { Open, Pending, Resolved, Closed }
    public enum TicketPriority { Low, Medium, High, Urgent }

    public class SupportTicket
    {
        public long Id { get; set; }
        public string Subject { get; set; }
        public string Description { get; set; }
        public string Remarks { get; set; }
        public TicketStatus Status { get; set; }
        public TicketPriority Priority { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? LastUpdatedAt { get; set; }
        public DateTime? ExpectedResolutionDate { get; set; }

        // User information
        public long CreatedByUserId { get; set; } // Link to a user table
        public string CreatedByFullName { get; set; }
        public long? AssignedToUserId { get; set; } // Support agent
        public string AssignedToName { get; set; }
        public string ResolvedBy { get; set; } // Could be the name of who resolved it

        // This would be populated from a separate query
        public List<TicketReply> Replies { get; set; } = new List<TicketReply>();
    }

    public class TicketReply
    {
        public long Id { get; set; }
        public long TicketId { get; set; }
        public string ReplyText { get; set; }
        public DateTime CreatedAt { get; set; }
        public long ReplierUserId { get; set; }
        public string ReplierName { get; set; }
        public bool IsPrivateNote { get; set; } // For internal agent notes
    }
}