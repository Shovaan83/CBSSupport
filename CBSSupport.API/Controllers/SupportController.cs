using Microsoft.AspNetCore.Mvc;

namespace CBSSupport.API.Controllers
{
    public class SupportController : Microsoft.AspNetCore.Mvc.Controller
    {
        public IActionResult Index()
        {
            return View("Support");
        }
    }
}