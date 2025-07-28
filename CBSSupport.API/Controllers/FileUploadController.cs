﻿using Microsoft.AspNetCore.Mvc;
using System;
using System.IO;
using System.Threading.Tasks;

namespace CBSSupport.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FileUploadController : ControllerBase
    {
        private readonly IWebHostEnvironment _environment;

        public FileUploadController(IWebHostEnvironment environment)
        {
            _environment = environment;
        }

        [HttpPost("UploadFile")]
        public async Task<IActionResult> UploadFile(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            // --- Validation ---
            long maxFileSize = 10 * 1024 * 1024; // 10 MB
            if (file.Length > maxFileSize)
                return BadRequest($"File size exceeds the limit of {maxFileSize / 1024 / 1024} MB.");

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".pdf", ".docx", ".txt" };
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (string.IsNullOrEmpty(extension) || !allowedExtensions.Contains(extension))
                return BadRequest("Invalid file type.");

            // --- File Saving ---
            // Create a unique filename to avoid conflicts
            var fileName = $"{Guid.NewGuid()}{extension}";
            var uploadsFolder = Path.Combine(_environment.WebRootPath, "uploads");

            // Ensure the directory exists
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var filePath = Path.Combine(uploadsFolder, fileName);

            try
            {
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // Return a public-facing URL to the file
                var fileUrl = $"{Request.Scheme}://{Request.Host}/uploads/{fileName}";

                return Ok(new { url = fileUrl, name = file.FileName, type = file.ContentType });
            }
            catch (Exception ex)
            {
                // Log the exception
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }
    }
}