/** Test Class: AccountDataTest */
/**
 * @Description: Class to retrieve the account records.
 */
public inherited sharing class AccountData {

    /**
     * @description: Method to query the acccount record based on account Id and the Sync Status as Sync pending
     * @param acctId - Salesforce account Id
     * @return List<Account> - returns the account record in a list
     */
    public static List<Account> queryAccountWithUnSyncedStatus(Id acctId) {
        return [SELECT Id, Name, FirstName, LastName, SSN__c, PersonEmail, PersonBirthdate, 
            Phone, PersonMailingStreet, PersonMailingCity, PersonMailingState, PersonMailingStateCode, 
            PersonMailingPostalCode, PersonMailingCountry, BillingStreet, BillingCity, BillingState, Fee_Paid_In_Full__c, 
            BillingPostalCode, BillingCountry, External_SAS_Id__c, Sync_Status__c, Bank_Account_Sync_Status__c, Contract_Sync_Status__c,
            Total_Debt__c, Program_Start_Date__c, Program_End_Date__c,Escrow_Balance__c,Escrow_Balance_Pulled_Date_Time__c,
            Client_Number__c, Bank_Account_Number__c, Bank_Routing_Number__c, Bank_Name__c, Bank_Account_Type__c, Primary_Contact__r.Name,
            Status__c, Client_Status__c, Sub_Disposition__c, External_RAM_Id__c, OwnerId FROM Account 
            WHERE Id = :acctId
        ];
    }

    /**
     * @description: Method to query the acccount record based on account Id.
     * @param acctId - Salesforce account Id
     * @return List<Account> - returns the account record in a list
     */
    public static List<Account> queryAccount(Id acctId) {
        return [SELECT Id, Name, FirstName, LastName, SSN__c, EIN_Number_Tax_Id__c, PersonEmail, PersonBirthdate,First_Payment_Completed_Date__c,
            Phone, PersonMailingStreet, PersonMailingCity, PersonMailingState, PersonMailingStateCode, Qualified_Financial__c, Net_Profit__c ,
            PersonMailingPostalCode, PersonMailingCountry, BillingStreet, BillingCity, BillingState, HIGH_UCC_RISK__c,
            BillingPostalCode, BillingCountry, External_SAS_Id__c, Sync_Status__c, Bank_Account_Sync_Status__c, Contract_Sync_Status__c,
            Total_Debt__c, Program_Start_Date__c, Program_End_Date__c,Primary_Contact__c,First_Draft_Date__c,Actual_Program_Term__c, Actual_Weekly_Payment__c,
            Client_Number__c, Bank_Account_Number__c, Bank_Routing_Number__c, Bank_Name__c, Bank_Account_Type__c, Primary_Contact__r.Name,
            Status__c, Client_Status__c, Sub_Disposition__c, External_RAM_Id__c, RecordType.DeveloperName FROM Account 
            WHERE Id = :acctId
        ];
    }

    /**
     * @description: Method to query the acccount record based on account Id set.
     * @param acctIdSet - Salesforce account Id set
     * @return List<Account> - returns the list of accounts
     */
    public static List<Account> queryAccounts(Set<Id> acctIdSet) {
        return [
            SELECT Id, Name, FirstName, LastName, SSN__c, EIN_Number_Tax_Id__c, PersonEmail, PersonBirthdate, First_Payment_Completed_Date__c,
            Phone, PersonMailingStreet, PersonMailingCity, PersonMailingState, PersonMailingStateCode,
            PersonMailingPostalCode, PersonMailingCountry, BillingStreet, BillingCity, BillingState,First_Draft_Date__c,
            BillingPostalCode, BillingCountry, Total_Debt__c, Program_Start_Date__c, Program_End_Date__c,
            Client_Number__c, Bank_Account_Number__c, Bank_Routing_Number__c, Bank_Name__c, Bank_Account_Type__c, Primary_Contact__r.Name,
            Status__c, Client_Status__c, Sub_Disposition__c, External_RAM_Id__c, External_SAS_Id__c, Current_Balance__c, Fee_Paid_In_Full__c,  
            PersonHomePhone, IsPersonAccount, PersonOtherPhone,   RecordTypeId, Lead_Number__c,Closer__c,Legal_Status__c ,NegotiationStatus__c,
            Primary_Contact__r.Email, Primary_Contact__r.Phone, Legal_Network__c
            FROM Account WHERE Id IN :acctIdSet
        ];
    }

    public static List<Account> queryAccountsPhoneNumbers(Id accountId) {
        return [SELECT Id, Phone, PersonMobilePhone, Work_Phone__c FROM Account WHERE Id = :accountId];
    }
    /**
     * @description: method to query the account record with the Id and list of account fields.
     * @param1: Id accountId - Id of the account record to be queried
     * @param2: Set<String> fields - the collection of the account fields to be queried
     * @returnType: List<Account>
    */
    public static List<Account> queryAccount(Id accountId, Set<String> fields) {
        List<String> fieldsList = new List<String>(fields);
        String fieldString = String.join(fieldsList, ', ');
        String query = 'SELECT ' + fieldString + ' FROM Account WHERE Id = :accountId';
        return Database.query(query);
    }

    public static List<Account> queryBankAccountDetails(Id acctId) {
        return [SELECT Id, Bank_Account_Number__c, Bank_Routing_Number__c, Bank_Name__c, Bank_Account_Type__c, Primary_Contact__r.Name, External_RAM_Id__c FROM Account WHERE Id = :acctId];
    }

    public static Map<Id, Account> queryAccountBasedOnIds(Set<Id> accountIds) {
        return new Map<Id,Account>([SELECT Id, Primary_Contact__c, Primary_Contact__r.Email,Sub_Disposition__c
                FROM Account
                WHERE Id IN :accountIds]);
    }

    public static List<Account> queryAccountsWithSamePhone(Set<String> phoneToLeadMap){
        return  [SELECT Id , Name ,phone FROM Account WHERE Phone IN : phoneToLeadMap AND RecordType.DeveloperName =: AccountUtil.RT_BUSINESS_ACCOUNT];
    }

    public static List<Account> queryAccountsWithSamePhone(Set<String> phoneToLeadMap,List<Account> processedAccounts){
        return  [SELECT Id , Name ,phone FROM Account WHERE Phone IN : phoneToLeadMap AND Id NOT IN: processedAccounts ];
    }

    public static List<Account> queryAccountsWithoutIndividualReference(Set<String> phoneNumberSet) {
        return [SELECT Id, Name, Phone, Formatted_Phone__c, Individual__c FROM Account 
            WHERE Formatted_Phone__c IN : phoneNumberSet 
            AND RecordType.DeveloperName =: AccountUtil.RT_BUSINESS_ACCOUNT 
            AND Individual__c = null
        ];
    } 
    
    public static List<Account> queryAccountRelatedToContact(Id contId) {
        return [SELECT Id, Name FROM Account WHERE Primary_Contact__c != null AND Primary_Contact__c =:contId];
    }
    
    public static List<Account> getActiveOppOfAccounts(Set<Id> accountIds){
      return [SELECT Id ,(SELECT Id, RecordTypeId FROM Opportunities WHERE StageName IN :OpportunityUtil.WORKING_STAGES
                                                                    ORDER BY CreatedDate DESC
                                                                    LIMIT 1) FROM Account WHERE Id IN :accountIds];
    }
    
    public static List<Opportunity> getActiveOppOfAccount(Id accId){
        return [SELECT id,recordTypeId FROM Opportunity WHERE 
                AccountId = :accId AND Version_Status__c = 'Active' ORDER BY CreatedDate DESC ];
    }
    
    public static Map<Id, Account> getAccountsWithOwner(Set<Id> accountIds) {
        return new Map<Id, Account>([
            SELECT Id, OwnerId, Primary_Contact__c, External_SAS_Id__c, External_RAM_Id__c, Name, Program_Completion_Stage__c
            FROM Account
            WHERE Id IN :accountIds
        ]);
    }
    
    public static Account queryAccountWithId(Id accId){
        return [SELECT Id, external_SAS_Id__c FROM Account WHERE Id = :accId LIMIT 1];
    }

    public static Map<Id, Account> getActiveAccounts(Set<Id> accountIds) {
        return new Map<Id, Account>([
            SELECT Id, OwnerId, Primary_Contact__c, External_SAS_Id__c, External_RAM_Id__c, Name, Program_Completion_Stage__c
            FROM Account
            WHERE Id IN :accountIds AND Client_Status__c != 'Cancelled'
        ]);
    }
    
    public static Map<Id,Account> getAccountsWithCreditorsId(Set<Id> creditorIds){
        return new Map<Id, Account>(
            [SELECT Id, Creditor_Category__c FROM Account WHERE Id IN :creditorIds]
        );
    }
}