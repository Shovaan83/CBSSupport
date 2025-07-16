using CBSSupport.Shared.Models;
using Dapper;
using Npgsql;
using System.Threading.Tasks;

namespace CBSSupport.Shared.Data
{
    public class UserRepository : IUserRepository
    {
        private readonly string _connectionString;

        public UserRepository(string connectionString)
        {
            _connectionString = connectionString;
            DefaultTypeMap.MatchNamesWithUnderscores = true;
        }

        public async Task<AdminUser?> GetByUsernameAsync(string username)
        {
            var sql = "SELECT * FROM admin.users WHERE user_name = @Username";
            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.QuerySingleOrDefaultAsync<AdminUser>(sql, new { Username = username });
            }
        }
    }
}