using System.ComponentModel.DataAnnotations;

namespace CBSSupport.Shared.Models
{
    public class LoginViewModel
    {
        [Required]
        public string RoleType { get; set; }

        public string? Username { get; set; }

        [DataType(DataType.Password)]
        public string? Password { get; set; }

        public ClientLoginViewModel? ClientLogin { get; set; }

        [Display(Name = "Remember me")]
        public bool RememberMe { get; set; }
    }
}