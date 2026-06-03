@isTest
public class AsyncOperationHandlerTest {
     
    @TestSetup
    static void makeData(){
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        Lead leadRecord = DataFactoryTest.createListLead();
        insert leadRecord;
    }
    
    @isTest
    static void assignAsyncOperationToParentTest(){
        
        Lead LeadRecord = [SELECT Id From Lead LIMIT 1];
        
        Test.startTest();
        Async_Operation__c AsyncOperation = DataFactoryTest.createAsyncOperation();
        AsyncOperation.Record_Id__c = String.valueOf(leadRecord.Id);
        insert AsyncOperation;
        Test.stopTest();
        
        Async_Operation__c AsyncOperationRecord = [SELECT Id,Record_Id__c,Lead__c FROM Async_Operation__c WHERE Lead__c != null LIMIT 1];
        
        Assert.areEqual(AsyncOperationRecord.Record_Id__c, leadRecord.Id);
        Assert.areEqual(AsyncOperationRecord.Lead__c, leadRecord.Id);
    }
    
    @isTest
    static void testFutureHandler() {
        List<Individual> individuals = [SELECT Id FROM Individual];
        List<Lead> leads = [SELECT Id FROM Lead];
        Test.startTest();
        FutureHandler.deduplicateLeads(new Set<Id> {leads[0].Id});
        FutureHandler.deduplicateLeads(new Set<Id> {individuals[0].Id});
        Test.stopTest();
    }

    @isTest
    static void asyncOperationUtilTest() {
        List<Lead> leads = [SELECT Id FROM Lead];
        Test.startTest();
        AsyncOperationUtil.logSuccessFutureDeDuplicateLeads(leads[0].Id);
        AsyncOperationUtil.logFailureFutureDeDuplicateLeads(leads[0].Id, 'Error');
        AsyncOperationUtil.dmlCachedAsyncOperations();
        AsyncOperationUtil.createIPQualityScoreCheckRecord(leads[0].Id, 'Future');
        Async_Operation__c asyncOp = new Async_Operation__c();
        asyncOp.Operation__c = 'IPQualityScoreCheck';
        asyncOp.Async_Type__c = 'Future';
        asyncOp.Record_Id__c = leads[0].Id;
        insert asyncOp;
        AsyncOperationUtil.createFailureAsyncOperationDMLInstance(asyncOp.Id, 'Test', 'Additional Details');
        AsyncOperationUtil.createSuccessAsyncOperationDMLInstance(asyncOp.Id, 'Test', 'Additional Details');
        Test.stopTest();
    }
    
    @isTest
    static void dmlCachedAsyncOperationsTest(){
        Lead leadRecord = DataFactoryTest.createListLead();
        leadRecord.Ad_Click_Id__c = '12345678';
        insert leadRecord;
        leadRecord.Status = 'Working Lead';
        leadRecord.Sub_Disposition__c = 'Call Transferred from Fronter';  
        update leadRecord;
        leadRecord.Status = 'New';
        leadRecord.Sub_Disposition__c = 'No Answer';  
        update leadRecord;
        Test.startTest();
        leadRecord.Status = 'Working Lead';
        leadRecord.Sub_Disposition__c = 'Call Transferred from Fronter';
        update leadRecord;
        Test.stopTest();
        
        List<Async_Operation__c> asyncOperationToVerify = [SELECT Id, Operation__c, Status__c FROM Async_Operation__c WHERE Lead__c = :leadRecord.Id AND Operation__c = 'RedTrack_LeadQualification'];
        Assert.areEqual(true, asyncOperationToVerify.Size() > 0,'An AsyncOperation record already exists for this event. Only one record is allowed per event.');
    }
}