using Microsoft.AspNetCore.Mvc;
using CBSSupport.Shared.Services;
using CBSSupport.Shared.Models;
using System.Threading.Tasks;

namespace CBSSupport.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TicketsController : ControllerBase
    {
        private readonly IChatService _chatService;

        public TicketsController(IChatService chatService)
        {
            _chatService = chatService;
        }

        // GET: api/tickets
        [HttpGet]
        public async Task<IActionResult> GetAllTickets()
        {
            var tickets = await _chatService.GetAllSupportTicketsAsync();
            return Ok(tickets);
        }

        // GET: api/tickets/5
        [HttpGet("{id}")]
        public async Task<IActionResult> GetTicket(long id)
        {
            var ticket = await _chatService.GetSupportTicketByIdAsync(id);
            if (ticket == null)
            {
                return NotFound();
            }
            return Ok(ticket);
        }

        // POST: api/tickets
        [HttpPost]
        public async Task<IActionResult> CreateTicket([FromBody] SupportTicket ticket)
        {
            // In a real app, you'd get the user ID from authentication context
            ticket.CreatedByUserId = 1; // Mocked user ID
            ticket.CreatedAt = System.DateTime.UtcNow;
            ticket.Status = TicketStatus.Open;

            var newTicket = await _chatService.CreateSupportTicketAsync(ticket);
            return CreatedAtAction(nameof(GetTicket), new { id = newTicket.Id }, newTicket);
        }

        // PUT: api/tickets/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTicket(long id, [FromBody] SupportTicket ticket)
        {
            if (id != ticket.Id)
            {
                return BadRequest();
            }
            var updatedTicket = await _chatService.UpdateSupportTicketAsync(ticket);
            return Ok(updatedTicket);
        }

        // POST: api/tickets/5/reply
        [HttpPost("{id}/reply")]
        public async Task<IActionResult> AddReply(long id, [FromBody] TicketReply reply)
        {
            reply.TicketId = id;
            // In a real app, get user from auth context
            reply.ReplierUserId = 2; // Mocked admin ID
            reply.ReplierName = "CBS Support";
            reply.CreatedAt = System.DateTime.UtcNow;

            var newReply = await _chatService.AddTicketReplyAsync(reply);
            return Ok(newReply);
        }

        // GET: api/tickets/dashboard-stats
        [HttpGet("dashboard-stats")]
        public async Task<IActionResult> GetDashboardStats()
        {
            var stats = await _chatService.GetDashboardStatsAsync();
            return Ok(stats);
        }
    }
}