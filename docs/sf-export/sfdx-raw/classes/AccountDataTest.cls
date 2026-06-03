@isTest
private class AccountDataTest {
    
    @TestSetup
    static void makeData() {
        
        Contact con = DataFactoryTest.createContact();
        insert con;

        List<Account> accountList = new List<Account> {
            new Account(FirstName = 'John', LastName = 'Doe', PersonEmail = 'john.doe@example.com', PersonMailingStreet = '123 Main St', 
            PersonMailingCity = 'New York', PersonMailingCountry = 'United States', PersonMailingState = 'New York', PersonMailingPostalCode = '10001',
            SSN__c = '123456789', Phone = '1234567890', Lead_Number__c = '123456', Program_Start_Date__c = Date.today(), Bank_Name__c = 'Wells Fargo',
            Bank_Account_Number__c = '13719713158835300', Bank_Routing_Number__c = '122105155', Program_End_Date__c = Date.today().addDays(30),Primary_Contact__c = con.id,
            RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'PersonAccount'), PersonMobilePhone='9087654321', Work_Phone__c='9987654321'),
            new Account(Name = 'John Tech LLC', SSN__c = '123456789', Phone = '1234567890', Lead_Number__c = '123457', Program_Start_Date__c = Date.today(), 
            Program_End_Date__c = Date.today().addDays(30), RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'Business_Account'))
        };
        insert accountList;
        
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.Name = 'Test Account';
        acctRecord.SSN__c = '123456780';
        acctRecord.Phone = '1234567890' ;
        acctRecord.Lead_Number__c = '12345643';
        acctRecord.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'Business_Account');
        insert acctRecord;
        
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acctRecord.Id;
        opp.StageName = 'Ready To Close';
        opp.Version_Status__c = 'Active';
        insert opp;
        
    }

    @isTest
    static void testQueryAccount() {
        
        Id accountId = [SELECT Id FROM Account WHERE RecordType.Name = 'Person Account' LIMIT 1].Id;

        Test.startTest();
        List<Account> accounts = AccountData.queryAccount(accountId);
        Test.stopTest();
        
        System.assertEquals('John', accounts[0].FirstName);
        System.assertEquals('Doe', accounts[0].LastName);
        System.assertEquals('123456789', accounts[0].SSN__c);
        System.assertEquals('john.doe@example.com', accounts[0].PersonEmail);
        System.assertEquals('1234567890', accounts[0].Phone);
        System.assertEquals('123 Main St', accounts[0].PersonMailingStreet);
        System.assertEquals('New York', accounts[0].PersonMailingCity);
        System.assertEquals('New York', accounts[0].PersonMailingState);
        System.assertEquals('NY', accounts[0].PersonMailingStateCode);
        System.assertEquals('10001', accounts[0].PersonMailingPostalCode);
        System.assertEquals('United States', accounts[0].PersonMailingCountry);
        System.assertEquals(Date.today(), accounts[0].Program_Start_Date__c);
        System.assertEquals(Date.today().addDays(30), accounts[0].Program_End_Date__c);
        System.assertEquals('13719713158835300', accounts[0].Bank_Account_Number__c);
        System.assertEquals('122105155', accounts[0].Bank_Routing_Number__c);
    }

    @isTest
    static void testQueryAccounts() {
        
        List<Account> accountList = [SELECT Id FROM Account];

        Test.startTest();
        List<Account> accounts = AccountData.queryAccounts(new Set<Id>{accountList[0].Id, accountList[1].Id});
        Test.stopTest();
        
        System.assertEquals('John', accounts[0].FirstName);
        System.assertEquals('Doe', accounts[0].LastName);
        System.assertEquals('123456789', accounts[0].SSN__c);
        System.assertEquals('john.doe@example.com', accounts[0].PersonEmail);
        System.assertEquals('1234567890', accounts[0].Phone);
        System.assertEquals('123 Main St', accounts[0].PersonMailingStreet);
        System.assertEquals('New York', accounts[0].PersonMailingCity);
        System.assertEquals('New York', accounts[0].PersonMailingState);
        System.assertEquals('NY', accounts[0].PersonMailingStateCode);
        System.assertEquals('10001', accounts[0].PersonMailingPostalCode);
        System.assertEquals('United States', accounts[0].PersonMailingCountry);
        System.assertEquals('123456789', accounts[1].SSN__c);
        System.assertEquals('1234567890', accounts[1].Phone);
        System.assertEquals('123457', accounts[1].Lead_Number__c);
    }

    @isTest
    static void testQueryAccountsPhoneNumbers(){
        
        Id accountId = [SELECT Id FROM Account LIMIT 1].Id;

        Test.startTest();
        List<Account> accounts = AccountData.queryAccountsPhoneNumbers(accountId);
        Test.stopTest();

        System.assertEquals('1234567890', accounts[0].Phone);
        System.assertEquals('9087654321', accounts[0].PersonMobilePhone);
        System.assertEquals('9987654321', accounts[0].Work_Phone__c);
    }

    /**Test Method for AccountData.queryAccount */
    @isTest
    static void testQueryAccountWithFields() {
        List<Account> accounts = [SELECT Id FROM Account];
        Set<String> fields = new Set<String> {'Id', 'FirstName', 'LastName'};
        Test.startTest();
        List<Account> queriedAccounts = AccountData.queryAccount(accounts[0].Id, fields);
        Test.stopTest();
        System.assertEquals('John', queriedAccounts[0].FirstName, 'Verify the Account Instance has FirstName');
        System.assertEquals('Doe', queriedAccounts[0].LastName, 'Verify the Account Instance has LastName');
    }
    
    @isTest
    static void queryBankAccountDetailsTest(){

        Id accId = [SELECT Id FROM Account LIMIT 1].Id;
        
        Test.startTest();
        List<Account> accList = AccountData.queryBankAccountDetails(accId);
        Test.stopTest();
        
        Assert.isNotNull(accList, 'Verify the account record retrieved');
        Assert.areEqual('13719713158835300', accList[0].Bank_Account_Number__c, 'Verify the bank account number');
        Assert.areEqual('122105155', accList[0].Bank_Routing_Number__c, 'Verify the bank routing number');
    }
    
    @isTest
    static void testQueryAccountBasedOnIds(){
        List<Account> accounts = [SELECT Id,Primary_Contact__c FROM Account Where Primary_Contact__c!=''];
        Map<Id, Account> resultMap = AccountData.queryAccountBasedOnIds(new set<Id>{accounts[0].id});
        AccountData.queryAccountRelatedToContact(accounts[0].Primary_Contact__c);
        AccountData.queryAccountsWithoutIndividualReference(new Set<String>{'1234567890'});
        AccountData.queryAccountsWithSamePhone(new Set<String>{'1234567890'});
        AccountData.queryAccountsWithSamePhone(new Set<String>{'1234567890'}, accounts);
        Account queriedAccount = resultMap.get(accounts[0].id);
        assert.areEqual(accounts[0].Primary_Contact__c,queriedAccount.Primary_Contact__c);
    }
    
    @isTest
    static void getActiveOppOfAccountsTest(){
        List<Account> accList = [SELECT Id FROM Account WHERE Lead_Number__c = '12345643'];
        
        List<Account> accountList = AccountData.getActiveOppOfAccounts(new set<Id>{accList[0].Id});
        List<Opportunity> oppList = AccountData.getActiveOppOfAccount(accList[0].Id);
        
        Assert.areEqual(accountList.isEmpty(),false);
        Assert.areEqual(oppList.isEmpty(),false);
    }
}