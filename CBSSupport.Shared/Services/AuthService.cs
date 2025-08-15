﻿using CBSSupport.Shared.Data;
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
            var clientUser = await _userRepository.GetClientUserAsync(clientCode, username);

            if (clientUser == null)
            {
                return null;
            }

            bool isPasswordValid = PasswordHelper.VerifyPassword(password, clientUser.PasswordHash, clientUser.PasswordSalt);

            return isPasswordValid ? clientUser : null;
        }

        public async Task<AdminUserDto?> GetAdminUserByIdAsync(long userId)
        {
            var user = await _userRepository.GetByIdAsync(userId);

            if (user == null)
            {
                return null;
            }

            return new AdminUserDto
            {
                Id = user.Id,
                Name = user.FullName
            };
        }
    }
}