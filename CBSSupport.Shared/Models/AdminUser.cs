using Dapper.Contrib.Extensions;
using System.ComponentModel.DataAnnotations.Schema;

namespace CBSSupport.Shared.Models
{
    [Dapper.Contrib.Extensions.Table("admin.users")]
    public class AdminUser
    {
        [Key]
        public int Id { get; set; }

        [Column("user_name")]
        public string Username { get; set; } = string.Empty;

        [Column("password_salt")]
        public string PasswordSalt { get; set; } = string.Empty;

        [Column("password_hash")]
        public string PasswordHash { get; set; } = string.Empty;

        [Column("role_id")]
        public int RoleId { get; set; }

        [Column("full_name")]
        public string FullName { get; set; } = string.Empty;

        [Write(false)] 
        public string Role { get; set; } = string.Empty;
    }
}