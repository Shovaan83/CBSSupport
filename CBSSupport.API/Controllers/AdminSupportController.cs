using Microsoft.AspNetCore.Mvc;

namespace CBSSupport.API.Controllers
{
    public class AdminSupportController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
