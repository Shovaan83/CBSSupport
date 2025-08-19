using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Http;
using CBSSupport.Shared.Services;

namespace CBSSupport.API.Controllers
{
    [Authorize(Roles = "Client")]
    public class SupportController : Microsoft.AspNetCore.Mvc.Controller
    {
        private readonly ILogger<SupportController> _logger;
        private readonly IChatService _chatService;

        public SupportController(ILogger<SupportController> logger, IChatService chatService)
        {
            _logger = logger;
            _chatService = chatService;
        }

        public async Task<IActionResult> Index() 
        {
            var claimsIdentity = User.Identity as ClaimsIdentity;

            var clientIdStr = claimsIdentity?.FindFirst("ClientId")?.Value ?? "0";
            var userIdStr = claimsIdentity?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0";

            var clientId = long.Parse(clientIdStr);
            var userId = int.Parse(userIdStr); 

            ViewBag.UserFullName = claimsIdentity?.FindFirst("FullName")?.Value ?? "User";
            ViewBag.ClientId = clientIdStr;
            ViewBag.UserId = userIdStr;

            try
            {
                var groupChatId = await _chatService.GetOrCreateGroupChatConversationIdAsync(clientId, userId);
                ViewBag.GroupChatId = groupChatId;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting group chat conversation ID for client {ClientId} and user {UserId}", clientId, userId);
                ViewBag.GroupChatId = 1; 
            }

            _logger.LogInformation($"Support Index - UserId: {ViewBag.UserId}, ClientId: {ViewBag.ClientId}, UserName: {ViewBag.UserFullName}, GroupChatId: {ViewBag.GroupChatId}");

            return View();
        }
    }
}