public inherited sharing virtual class CitadelWrapper {
    
    public String clientsFirstName { get; set; }
    public String clientsLastName { get; set; }
    public String businessName { get; set; }
    public String phonenumber { get; set; }
    public String emailaddress { get; set; }
    /** Related to CRM-2449 commented this line
    public String firstPaymentDate { get; set; } */
    public String streetAddress { get; set; }
    public String city { get; set; }
    public String state { get; set; }
    public String zip { get; set; }
    public String fileName {get; set;}
    public String content {get; set;}
    public String description {get; set;}
    public String employerName {get; set;}
    public String employerStreetAddress {get; set;}
    public String employerCity {get; set;}
    public String employerState {get; set;}
    public String employerZip {get; set;}

    public CitadelWrapper (Account acctInstance, Contact contInstance, ContentVersion contVersion) { 
        this.clientsFirstName=contInstance.FirstName;
        this.clientsLastName=contInstance.LastName;
        this.businessName = acctInstance.Name;
        this.phonenumber = contInstance.Phone != null ? contInstance.Phone : '';
        this.emailaddress = contInstance.Email != null ? contInstance.Email : '';
        //this.firstPaymentDate = acctInstance.Program_Start_Date__c != null ? acctInstance.Program_Start_Date__c.format(): '';
        this.streetAddress = String.isNotBlank(acctInstance.BillingStreet) ? acctInstance.BillingStreet : '';
        this.city = String.isNotBlank(acctInstance.BillingCity) ? acctInstance.BillingCity : '';
        this.state = String.isNotBlank(acctInstance.BillingState) ? StateCodeUtil.getUSStateAbbreviation(acctInstance.BillingState) : '';
        this.zip = String.isNotBlank(acctInstance.BillingPostalCode) ? acctInstance.BillingPostalCode : ''; 
        this.fileName = contVersion.Title;
        this.content = EncodingUtil.base64Encode(contVersion.VersionData); 
        this.description = 'Citadel Contract';
        this.employerName = acctInstance.Name;
        this.employerStreetAddress = String.isNotBlank(acctInstance.BillingStreet) ? acctInstance.BillingStreet : '';
        this.employerCity = String.isNotBlank(acctInstance.BillingCity) ? acctInstance.BillingCity : '';
        this.employerState = String.isNotBlank(acctInstance.BillingState) ? StateCodeUtil.getUSStateAbbreviation(acctInstance.BillingState) : '';
        this.employerZip = String.isNotBlank(acctInstance.BillingPostalCode) ? acctInstance.BillingPostalCode : '';
    }
 
    public static Map<String, String> createClientMap = new Map<String, String> {
        'clientsFirstName' => 'Clients_First_Name',
        'clientsLastName' => 'Clients_Last_Name',
        'businessName' => 'Business_Name',
        'phonenumber'=> 'Phone_Number',
        'emailaddress'=> 'Email_Address',
        //'firstPaymentDate' => 'First_Payment_Date',
        'streetAddress' => 'Street_Address',
        'city' => 'City', 
        'state' => 'State',
        'zip' => 'Zip',
        'content' =>  'doc1_data', 
        'fileName' => 'doc1_name',
        'description' => 'doc1_desc',
        'employerName' => 'Employer_Name',
        'employerStreetAddress' => 'Street_Address',
        'employerCity' => 'City', 
        'employerState' => 'State',
        'employerZip' => 'Zip' 
    };
}