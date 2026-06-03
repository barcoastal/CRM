public inherited sharing class BankAccountWrapper {

    public Id recordId { get; set; }
    public String clientProcessorId { get; set; }
    public String payeeProcessorId { get; set; }
    public String paymentType { get; set; }
    public String bankAccountNumber { get; set; }
    public String routingNumber { get; set; }
    public String nameOnAccount { get; set; }
    public String bankAccountType { get; set; }
    public String bankName { get; set; }
    public String clientNumber { get; set; }

    public BankAccountWrapper() {
        
    }
    
    public BankAccountWrapper(Account acctInstance, String processorType) {
        if (acctInstance != null) {
            this.recordId = acctInstance.Id;
            this.clientProcessorId = (String)acctInstance.get('External_' + processorType + '_Id__c');
            //this.payeeProcessorId = acctInstance.LastName;
            this.paymentType = 'ACH';
            this.bankAccountNumber = acctInstance.Bank_Account_Number__c;
            this.routingNumber = acctInstance.Bank_Routing_Number__c;
            if (acctInstance.Primary_Contact__c != null && String.isNotBlank(acctInstance.Primary_Contact__r.Name)) {
                this.nameOnAccount = acctInstance.Primary_Contact__r.Name;
            }
            this.bankAccountType = acctInstance.Bank_Account_Type__c;
            this.bankName = acctInstance.Bank_Name__c;
            this.clientNumber = acctInstance.Client_Number__c;
        }
    }

    public static Set<Schema.SObjectField> bankAccountFields = new Set<Schema.SObjectField> {
        Account.Bank_Account_Number__c, Account.Bank_Routing_Number__c, Account.Bank_Account_Type__c,
        Account.Bank_Name__c
    };

    public static Set<Schema.SObjectField> bankAccountContactFields = new Set<Schema.SObjectField> {
        Contact.FirstName, Contact.LastName
    };

    //Required Parameters List
    public static Map<String, String> fieldNameLabelMap = new Map<String, String> {
        'recordId' => 'Account Id',
        'bankAccountNumber' => 'Bank Account Number',
        'routingNumber' => 'Routing Number',
        'nameOnAccount' => 'Primary Contact Name', 
        'bankAccountType' => 'Bank Account Type',
        'bankName' => 'Bank Name'
    };
}