@isTest
public class Five9CallLogDataTest {
    
    @TestSetup
    public static void TestSetup(){
        Lead leadInstance = dataFactoryTest.createListLead();
        insert leadInstance;
        
        Five9_Call_Log__c five9CallLog = dataFactoryTest.createFive9CallLog();
        five9CallLog.Disposition__c = 'Debt Too New_A';
        five9CallLog.Lead__c = leadInstance.Id;
        insert five9CallLog;
    }
   
    @isTest
    static void getFive9RecordCountRelatedLeadTest() {
        Lead leadInstnace = [SELECT Id FROM Lead LIMIT 1];
        
        Test.startTest();
        Map<Id, AggregateResult> aggregateResult = Five9CallLogData.getFive9RecordCountRelatedLead(New Set<Id> {leadInstnace.Id});
        Test.stopTest();
        
        Assert.areEqual(!aggregateResult.isEmpty(),True);
    }
    
    @isTest
    static void getFive9LeadQualifiedDispositionsTest() {
        
       Test.startTest();
       List<Five9_Connector_Disposition__mdt> five9LeadQualificationDispositionsList = Five9CallLogData.getFive9LeadQualifiedDispositions();
       Test.stopTest(); 
        
       Assert.areEqual(!five9LeadQualificationDispositionsList.isEmpty(),True);
    }
}