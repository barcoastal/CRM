public inherited sharing virtual class MCALenderWrapper {
    
    public String firstName { get; set; }
    public String lastName { get; set; }
    public String companyName { get; set; }
    public String phone { get; set; }
    public String email { get; set; }
    public String address { get; set; }
    public String leadId{ get; set; }

    public MCALenderWrapper (Lead leadRec) { 
        this.firstName = leadRec.FirstName;
        this.lastName = leadRec.LastName;
        this.companyName = leadRec.Company != null ? leadRec.Company : '';
        this.phone = leadRec.Phone != null ? leadRec.Phone : '';
        this.email = leadRec.Email != null ? leadRec.Email : '';
        String leadAddress = leadRec.Street != null ? leadRec.Street + ',' : '';
        leadAddress += leadRec.city != null ? leadRec.city + ',' : '';
        leadAddress += leadRec.State != null ? leadRec.State + ',' : '';
        leadAddress += leadRec.PostalCode != null ? leadRec.PostalCode + ',' : '';
        this.address = leadAddress != null ? leadAddress : '';  
        this.leadId = leadRec.Lead_Id__c;
    }
 
    public static Map<String, String> createMCALenderMap= new Map<String, String> {
        'firstName' => 'FirstName',
        'lastName' => 'LastName',
        'companyName' => 'Company_Name',
        'phone'=> 'Phone',
        'email'=> 'Email',
        'address' => 'Address',
        'leadId' => 'Lead_Id'
    };
}