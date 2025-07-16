using CBSSupport.Shared.Models;
using System.Threading.Tasks;

namespace CBSSupport.Shared.Data
{
    public interface IUserRepository
    {
        Task<AdminUser> GetByUsernameAsync(string username);
    }
}