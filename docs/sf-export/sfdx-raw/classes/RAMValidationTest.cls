@IsTest
private class RAMValidationTest {
    
    @IsTest
    static void testClientValidation(){
        
        Account acctInstance = new Account();
        acctInstance.Name = 'John Tech LLC';
        acctInstance.SSN__c = '123456789';
        acctInstance.Phone = '123-456-7890';
        acctInstance.Lead_Number__c = '12345';
        acctInstance.Program_Start_Date__c = Date.today();
        acctInstance.Program_End_Date__c = Date.today().addDays(30);
        acctInstance.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'Business_Account');
        insert acctInstance;

        Contact contInstance = new Contact();
        contInstance.FirstName = 'Jane';
        contInstance.LastName = 'Smith';
        contInstance.Email = 'jane.smith@example.com';
        contInstance.MailingStreet = '456 Elm St';
        contInstance.MailingCity = 'Los Angeles';
        contInstance.MailingCountry = 'United States';
        contInstance.MailingState = 'California';
        contInstance.MailingPostalCode = '90001';
        contInstance.Lead_Number__c = '12345';
        contInstance.AccountId = acctInstance.Id;
        insert contInstance;

        ClientWrapper clientWrap = new ClientWrapper(acctInstance, contInstance, null);

        Test.startTest();
        String errorMessage = RAMValidation.clientValidation(clientWrap, RAMWrapper.createClientRequiredField);
        Assert.areEqual(true, errorMessage.contains('Client Sync => The following fields should not be blank: '), 'Expected validation message is not matching.');
        Test.stopTest();
    }
    
    @IsTest
    static void testBankAccountValidation(){
        
        Account acctInstance = new Account();
        acctInstance.Name = 'John Tech LLC';
        acctInstance.SSN__c = '123456789';
        acctInstance.Phone = '123-456-7890';
        acctInstance.Lead_Number__c = '12345';
        acctInstance.Program_Start_Date__c = Date.today();
        acctInstance.Program_End_Date__c = Date.today().addDays(30);
        acctInstance.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'Business_Account');
        acctInstance.Bank_Account_Number__c = null;
        acctInstance.Bank_Routing_Number__c = null;
        acctInstance.Bank_Account_Type__c = null;
        acctInstance.Bank_Name__c = null;
        acctInstance.External_RAM_Id__c = '123123123';
        
        insert acctInstance;

        BankAccountWrapper bankAccountWrap = new BankAccountWrapper(acctInstance, 'RAM');

        Test.startTest();
        String errorMessage = RAMValidation.bankAccountValidation(bankAccountWrap, RAMWrapper.bankAccountRequiredField);
        Assert.areEqual(true, errorMessage.contains('Bank Account Sync => The following fields should not be blank: '), 'Expected validation message is not matching.');
        Test.stopTest();
    }
    
}