@isTest
public with sharing class Batch_CleanUpAccountIndustry_Test {
    @isTest
    static void testIndustryCleanUp() {
        Account accountRecord = new Account();
        accountRecord.Name = 'Test';
        accountRecord.Industry = 'Test Industry';
        insert accountRecord;
        Test.startTest();
        Database.executeBatch(new Batch_CleanUpAccountIndustry(), 200);
        Test.stopTest();
        List<Account> accountToVerify = [SELECT Id, Industry, Other_Industry__c FROM Account WHERE Id = :accountRecord.Id];
        Assert.areEqual('Other', accountToVerify[0].Industry);
        Assert.areEqual('Test Industry', accountToVerify[0].Other_Industry__c);
    }
}