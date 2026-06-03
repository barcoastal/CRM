@isTest
public class AsyncOpIPQualityScoreCheckTest {
    @testSetup
    static void makeData() {
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        Lead leadRec = DataFactoryTest.createWebLead();
        insert leadRec;
    }

    @isTest
    private static void callQualityServiceTest() {
        Map<Id, Async_Operation__c> asyncOperationMap = new Map<Id, Async_Operation__c>([SELECT Id, Individual__c, Individual__r.Phone__c FROM Async_Operation__c]);
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        Map<String, Object> inputMap = new Map<String, Object>();
        inputMap.put('asyncOperationIds', asyncOperationMap.keySet());
        AsyncOpIPQualityScoreCheck.execute(inputMap, null);
        Test.stopTest();
        List<Async_Operation__c> asyncOperationsToVerify = [SELECT Id, Status__c FROM Async_Operation__c];
        //Assert.areEqual('Completed', asyncOperationsToVerify[0].Status__c, 'Verifying the Async Operation is successfully completed.');
    }
}