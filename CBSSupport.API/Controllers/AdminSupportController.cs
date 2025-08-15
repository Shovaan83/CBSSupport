﻿using CBSSupport.Shared.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

[Authorize(Roles = "Admin")]
public class AdminSupportController : Controller
{
    private readonly IAuthService _authService;
    private readonly IChatService _chatService;
    private readonly ILogger<AdminSupportController> _logger;
    public AdminSupportController(
        IAuthService authService,
        IChatService chatService,
        ILogger<AdminSupportController> logger)
    {
        _authService = authService;
        _chatService = chatService;
        _logger = logger;
    }

    [HttpGet]
    public IActionResult Index()
    {
        return View();
    }

    [HttpGet("v1/api/accounts/me")]
    [Authorize(AuthenticationSchemes = $"{JwtBearerDefaults.AuthenticationScheme},{CookieAuthenticationDefaults.AuthenticationScheme}")]
    public async Task<IActionResult> GetMe()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!long.TryParse(userIdClaim, out long userId))
        {
            return Unauthorized(new { message = "User ID claim is missing or invalid." });
        }

        try
        {
            var adminUser = await _authService.GetAdminUserByIdAsync(userId);
            return adminUser != null ? Ok(adminUser) : NotFound();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching admin user data for ID {UserId}", userId);
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    [HttpGet("v1/api/clients")]
    [Authorize(AuthenticationSchemes = $"{JwtBearerDefaults.AuthenticationScheme},{CookieAuthenticationDefaults.AuthenticationScheme}")]
    public async Task<IActionResult> GetClients()
    {
        try
        {
            var clients = await _chatService.GetAllClientsAsync();

            var result = clients.Select(c => new {
                Id = c.ClientId, 
                Name = c.FullName ?? c.Username
            });

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while fetching clients.");
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }

    [HttpGet("v1/api/dashboard/stats/all")]
    [Authorize(AuthenticationSchemes = $"{JwtBearerDefaults.AuthenticationScheme},{CookieAuthenticationDefaults.AuthenticationScheme}")]
    public async Task<IActionResult> GetDashboardStats()
    {
        try
        {
            var stats = await _chatService.GetDashboardStatsAsync();
            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching dashboard aggregate stats.");
            return StatusCode(500, new { message = "An internal server error occurred." });
        }
    }
}