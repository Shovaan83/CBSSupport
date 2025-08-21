using CBSSupport.Shared.Models;
using CBSSupport.Shared.ViewModels;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace CBSSupport.Shared.Services
{
    public interface IChatService
    {
        Task<IEnumerable<ChatMessage>> GetInstructionTicketsForUserAsync(long clientAuthUserId);

        Task<IEnumerable<ChatMessage>> GetConversationsByInstTypeAsync(short instTypeId);

        Task<ChatMessage> CreateInstructionTicketAsync(ChatMessage newTicket);

        Task<ChatMessage> GetInstructionByIdAsync(long instructionId);

        Task<IEnumerable<ChatMessage>> GetMessagesByConversationIdAsync(long conversationId);

        Task<SidebarViewModel> GetSidebarForUserAsync(long clientAuthUserId, long clientId);

        Task<IEnumerable<TicketViewModel>> GetTicketsByClientIdAsync(long clientId);

        Task<IEnumerable<InquiryViewModel>> GetInquiriesByClientIdAsync(long clientId);

        Task<IEnumerable<ClientUser>> GetAllClientsAsync();

        Task<IEnumerable<TicketViewModel>> GetAllTicketsAsync();

        Task<IEnumerable<InquiryViewModel>> GetAllInquiriesAsync();

        Task<DashboardStatsViewModel> GetDashboardStatsAsync();

        Task<ChatMessage> CreateGroupChatMessageAsync(ChatMessage newMessage);

        Task<long> GetOrCreateGroupChatConversationIdAsync(long clientId, int loggedInUserId);

        Task<bool> UpdateInstructionAsync(ChatMessage instruction);
    }
}