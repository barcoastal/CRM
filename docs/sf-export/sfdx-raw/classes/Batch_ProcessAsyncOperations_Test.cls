//Test Class for Batch Async Operations
@isTest
public with sharing class Batch_ProcessAsyncOperations_Test {
    
    @testSetup
    static void makeData() {
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        List<Lead> leads = new List<Lead>();
        Lead leadRec1 = DataFactoryTest.createListLead();
        Lead leadRec2 = DataFactoryTest.createListLead();
        leadRec2.Phone = '8722334455';
        leads.add(leadRec1);
        leads.add(leadRec2);
        insert leads;
        List<Account> accts = new List<Account>();
        Account acctRecord = DataFactoryTest.createBusinessAccount();
        acctRecord.Name = 'Test Account';
        acctRecord.SSN__c = '123456780';
        acctRecord.Phone = '123-456-7890' ;
        acctRecord.Lead_Number__c = '123456';
        acctRecord.Program_Start_Date__c = Date.today();
        acctRecord.Program_End_Date__c = Date.today().addDays(30); 
        acctRecord.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Account', 'Business_Account');
        acctRecord.BillingStreet = 'Ap #696-3279 Viverra. Avenue';
        acctRecord.BillingCity = 'Latrobe';
        acctRecord.BillingStateCode = 'DE';
        acctRecord.BillingPostalCode = '38100'; 
        acctRecord.BillingCountryCode = 'US';
        Account acctRecord2 = DataFactoryTest.createBusinessAccount();
        accts.add(acctRecord);
        accts.add(acctRecord2);
        insert accts;   
        
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.AccountId = accts[0].Id;
        insert opp;     
    }

    @isTest
    private static void testAsyncOPBatch() {
        Map<Id, Async_Operation__c> asyncOperationMap = new Map<Id, Async_Operation__c>([SELECT Id, Individual__c, Individual__r.Phone__c, Status__c, Async_Type__c, Operation__c FROM Async_Operation__c]);
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        Database.executeBatch(new Batch_ProcessAsyncOperations());
        Test.stopTest();
        List<Async_Operation__c> asyncOperationsToVerify = [SELECT Id, Status__c FROM Async_Operation__c];
        Assert.areEqual('Completed', asyncOperationsToVerify[0].Status__c, 'Verifying the Async Operation is successfully completed.');
    }

    @isTest
    private static void testAsyncOpScheduler() {
        Map<Id, Async_Operation__c> asyncOperationMap = new Map<Id, Async_Operation__c>([SELECT Id, Individual__c, Individual__r.Phone__c FROM Async_Operation__c]);
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        String queryString = 'SELECT Id, Operation__c, Status__c, Lead__r.Name, CreatedDate, Async_Type__c FROM Async_Operation__c';
        Batch_ProcessAsyncOperations batch = new Batch_ProcessAsyncOperations(queryString, null);
        String sch = '0 0 * * * ?';
        String jobID = System.schedule('Test', sch, batch);
        Test.stopTest();
    }
    
    @isTest
    private static void testAsyncRedTrackOpportunityClosedWon() {                
        Opportunity opp = [SELECT Id, Ad_Click_Id__c FROM opportunity];
        opp.Ad_Click_Id__c = '123654';
       // opp.StageName = OpportunityUtil.STAGE_CLOSED_WON_PENDING;
        update opp;
        Map<Id, Async_Operation__c> asyncOperationMap = new Map<Id, Async_Operation__c>([SELECT Id, Individual__c, Individual__r.Phone__c, Status__c, Async_Type__c, Operation__c FROM Async_Operation__c WHERE Operation__c =:AsyncOperationUtil.OPERATION_SET_CUSTOMER_STATUS_API]);
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        Database.executeBatch(new Batch_ProcessAsyncOperations());
        Test.stopTest();
        List<Async_Operation__c> asyncOperationsToVerify = [SELECT Id, Status__c FROM Async_Operation__c];
        Assert.areEqual('Completed', asyncOperationsToVerify[0].Status__c, 'Verifying the Async Operation is successfully completed.');
    }
    
    @isTest
    private static void testAsyncSetCustomerStatusBatch() {                
        List<Account> accts = [SELECT Id, Fee_Paid_In_Full__c FROM Account];
        accts[0].Fee_Paid_In_Full__c = true;
        accts[0].External_SAS_Id__c = '117';
        accts[1].Fee_Paid_In_Full__c = true;
        accts[1].External_SAS_Id__c = '118';
        update accts;
        Map<Id, Async_Operation__c> asyncOperationMap = new Map<Id, Async_Operation__c>([SELECT Id, Individual__c, Individual__r.Phone__c, Status__c, Async_Type__c, Operation__c FROM Async_Operation__c WHERE Operation__c =:AsyncOperationUtil.OPERATION_SET_CUSTOMER_STATUS_API]);
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        Database.executeBatch(new Batch_ProcessAsyncOperations());
        AccountStatusMDT.getAccountStatus('Fee Paid In Full');
        AccountStatusMDT.getAllAccountStatus();
        Test.stopTest();
        List<Async_Operation__c> asyncOperationsToVerify = [SELECT Id, Status__c FROM Async_Operation__c];
        Assert.areEqual('Completed', asyncOperationsToVerify[0].Status__c, 'Verifying the Async Operation is successfully completed.');
    }   
    
}