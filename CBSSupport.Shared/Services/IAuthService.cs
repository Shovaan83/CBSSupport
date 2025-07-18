﻿using CBSSupport.Shared.Models;
using System.Threading.Tasks;

namespace CBSSupport.Shared.Services
{
    public interface IAuthService
    {
        Task<string?> LoginAsync(LoginRequest loginRequest);
    }
}