@isTest
public with sharing class ContactTrigger_Test {
    
    @testSetup
    static void makeData() {    
        
        Payment_Processor__c procSas = DataFactoryTest.createPaymentProcessor();
        insert procSas;

        SAS_Settings__c settings = DataFactoryTest.createSASSettings();
        insert settings;

        Account acctRecord = DataFactoryTest.createBusinessAccount();
        insert acctRecord;

        Contact contRecord = DataFactoryTest.createContact();
        contRecord.AccountId = acctRecord.Id;
        contRecord.Lead_Number__c = '123456';
        insert contRecord;
    }

    @isTest
    static void testSyncStatusUpdatedIfSpecificFieldsAreUpdated() {
        List<Account> accts = [SELECT Id FROM Account];
        Account acctRecord = accts[0];
        acctRecord.External_SAS_Id__c = '34534535';
        acctRecord.Sync_Status__c = 'In Sync';
        update acctRecord;
        List<Contact> contacts = [SELECT Id FROM Contact WHERE AccountId = :acctRecord.Id];
        Contact contactRecord = contacts[0];
        contactRecord.Email = 'hjsdfds@jkfhsdfdf.com';
        Test.startTest();
        update contactRecord;
        Test.stopTest();
        List<Contact> contactsToVerify = [SELECT Id, Account.Sync_Status__c FROM Contact WHERE Id = :contactRecord.Id];
        Assert.areEqual('Sync Pending', contactsToVerify[0].Account.Sync_Status__c, 'Verifying the Account Sync Status is updated Sync Pending');
    }

    @isTest
    static void testSyncStatusNotUpdatedIfSpecificFieldsAreNotUpdated() {
        List<Account> accts = [SELECT Id FROM Account];
        Account acctRecord = accts[0];
        acctRecord.External_SAS_Id__c = '34534535';
        acctRecord.Sync_Status__c = 'In Sync';
        update acctRecord;
        List<Contact> contacts = [SELECT Id FROM Contact WHERE AccountId = :acctRecord.Id];
        Contact contactRecord = contacts[0];
        contactRecord.MailingStreet = 'BHSJFGQHE';
        Test.startTest();
        update contactRecord;
        Test.stopTest();
        List<Contact> contactsToVerify = [SELECT Id, Account.Sync_Status__c FROM Contact WHERE Id = :contactRecord.Id];
        Assert.areEqual('In Sync', contactsToVerify[0].Account.Sync_Status__c, 'Verifying the Account Sync Status is not updated Sync Pending');
    }

    @isTest
    static void testSyncStatusNotUpdatedIfSpecificFieldsAreUpdatedClientUnSynced() {
        List<Account> accts = [SELECT Id FROM Account];
        List<Contact> contacts = [SELECT Id FROM Contact WHERE AccountId = :accts[0].Id];
        Contact contactRecord = contacts[0];
        contactRecord.Email = 'hjsdfds@jkfhsdfdf.com';
        Test.startTest();
        update contactRecord;
        Test.stopTest();
        List<Contact> contactsToVerify = [SELECT Id, Account.Sync_Status__c FROM Contact WHERE Id = :contactRecord.Id];
        Assert.areEqual('Sync Pending', contactsToVerify[0].Account.Sync_Status__c, 'Verifying the Account Sync Status is updated Sync Pending');
    }

    /*@isTest
    static void testCreatePayeeSAS() {
        Account creditorAccount = DataFactoryTest.createCreditorAccount();
        insert creditorAccount;
        Contact creditorContact = DataFactoryTest.createContact();
        creditorContact.AccountId = creditorAccount.Id;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        insert creditorContact;
        Test.stopTest();
        List<Account> accountsToVerify = [SELECT Id, External_SAS_Id__c, Sync_Status__c FROM Account WHERE Id = :creditorAccount.Id];
        Assert.areEqual('1543', accountsToVerify[0].External_SAS_Id__c, 'Verify the External SAS Id to make sure the payee is synced with SAS');
        Assert.areEqual('In Sync', accountsToVerify[0].Sync_Status__c, 'Verify the External SAS Id to make sure the payee is synced with SAS');
        List<Application_Log__c> logs = [SELECT Id, Log_Type__c FROM Application_Log__c WHERE Account__c = :creditorAccount.Id];
        Assert.areEqual('Callout Success', logs[0].Log_Type__c, 'Verify the application log is created');
    }*/

    /*@isTest
    static void testSyncPayeeSASOnUpdate() {
        Account creditorAccount = DataFactoryTest.createCreditorAccount();
        insert creditorAccount;
        Contact creditorContact = DataFactoryTest.createContact();
        creditorContact.AccountId = creditorAccount.Id;
        creditorContact.Email = null;
        insert creditorContact;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        creditorContact.Email = 'sdjfhgshjdf@jskdfhsd.com';
        update creditorContact;
        Test.stopTest();
        List<Account> accountsToVerify = [SELECT Id, External_SAS_Id__c, Sync_Status__c FROM Account WHERE Id = :creditorAccount.Id];
        Assert.areEqual('1543', accountsToVerify[0].External_SAS_Id__c, 'Verify the External SAS Id to make sure the payee is synced with SAS');
        Assert.areEqual('In Sync', accountsToVerify[0].Sync_Status__c, 'Verify the External SAS Id to make sure the payee is synced with SAS');
        List<Application_Log__c> logs = [SELECT Id, Log_Type__c FROM Application_Log__c WHERE Account__c = :creditorAccount.Id];
        Assert.areEqual('Callout Success', logs[0].Log_Type__c, 'Verify the application log is created');
    }*/

    /*@isTest
    static void testSyncPayeeSASWithUpdatedField() {
        Account creditorAccount = DataFactoryTest.createCreditorAccount();
        insert creditorAccount;
        Contact creditorContact = DataFactoryTest.createContact();
        creditorContact.AccountId = creditorAccount.Id;
        insert creditorContact;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        creditorContact.FirstName = 'XYZ1';
        update creditorContact;
        Test.stopTest();
        List<Account> accountsToVerify = [SELECT Id, External_SAS_Id__c, Sync_Status__c FROM Account WHERE Id = :creditorAccount.Id];
        Assert.areEqual('1543', accountsToVerify[0].External_SAS_Id__c, 'Verify the External SAS Id to make sure the payee is synced with SAS');
        Assert.areEqual('In Sync', accountsToVerify[0].Sync_Status__c, 'Verify the External SAS Id to make sure the payee is synced with SAS');
        List<Application_Log__c> logs = [SELECT Id, Log_Type__c FROM Application_Log__c WHERE Account__c = :creditorAccount.Id];
        Assert.areEqual('Callout Success', logs[0].Log_Type__c, 'Verify the application log is created');
    }*/

    @isTest
    static void testSyncPayeeSASNegativeScenario() {
        Account creditorAccount = DataFactoryTest.createCreditorAccount();
        insert creditorAccount;
        Contact creditorContact = DataFactoryTest.createContact();
        creditorContact.AccountId = creditorAccount.Id;
        creditorContact.Email = null;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        insert creditorContact;
        Test.stopTest();
        List<Account> accountsToVerify = [SELECT Id, External_SAS_Id__c, Sync_Status__c FROM Account WHERE Id = :creditorAccount.Id];
        Assert.areEqual('Sync Pending', accountsToVerify[0].Sync_Status__c, 'Verify the callout is skipped due to custom validation');
    }

    /*@isTest
    static void testSyncPayeeSASNegativeScenarioWithoutSASCredentials() {
        SAS_Settings__c settings = [SELECT Id FROM SAS_Settings__c][0];
        settings.Endpoint__c = null;
        update settings;
        Account creditorAccount = DataFactoryTest.createCreditorAccount();
        insert creditorAccount;
        Contact creditorContact = DataFactoryTest.createContact();
        creditorContact.AccountId = creditorAccount.Id;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        insert creditorContact;
        Test.stopTest();
        List<Application_Log__c> logs = [SELECT Id, Log_Type__c, Exception_Message__c FROM Application_Log__c WHERE Account__c = :creditorAccount.Id];
        Assert.areEqual('Error', logs[0].Log_Type__c, 'Verify the application log is created with Error Status');
        Assert.isTrue(logs[0].Exception_Message__c.contains('SAS Endpoint is blank'), 'Verify the proper exception message is populated');
    }*/

    /*@isTest
    static void testSyncPayeeSASNegativeScenarioWithAPIFailure() {
        Account creditorAccount = DataFactoryTest.createCreditorAccount();
        insert creditorAccount;
        Contact creditorContact = DataFactoryTest.createContact();
        creditorContact.AccountId = creditorAccount.Id;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler(false));
        insert creditorContact;
        Test.stopTest();
        List<Account> accountsToVerify = [SELECT Id, External_SAS_Id__c, Sync_Status__c FROM Account WHERE Id = :creditorAccount.Id];
        Assert.areEqual('Sync Failed', accountsToVerify[0].Sync_Status__c, 'Verify the sync status is updated to Sync Failed');
        List<Application_Log__c> logs = [SELECT Id, Log_Type__c, Exception_Message__c FROM Application_Log__c WHERE Account__c = :creditorAccount.Id AND Exception_Message__c != null];
        Assert.areEqual('Error', logs[0].Log_Type__c, 'Verify the application log is created with Error Status');
        Assert.isTrue(logs[0].Exception_Message__c.contains('Payee account not created'), 'Verify the proper exception message is populated');
    }*/
}