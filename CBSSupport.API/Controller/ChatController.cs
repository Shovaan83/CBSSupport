using Microsoft.AspNetCore.Mvc;

// Make sure you have the correct using statements for your project
// using Dapper;
// using Npgsql;

namespace YourProjectName.Controllers; // <-- Make sure your namespace is correct

[Route("api/[controller]")]
[ApiController]
[IgnoreAntiforgeryToken]
public class ChatController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<ChatController> _logger;

    public ChatController(IConfiguration config, ILogger<ChatController> logger)
    {
        _config = config;
        _logger = logger;
    }

    // --- MODEL FOR THE NEW SUPPORT REQUEST FORM ---
    public class NewSupportRequest
    {
        public string FullName { get; set; }
        public string Email { get; set; }
        public string AccountNumber { get; set; }
        public string Title { get; set; }
        public string Topic { get; set; }
        public string Description { get; set; }
        public string Priority { get; set; }
    }

    // --- MODEL FOR THE TICKET DATA ---
    public class SupportTicket
    {
        public string ID { get; set; }
        public string Subject { get; set; }
        public DateTime Date { get; set; }
        public string Status { get; set; }
        public string Created_By { get; set; }
        public string Resolved_By { get; set; }
    }

    [HttpGet("tickets")]
    public async Task<IActionResult> GetMyTickets()
    {
        try
        {
            var mockTickets = new List<SupportTicket>
            {
                new SupportTicket { ID = "#84321", Subject = "Login Issue", Date = DateTime.Parse("2024-10-21"), Status = "Resolved" },
                new SupportTicket { ID = "#64198", Subject = "Invoice Question", Date = DateTime.Parse("2024-10-19"), Status = "Resolved" }
            };
            return Ok(await Task.FromResult(mockTickets)); // Use Task.FromResult for async signature
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching tickets.");
            return StatusCode(500, "Internal server error");
        }
    }

    // --- NEW ENDPOINT FOR CREATING A TICKET ---
    [HttpPost("createticket")]
    public async Task<IActionResult> CreateTicket([FromBody] NewSupportRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest("Request and Title are required.");
        }

        _logger.LogInformation("Creating new support request with title '{Title}'", request.Title);

        // In a real app, you would INSERT into the DB and get the new ID.
        // For this example, we mock the creation of the ticket object.
        var newTicket = new SupportTicket
        {
            ID = $"#{new Random().Next(10000, 99999)}",
            Subject = request.Title,
            Date = DateTime.UtcNow,
            Status = "Open", // New tickets should be 'Open'
            Created_By = request.FullName, // Set from the form data
            Resolved_By = "" // Not resolved yet
        };

        // Here you would use Dapper to save the 'newTicket' to your database.
        // await connection.ExecuteAsync(sql, newTicket);

        // Return the newly created ticket object to the client.
        return Ok(await Task.FromResult(newTicket));
    }
}