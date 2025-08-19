using System.Text.Json;
using CBSSupport.Shared.Models;
using CBSSupport.Shared.ViewModels;
using Dapper;
using Npgsql;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq;

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
            if (newTicket.InstCategoryId == 101)
            {
                var priority = newTicket.Priority ?? "Normal";
                var userRemarks = newTicket.Remarks ?? "";

                var remarksJson = new
                {
                    priority = priority,
                    userremarks = userRemarks
                };

                newTicket.Remarks = JsonSerializer.Serialize(remarksJson);
            }

            var sqlInsert = @"
        INSERT INTO digital.instructions (
            datetime, inst_category_id, inst_type_id, instruction,
            status, insert_user, client_auth_user_id, client_id,
            service_id, ip_address, geo_location, inst_channel,
            attachment_id, instruction_id, remarks, expiry_date
        )
        VALUES (
            @DateTime, @InstCategoryId, @InstTypeId, @Instruction,
            @Status, @InsertUser, @ClientAuthUserId, @ClientId,
            @ServiceId, @IpAddress, @GeoLocation, @InstChannel,
            @AttachmentId, @InstructionId, @Remarks, @ExpiryDate
        )
        RETURNING id;";

            var sqlUpdate = @"UPDATE digital.instructions SET instruction_id = @Id WHERE id = @Id;";

            var sqlSelect = @"
            SELECT 
                i.*,
                COALESCE(au.full_name, cu.full_name, 'Unknown User') AS SenderName 
            FROM digital.instructions i
            LEFT JOIN admin.users au ON i.insert_user = au.id AND i.client_auth_user_id IS NULL
            LEFT JOIN internal.support_users cu ON i.client_auth_user_id = cu.id
            WHERE i.id = @Id;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                long newId = await connection.ExecuteScalarAsync<long>(sqlInsert, newTicket);

                if (newTicket.InstructionId == null || newTicket.InstructionId == 0)
                {
                    await connection.ExecuteAsync(sqlUpdate, new { Id = newId });
                    newTicket.InstructionId = newId;
                }

                var savedMessage = await connection.QueryFirstOrDefaultAsync<ChatMessage>(sqlSelect, new { Id = newId });

                if (savedMessage != null && savedMessage.InstructionId == null)
                {
                    savedMessage.InstructionId = newTicket.InstructionId;
                }

                return savedMessage;
            }
        }

        public async Task<SidebarViewModel> GetSidebarForUserAsync(long fintechUserId, long viewingClientId)
        {
            var sidebar = new SidebarViewModel();
            long fintechCompanyClientId = 1;

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                // === 1. Get Private Chats ===
                var privateChatSql = @"
        SELECT DISTINCT ON (i.instruction_id)
            i.instruction_id AS ConversationId,
            COALESCE(u.full_name, 'Client User') AS DisplayName,
            i.instruction AS Subtitle,
            'P' AS AvatarInitials, 'avatar-bg-purple' AS AvatarClass,
            'support-private' AS Route
        FROM digital.instructions i
        LEFT JOIN internal.support_users u ON i.client_auth_user_id = u.id
        WHERE i.client_id = @ViewingClientId AND i.inst_type_id = 101 AND i.instruction_id IS NOT NULL
        ORDER BY i.instruction_id, i.datetime DESC;";
                sidebar.PrivateChats.AddRange(await connection.QueryAsync<SidebarChatItem>(privateChatSql, new { ViewingClientId = viewingClientId }));

                // === 2. Get Internal Chats ===
                var internalChatSql = @"
        SELECT DISTINCT ON (i.instruction_id)
            i.instruction_id AS ConversationId,
            'Internal Discussion' AS DisplayName,
            i.instruction AS Subtitle,
            'I' AS AvatarInitials, 'avatar-bg-green' AS AvatarClass,
            'internal-team-chat' AS Route
        FROM digital.instructions i
        WHERE i.client_id = @FintechClientId AND i.inst_type_id = 105 AND i.instruction_id IS NOT NULL
        ORDER BY i.instruction_id, i.datetime DESC;";
                sidebar.InternalChats.AddRange(await connection.QueryAsync<SidebarChatItem>(internalChatSql, new { FintechClientId = fintechCompanyClientId }));

                // === 3. Get Ticket Chats ===
                var ticketTypeIds = Enumerable.Range(110, 8).ToArray();
                var ticketSql = @"
        SELECT DISTINCT ON (i.instruction_id)
            i.instruction_id AS ConversationId,
            t.inst_type_name AS DisplayName,
            i.instruction AS Subtitle,
            'T' AS AvatarInitials, 'avatar-bg-orange' AS AvatarClass,
            CASE i.inst_type_id
                WHEN 110 THEN 'ticket/training' WHEN 111 THEN 'ticket/migration'
                WHEN 112 THEN 'ticket/setup' WHEN 113 THEN 'ticket/correction'
                WHEN 114 THEN 'ticket/bug-fix' WHEN 115 THEN 'ticket/new-feature'
                WHEN 116 THEN 'ticket/feature-enhancement' WHEN 117 THEN 'ticket/backend-workaround'
                ELSE ''
            END AS Route
        FROM digital.instructions i JOIN digital.inst_types t ON i.inst_type_id = t.id
        WHERE i.client_id = @ViewingClientId AND i.inst_type_id = ANY(@TicketTypeIds) AND i.instruction_id IS NOT NULL
        ORDER BY i.instruction_id, i.datetime DESC;";
                var tickets = await connection.QueryAsync<SidebarChatItem>(ticketSql, new { ViewingClientId = viewingClientId, TicketTypeIds = ticketTypeIds });
                foreach (var ticket in tickets) { ticket.DisplayName = $"#{ticket.ConversationId} - {ticket.DisplayName}"; }
                sidebar.TicketChats.AddRange(tickets);

                // === 4. Get Inquiry Chats ===
                var inquiryTypeIds = new[] { 121, 122 };
                var inquirySql = @"
         SELECT DISTINCT ON (i.instruction_id)
            i.instruction_id AS ConversationId,
            t.inst_type_name AS DisplayName,
            i.instruction AS Subtitle,
            'Q' AS AvatarInitials, 'avatar-bg-cyan' AS AvatarClass,
            CASE i.inst_type_id
                WHEN 121 THEN 'inquiry/accounts' WHEN 122 THEN 'inquiry/sales'
                ELSE ''
            END AS Route
        FROM digital.instructions i JOIN digital.inst_types t ON i.inst_type_id = t.id
        WHERE i.client_id = @ViewingClientId AND i.inst_type_id = ANY(@InquiryTypeIds) AND i.instruction_id IS NOT NULL
        ORDER BY i.instruction_id, i.datetime DESC;";
                sidebar.InquiryChats.AddRange(await connection.QueryAsync<SidebarChatItem>(inquirySql, new { ViewingClientId = viewingClientId, InquiryTypeIds = inquiryTypeIds }));
            }
            return sidebar;
        }

        public async Task<IEnumerable<ChatMessage>> GetInstructionTicketsForUserAsync(long clientAuthUserId)
        {
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

        public async Task<IEnumerable<ChatMessage>> GetMessagesByConversationIdAsync(long conversationId)
        {
            var sql = @"
        SELECT 
            i.*,
            COALESCE(au.full_name, cu.full_name, 'Unknown User') AS SenderName
        FROM digital.instructions i
        LEFT JOIN admin.users au ON i.insert_user = au.id
        LEFT JOIN internal.support_users cu ON i.client_auth_user_id = cu.id
        WHERE i.instruction_id = @ConversationId
        ORDER BY i.datetime ASC;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.QueryAsync<ChatMessage>(sql, new { ConversationId = conversationId });
            }
        }

        public async Task<IEnumerable<TicketViewModel>> GetTicketsByClientIdAsync(long clientId)
        {
            var ticketTypeIds = Enumerable.Range(110, 8).ToArray();
            var sql = @"
        SELECT 
            i.id AS Id,
            i.instruction AS Subject,
            i.datetime AS Date,
            u.full_name AS CreatedBy,
            res.full_name AS ResolvedBy,
            CASE WHEN i.completed = true THEN 'Resolved' ELSE 'Open' END AS Status,
            COALESCE(public.try_get_json_value(i.remarks, 'priority'), 'Normal') AS Priority
        FROM digital.instructions i
        LEFT JOIN internal.support_users u ON i.client_auth_user_id = u.id
        LEFT JOIN admin.users res ON i.completed_by = res.id
        WHERE i.client_id = @ClientId AND i.inst_type_id = ANY(@TicketTypeIds)
        ORDER BY i.datetime DESC;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.QueryAsync<TicketViewModel>(sql, new { ClientId = clientId, TicketTypeIds = ticketTypeIds });
            }
        }

        public async Task<IEnumerable<InquiryViewModel>> GetInquiriesByClientIdAsync(long clientId)
        {
            var inquiryTypeIds = new[] { 121, 122 };
            var sql = @"
        SELECT
            i.id AS Id,
            t.inst_type_name AS Topic,
            COALESCE(au.full_name, u.full_name, 'Unknown') AS InquiredBy,
            i.datetime AS Date,
            CASE 
                WHEN i.completed = true THEN 'Completed'
                WHEN i.completed_by IS NOT NULL THEN 'In Progress'
                ELSE 'Pending'
            END AS Outcome,
            i.client_id AS ClientId,
            i.instruction AS Description,
            COALESCE(public.try_get_json_value(i.remarks, 'priority'), 'Normal') AS Priority,
            i.completed_on AS ResolvedDate
        FROM digital.instructions i
        LEFT JOIN internal.support_users u ON i.client_auth_user_id = u.id
        LEFT JOIN admin.users au ON i.insert_user = au.id
        LEFT JOIN digital.inst_types t ON i.inst_type_id = t.id
        WHERE i.client_id = @ClientId AND i.inst_type_id = ANY(@InquiryTypeIds)
        ORDER BY i.datetime DESC;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.QueryAsync<InquiryViewModel>(sql, new { ClientId = clientId, InquiryTypeIds = inquiryTypeIds });
            }
        }

        public async Task<IEnumerable<ClientUser>> GetAllClientsAsync()
        {
            var sql = @"
        SELECT DISTINCT ON (client_id)
            client_id,
            full_name,
            user_name
        FROM internal.support_users
        ORDER BY client_id, full_name;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.QueryAsync<ClientUser>(sql);
            }
        }

        public async Task<IEnumerable<TicketViewModel>> GetAllTicketsAsync()
        {
            var ticketTypeIds = Enumerable.Range(110, 8).ToArray();
            var sql = @"
        SELECT 
            i.id AS Id,
            i.instruction AS Subject,
            i.datetime AS Date,
            u.full_name AS CreatedBy,
            res.full_name AS ResolvedBy,
            CASE WHEN i.completed = true THEN 'Resolved' ELSE 'Open' END AS Status,
            COALESCE(public.try_get_json_value(i.remarks, 'priority'), 'Normal') AS Priority,
            (SELECT DISTINCT c.full_name FROM internal.support_users c WHERE c.client_id = i.client_id LIMIT 1) AS ClientName
        FROM digital.instructions i
        LEFT JOIN internal.support_users u ON i.client_auth_user_id = u.id
        LEFT JOIN admin.users res ON i.completed_by = res.id
        WHERE i.inst_type_id = ANY(@TicketTypeIds)
        ORDER BY i.datetime DESC;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.QueryAsync<TicketViewModel>(sql, new { TicketTypeIds = ticketTypeIds });
            }
        }

        public async Task<IEnumerable<InquiryViewModel>> GetAllInquiriesAsync()
        {
            var inquiryTypeIds = new[] { 121, 122 };
            var sql = @"
        SELECT
            i.id AS Id,
            t.inst_type_name AS Topic,
            COALESCE(au.full_name, u.full_name, 'Unknown') AS InquiredBy,
            i.datetime AS Date,
            CASE 
                WHEN i.completed = true THEN 'Completed'
                WHEN i.completed_by IS NOT NULL THEN 'In Progress'
                ELSE 'Pending'
            END AS Outcome,
            (SELECT DISTINCT c.full_name FROM internal.support_users c WHERE c.client_id = i.client_id LIMIT 1) AS ClientName,
            i.client_id AS ClientId,
            i.instruction AS Description,
            COALESCE(public.try_get_json_value(i.remarks, 'priority'), 'Normal') AS Priority,
            i.completed_on AS ResolvedDate
        FROM digital.instructions i
        LEFT JOIN internal.support_users u ON i.client_auth_user_id = u.id
        LEFT JOIN admin.users au ON i.insert_user = au.id
        LEFT JOIN digital.inst_types t ON i.inst_type_id = t.id
        WHERE i.inst_type_id = ANY(@InquiryTypeIds)
        ORDER BY i.datetime DESC;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.QueryAsync<InquiryViewModel>(sql, new { InquiryTypeIds = inquiryTypeIds });
            }
        }

        public async Task<DashboardStatsViewModel> GetDashboardStatsAsync()
        {
            var sql = @"
        SELECT 
            COUNT(*) FILTER (WHERE i.inst_category_id = 101) AS TotalTickets,
            COUNT(*) FILTER (WHERE i.inst_category_id = 101 AND i.completed = false) AS OpenTickets,
            COUNT(*) FILTER (WHERE i.inst_category_id = 101 AND i.completed = true) AS ResolvedTickets,
            COUNT(*) FILTER (WHERE i.inst_category_id = 102) AS TotalInquiries
        FROM digital.instructions i;";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.QueryFirstOrDefaultAsync<DashboardStatsViewModel>(sql);
            }
        }

        public async Task<InquiryViewModel?> GetInquiryByIdAsync(long inquiryId)
        {
            var inquiryTypeIds = new[] { 121, 122 };
            var sql = @"
        SELECT
            i.id AS Id,
            t.inst_type_name AS Topic,
            COALESCE(au.full_name, u.full_name, 'Unknown') AS InquiredBy,
            i.datetime AS Date,
            CASE 
                WHEN i.completed = true THEN 'Completed'
                WHEN i.completed_by IS NOT NULL THEN 'In Progress'
                ELSE 'Pending'
            END AS Outcome,
            (SELECT DISTINCT c.full_name FROM internal.support_users c WHERE c.client_id = i.client_id LIMIT 1) AS ClientName,
            i.client_id AS ClientId,
            i.instruction AS Description,
            COALESCE(public.try_get_json_value(i.remarks, 'priority'), 'Normal') AS Priority,
            i.completed_on AS ResolvedDate
        FROM digital.instructions i
        LEFT JOIN internal.support_users u ON i.client_auth_user_id = u.id
        LEFT JOIN admin.users au ON i.insert_user = au.id
        LEFT JOIN digital.inst_types t ON i.inst_type_id = t.id
        WHERE i.id = @InquiryId AND i.inst_type_id = ANY(@InquiryTypeIds);";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                return await connection.QueryFirstOrDefaultAsync<InquiryViewModel>(sql, new { InquiryId = inquiryId, InquiryTypeIds = inquiryTypeIds });
            }
        }

        public async Task<bool> UpdateInquiryOutcomeAsync(long inquiryId, string outcome)
        {
            var sql = @"
        UPDATE digital.instructions 
        SET 
            completed = CASE WHEN @Outcome = 'Completed' THEN true ELSE false END,
            completed_on = CASE WHEN @Outcome = 'Completed' THEN CURRENT_TIMESTAMP ELSE completed_on END,
            completed_by = CASE WHEN @Outcome = 'Completed' THEN 1 ELSE completed_by END,
            edit_date = CURRENT_TIMESTAMP,
            edit_user = 1
        WHERE id = @InquiryId AND inst_type_id IN (121, 122);";

            using (var connection = new NpgsqlConnection(_connectionString))
            {
                var rowsAffected = await connection.ExecuteAsync(sql, new { InquiryId = inquiryId, Outcome = outcome });
                return rowsAffected > 0;
            }
        }
    }
}