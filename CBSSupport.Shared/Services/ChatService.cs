using CBSSupport.Shared.Models;
using CBSSupport.Shared.ViewModels;
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
        public async Task<ChatMessage> CreateInstructionTicketAsync(ChatMessage newTicket)
        {
            // --- Step 1: Define the SQL command to insert a new message. ---
            // This matches the properties in your ChatMessage.cs model.
            var sqlInsert = @"
                INSERT INTO digital.instructions (
                    datetime, inst_category_id, inst_type_id, instruction,
                    status, insert_user, client_auth_user_id, client_id,
                    service_id, ip_address, geo_location, inst_channel,
                    attachment_id, instruction_id, remarks
                )
                VALUES (
                    @DateTime, @InstCategoryId, @InstTypeId, @Instruction,
                    @Status, @InsertUser, @ClientAuthUserId, @ClientId,
                    @ServiceId, @IpAddress, @GeoLocation, @InstChannel,
                    @AttachmentId, @InstructionId, @Remarks
                )
                RETURNING *;";

            // --- Step 2: Define the SQL command to update the conversation grouping. ---
            var sqlUpdate = @"UPDATE digital.instructions SET instruction_id = @Id WHERE id = @Id;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                var savedMessage = await connection.QueryFirstOrDefaultAsync<ChatMessage>(sqlInsert, newTicket);

                if (savedMessage !=null && (savedMessage.InstructionId == null || savedMessage.InstructionId == 0))
                {
                    var updateParams = new { Id = savedMessage.Id };
                    await connection.ExecuteAsync(sqlUpdate, updateParams);
                    savedMessage = await connection.QueryFirstOrDefaultAsync<ChatMessage>(
                        "SELECT * FROM digital.instructions WHERE id = @Id;", new { Id = savedMessage.Id });
                }
                return savedMessage;
            }
        }

        /// <summary>
        /// Gets a list of unique conversations for a user, represented by the most recent message
        /// from each conversation thread.
        /// </summary>
        public async Task<IEnumerable<ChatMessage>> GetInstructionTicketsForUserAsync(long clientAuthUserId)
        {
            // This query fetches the most recent message for each distinct conversation thread (instruction_id).
            var sql = @"
                SELECT DISTINCT ON (instruction_id)
                    id, instruction_id, datetime, instruction, status, inst_type_id
                FROM digital.instructions
                WHERE client_auth_user_id = @ClientAuthUserId AND instruction_id IS NOT NULL
                ORDER BY instruction_id, datetime DESC;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.QueryAsync<ChatMessage>(sql, new { ClientAuthUserId = clientAuthUserId });
            }
        }

        /// <summary>
        /// Gets all messages that belong to a specific conversation thread.
        /// </summary>
        public async Task<IEnumerable<ChatMessage>> GetMessagesByConversationIdAsync(long conversationId)
        {
            // This query correctly fetches all messages where the 'instruction_id' matches the conversation group ID.
            var sql = @"
                SELECT id, datetime, instruction, insert_user, status, instruction_id,
                       client_auth_user_id
                FROM digital.instructions
                WHERE instruction_id = @ConversationId
                ORDER BY datetime ASC;"; // ASC is correct to show history chronologically.

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.QueryAsync<ChatMessage>(sql, new { ConversationId = conversationId });
            }
        }

        // This method remains as-is, useful for fetching a single, specific message by its primary key.
        public async Task<ChatMessage> GetInstructionByIdAsync(long instructionId)
        {
            var sql = @"
                SELECT 
                    id, datetime, instruction, assigned_to, status, 
                    completed, attachment_id
                FROM digital.instructions
                WHERE id = @InstructionId;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.QueryFirstOrDefaultAsync<ChatMessage>(sql, new { InstructionId = instructionId });
            }
        }

        public async Task<SidebarViewModel> GetSidebarForUserAsync(long fintechUserId, long viewingClientId)
        {
            var sidebar = new SidebarViewModel();

            // NOTE: This assumes 'viewingClientId' is the ID of the client whose tickets/inquiries the agent is looking at.
            // For internal chats, we might use a special fintech-only client_id (e.g., client_id = 1).
            long fintechCompanyClientId = 1; // Assuming your own company has a client_id of 1.

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                // === 1. Get Private Chats with the selected client's users (inst_type_id = 101) ===
                // This query finds all 1-on-1 support chats for the currently viewed client.
                var privateChatSql = @"
            SELECT DISTINCT ON (i.instruction_id)
                i.instruction_id AS ConversationId,
                COALESCE(u.full_name, 'Client User') AS DisplayName, -- Assumes a 'users' table with 'full_name'
                i.instruction AS Subtitle,
                'P' AS AvatarInitials, 'avatar-bg-purple' AS AvatarClass
            FROM digital.instructions i
            LEFT JOIN admin.users u ON i.client_auth_user_id = u.id -- EXAMPLE JOIN, adjust as needed
            WHERE i.client_id = @ViewingClientId AND i.inst_type_id = 101 AND i.instruction_id IS NOT NULL
            ORDER BY i.instruction_id, i.datetime DESC;";
                sidebar.PrivateChats.AddRange(await connection.QueryAsync<SidebarChatItem>(privateChatSql, new { ViewingClientId = viewingClientId }));


                // === 2. Get Internal Fintech Team Chats (inst_type_id = 105) ===
                // This query finds chats between fintech employees, ignoring the client being viewed.
                var internalChatSql = @"
            SELECT DISTINCT ON (i.instruction_id)
                i.instruction_id AS ConversationId,
                'Internal Discussion' AS DisplayName, -- Or parse participants
                i.instruction AS Subtitle,
                'I' AS AvatarInitials, 'avatar-bg-green' AS AvatarClass
            FROM digital.instructions i
            WHERE i.client_id = @FintechClientId AND i.inst_type_id = 105 AND i.instruction_id IS NOT NULL
            ORDER BY i.instruction_id, i.datetime DESC;";
                sidebar.InternalChats.AddRange(await connection.QueryAsync<SidebarChatItem>(internalChatSql, new { FintechClientId = fintechCompanyClientId }));


                // === 3. Get Ticket Chats for the selected client (inst_type_id = 110-117) ===
                var ticketTypeIds = Enumerable.Range(110, 8).ToArray(); // [110, 111, ..., 117]
                var ticketSql = @"
    SELECT DISTINCT ON (i.instruction_id)
        i.instruction_id AS ConversationId,
        t.inst_type_name AS DisplayName,
        i.instruction AS Subtitle,
        'T' AS AvatarInitials,
        'avatar-bg-orange' AS AvatarClass, -- <<< ADD THE COMMA HERE
        CASE i.inst_type_id
            WHEN 110 THEN 'ticket/training'
            WHEN 111 THEN 'ticket/migration'
            WHEN 112 THEN 'ticket/setup'
            WHEN 113 THEN 'ticket/correction'
            WHEN 114 THEN 'ticket/bug-fix'
            WHEN 115 THEN 'ticket/new-feature'
            WHEN 116 THEN 'ticket/feature-enhancement'
            WHEN 117 THEN 'ticket/backend-workaround'
            ELSE ''
        END AS Route
    FROM digital.instructions i JOIN digital.inst_types t ON i.inst_type_id = t.id
    WHERE i.client_id = @ViewingClientId AND i.inst_type_id = ANY(@TicketTypeIds) AND i.instruction_id IS NOT NULL
    ORDER BY i.instruction_id, i.datetime DESC;";
                var tickets = await connection.QueryAsync<SidebarChatItem>(ticketSql, new { ViewingClientId = viewingClientId, TicketTypeIds = ticketTypeIds });
                foreach (var ticket in tickets) { ticket.DisplayName = $"#{ticket.ConversationId} - {ticket.DisplayName}"; }
                sidebar.TicketChats.AddRange(tickets);


                // === 4. Get Inquiry Chats for the selected client (inst_type_id = 121, 122) ===
                var inquiryTypeIds = new[] { 121, 122 };
                var inquirySql = @"
     SELECT DISTINCT ON (i.instruction_id)
        i.instruction_id AS ConversationId,
        t.inst_type_name AS DisplayName,
        i.instruction AS Subtitle,
        'Q' AS AvatarInitials,
        'avatar-bg-cyan' AS AvatarClass,
        CASE i.inst_type_id
            WHEN 121 THEN 'inquiry/accounts'
            WHEN 122 THEN 'inquiry/sales'
            ELSE ''
        END AS Route
            FROM digital.instructions i JOIN digital.inst_types t ON i.inst_type_id = t.id
            WHERE i.client_id = @ViewingClientId AND i.inst_type_id = ANY(@InquiryTypeIds) AND i.instruction_id IS NOT NULL
            ORDER BY i.instruction_id, i.datetime DESC;";
                sidebar.InquiryChats.AddRange(await connection.QueryAsync<SidebarChatItem>(inquirySql, new { ViewingClientId = viewingClientId, InquiryTypeIds = inquiryTypeIds }));
            }

            return sidebar;
        }

        // This method might be deprecated if you are using the sidebar logic, but is kept for completeness.
        public async Task<IEnumerable<ChatMessage>> GetConversationsByInstTypeAsync(short instTypeId)
        {
            var sql = @"
                SELECT id, datetime, instruction, assigned_to, status, completed, instruction_id
                FROM digital.instructions
                WHERE inst_type_id = @InstTypeId
                ORDER BY datetime DESC;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.QueryAsync<ChatMessage>(sql, new { InstTypeId = instTypeId });
            }
        }
    }
}