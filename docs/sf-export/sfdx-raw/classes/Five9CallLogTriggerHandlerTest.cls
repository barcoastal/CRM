@isTest
private class Five9CallLogTriggerHandlerTest {

    @isTest
    static void createTaskMethod(){
    
        Opportunity oppInstance = DataFactoryTest.createOpportunity();
        insert oppInstance;
        oppInstance.StageName = 'Agreements Received';
        update oppInstance;
        
        List<Lead> leadsToInsert = new List<Lead>{
            new Lead(FirstName='John', LastName='Doe', Company='Acme Inc.', Phone='9876543201')
        };        
        
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        insert leadsToInsert;
        
        Test.startTest();
            Lead leadRec = [SELECT Id, Name FROM Lead LIMIT 1];
            Opportunity opp = [SELECT Id, Name FROM Opportunity LIMIT 1];
            system.debug(':::leadRec'+leadRec+':::oppId'+ opp.Id);
            Five9_Call_Log__c five9CallLogRec = DataFactoryTest.createFive9CallLog();
            five9CallLogRec.Lead__c = leadRec.Id;
            five9CallLogRec.Opportunity__c = opp.Id;
            insert five9CallLogRec;        
        Test.stopTest();
    }  
}