using CBSSupport.Shared.Models;
using System.Threading.Tasks;

namespace CBSSupport.Shared.Data
{
    public interface IUserRepository
    {
        Task<AdminUser?> GetByUsernameAsync(string username);

        Task<ClientUser?> GetClientUserAsync(long clientId, string username);

        Task<AdminUser?> GetByIdAsync(long userId);
    }
}