using Microsoft.AspNetCore.Mvc;

namespace CBSSupport.API.Controllers
{
    public class LoginController : Controller
    {
        // This method serves the static login page.
        public IActionResult Index()
        {
            return View();
        }
    }
}