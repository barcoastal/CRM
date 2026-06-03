public inherited sharing class ClientWrapper {

    public Id recordId { get; set; }
    public String firstName { get; set; }
    public String lastName { get; set; }
    public String companyName { get; set; }
    public String ssn { get; set; }
    public String taxId { get; set; }
    public Date dob { get; set; }
    public String email { get; set; }
    public String phone { get; set; }
    public String address { get; set; }
    public String city { get; set; }
    public String state { get; set; }
    public String postalCode { get; set; }
    public String country { get; set; }
    public String totalDebt { get; set; }
    public String invoiceNumber { get; set; }
    public Date programStartDate { get; set; }
    public Date programEndDate { get; set; }
    public Blob contractDetails { get; set; }
    public String accountStatus { get; set; }
    public String accountHoldStatus { get; set; }
    public String affiliateId { get; set; }
    public String feeSplitGroupId { get; set; }
    public String accountType { get; set; }
    public String clientNumber { get; set; }
    public String externalRAMId { get; set; }
    public String externalSASId { get; set; }

    public ClientWrapper(Account acctInstance, Contact contInstance, Blob contractData) {
        if (acctInstance != null) {
            this.recordId = acctInstance.Id;
            if (contInstance != null) {
                this.firstName = contInstance.FirstName;
                this.lastName = contInstance.LastName;
                this.dob = contInstance.BirthDate;
                this.email = contInstance.Email;
                this.phone = contInstance.Phone;
                //this.ssn = contInstance.SSN__c;
                this.ssn = contInstance.SSN__c;
            }
            this.companyName = acctInstance.Name;
            this.address = acctInstance.BillingStreet;
            this.city = acctInstance.BillingCity;
            this.state = StateCodeUtil.getUSStateAbbreviation(acctInstance.BillingState);
            this.postalCode = acctInstance.BillingPostalCode;
            this.country = acctInstance.BillingCountry;
            this.totalDebt = String.valueOf(acctInstance.Total_Debt__c);
            this.invoiceNumber = acctInstance.Client_Number__c;
            this.programStartDate = acctInstance.Program_Start_Date__c;
            this.programEndDate = acctInstance.Program_End_Date__c;
            this.contractDetails = contractData;
            this.accountHoldStatus = 'ACTIVE';
            this.accountType = acctInstance.Bank_Account_Type__c;
            this.accountStatus = String.isNotBlank(acctInstance.External_RAM_Id__c) ? acctInstance.Status__c : 'Active';
            this.clientNumber = acctInstance.Client_Number__c;
            this.externalRAMId = acctInstance.External_RAM_Id__c;
            this.externalSASId = acctInstance.External_SAS_Id__c;
            this.taxId = acctInstance.EIN_Number_Tax_Id__c;
        }
    }

    public static Set<Schema.SObjectField> accountFields = new Set<Schema.SObjectField> {
        Account.Name, Account.Phone, Account.BillingStreet, Account.BillingCity,
        Account.BillingState, Account.BillingPostalCode, Account.BillingCountry, Account.Total_Debt__c,
        Account.Client_Number__c, Account.Program_Start_Date__c, Account.Program_End_Date__c, Account.Status__c
    };

    public static Set<Schema.SObjectField> contactFields = new Set<Schema.SObjectField> {
        Contact.FirstName, Contact.LastName, Contact.BirthDate, Contact.Email, Contact.Phone, Contact.SSN_Encrypted__c, Contact.SSN__c
    };

    public static Set<Schema.SObjectField> payeeFields = new Set<Schema.SObjectField> {
        Account.Name, Account.SSN__c, Account.BillingStreet, Account.BillingCity,
        Account.BillingState, Account.BillingPostalCode, Account.BillingCountry, Account.EIN_Number_Tax_Id__c
    };

    public static Set<Schema.SObjectField> payeeContactFields = new Set<Schema.SObjectField> {
        Contact.FirstName, Contact.LastName, Contact.Email, Contact.Phone
    };

    //Required Parameters List
    public static Map<String, String> fieldNameLabelMap = new Map<String, String> {
        'recordId' => 'Account Id',
        'firstName' => 'First Name',
        'lastName' => 'Last Name',
        'ssn' => 'SSN',
        'dob' => 'Date Of Birth',
        'email' => 'Email',
        'phone' => 'Phone',
        'address' => 'Address',
        'city' => 'City',
        'state' => 'State',
        'postalCode' => 'Postal Code',
        'country' => 'Country',
        'totalDebt' => 'Total Debt',
        'invoiceNumber' => 'Client Number',
        'programStartDate' => 'Program Start Date',
        'programEndDate' => 'Program End Date',
        'contractDetails' => 'Contract Details',
        'affiliateId' => 'Affiliate Id',
        'feeSplitGroupId' => 'Fee Split Group Id',
        'clientNumber' => 'Client Number',
        'accountStatus' => 'Status',
        'externalRAMId' => 'External RAM Id'
    };
}