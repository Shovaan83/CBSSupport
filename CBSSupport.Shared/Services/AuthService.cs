using CBSSupport.Shared.Data;
using CBSSupport.Shared.Helpers;
using CBSSupport.Shared.Models;
using Npgsql;
using System.Threading.Tasks;

namespace CBSSupport.Shared.Services
{
    public class AuthService : IAuthService
    {
        private readonly IUserRepository _userRepository;

        public AuthService(IUserRepository userRepository)
        {
            _userRepository = userRepository;
        }

        public async Task<AdminUser?> ValidateUserAsync(string username, string password)
        {
            var user = await _userRepository.GetByUsernameAsync(username);
            if (user == null) return null;

            bool isPasswordValid = PasswordHelper.VerifyPassword(password, user.PasswordHash, user.PasswordSalt);

            return isPasswordValid ? user : null;
        }

        public async Task<ClientUser?> ValidateClientUserAsync(long clientCode, string username, string password)
        {
            // 1. Find the user by their client code and username.
            var clientUser = await _userRepository.GetClientUserAsync(clientCode, username);

            // 2. If no user is found, validation fails.
            if (clientUser == null)
            {
                return null;
            }

            // 3. Verify the provided password against the stored hash.
            bool isPasswordValid = PasswordHelper.VerifyPassword(password, clientUser.PasswordHash, clientUser.PasswordSalt);

            // 4. Return the user object if the password is valid, otherwise return null.
            return isPasswordValid ? clientUser : null;
        }

        public async Task<AdminUserDto?> GetAdminUserByIdAsync(long userId)
        {
            // It now correctly calls the repository
            var user = await _userRepository.GetByIdAsync(userId);

            if (user == null)
            {
                return null;
            }

            // Map the database model to the simple DTO for security
            return new AdminUserDto
            {
                Id = user.Id,
                Name = user.FullName
            };
        }
    }
}