using Microsoft.AspNetCore.Mvc;

namespace CBSSupport.API.Controllers
{
    public class LoginController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
