/**
 * @description: Class to cover the test cases of the FileData class
**/
@isTest
public with sharing class FileData_Test {
    
    /**
     * @description: Test setup method to create the test records
    **/
    @testSetup
    static void makeData() {  
        Account acctRecord = DataFactoryTest.createAccount();
        insert acctRecord;

        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = acctRecord.Id;
        opp.StageName = 'Closed Won First Payment Pending';
        insert opp;

         
        ContentVersion contVersion = new ContentVersion();
        contVersion.Title = 'SAS Agreement_TestDocument_' + opp.Name + '_completed.pdf';
        contVersion.VersionData = Blob.valueOf('Test Contract');
        contVersion.PathOnClient = 'Test';
        insert contVersion;
        
        ContentVersion contVersion2 = new ContentVersion();
        contVersion2.Title = 'Citadel Legal Plan_TestDocument_' + opp.Name + '_completed.pdf';
        contVersion2.VersionData = Blob.valueOf('Test Contract');
        contVersion2.PathOnClient = 'Test';
        insert contVersion2;

        List<ContentDocument> contentDocuments = [SELECT Id FROM ContentDocument];

        List<ContentDocumentLink> contentDocLink = new List<ContentDocumentLink>();
        ContentDocumentLink contDoc = new ContentDocumentLink();        
        contDoc.ContentDocumentId = contentDocuments[0].Id;
        contDoc.LinkedEntityId = opp.Id;
        contentDocLink.add(contDoc);        
        ContentDocumentLink contDoc1 = new ContentDocumentLink();
        contDoc1.ContentDocumentId = contentDocuments[1].Id;
        contDoc1.LinkedEntityId = opp.Id;
        contentDocLink.add(contDoc1);
        insert contentDocLink;
    }

    /**
     * @description: Validate the scneario of updating the payment processor to RAM if the state is updated to RAM's specific state
    **/
    @isTest
    static void testQueryContractData() {
        List<Opportunity> oppList = [SELECT Id, Name, AccountId,Account.External_SAS_Id__c, Account.External_RAM_Id__c, Processor__c, Legal_Network__c  FROM Opportunity];
        Test.startTest();
        Blob contractDetails = FileData.getContractData(oppList[0]);
        FileData.getCitadelContractData(oppList[0]);
        Test.stopTest();
        Assert.isTrue(contractDetails != null, 'Verifying the Blob is returned');
    }
}