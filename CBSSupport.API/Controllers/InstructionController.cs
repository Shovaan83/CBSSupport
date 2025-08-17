using CBSSupport.Shared.Models;
using CBSSupport.Shared.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("v1/api/instructions")]
[Authorize(AuthenticationSchemes = $"{JwtBearerDefaults.AuthenticationScheme},{CookieAuthenticationDefaults.AuthenticationScheme}")]
public class InstructionsController : ControllerBase
{
    private readonly IChatService _service;
    private readonly ILogger<InstructionsController> _logger;

    public InstructionsController(IChatService service, ILogger<InstructionsController> logger)
    {
        _service = service;
        _logger = logger;
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

            // Get existing ticket to check its current state
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

            // Set the required properties
            updatedTicket.Id = ticketId;
            updatedTicket.EditDate = DateTime.UtcNow;

            // Format remarks as JSON if needed
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
}