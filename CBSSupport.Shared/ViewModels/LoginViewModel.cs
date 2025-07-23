using System.ComponentModel.DataAnnotations;

namespace CBSSupport.Shared.Models
{
    public class LoginViewModel
    {
        [Required]
        public string Username { get; set; } = string.Empty;

        [Required]
        [DataType(DataType.Password)]
        public string Password { get; set; } = string.Empty;

        public string? BranchCode { get; set; } // For client login

        [Display(Name = "Remember me")]
        public bool RememberMe { get; set; }
    }
}