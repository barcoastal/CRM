@isTest
private class Five9AddNumbersToDnc_Test {
 @TestSetup
    static void setup(){
        LeadTriggerHandler.preventRecursion = true;
          Five9_API__c five9ApiSettings = DataFactoryTest.createFive9ApiSettings();
        insert five9ApiSettings;
         Five9LSP__Five9_LSP_Settings__c five9Settings = DataFactoryTest.createFive9Settings();
        insert five9Settings;

        Five9LSP__Five9_List__c five9List = DataFactoryTest.createFive9List();
        insert five9List;
        Five9LSP__Five9_List__c five9ListOpp = DataFactoryTest.createFive9ListOpportunity();
        insert five9ListOpp;
        // Create test lead
        Lead testLead = DataFactoryTest.createListLead();
        testLead.Phone = '9087654321';
        testLead.Work_Phone__c = '8907612354';
        testLead.MobilePhone = '7890456123';
        testLead.Add_to_f9list_Id__c = five9List.Id;
        insert testLead;  
        
        // Create test Opportunity
        Opportunity opp = DataFactoryTest.createOpportunity();
        opp.Phone__c ='7680951234';
        insert opp; 
    }
     @IsTest
    static void testAddNumbersToDncExceptionForLead(){
        Lead l = [select id,Phone,Work_Phone__c,MobilePhone from lead limit 1];
        list<Id> recordIdList = New List<Id>();
    	recordIdList.add(l.Id);
        List<Five9AddNumbersToDnc.FlowOutputVariable> result = new List<Five9AddNumbersToDnc.FlowOutputVariable>();
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('addNumbersToDNC', false));
        result  = Five9AddNumbersToDnc.addNumbersToDNCBasedOnRecordId(recordIdList);
        Test.stopTest();
        Assert.areEqual(false,result[0].isSuccess);
    }
     @IsTest
    static void testAddNumbersToDncForLead(){
        Lead l = [select id,Phone,Work_Phone__c,MobilePhone from lead limit 1];
        list<Id> recordIdList = New List<Id>();
    	recordIdList.add(l.Id);
        List<Five9AddNumbersToDnc.FlowOutputVariable> result = new List<Five9AddNumbersToDnc.FlowOutputVariable>();
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('addNumbersToDNC', true));
        result  = Five9AddNumbersToDnc.addNumbersToDNCBasedOnRecordId(recordIdList);
        Test.stopTest();
        Assert.areEqual(true,result[0].isSuccess);
    }
    @IsTest
    static void testAddNumbersToDncForOpportunity(){
        Opportunity opp = [Select id,Phone__c from Opportunity limit 1];
        list<Id> recordIdList = New List<Id>();
        recordIdList.add(opp.Id);
        List<Five9AddNumbersToDnc.FlowOutputVariable> result = new List<Five9AddNumbersToDnc.FlowOutputVariable>();
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('addNumbersToDNC', true));
        result  = Five9AddNumbersToDnc.addNumbersToDNCBasedOnRecordId(recordIdList);
        system.debug('result----'+result);
        Test.stopTest();
        Assert.areEqual(true,result[0].isSuccess);
    }
}