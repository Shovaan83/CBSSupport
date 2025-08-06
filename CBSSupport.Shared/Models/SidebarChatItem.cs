using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CBSSupport.Shared.Models
{
    public class SidebarChatItem
    {
        public string ConversationId { get; set; } // The instruction_id that groups the messages.
        public string DisplayName { get; set; }    // e.g., "Ticket #12345" or "John Doe"
        public string Subtitle { get; set; }       // e.g., "Status: Open" or the last message text.
        public string AvatarInitials { get; set; }
        public string AvatarClass { get; set; }    // e.g., "avatar-bg-red"

        public string Route { get; set; }
    }
}
