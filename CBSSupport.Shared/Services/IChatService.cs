using CBSSupport.Shared.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace CBSSupport.Shared.Services
{
    public interface IChatService
    {
        
        Task<IEnumerable<ChatMessage>> GetInstructionTicketsForUserAsync(long userId);
        Task<long> CreateInstructionTicketAsync(ChatMessage ticket);

        

        
        Task<SupportTicket> CreateSupportTicketAsync(SupportTicket ticket);

        // Get all tickets for the admin data table
        Task<IEnumerable<SupportTicket>> GetAllSupportTicketsAsync();

        // Get a single ticket with its full conversation history
        Task<SupportTicket> GetSupportTicketByIdAsync(long ticketId);

        // Update a ticket (e.g., change status, priority, assignee)
        Task<SupportTicket> UpdateSupportTicketAsync(SupportTicket ticket);

        // Add a reply to a ticket
        Task<TicketReply> AddTicketReplyAsync(TicketReply reply);

        // Get stats for the dashboard
        Task<DashboardStats> GetDashboardStatsAsync();
    }

    // Helper model for dashboard stats
    public class DashboardStats
    {
        public int TotalTickets { get; set; }
        public int NewTickets { get; set; } // e.g., in the last 24 hours
        public int ClosedTickets { get; set; } // e.g., in the last 24 hours
        public int OpenTickets { get; set; }
        public decimal SolvedTicketsValue { get; set; } // Example stat
    }
}