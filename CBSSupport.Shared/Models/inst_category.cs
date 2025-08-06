using System;
using System.ComponentModel.DataAnnotations;

namespace CBS_DOL.DbEntities.digital;

public class inst_category 
{
    public long id { get; set; }

    public int? rec_count;

    public int? row_no { get; set; }

    [Display(Name = "Inst Category Name: *")]
    [Required(ErrorMessage = "Please enter valid name")]
    public string inst_category_name { get; set; }

    [Display(Name = "Inst Category Locale: *")]
    [Required(ErrorMessage = "Please enter locale name in nepali")]
    public string inst_category_locale { get; set; }
    public string description { get; set; }
    public bool status { get; set; }
    public string remarks { get; set; }

}
