@isTest
public with sharing class Batch_CleanUpLeadIndustry_Test {
    @isTest
    static void testIndustryCleanUp() {
        Lead leadRecord = new Lead();
        leadRecord.LastName = 'Test';
        leadRecord.Industry = 'Test Industry';
        insert leadRecord;
        Test.startTest();
        Database.executeBatch(new Batch_CleanUpLeadIndustry(), 200);
        Test.stopTest();
        List<Lead> leadToVerify = [SELECT Id, Other_Industry__c, Industry FROM Lead WHERE Id = :leadRecord.Id];
        Assert.areEqual('Other', leadToVerify[0].Industry);
        Assert.areEqual('Test Industry', leadToVerify[0].Other_Industry__c);
    }
}