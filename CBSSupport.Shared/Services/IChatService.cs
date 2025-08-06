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
    }
}
