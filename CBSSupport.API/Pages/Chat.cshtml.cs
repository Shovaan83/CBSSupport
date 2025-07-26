using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Logging;

namespace CBSSupport.API.Pages
{
    public class ChatModel : PageModel
    {
        private readonly ILogger<ChatModel> _logger;

        public ChatModel(ILogger<ChatModel> logger)
        {
            _logger = logger;
        }

        public void OnGet()
        {
        }
    }
}