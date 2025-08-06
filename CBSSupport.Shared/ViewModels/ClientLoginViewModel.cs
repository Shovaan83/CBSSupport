using System.ComponentModel.DataAnnotations;

namespace CBSSupport.Shared.Models
{
    public class ClientLoginViewModel
    {
        [Required(ErrorMessage = "Client Code is required.")]
        [Display(Name = "Client Code")]
        public long? ClientCode { get; set; } 
        [Required]
        public string Username { get; set; } = string.Empty;

        [Required]
        [DataType(DataType.Password)]
        public string Password { get; set; } = string.Empty;

        [Display(Name = "Remember me")]
        public bool RememberMe { get; set; }
    }
}