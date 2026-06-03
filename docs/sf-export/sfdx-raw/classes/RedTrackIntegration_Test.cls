//Test class for RedTrack Integration
@isTest
public without sharing class RedTrackIntegration_Test {
    
    @isTest
    static void testLeadCreation() {
        Lead leadRecord = DataFactoryTest.createListLead();
        leadRecord.Ad_Click_Id__c = '9876543201';
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        insert leadRecord;
        Test.stopTest();
        List<Async_Operation__c> asyncOperationToVerify = [SELECT Id, Operation__c, Status__c FROM Async_Operation__c WHERE Lead__c = :leadRecord.Id AND Operation__c = 'RedTrack_LeadCreation'];
        Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed');
    }

    @isTest
    static void testLeadQualification() {
        Lead leadRecord = DataFactoryTest.createListLead();
        leadRecord.Ad_Click_Id__c = '9876543201';
        insert leadRecord;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        leadRecord.Status = 'Working Lead';
        leadRecord.Sub_Disposition__c = 'Call Transferred from Fronter';
        update leadRecord;
        Test.stopTest();
        List<Async_Operation__c> asyncOperationToVerify = [SELECT Id, Operation__c, Status__c FROM Async_Operation__c WHERE Lead__c = :leadRecord.Id AND Operation__c = 'RedTrack_LeadQualification'];
        Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed');
    }

    @isTest
    static void testOpportunityCreation() {
        Opportunity oppRecord = DataFactoryTest.createOpportunity();
        oppRecord.Ad_Click_Id__c = '9876543201';
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        insert oppRecord;
        Test.stopTest();
        List<Async_Operation__c> asyncOperationToVerify = [SELECT Id, Operation__c, Status__c FROM Async_Operation__c WHERE Opportunity__c = :oppRecord.Id AND Operation__c = 'RedTrack_OpportunityCreation'];
        Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed');
    }

    @isTest
    static void testOpportunityContractSent() {
        Opportunity oppRecord = DataFactoryTest.createOpportunity();
        oppRecord.Ad_Click_Id__c = '9876543201';
        oppRecord.StageName = 'Working Opportunity';
        insert oppRecord;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        oppRecord.StageName = OpportunityUtil.STAGE_CONTRACT_SENT;
        update oppRecord;
        Test.stopTest();
        List<Async_Operation__c> asyncOperationToVerify = [SELECT Id, Operation__c, Status__c FROM Async_Operation__c WHERE Opportunity__c = :oppRecord.Id AND Operation__c = 'RedTrack_ContractSent'];
        Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed');
    }

    @isTest
    static void testOpportunityClosedWon() {
        Opportunity oppRecord = DataFactoryTest.createOpportunity();
        oppRecord.Ad_Click_Id__c = '9876543201';
        oppRecord.StageName = OpportunityUtil.STAGE_CONTRACT_SENT;
        insert oppRecord;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        oppRecord.StageName = OpportunityUtil.STAGE_CLOSED_WON_PENDING;
        update oppRecord;
        Test.stopTest();
        List<Async_Operation__c> asyncOperationToVerify = [SELECT Id, Operation__c, Status__c FROM Async_Operation__c WHERE Opportunity__c = :oppRecord.Id AND Operation__c = 'RedTrack_OpportunityClosedWon'];
        Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed');
    }

    @isTest
    static void testOpportunityFirstPayment() {
        Opportunity oppRecord = DataFactoryTest.createOpportunity();
        oppRecord.Ad_Click_Id__c = '9876543201';
        oppRecord.StageName =  OpportunityUtil.STAGE_CLOSED_WON_PENDING;
        insert oppRecord;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        oppRecord.StageName = OpportunityUtil.STAGE_CLOSED_WON_COMPLETED;
        update oppRecord;
        Test.stopTest();
        List<Async_Operation__c> asyncOperationToVerify = [SELECT Id, Operation__c, Status__c FROM Async_Operation__c WHERE Opportunity__c = :oppRecord.Id AND Operation__c = 'RedTrack_OpportunityFirstPayment'];
        Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed');
    }

    @isTest
    static void testLeadCreationBatch() {
        List<Lead> leadsList = new List<Lead>();
        Lead leadRecord = DataFactoryTest.createListLead();
        leadRecord.Ad_Click_Id__c = '9876543201';
        leadsList.add(leadRecord);
        Lead leadRecord2 = DataFactoryTest.createListLead();
        leadRecord2.Ad_Click_Id__c = '94857yi3hruew';
        leadsList.add(leadRecord2);
        insert leadsList;

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        String query = 'SELECT Id, Record_Id__c, Async_Type__c, Status__c, Operation__c, Lead__c, Individual__c FROM Async_Operation__c LIMIT 1';
        Database.executeBatch(new Batch_ProcessAsyncOperations(query), 1);
        System.schedule('Test Job', '0 0 0 * * ? *', new Batch_ProcessAsyncOperations(query, 1));
        Test.stopTest();
        List<Async_Operation__c> asyncOperationToVerify = [SELECT Id, Operation__c, Status__c FROM Async_Operation__c WHERE Lead__c = :leadRecord.Id AND Operation__c = 'RedTrack_LeadCreation'];
        Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed');
    }
    
    @isTest
    static void testLeadQualificationWithFiveDisposition() {
        Lead leadRecord = DataFactoryTest.createListLead();
        leadRecord.Ad_Click_Id__c = '9876543201';
        insert leadRecord;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        List<Five9_Connector_Disposition__mdt> five9DispositionList = Five9CallLogData.getFive9LeadQualifiedDispositions();
        leadRecord.five9_Disposition__c = five9DispositionList[0].Label;
        update leadRecord;
        Test.stopTest();
        List<Async_Operation__c> asyncOperationToVerify = [SELECT Id, Operation__c, Status__c FROM Async_Operation__c WHERE Lead__c = :leadRecord.Id AND Operation__c = 'RedTrack_LeadQualification'];
        Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed');
    }    
       
   @isTest
   static void testInboundLeadQualification() {
        Lead leadRecord = DataFactoryTest.createListLead();
        leadRecord.Ad_Click_Id__c = '9876543201';
        insert leadRecord;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        leadRecord.Status = 'Working Lead';
        leadRecord.Sub_Disposition__c = 'Call Transferred from Fronter';
        leadRecord.LeadSource = 'IB - Google';
        update leadRecord;
        Test.stopTest();
        List<Async_Operation__c> asyncOperationToVerify = [SELECT Id, Operation__c, Status__c FROM Async_Operation__c WHERE Lead__c = :leadRecord.Id AND Operation__c = 'RedTrack_InboundLeadQualification'];
        Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed');
    }
    
    @isTest
    static void testInboundLeadCreationWithAdClickId() {
        Lead leadRecord = DataFactoryTest.createListLead();
        leadRecord.LastName = 'Splashpage Inbound';
        leadRecord.LeadSource = 'IB - Google';
        insert leadRecord;
        leadRecord.Ad_Click_Id__c = '123456789';
        update leadRecord;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        leadRecord.LastName = 'Test';
        update leadRecord;
        Test.stopTest();
        List<Async_Operation__c> asyncOperationToVerify = [SELECT Id, Operation__c, Status__c FROM Async_Operation__c WHERE Lead__c = :leadRecord.Id AND Operation__c = 'RedTrack_InboundLeadCreation'];
        Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed');
    }
    
    @isTest
static void testLeadCreationAffiliate() {
    Lead leadRecord = DataFactoryTest.createListLead();
    leadRecord.Ad_Click_Id__c = '9876543201';
    leadRecord.LeadSource = LeadUtil.LEAD_SOURCE_AFFILIATE;
    Test.startTest();
    Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
    insert leadRecord;
    Test.stopTest();
    List<Async_Operation__c> asyncOperationToVerify = [
        SELECT Id, Operation__c, Status__c 
        FROM Async_Operation__c 
        WHERE Lead__c = :leadRecord.Id 
        AND Operation__c = 'RedTrack_LeadCreation'
    ];
    Assert.isFalse(asyncOperationToVerify.isEmpty(), 'Async operation should be created for Affiliate lead creation');
    Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed for Affiliate lead creation');
}

@isTest
static void testLeadQualificationAffiliate() {
    Lead leadRecord = DataFactoryTest.createListLead();
    leadRecord.Ad_Click_Id__c = '9876543201';
    leadRecord.LeadSource = LeadUtil.LEAD_SOURCE_AFFILIATE;
    insert leadRecord;
    Test.startTest();
    Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
    leadRecord.Status = 'Working Lead';
    leadRecord.Sub_Disposition__c = 'Call Transferred from Fronter';
    update leadRecord;
    Test.stopTest();
    List<Async_Operation__c> asyncOperationToVerify = [
        SELECT Id, Operation__c, Status__c 
        FROM Async_Operation__c 
        WHERE Lead__c = :leadRecord.Id 
        AND Operation__c = 'RedTrack_LeadQualification'
    ];
    Assert.isFalse(asyncOperationToVerify.isEmpty(), 'Async operation should be created for Affiliate lead qualification');
    Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed for Affiliate lead qualification');
}

@isTest
static void testLeadQualificationWithFiveDispositionAffiliate() {
    Lead leadRecord = DataFactoryTest.createListLead();
    leadRecord.Ad_Click_Id__c = '9876543201';
    leadRecord.LeadSource = LeadUtil.LEAD_SOURCE_AFFILIATE;
    insert leadRecord;
    Test.startTest();
    Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
    List<Five9_Connector_Disposition__mdt> five9DispositionList = Five9CallLogData.getFive9LeadQualifiedDispositions();
    leadRecord.five9_Disposition__c = five9DispositionList[0].Label;
    update leadRecord;
    Test.stopTest();
    List<Async_Operation__c> asyncOperationToVerify = [
        SELECT Id, Operation__c, Status__c 
        FROM Async_Operation__c 
        WHERE Lead__c = :leadRecord.Id 
        AND Operation__c = 'RedTrack_LeadQualification'
    ];
    Assert.isFalse(asyncOperationToVerify.isEmpty(), 'Async operation should be created for Affiliate lead qualification via Five9 disposition');
    Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed for Affiliate lead qualification via Five9 disposition');
}

@isTest
static void testOpportunityCreationAffiliate() {
    Opportunity oppRecord = DataFactoryTest.createOpportunity();
    oppRecord.Ad_Click_Id__c = '9876543201';
    oppRecord.LeadSource = LeadUtil.LEAD_SOURCE_AFFILIATE;
    Test.startTest();
    Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
    insert oppRecord;
    Test.stopTest();
    List<Async_Operation__c> asyncOperationToVerify = [
        SELECT Id, Operation__c, Status__c 
        FROM Async_Operation__c 
        WHERE Opportunity__c = :oppRecord.Id 
        AND Operation__c = 'RedTrack_OpportunityCreation'
    ];
    Assert.isFalse(asyncOperationToVerify.isEmpty(), 'Async operation should be created for Affiliate opportunity creation');
    Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed for Affiliate opportunity creation');
}

@isTest
static void testOpportunityContractSentAffiliate() {
    Opportunity oppRecord = DataFactoryTest.createOpportunity();
    oppRecord.Ad_Click_Id__c = '9876543201';
    oppRecord.LeadSource = LeadUtil.LEAD_SOURCE_AFFILIATE;
    oppRecord.StageName = 'Working Opportunity';
    insert oppRecord;
    Test.startTest();
    Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
    oppRecord.StageName = OpportunityUtil.STAGE_CONTRACT_SENT;
    update oppRecord;
    Test.stopTest();
    List<Async_Operation__c> asyncOperationToVerify = [
        SELECT Id, Operation__c, Status__c 
        FROM Async_Operation__c 
        WHERE Opportunity__c = :oppRecord.Id 
        AND Operation__c = 'RedTrack_ContractSent'
    ];
    Assert.isFalse(asyncOperationToVerify.isEmpty(), 'Async operation should be created for Affiliate contract sent');
    Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed for Affiliate contract sent');
}

@isTest
static void testOpportunityClosedWonAffiliate() {
    Opportunity oppRecord = DataFactoryTest.createOpportunity();
    oppRecord.Ad_Click_Id__c = '9876543201';
    oppRecord.LeadSource = LeadUtil.LEAD_SOURCE_AFFILIATE;
    oppRecord.StageName = OpportunityUtil.STAGE_CONTRACT_SENT;
    insert oppRecord;
    Test.startTest();
    Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
    oppRecord.StageName = OpportunityUtil.STAGE_CLOSED_WON_PENDING;
    update oppRecord;
    Test.stopTest();
    List<Async_Operation__c> asyncOperationToVerify = [
        SELECT Id, Operation__c, Status__c 
        FROM Async_Operation__c 
        WHERE Opportunity__c = :oppRecord.Id 
        AND Operation__c = 'RedTrack_OpportunityClosedWon'
    ];
    Assert.isFalse(asyncOperationToVerify.isEmpty(), 'Async operation should be created for Affiliate opportunity closed won');
    Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed for Affiliate opportunity closed won');
}

@isTest
static void testOpportunityFirstPaymentAffiliate() {
    Opportunity oppRecord = DataFactoryTest.createOpportunity();
    oppRecord.Ad_Click_Id__c = '9876543201';
    oppRecord.LeadSource = LeadUtil.LEAD_SOURCE_AFFILIATE;
    oppRecord.StageName = OpportunityUtil.STAGE_CLOSED_WON_PENDING;
    insert oppRecord;
    Test.startTest();
    Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
    oppRecord.StageName = OpportunityUtil.STAGE_CLOSED_WON_COMPLETED;
    update oppRecord;
    Test.stopTest();
    List<Async_Operation__c> asyncOperationToVerify = [
        SELECT Id, Operation__c, Status__c 
        FROM Async_Operation__c 
        WHERE Opportunity__c = :oppRecord.Id 
        AND Operation__c = 'RedTrack_OpportunityFirstPayment'
    ];
    Assert.isFalse(asyncOperationToVerify.isEmpty(), 'Async operation should be created for Affiliate opportunity first payment');
    Assert.areEqual('Completed', asyncOperationToVerify[0].Status__c, 'Verify that the async operation is completed for Affiliate opportunity first payment');
}

@isTest
static void testLeadCreationAffiliateWithoutAdClickId() {
    Lead leadRecord = DataFactoryTest.createListLead();
    leadRecord.LeadSource = LeadUtil.LEAD_SOURCE_AFFILIATE;
    // Intentionally no Ad_Click_Id__c — validates graceful handling
    Test.startTest();
    Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
    insert leadRecord;
    Test.stopTest();
    // No async op expected without Ad_Click_Id — adjust assertion 
    // to match your actual trigger guard condition
    List<Async_Operation__c> asyncOperationToVerify = [
        SELECT Id, Operation__c, Status__c 
        FROM Async_Operation__c 
        WHERE Lead__c = :leadRecord.Id 
        AND Operation__c = 'RedTrack_LeadCreation'
    ];
    Assert.isTrue(asyncOperationToVerify.isEmpty(), 'No async operation should be created for Affiliate lead without Ad Click Id');
}

}