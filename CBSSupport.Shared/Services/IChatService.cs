using CBSSupport.Shared.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace CBSSupport.Shared.Services
{
    public interface IChatService
    {
        Task<IEnumerable<ChatMessage>> GetInstructionTicketsForUserAsync(long clientAuthUserId);
        Task<long> CreateInstructionTicketAsync(ChatMessage newTicket);
    }
}