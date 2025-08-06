using CBSSupport.Shared.Models;
using CBSSupport.Shared.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Microsoft.Extensions.Logging;

namespace CBSSupport.API.Controllers
{
    [AllowAnonymous]
    public class LoginController : Controller
    {
        private readonly IAuthService _authService;
        private readonly ILogger<LoginController> _logger;

        public LoginController(IAuthService authService, ILogger<LoginController> logger)
        {
            _authService = authService;
            _logger = logger;
        }

        [HttpGet]
        public IActionResult Index()
        {
            // Handles users who are already logged in and try to visit the login page.
            if (User.Identity is { IsAuthenticated: true })
            {
                // If the logged-in user has the "Client" role, send them to the Support page.
                if (User.IsInRole("Client"))
                {
                    return RedirectToAction("Index", "Support");
                }

                // Otherwise, assume they are an Admin and send them to the AdminSupport page.
                return RedirectToAction("Index", "AdminSupport");
            }
            return View(new LoginViewModel());
        }

        [HttpPost]
        public async Task<IActionResult> Index(LoginViewModel model)
        {
            if (!ModelState.IsValid) return View(model);

            if (model.RoleType == "admin")
            {
                // --- ADMIN LOGIN LOGIC ---
                if (string.IsNullOrEmpty(model.Username) || string.IsNullOrEmpty(model.Password))
                {
                    ModelState.AddModelError(string.Empty, "Username and Password are required for admin login.");
                    return View(model);
                }

                var adminUser = await _authService.ValidateUserAsync(model.Username, model.Password);
                if (adminUser != null)
                {
                    var claims = new List<Claim>
                    {
                        new Claim(ClaimTypes.Name, adminUser.Username),
                        new Claim("FullName", adminUser.FullName),
                        new Claim(ClaimTypes.Role, "Admin"), // The role is "Admin"
                        new Claim("UserId", adminUser.Id.ToString())
                    };

                    await SignInUser(claims, model.RememberMe, "/AdminSupport");
                    return RedirectToAction("Index", "AdminSupport");
                }
            }
            else if (model.RoleType == "client" && model.ClientLogin != null)
            {

                if (!model.ClientLogin.ClientCode.HasValue || string.IsNullOrEmpty(model.ClientLogin.Username) || string.IsNullOrEmpty(model.ClientLogin.Password))
                {
                    ModelState.AddModelError(string.Empty, "Client Code, Username, and Password are required.");
                    return View(model);
                }

                // --- CLIENT LOGIN LOGIC ---
                var clientUser = await _authService.ValidateClientUserAsync(
                    model.ClientLogin.ClientCode.Value,
                    model.ClientLogin.Username,
                    model.ClientLogin.Password
                );

                if (clientUser != null)
                {
                    var claims = new List<Claim>
                    {
                        new Claim(ClaimTypes.Name, clientUser.Username),
                        new Claim("FullName", clientUser.FullName),
                        new Claim(ClaimTypes.Role, "Client"), // The role is "Client"
                        new Claim("UserId", clientUser.Id.ToString()),
                        new Claim("ClientId", clientUser.ClientId.ToString())
                    };

                    await SignInUser(claims, model.RememberMe, "/Support");
                    return RedirectToAction("Index", "Support");
                }
            }

            ModelState.AddModelError(string.Empty, "Invalid login attempt.");
            return View(model);
        }

        // Helper method to create the auth cookie and set the session.
        private async Task SignInUser(List<Claim> claims, bool isPersistent, string redirectUri)
        {
            var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            var authProperties = new AuthenticationProperties
            {
                IsPersistent = isPersistent,
                ExpiresUtc = DateTimeOffset.UtcNow.AddMinutes(60),
                RedirectUri = redirectUri
            };

            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                new ClaimsPrincipal(claimsIdentity),
                authProperties);

            var userIdClaim = claims.FirstOrDefault(c => c.Type == "UserId");
            var userNameClaim = claims.FirstOrDefault(c => c.Type == ClaimTypes.Name);

            if (userIdClaim != null) HttpContext.Session.SetString("UserId", userIdClaim.Value);
            if (userNameClaim != null) HttpContext.Session.SetString("Username", userNameClaim.Value);

            _logger.LogInformation("Session set for UserId: {UserId}", userIdClaim?.Value ?? "N/A");
        }

        [HttpGet]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return RedirectToAction("Index", "Login");
        }
    }
}   