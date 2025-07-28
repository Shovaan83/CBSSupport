using CBSSupport.Shared.Models;
using CBSSupport.Shared.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace CBSSupport.Shared.Services
{
    public class ChatService : IChatService
    {
        private readonly string _connectionString;

        // --- MOCK IN-MEMORY DATABASE ---
        // Using static lists to persist data across requests for the lifetime of the application.
        // This simulates a database for demonstration purposes.
        private static readonly List<SupportTicket> _supportTickets = new List<SupportTicket>();
        private static readonly List<TicketReply> _ticketReplies = new List<TicketReply>();
        private static bool _isSeeded = false; // Flag to ensure we only seed data once.

        public ChatService(string connectionString)
        {
            _connectionString = connectionString;
            SeedInitialData(); // Create some sample tickets when the service is first created.
        }

        private void SeedInitialData()
        {
            if (_isSeeded) return;

            _supportTickets.AddRange(new List<SupportTicket>
            {
                new SupportTicket
                {
                    Id = 1,
                    Subject = "API Access Question",
                    Description = "I need help understanding how to authenticate with the new API. The documentation is a bit unclear on the token generation part.",
                    Status = TicketStatus.Open,
                    Priority = TicketPriority.High,
                    CreatedAt = DateTime.UtcNow.AddDays(-2),
                    CreatedByUserId = 3, // Corresponds to Ram Shah in your mock data
                    CreatedByFullName = "Ram Shah",
                    AssignedToUserId = 1,
                    AssignedToName = "CBS Support"
                },
                new SupportTicket
                {
                    Id = 2,
                    Subject = "Problem with my recent order",
                    Description = "My recent order #12345 seems to be stuck in processing. Can you please check on the status?",
                    Status = TicketStatus.Pending,
                    Priority = TicketPriority.Medium,
                    CreatedAt = DateTime.UtcNow.AddHours(-10),
                    CreatedByUserId = 2,
                    CreatedByFullName = "Soniya Basnet",
                    AssignedToName = "CBS Support"
                },
                new SupportTicket
                {
                    Id = 3,
                    Subject = "Billing Inquiry",
                    Description = "I believe there is an error on my last invoice. I was charged twice for the same service.",
                    Status = TicketStatus.Open,
                    Priority = TicketPriority.Urgent,
                    CreatedAt = DateTime.UtcNow.AddMinutes(-30),
                    CreatedByUserId = 4,
                    CreatedByFullName = "Namsang Limbu",
                    AssignedToName = "Unassigned"
                },
                new SupportTicket
                {
                    Id = 4,
                    Subject = "Feature Request: Dark Mode",
                    Description = "The application is great, but it would be even better with a dark mode option. Please consider adding it!",
                    Status = TicketStatus.Closed,
                    Priority = TicketPriority.Low,
                    CreatedAt = DateTime.UtcNow.AddDays(-15),
                    LastUpdatedAt = DateTime.UtcNow.AddDays(-10),
                    CreatedByUserId = 1,
                    CreatedByFullName = "Alzeena Limbu",
                    ResolvedBy = "CBS Support"
                }
            });

            _isSeeded = true;
        }


        // === Implementation of New Interface Members ===

        public Task<SupportTicket> CreateSupportTicketAsync(SupportTicket ticket)
        {
            // Simulate generating a new ID
            long newId = _supportTickets.Any() ? _supportTickets.Max(t => t.Id) + 1 : 1;
            ticket.Id = newId;

            _supportTickets.Insert(0, ticket); // Add to the top of the list

            return Task.FromResult(ticket);
        }

        public Task<IEnumerable<SupportTicket>> GetAllSupportTicketsAsync()
        {
            // Return all tickets from our in-memory list
            return Task.FromResult<IEnumerable<SupportTicket>>(_supportTickets);
        }

        public Task<SupportTicket> GetSupportTicketByIdAsync(long ticketId)
        {
            var ticket = _supportTickets.FirstOrDefault(t => t.Id == ticketId);
            // In a real app, you would also fetch replies here
            // ticket.Replies = _ticketReplies.Where(r => r.TicketId == ticketId).ToList();
            return Task.FromResult(ticket);
        }

        public Task<SupportTicket> UpdateSupportTicketAsync(SupportTicket ticket)
        {
            var existingTicket = _supportTickets.FirstOrDefault(t => t.Id == ticket.Id);
            if (existingTicket != null)
            {
                // Update properties
                existingTicket.Subject = ticket.Subject;
                existingTicket.Description = ticket.Description;
                existingTicket.Status = ticket.Status;
                existingTicket.Priority = ticket.Priority;
                existingTicket.AssignedToName = ticket.AssignedToName;
                existingTicket.LastUpdatedAt = DateTime.UtcNow;
            }
            return Task.FromResult(existingTicket);
        }

        public Task<TicketReply> AddTicketReplyAsync(TicketReply reply)
        {
            // Simulate generating a new ID
            long newId = _ticketReplies.Any() ? _ticketReplies.Max(r => r.Id) + 1 : 1;
            reply.Id = newId;
            _ticketReplies.Add(reply);
            return Task.FromResult(reply);
        }

        public Task<DashboardStats> GetDashboardStatsAsync()
        {
            var stats = new DashboardStats
            {
                TotalTickets = _supportTickets.Count,
                NewTickets = _supportTickets.Count(t => t.CreatedAt >= DateTime.UtcNow.AddDays(-1)),
                ClosedTickets = _supportTickets.Count(t => t.Status == TicketStatus.Closed),
                OpenTickets = _supportTickets.Count(t => t.Status == TicketStatus.Open || t.Status == TicketStatus.Pending),
                SolvedTicketsValue = 1250.00m // Example static value
            };
            return Task.FromResult(stats);
        }

        // === Implementation of Original Interface Members ===

        public Task<IEnumerable<ChatMessage>> GetInstructionTicketsForUserAsync(long userId)
        {
            // Returning empty list as this logic is being replaced by the new SupportTicket system
            return Task.FromResult(Enumerable.Empty<ChatMessage>());
        }

        public Task<long> CreateInstructionTicketAsync(ChatMessage ticket)
        {
            // Returning a mock ID as this logic is being replaced
            return Task.FromResult(DateTime.UtcNow.Ticks);
        }
    }
}