using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims; 

namespace CBSSupport.API.Controllers
{
    [Authorize] 
    public class SupportController : Microsoft.AspNetCore.Mvc.Controller
    {
        public IActionResult Index()
        {
            var fullName = User.FindFirstValue("FullName");
            ViewBag.UserFullName = fullName ?? User.Identity.Name;

            return View("Support");
        }
    }
}