using System;
using System.ComponentModel.DataAnnotations;

namespace CBS_DOL.DbEntities.digital;

public class inst_types 
{
    public int? rec_count;
    public int? row_no { get; set; }

    public long id { get; set; }
    public long inst_category_id { get; set; }

    [Display(Name = "Inst Type Name: *")]
    public string inst_type_name { get; set; }

    [Display(Name = "Inst Type Locale: *")]
    public string inst_type_locale { get; set; }

    [Display(Name = "Description: *")]
    public string descripion { get; set; }
    public bool status { get; set; }
    public string remarks { get; set; }

    public string? inst_category_name { get; set; }
 
}
