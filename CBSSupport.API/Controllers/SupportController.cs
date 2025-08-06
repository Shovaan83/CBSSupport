using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims; 
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Http;

namespace CBSSupport.API.Controllers
{
    [Authorize] 
    public class SupportController : Microsoft.AspNetCore.Mvc.Controller
    {
        private readonly ILogger<SupportController> _logger;

        public SupportController(ILogger<SupportController> logger)
        {
            _logger = logger;
        }
        public IActionResult Index()
        {
            var userIdFromSession = HttpContext.Session.GetString("UserId");
            _logger.LogInformation("--- NEW VERSION LOADED --- Session User ID is: {UserId}", userIdFromSession ?? "NULL");
            return View();
        }
    }
}