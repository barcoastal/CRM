@isTest
public with sharing class Batch_UpdatePhoneDatabase_Test {

    @TestSetup
    static void makeData(){
        Lead leadRecord = DataFactoryTest.createListLead();
        leadRecord.Phone='9876543201';
        insert leadRecord;

        Lead leadRecord1 = DataFactoryTest.createListLead();
        leadRecord1.Phone='98765432011';
        insert leadRecord1;
    }

    @isTest
    static void testLeadInsertAndUpdates() {
        Test.startTest();
        Database.executeBatch(new Batch_UpdatePhoneDatabase());
        Test.stopTest();
        List<Phone_Database__c> phDBListToVerify = [SELECT Id, Count__c, Phone_Number__c FROM Phone_Database__c];
        Assert.areEqual(1, phDBListToVerify.size(), 'Verify the number of Phone Database size');
        Assert.areEqual(1, Integer.valueOf(phDBListToVerify[0].Count__c), 'Verify the count of the phone number');
        Assert.areEqual('9876543201', phDBListToVerify[0].Phone_Number__c, 'Verify the count of the phone number');
    }
}