using CBSSupport.Shared.Data;
using CBSSupport.Shared.Models;
using CBSSupport.Shared.Helpers;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace CBSSupport.Shared.Services
{
    public class AuthService : IAuthService
    {
        private readonly IUserRepository _userRepository;
        private readonly IConfiguration _configuration;

        public AuthService(IUserRepository userRepository, IConfiguration configuration)
        {
            _userRepository = userRepository;
            _configuration = configuration;
        }

        public async Task<string?> LoginAsync(LoginRequest loginRequest)
        {
            // 1. Get the user from the database
            var user = await _userRepository.GetByUsernameAsync(loginRequest.Username);
            if (user == null)
            {
                return null; // User not found
            }

            // 2. Verify the hashed password
            // NEVER compare plain text passwords.
            bool isPasswordValid = PasswordHelper.VerifyPassword(loginRequest.Password, user.PasswordHash, user.PasswordSalt);
            if (!isPasswordValid)
            {
                return null; // Invalid password
            }

            // 3. If valid, generate and return the JWT
            return GenerateJwtToken(user);
        }

        private string GenerateJwtToken(AdminUser user)
        {
            var jwtSecret = _configuration["Jwt:Secret"];
            if (string.IsNullOrEmpty(jwtSecret))
            {
                throw new InvalidOperationException("JWT Secret is not configured in appsettings.json.");
            }

            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Username),
                new Claim("userId", user.Id.ToString()), // Custom claim for user ID
                new Claim(ClaimTypes.Role, user.Role),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.Now.AddHours(8),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}