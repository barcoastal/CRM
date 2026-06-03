@isTest
public with sharing class QuoteTrigger_Test {
    @isTest
    static void quoteTriggerTest() {
        Opportunity opp = new Opportunity();
        opp.Name = 'Test Opp';
        opp.CloseDate = System.today();
        opp.StageName = 'Closed Won';
        insert opp;
        Test.startTest();
        Quote quoteRecord = new Quote();
        quoteRecord.Name = 'Test Quote';
        quoteRecord.OpportunityId = opp.Id;
        insert quoteRecord;
        Test.stopTest();
    }
}