using System;

namespace CBSSupport.Shared.ViewModels
{
    public class InquiryViewModel
    {
        public long Id { get; set; }
        public string Topic { get; set; }
        public string InquiredBy { get; set; }
        public DateTime Date { get; set; }
        public string Outcome { get; set; }
        public string ClientName { get; set; }

    }
}