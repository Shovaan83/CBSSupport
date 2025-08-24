namespace CBSSupport.Shared.Models
{
    public class ClientUser
    {
        public long Id { get; set; }
        public long ClientId { get; set; } 
        public string Username { get; set; }
        public string FullName { get; set; }
        public string Role { get; set; } 

        public string PasswordHash { get; set; }
        public string PasswordSalt { get; set; }
    }
}