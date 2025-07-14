using Microsoft.AspNetCore.SignalR;
using CBSSupport.Shared.Services; // Your service interface
using CBSSupport.Shared.Models;   // Your model
using System.Threading.Tasks;

namespace CBSSupport.API.Hubs
{
    public class ChatHub : Hub
    {
        private readonly IChatService _chatService;

        public ChatHub(IChatService chatService)
        {
            _chatService = chatService;
        }

        // Called from JS when the client connects
        public async Task GetMyConversations()
        {
            // TODO: Get the real user ID after implementing authentication
            long mockClientAuthUserId = 1;

            var tickets = await _chatService.GetInstructionTicketsForUserAsync(mockClientAuthUserId);
            // Send the list only to the caller
            await Clients.Caller.SendAsync("ReceiveConversationList", tickets);
        }

        // Called from JS when user clicks "Start New Chat"
        public async Task CreateTicket(string subject)
        {
            // TODO: Get real user/client IDs
            long mockClientAuthUserId = 1;
            int mockInsertUser = 1;

            var newTicket = new ChatMessage
            {
                DateTime = DateTime.UtcNow,
                InstCategoryId = 1, // 'Client Chat'
                InstTypeId = 1, // 'Support Chat'
                Instruction = subject,
                Status = true, // Open
                ClientAuthUserId = mockClientAuthUserId,
                InsertUser = mockInsertUser,
                InstChannel = "WebApp"
            };

            long newId = await _chatService.CreateInstructionTicketAsync(newTicket);
            newTicket.Id = newId;

            // Send the newly created ticket back to the caller so they can open it
            await Clients.Caller.SendAsync("NewTicketCreated", newTicket);
        }
    }
}