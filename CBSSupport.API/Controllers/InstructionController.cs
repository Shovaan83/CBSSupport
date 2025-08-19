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

    [HttpGet("inquiry/{inquiryId}")]
    [Authorize(AuthenticationSchemes = $"{JwtBearerDefaults.AuthenticationScheme},{CookieAuthenticationDefaults.AuthenticationScheme}")]
    public async Task<IActionResult> GetInquiryById(long inquiryId)
    {
        if (inquiryId <= 0)
        {
            return BadRequest(new { message = "A valid inquiry ID must be provided." });
        }

        try
        {
            var inquiry = await _service.GetInquiryByIdAsync(inquiryId);
            if (inquiry == null)
            {
                return NotFound(new { message = "Inquiry not found." });
            }
            return Ok(inquiry);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching inquiry by ID {InquiryId}.", inquiryId);
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    [HttpPut("inquiry/{inquiryId}/outcome")]
    [Authorize(AuthenticationSchemes = $"{JwtBearerDefaults.AuthenticationScheme},{CookieAuthenticationDefaults.AuthenticationScheme}")]
    public async Task<IActionResult> UpdateInquiryOutcome(long inquiryId, [FromBody] UpdateInquiryOutcomeRequest request)
    {
        if (inquiryId <= 0)
        {
            return BadRequest(new { message = "A valid inquiry ID must be provided." });
        }

        if (string.IsNullOrWhiteSpace(request.Outcome))
        {
            return BadRequest(new { message = "Outcome cannot be empty." });
        }

        try
        {
            var result = await _service.UpdateInquiryOutcomeAsync(inquiryId, request.Outcome);
            if (result)
            {
                return Ok(new { message = "Inquiry outcome updated successfully." });
            }
            return NotFound(new { message = "Inquiry not found." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating inquiry outcome for ID {InquiryId}.", inquiryId);
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }
}

public class UpdateInquiryOutcomeRequest
{
    public string Outcome { get; set; } = "";
}