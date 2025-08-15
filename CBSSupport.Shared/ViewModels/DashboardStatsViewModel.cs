using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CBSSupport.Shared.ViewModels
{
 public class DashboardStatsViewModel
    {
        public int TotalTickets { get; set; }
        public int OpenTickets { get; set; }
        public int ResolvedTickets { get; set; }
        public int TotalInquiries { get; set; }
    }
}
