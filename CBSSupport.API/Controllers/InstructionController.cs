using CBSSupport.Shared.Models;
using CBSSupport.Shared.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using CBSSupport.API.Hubs; 
using Microsoft.Maui.Controls;
using Npgsql;
using System.Security.Claims;

[ApiController]
[Route("v1/api/instructions")]
[Authorize(AuthenticationSchemes = $"{JwtBearerDefaults.AuthenticationScheme},{CookieAuthenticationDefaults.AuthenticationScheme}")]
public class InstructionsController : ControllerBase
{
    private readonly IChatService _service;
    private readonly ILogger<InstructionsController> _logger;
    private readonly IHubContext<ChatHub> _hubContext;

    public InstructionsController(IChatService service, ILogger<InstructionsController> logger, IHubContext<ChatHub> hubContext)
    {
        _service = service;
        _logger = logger;
        _hubContext = hubContext; 
    }

    private async Task<IActionResult> SaveInstruction(ChatMessage instruction, short instTypeId)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        if (instruction.UserId == null && instruction.ClientId == null)
        {
            ModelState.AddModelError("Identifier", "A UserId or ClientId must be provided.");
            return BadRequest(ModelState);
        }

        try
        {
            instruction.InstTypeId = instTypeId;
            instruction.DateTime = DateTime.UtcNow;
            instruction.InsertDate = DateTime.UtcNow;
            instruction.Status = true;
            instruction.InstChannel ??= "chat";
            instruction.IpAddress ??= HttpContext.Connection.RemoteIpAddress?.ToString();

            var savedMessage = await _service.CreateInstructionTicketAsync(instruction);

            if (savedMessage != null)
            {
                return Ok(savedMessage);
            }
            return BadRequest(new { message = "Failed to create the instruction." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred in SaveInstruction for InstTypeId {InstTypeId}.", instTypeId);
            return StatusCode(500, new { message = "An internal server error occurred while saving." });
        }
    }

    [HttpPost("support-group")]
    public Task<IActionResult> SaveSupportGroupChat([FromBody] ChatMessage instruction) => SaveInstruction(instruction, 100);

    [HttpPost("support-private")]
    public Task<IActionResult> SaveSupportPrivateChat([FromBody] ChatMessage instruction) => SaveInstruction(instruction, 101);

    [HttpPost("internal-team-chat")]
    public Task<IActionResult> SaveInternalTeamChat([FromBody] ChatMessage instruction) => SaveInstruction(instruction, 105);

    [HttpPost("ticket/training")]
    public Task<IActionResult> SaveTicketTraining([FromBody] ChatMessage instruction) => SaveInstruction(instruction, 110);

    [HttpPost("ticket/migration")]
    public Task<IActionResult> SaveMigrationTraining([FromBody] ChatMessage instruction) => SaveInstruction(instruction, 111);

    [HttpPost("ticket/setup")]
    public Task<IActionResult> SaveSetupTraining([FromBody] ChatMessage instruction) => SaveInstruction(instruction, 112);

    [HttpPost("ticket/correction")]
    public Task<IActionResult> SaveCorrectionTraining([FromBody] ChatMessage instruction) => SaveInstruction(instruction, 113);

    [HttpPost("ticket/bug-fix")]
    public Task<IActionResult> SaveBugFixTraining([FromBody] ChatMessage instruction) => SaveInstruction(instruction, 114);

    [HttpPost("ticket/new-feature")]
    public Task<IActionResult> SaveNewFeatureTraining([FromBody] ChatMessage instruction) => SaveInstruction(instruction, 115);

    [HttpPost("ticket/feature-enhancement")]
    public Task<IActionResult> SaveFeatureEnhancementTraining([FromBody] ChatMessage instruction) => SaveInstruction(instruction, 116);

    [HttpPost("ticket/backend-workaround")]
    public Task<IActionResult> SaveBackendWorkaroundTraining([FromBody] ChatMessage instruction) => SaveInstruction(instruction, 117);

    [HttpPost("inquiry/accounts")]
    public Task<IActionResult> SaveAccountsInquiry([FromBody] ChatMessage instruction) => SaveInstruction(instruction, 121);

    [HttpPost("inquiry/sales")]
    public Task<IActionResult> SaveSalesInquiry([FromBody] ChatMessage instruction) => SaveInstruction(instruction, 122);

    [HttpPost("reply")]
    public Task<IActionResult> SaveReply([FromBody] ChatMessage instruction)
    {
        return SaveInstruction(instruction, 100);
    }

    [HttpGet("by-type/{*chatType}")]
    public async Task<IActionResult> GetConversationsByChatType(string chatType)
    {
        try
        {
            short instTypeId = chatType.ToLower() switch
            {
                "support-group" => 100,
                "support-private" => 101,
                "internal-team-chat" => 105,
                "ticket/training" => 110,
                "ticket/migration" => 111,
                "ticket/setup" => 112,
                "ticket/correction" => 113,
                "ticket/bug-fix" => 114,
                "ticket/new-feature" => 115,
                "ticket/feature-enhancement" => 116,
                "ticket/backend-workaround" => 117,
                "inquiry/accounts" => 121,
                "inquiry/sales" => 122,
                _ => throw new ArgumentException("Invalid chat type specified.")
            };

            var messages = await _service.GetConversationsByInstTypeAsync(instTypeId);
            return Ok(messages);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching conversations for chatType {ChatType}.", chatType);
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    [HttpGet("messages/{conversationId}")]
    public async Task<IActionResult> GetMessagesForConversation(long conversationId)
    {
        if (conversationId <= 0)
        {
            return BadRequest(new { message = "A valid conversation ID must be provided." });
        }

        try
        {
            var messages = await _service.GetMessagesByConversationIdAsync(conversationId);
            return Ok(messages);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching messages for conversationId {ConversationId}.", conversationId);
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    [HttpGet("sidebar/{clientId}")]
    [Authorize(AuthenticationSchemes = $"{JwtBearerDefaults.AuthenticationScheme},{CookieAuthenticationDefaults.AuthenticationScheme}")]
    public async Task<IActionResult> GetSidebar(long clientId)
    {
        try
        {
            var sidebarData = await _service.GetSidebarForUserAsync(0, clientId);
            return Ok(sidebarData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching sidebar data for client ID {ClientId}", clientId);
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    [HttpGet("tickets/{clientId}")]
    [Authorize(AuthenticationSchemes = $"{JwtBearerDefaults.AuthenticationScheme},{CookieAuthenticationDefaults.AuthenticationScheme}")]
    public async Task<IActionResult> GetTicketsForClient(long clientId)
    {
        try
        {
            var tickets = await _service.GetTicketsByClientIdAsync(clientId);
            return Ok(new { data = tickets });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching tickets for client ID {ClientId}", clientId);
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    [HttpGet("inquiries/{clientId}")]
    [Authorize(AuthenticationSchemes = $"{JwtBearerDefaults.AuthenticationScheme},{CookieAuthenticationDefaults.AuthenticationScheme}")]
    public async Task<IActionResult> GetInquiriesForClient(long clientId)
    {
        try
        {
            var inquiries = await _service.GetInquiriesByClientIdAsync(clientId);
            return Ok(new { data = inquiries });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching inquiries for client ID {ClientId}", clientId);
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    [HttpGet("tickets/all")]
    public async Task<IActionResult> GetAllTickets()
    {
        try
        {
            var tickets = await _service.GetAllTicketsAsync();
            return Ok(new { data = tickets });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching all tickets.");
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    [HttpGet("inquiries/all")]
    public async Task<IActionResult> GetAllInquiries()
    {
        try
        {
            var inquiries = await _service.GetAllInquiriesAsync();
            return Ok(new { data = inquiries });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching all inquiries.");
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    [HttpPut("update/{ticketId}")]
    [Authorize(AuthenticationSchemes = $"{JwtBearerDefaults.AuthenticationScheme},{CookieAuthenticationDefaults.AuthenticationScheme}")]
    public async Task<IActionResult> UpdateTicket(long ticketId, [FromBody] ChatMessage updatedTicket)
    {
        try
        {
            _logger.LogInformation("=== UpdateTicket START ===");
            _logger.LogInformation("Ticket ID: {TicketId}", ticketId);
            _logger.LogInformation("Request payload: {Payload}", System.Text.Json.JsonSerializer.Serialize(updatedTicket));

            if (!ModelState.IsValid)
            {
                var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage);
                _logger.LogWarning("Model validation failed: {Errors}", string.Join(", ", errors));
                return BadRequest(ModelState);
            }

            var existingTicket = await _service.GetInstructionByIdAsync(ticketId);
            if (existingTicket == null)
            {
                _logger.LogWarning("Ticket {TicketId} not found", ticketId);
                return NotFound(new { message = "Ticket not found." });
            }

            _logger.LogInformation("Existing ticket found - Completed: {Completed}", existingTicket.Completed);

            if (existingTicket.Completed == true)
            {
                _logger.LogWarning("Attempt to edit resolved ticket {TicketId}", ticketId);
                return BadRequest(new { message = "Cannot edit resolved tickets." });
            }

            updatedTicket.Id = ticketId;
            updatedTicket.EditDate = DateTime.UtcNow;

            if (!string.IsNullOrEmpty(updatedTicket.Priority) || !string.IsNullOrEmpty(updatedTicket.Remarks))
            {
                var remarksJson = new
                {
                    priority = updatedTicket.Priority ?? "Normal",
                    userremarks = updatedTicket.Remarks ?? ""
                };
                updatedTicket.Remarks = System.Text.Json.JsonSerializer.Serialize(remarksJson);
                _logger.LogInformation("Formatted remarks as JSON: {Remarks}", updatedTicket.Remarks);
            }

            _logger.LogInformation("Calling UpdateInstructionAsync with: {UpdatedTicket}",
                System.Text.Json.JsonSerializer.Serialize(updatedTicket));

            var result = await _service.UpdateInstructionAsync(updatedTicket);

            if (result)
            {
                _logger.LogInformation("Ticket {TicketId} updated successfully", ticketId);
                return Ok(new { message = "Ticket updated successfully." });
            }

            _logger.LogWarning("UpdateInstructionAsync returned false for ticket {TicketId} - no rows affected", ticketId);
            return BadRequest(new { message = "Failed to update ticket - no rows affected." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating ticket {TicketId}", ticketId);
            return StatusCode(500, new { message = "An internal server error occurred.", detail = ex.Message });
        }
    }

    [HttpGet("tickets/{ticketId}/details")]
    [Authorize(AuthenticationSchemes = $"{JwtBearerDefaults.AuthenticationScheme},{CookieAuthenticationDefaults.AuthenticationScheme}")]
    public async Task<IActionResult> GetTicketDetails(long ticketId)
    {
        try
        {
            var ticket = await _service.GetTicketDetailsByIdAsync(ticketId);
            if (ticket == null)
            {
                return NotFound(new { message = "Ticket not found." });
            }
            return Ok(ticket);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching ticket details for ID {TicketId}", ticketId);
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    [HttpGet("inquiries/{inquiryId}/details")]
    [Authorize(AuthenticationSchemes = $"{JwtBearerDefaults.AuthenticationScheme},{CookieAuthenticationDefaults.AuthenticationScheme}")]
    public async Task<IActionResult> GetInquiryDetails(long inquiryId)
    {
        try
        {
            var inquiry = await _service.GetInquiryDetailsByIdAsync(inquiryId);
            if (inquiry == null)
            {
                return NotFound(new { message = "Inquiry not found." });
            }
            return Ok(inquiry);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching inquiry details for ID {InquiryId}", inquiryId);
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    [HttpPut("tickets/{ticketId}/status")]
    [Authorize(AuthenticationSchemes = $"{JwtBearerDefaults.AuthenticationScheme},{CookieAuthenticationDefaults.AuthenticationScheme}")]
    public async Task<IActionResult> UpdateTicketStatus(long ticketId, [FromBody] UpdateStatusRequest request)
    {
        try
        {
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var currentUserId = long.TryParse(currentUserIdClaim, out var userId) ? userId : (long?)null;

            var result = await _service.UpdateTicketStatusAsync(ticketId, request.IsCompleted, currentUserId);

            if (result)
            {
                var ticketDetails = await _service.GetTicketDetailsByIdAsync(ticketId);
                if (ticketDetails != null)
                {
                    var newStatus = request.IsCompleted ? "Resolved" : "Open";
                    await _hubContext.Clients.User(ticketDetails.ClientId.ToString()).SendAsync("TicketStatusUpdated", new
                    {
                        TicketId = ticketId,
                        NewStatus = newStatus,
                        UpdatedAt = DateTime.UtcNow
                    });

                    _logger.LogInformation("Broadcast ticket status update: TicketId={TicketId}, Status={Status}, ClientId={ClientId}",
                                         ticketId, newStatus, ticketDetails.ClientId);
                }

                return Ok(new { success = true, message = "Ticket status updated successfully." });
            }

            return BadRequest(new { success = false, message = "Failed to update ticket status." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating ticket status for ID {TicketId}", ticketId);
            return StatusCode(500, new { success = false, message = "An internal server error occurred." });
        }
    }

    [HttpPut("inquiries/{inquiryId}/status")]
    [Authorize(AuthenticationSchemes = $"{JwtBearerDefaults.AuthenticationScheme},{CookieAuthenticationDefaults.AuthenticationScheme}")]
    public async Task<IActionResult> UpdateInquiryStatus(long inquiryId, [FromBody] UpdateStatusRequest request)
    {
        try
        {
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var currentUserId = long.TryParse(currentUserIdClaim, out var userId) ? userId : (long?)null;

            var result = await _service.UpdateInquiryStatusAsync(inquiryId, request.IsCompleted, currentUserId);

            if (result)
            {
                var inquiryDetails = await _service.GetInquiryDetailsByIdAsync(inquiryId);
                if (inquiryDetails != null)
                {
                    var newStatus = request.IsCompleted ? "Completed" : "Pending";
                    await _hubContext.Clients.User(inquiryDetails.ClientId.ToString()).SendAsync("InquiryStatusUpdated", new
                    {
                        InquiryId = inquiryId,
                        NewStatus = newStatus,
                        UpdatedAt = DateTime.UtcNow
                    });

                    _logger.LogInformation("Broadcast inquiry status update: InquiryId={InquiryId}, Status={Status}, ClientId={ClientId}",
                                         inquiryId, newStatus, inquiryDetails.ClientId);
                }

                return Ok(new { success = true, message = "Inquiry status updated successfully." });
            }

            return BadRequest(new { success = false, message = "Failed to update inquiry status." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating inquiry status for ID {InquiryId}", inquiryId);
            return StatusCode(500, new { success = false, message = "An internal server error occurred." });
        }
    }

    [HttpGet("notifications/unread")]
    public async Task<IActionResult> GetUnreadNotifications([FromQuery] long? clientId = null)
    {
        try
        {
            IEnumerable<object> notifications;

            if (clientId.HasValue)
            {
                notifications = await _service.GetUnreadNotificationsForClientAsync(clientId.Value);
            }
            else
            {
                notifications = await _service.GetUnreadNotificationsForAdminAsync();
            }

            return Ok(notifications);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching unread notifications");
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    [HttpPut("{instructionId}/mark-seen-admin")]
    public async Task<IActionResult> MarkNotificationSeenByAdmin(long instructionId)
    {
        try
        {
            var result = await _service.MarkNotificationSeenByAdminAsync(instructionId);

            if (result)
            {
                return Ok(new { success = true, message = "Notification marked as seen." });
            }

            return NotFound(new { success = false, message = "Instruction not found." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking notification as seen for instruction {InstructionId}", instructionId);
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    [HttpPut("mark-all-seen-client")]
    public async Task<IActionResult> MarkAllNotificationsSeenByClient()
    {
        try
        {
            var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var currentUserId = long.TryParse(currentUserIdClaim, out var userId) ? userId : (long?)null;

            var count = await _service.MarkAllNotificationsSeenByClientAsync(currentUserId);

            return Ok(new
            {
                success = true,
                message = "All notifications marked as seen by client.",
                count = count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking all notifications as seen by client");
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    [HttpPut("mark-all-seen-admin")]
    public async Task<IActionResult> MarkAllNotificationsSeenByAdmin()
    {
        try
        {
            var count = await _service.MarkAllNotificationsSeenByAdminAsync();

            return Ok(new
            {
                success = true,
                message = "All notifications marked as seen.",
                count = count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking all notifications as seen");
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    [HttpPut("{instructionId}/mark-seen-client")]
    public async Task<IActionResult> MarkNotificationSeenByClient(long instructionId)
    {
        try
        {
            var result = await _service.MarkNotificationSeenByClientAsync(instructionId);

            if (result)
            {
                return Ok(new { success = true, message = "Notification marked as seen by client." });
            }

            return NotFound(new { success = false, message = "Instruction not found." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking notification as seen by client for instruction {InstructionId}", instructionId);
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    public class UpdateStatusRequest
    {
        public bool IsCompleted { get; set; }
    }
}