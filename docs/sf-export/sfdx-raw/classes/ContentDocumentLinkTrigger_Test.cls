/**
 * @Description: Class to cover the test cases of the Content Document Link trigger
**/
@isTest
public with sharing class ContentDocumentLinkTrigger_Test {
    
    /**
    * @Description: Test setup method to create the test records
    **/
    @testSetup
    static void makeData() {    
        
        Payment_Processor__c procSas = DataFactoryTest.createPaymentProcessor();
        insert procSas;
        SAS_Settings__c settings = DataFactoryTest.createSASSettings();
        insert settings;
         Account acctRecord = DataFactoryTest.createAccount();
        acctRecord.External_SAS_Id__c = '100';
        insert acctRecord;
        Account acct = DataFactoryTest.createAccount();
        insert acct;
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acctRecord.Id;
        insert opp;
        Opportunity oppty = DataFactoryTest.createOpportunity();
        oppty.AccountId = acct.Id;
        insert oppty;
        Program_Plan__c prgmPlan = DataFactoryTest.createProgramplan(opp.Id, acctRecord.Id, procSas.Id);
        insert prgmPlan;
        Program_Plan__c pgmPlan = DataFactoryTest.createProgramplan(oppty.Id, acct.Id, procSas.Id);
        insert pgmPlan;
        ContentVersion contVersion1 = new ContentVersion();
        contVersion1.Title = FileUtil.AGREEMENT_SAS + opp.Name + '_Completed';
        contVersion1.VersionData = Blob.valueOf('Test Contract');
        contVersion1.PathOnClient = 'Test';
        insert contVersion1;
        ContentVersion contVersion2 = new ContentVersion();
        contVersion2.Title = FileUtil.AGREEMENT_CITADEL + opp.Name + '_Completed';
        contVersion2.VersionData = Blob.valueOf('Test Contract');
        contVersion2.PathOnClient = 'Test';
        insert contVersion2;
        ContentVersion contVersion3 = new ContentVersion();
        contVersion3.Title = FileUtil.AGREEMENT_COASTAL + opp.Name + '_Completed';
        contVersion3.VersionData = Blob.valueOf('Test Contract');
        contVersion3.PathOnClient = 'Test';
        insert contVersion3;
         ContentVersion contVersion4 = new ContentVersion();
        contVersion4.title = 'Test Note';
        contVersion4.VersionData = Blob.valueOf('Test Note');
        contVersion4.PathOnClient = 'Test.snote';
        insert contVersion4;
        
        Debt_Details__c debtDetails = DataFactoryTest.createDebtDetails(pgmPlan.id);
        debtDetails.Account__c = oppty.AccountId;
        debtDetails.Opportunity__c = oppty.Id;
        insert debtDetails;
    }
    @isTest
    static void validateFileUploadAfterClientSynced_SAS() {
        String sasAgreement = '%' + FileUtil.AGREEMENT_SAS + '%';
        List<ContentDocument> contentDocuments = [SELECT Id FROM ContentDocument WHERE Title LIKE :sasAgreement];
        List<Opportunity> opportunities = [SELECT Id FROM Opportunity];
        ContentDocumentLink contentDocLink = new ContentDocumentLink();
        contentDocLink.ContentDocumentId = contentDocuments[0].Id;
        contentDocLink.LinkedEntityId = opportunities[0].Id;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        insert contentDocLink;
        Test.stopTest();
        List<Account> acctListToVerify = [SELECT Id, Contract_Sync_Status__c FROM Account];
        Assert.areEqual('In Sync', acctListToVerify[0].Contract_Sync_Status__c, 'Verifying the Contract Sync Status');
    }

    @isTest
    static void validateFileUploadAfterClientSynced_CITADEL() {
        String sasAgreement = '%' + FileUtil.AGREEMENT_CITADEL + '%';
        List<ContentDocument> contentDocuments = [SELECT Id FROM ContentDocument WHERE Title LIKE :sasAgreement];
        List<Opportunity> opportunities = [SELECT Id FROM Opportunity];
        ContentDocumentLink contentDocLink = new ContentDocumentLink();
        contentDocLink.ContentDocumentId = contentDocuments[0].Id;
        contentDocLink.LinkedEntityId = opportunities[0].Id;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        insert contentDocLink;
        Test.stopTest();
        List<Account> acctListToVerify = [SELECT Id, Contract_Sync_Status__c FROM Account];
        Assert.areEqual('In Sync', acctListToVerify[0].Contract_Sync_Status__c, 'Verifying the Contract Sync Status');
    }
    @isTest
    static void validateFileUploadAfterClientSynced_COASTAL() {
        String sasAgreement = '%' + FileUtil.AGREEMENT_COASTAL + '%';
        List<ContentDocument> contentDocuments = [SELECT Id FROM ContentDocument WHERE Title LIKE :sasAgreement];
        List<Opportunity> opportunities = [SELECT Id FROM Opportunity];
        ContentDocumentLink contentDocLink = new ContentDocumentLink();
        contentDocLink.ContentDocumentId = contentDocuments[0].Id;
        contentDocLink.LinkedEntityId = opportunities[0].Id;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        insert contentDocLink;
        Test.stopTest();
        List<Account> acctListToVerify = [SELECT Id, Contract_Sync_Status__c FROM Account];
        Assert.areEqual('In Sync', acctListToVerify[0].Contract_Sync_Status__c, 'Verifying the Contract Sync Status');
    }
    @isTest
    static void validateFileUploadAfterClientSyncedNegativeScenario() {
        List<ContentDocument> contentDocuments = [SELECT Id FROM ContentDocument];
        List<Opportunity> opportunities = [SELECT Id FROM Opportunity];
        ContentDocumentLink contentDocLink = new ContentDocumentLink();
        contentDocLink.ContentDocumentId = contentDocuments[0].Id;
        contentDocLink.LinkedEntityId = opportunities[0].Id;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler(false));
        insert contentDocLink;
        Test.stopTest();
        List<Account> acctListToVerify = [SELECT Id, Contract_Sync_Status__c FROM Account];
        //Assert.areEqual('Sync Failed', acctListToVerify[0].Contract_Sync_Status__c, 'Verifying the Contract Sync Status');
    }
    @isTest
    static void validateFileUploadAfterClientSyncedRequiredFieldsMissing() {
        List<Account> acctList = [SELECT Id FROM Account];
        Account acctToUpdate = new Account();
        acctToUpdate.Id = acctList[0].Id;
        acctToUpdate.External_SAS_Id__c = null;
        update acctToUpdate;
        List<ContentDocument> contentDocuments = [SELECT Id FROM ContentDocument];
        List<Opportunity> opportunities = [SELECT Id FROM Opportunity];
        ContentDocumentLink contentDocLink = new ContentDocumentLink();
        contentDocLink.ContentDocumentId = contentDocuments[0].Id;
        contentDocLink.LinkedEntityId = opportunities[0].Id;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler(true));
        insert contentDocLink;
        Test.stopTest();
        List<Account> acctListToVerify = [SELECT Id, Contract_Sync_Status__c FROM Account];
        Assert.areEqual(null, acctListToVerify[0].Contract_Sync_Status__c, 'Verifying the Contract Sync Status');
    }
      @isTest
    static void validateLinkNoteToAccountFromDebtDetails(){
        List<ContentDocument> contentDocuments = [SELECT Id FROM ContentDocument where fileType='SNOTE'];
        Debt_Details__c debt = [select id,Account__c,opportunity__c from Debt_Details__c limit 1];
        ContentDocumentLink contentDocLink = new ContentDocumentLink();
        contentDocLink.ContentDocumentId = contentDocuments[0].Id;
        contentDocLink.LinkedEntityId = debt.Id;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler(true));
        insert contentDocLink;
        Test.stopTest();
        list<ContentDocumentLink> cdLink = [Select id,ContentDocumentId from ContentDocumentLink where ContentDocumentId =: contentDocuments[0].Id];
        Assert.areEqual(3,cdLink.size());
    }
    @isTest
    static void validateLinkNoteToAccountFromOpportunity(){
        List<ContentDocument> contentDocuments = [SELECT Id FROM ContentDocument where fileType='SNOTE'];
        Opportunity opp = [select id from Opportunity where stageName!='Closed Won First Payment Pending' limit 1];
        ContentDocumentLink contentDocLink = new ContentDocumentLink();
        contentDocLink.ContentDocumentId = contentDocuments[0].Id;
        contentDocLink.LinkedEntityId = opp.Id;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler(true));
        insert contentDocLink;
        Test.stopTest();
        list<ContentDocumentLink> cdLink = [Select id,ContentDocumentId from ContentDocumentLink where ContentDocumentId =: contentDocuments[0].Id];
        Assert.areEqual(3,cdLink.size());
    }
    @isTest
    static void validateLinkToOpportunityLockDelete(){
        Test.startTest();
        List<ContentDocument> contentDocuments = [SELECT Id FROM ContentDocument where fileType='SNOTE'];
        Opportunity opp = [select id from Opportunity limit 1];
        
        ContentDocumentLink contentDocLink = new ContentDocumentLink();
        contentDocLink.ContentDocumentId = contentDocuments[0].Id;
        contentDocLink.LinkedEntityId = opp.Id;
        insert contentDocLink;
        opp.stageName = 'Closed Won First Payment Pending';
        update opp;
         String errMsg;        
        
        try {
            delete contentDocLink;
        } catch (Exception exp) {
            errMsg = exp.getMessage();
        }
        Test.stopTest();
        //System.assertNotEquals(null, errMsg, 'Verify exception is thrown on delete');
    }
    @isTest
    static void validateLinkToOpportunityLockUpdate(){
        Test.startTest();
        List<ContentDocument> contentDocuments = [SELECT Id FROM ContentDocument where fileType='SNOTE'];
        Opportunity opp = [select id from Opportunity limit 1];
         List<Account> acctList = [SELECT Id FROM Account];
        
        ContentDocumentLink contentDocLink = new ContentDocumentLink();
        contentDocLink.ContentDocumentId = contentDocuments[0].Id;
        contentDocLink.LinkedEntityId = opp.Id;
        insert contentDocLink;
        opp.stageName = 'Closed Won First Payment Pending';
        update opp;
        contentDocLink.ShareType = 'I';
         String errMsg;        
        try {
            update contentDocLink;
        } catch (Exception exp) {
            errMsg = exp.getMessage();
        }
        Test.stopTest();
       // System.assertNotEquals(null, errMsg, 'Verify exception is thrown on delete');
    }
}