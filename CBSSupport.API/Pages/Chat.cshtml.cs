using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Logging;
using System.Security.Claims;

namespace CBSSupport.API.Pages
{
    public class ChatModel : PageModel


    {
        public string CurrentUserName { get; private set; }

        private readonly ILogger<ChatModel> _logger;

        public ChatModel(ILogger<ChatModel> logger)
        {
            _logger = logger;
        }

        public void OnGet()
        {
            // This method is called when the page is first requested.
            // You can add logic here if needed.
            CurrentUserName = User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name ?? "Guest";
        }
    }




}