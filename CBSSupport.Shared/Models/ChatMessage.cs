// Located in CBSSupport.Shared/Models/ChatMessage.cs
using System.ComponentModel.DataAnnotations;

namespace CBSSupport.Shared.Models
{
    public class ChatMessage
    {
        // Properties set by the database or server-side logic
        public long Id { get; set; }
        public DateTime DateTime { get; set; }
        public short InstTypeId { get; set; }
        public bool Status { get; set; }
        public DateTime InsertDate { get; set; }
        public string? InstChannel { get; set; }
        public string? IpAddress { get; set; }

        // --- Properties likely sent from the client ---

        [Required(ErrorMessage = "Instruction text cannot be empty.")]
        [StringLength(4000, MinimumLength = 1, ErrorMessage = "Instruction must be between 1 and 4000 characters.")]
        public string? Instruction { get; set; }
        public int? UserId { get; set; }
        public long? ClientId { get; set; }
        public long? ClientUserId { get; set; }
        public long? ClientAuthUserId { get; set; }

        [Required(ErrorMessage = "The ID of the user creating the record is required.")]
        [Range(1, int.MaxValue, ErrorMessage = "InsertUser must be a valid user ID.")]
        public int InsertUser { get; set; }
        public long? IntroId { get; set; }
        public long? IdenId { get; set; }
        public long? AccountId { get; set; }
        public long? DemandId { get; set; }
        public short InstCategoryId { get; set; } 
        public DateTime? AlertDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public long? InstructionId { get; set; }
        public int? AssignedTo { get; set; }
        public bool? Completed { get; set; }
        public int? CompletedBy { get; set; }
        public DateTime? CompletedOn { get; set; }
        public string? CompletedRemarks { get; set; }
        public string? Remarks { get; set; }
        public int? EditUser { get; set; }
        public DateTime? EditDate { get; set; }
        public long? ServiceId { get; set; }
        public string? AttachmentId { get; set; }
        public string? GeoLocation { get; set; }
    }
}