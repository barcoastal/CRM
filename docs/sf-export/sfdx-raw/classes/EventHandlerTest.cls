@IsTest
private class EventHandlerTest {
    
    
    @IsTest
    static void populateLastContactedDateTimeTest_WithLead() {
        Lead leadInstance = DataFactoryTest.createBusinessLead();
        insert leadInstance;

        Event eventInstance = DataFactoryTest.createEvent();
        eventInstance.WhoId = leadInstance.Id;

        Test.startTest();
        insert eventInstance;
        Test.stopTest();

        Lead leadInst = [SELECT Id, Last_Contacted_DateTime__c FROM Lead WHERE Id = :leadInstance.Id];
        Assert.isNotNull(leadInst.Last_Contacted_DateTime__c, 'Last Contacted Datetime should be populated in Lead.');
    }

    @IsTest
    static void populateLastContactedDateTimeTest_WithOpportunity() {
        Opportunity opportunityInstance = DataFactoryTest.createOpportunity();
        insert opportunityInstance;

        Event eventInstance = DataFactoryTest.createEvent();
        eventInstance.WhatId = opportunityInstance.Id;

        Test.startTest();
        insert eventInstance;
        Test.stopTest();

        Opportunity opportunityInst = [SELECT Id, Last_Contacted_DateTime__c FROM Opportunity WHERE Id = :opportunityInstance.Id];
        Assert.isNotNull(opportunityInst.Last_Contacted_DateTime__c, 'Last Contacted Datetime should be populated in Opportunity.');
    }
}