using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Http;

namespace CBSSupport.API.Controllers
{
    [Authorize(Roles = "Client")]
    public class SupportController : Microsoft.AspNetCore.Mvc.Controller
    {
        private readonly ILogger<SupportController> _logger;

        public SupportController(ILogger<SupportController> logger)
        {
            _logger = logger;
        }
        public IActionResult Index()
        {
            var claimsIdentity = User.Identity as ClaimsIdentity;
            ViewBag.UserFullName = claimsIdentity?.FindFirst("FullName")?.Value ?? "User";
            ViewBag.ClientId = claimsIdentity?.FindFirst("ClientId")?.Value ?? "0";
            return View();
        }
    }
}