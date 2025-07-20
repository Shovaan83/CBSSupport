using Microsoft.AspNetCore.SignalR;
using System;
using System.Threading.Tasks;

namespace CBSSupport.API.Hubs
{
    public class ChatHub : Hub
    {
        // A "room" is just a SignalR group.
        public async Task JoinConversationRoom(string conversationId)
        {
            // The group name is unique to the conversation.
            await Groups.AddToGroupAsync(Context.ConnectionId, $"conversation-{conversationId}");

            // Optional: notify others in the group that a user has joined.
            var user = "System"; 
            var message = $"{user} has joined the chat.";
            await Clients.Group($"conversation-{conversationId}").SendAsync("ReceiveMessage", user, message, DateTime.UtcNow);
        }

        // When a client sends a message.
        public async Task SendMessage(string conversationId, string user, string message)
        {
            await Clients.OthersInGroup($"conversation-{conversationId}").SendAsync("ReceiveMessage", conversationId, user, message, DateTime.UtcNow);
        }

        public async Task UserIsTyping(string conversationId, string user)
        {
            // Send to everyone ELSE in the group.
            await Clients.OthersInGroup($"conversation-{conversationId}").SendAsync("DisplayTypingIndicator", user);
        }

        public async Task UserStoppedTyping(string conversationId)
        {
            await Clients.OthersInGroup($"conversation-{conversationId}").SendAsync("HideTypingIndicator");
        }
    }
}