using CBSSupport.Shared.Models;
using Dapper;
using Npgsql;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace CBSSupport.Shared.Services
{
    public class ChatService : IChatService
    {
        private readonly string _connectionString;

        public ChatService(string connectionString)
        {
            _connectionString = connectionString;
            DefaultTypeMap.MatchNamesWithUnderscores = true;
        }

        public async Task<long> CreateInstructionTicketAsync(ChatMessage newTicket)
        {
            var sql = @"
                INSERT INTO digital.instructions (
                    datetime, inst_category_id, inst_type_id, instruction, 
                    status, insert_user, client_auth_user_id, client_id, service_id, ip_address, geo_location, inst_channel
                )
                VALUES (
                    @DateTime, @InstCategoryId, @InstTypeId, @Instruction,
                    @Status, @InsertUser, @ClientAuthUserId, @ClientId, @ServiceId, @IpAddress, @GeoLocation, @InstChannel
                )
                RETURNING id;"; // Get the newly created ID back

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.ExecuteScalarAsync<long>(sql, newTicket);
            }
        }

        public async Task<IEnumerable<ChatMessage>> GetInstructionTicketsForUserAsync(long clientAuthUserId)
        {
            var sql = @"
                SELECT id, datetime, instruction, assigned_to, status, completed
                FROM digital.instructions
                WHERE client_auth_user_id = @ClientAuthUserId
                ORDER BY datetime DESC;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.QueryAsync<ChatMessage>(sql, new { ClientAuthUserId = clientAuthUserId });
            }
        }
    }
}