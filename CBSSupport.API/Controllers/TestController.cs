// File: Controllers/TestController.cs
using Microsoft.AspNetCore.Mvc;

namespace CBSSupport.API.Controllers
{
    public class TestController : Microsoft.AspNetCore.Mvc.Controller
    {
        public IActionResult Index()
        {
            // This will try to render Views/Test/Index.cshtml
            return View();
        }
    }
}