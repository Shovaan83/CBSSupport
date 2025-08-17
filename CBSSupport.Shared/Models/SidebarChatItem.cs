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
        public string ConversationId { get; set; } 
        public string DisplayName { get; set; }   
        public string Subtitle { get; set; }      
        public string AvatarInitials { get; set; }
        public string AvatarClass { get; set; }    

        public string Route { get; set; }
    }
}
