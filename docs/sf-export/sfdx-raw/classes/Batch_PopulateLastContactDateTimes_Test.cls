@IsTest
public with sharing class Batch_PopulateLastContactDateTimes_Test {
    
    @testSetup
    static void setupData() {
        Account acct = new Account(Name = 'Test Account');
        insert acct;
		DateTime testCreatedDate = DateTime.now().addDays(-15);

        smagicinteract__smsMagic__c sms = new smagicinteract__smsMagic__c(
            smagicinteract__Account__c = acct.Id,
            smagicinteract__PhoneNumber__c = '987654321',
            smagicinteract__SenderId__c = 'Transactional',
            smagicinteract__external_field__c = smagicinteract.ApexAPI.generateUniqueKey(),
            smagicinteract__SMSText__c= 'test'
        );
        insert sms;
        Test.setCreatedDate(sms.Id, testCreatedDate);

        Task callTask = new Task(
            WhatId = acct.Id,
            Subject = 'Call with customer',
            Five9__Five9TaskType__c = 'Call'
        );
        insert callTask;
		Test.setCreatedDate(callTask.Id, testCreatedDate);
        Task emailTask = new Task(
            WhatId = acct.Id,
            Subject = 'Email to customer',
            TaskSubtype = 'Email'
        );
        insert emailTask;
		Test.setCreatedDate(emailTask.Id, testCreatedDate);
    }

    @IsTest
    static void testBatchPopulateLastContactDateTime() {
        Test.startTest();
        Batch_PopulateLastContactDateTime batch = new Batch_PopulateLastContactDateTime();
        batch.query = 'SELECT Id, Last_SMS__c, Last_Call__c, Last_Email__c FROM Account WHERE CreatedDate = Last_N_Days:7';
        Database.executeBatch(batch, 200);
        Test.stopTest();
        List<Account> updatedAccounts = [SELECT Id, Last_SMS__c, Last_Call__c, Last_Email__c, Last_Contacted_DateTime__c FROM Account WHERE CreatedDate = Last_N_Days:7];
        for (Account acct : updatedAccounts) {
            System.assertNotEquals(null, acct.Last_SMS__c, 'Last_SMS__c should be populated');
            System.assertNotEquals(null, acct.Last_Call__c, 'Last_Call__c should be populated');
            System.assertNotEquals(null, acct.Last_Email__c, 'Last_Email__c should be populated');
            System.assertNotEquals(null, acct.Last_Contacted_DateTime__c, 'Last_Contacted_DateTime__c should be populated');
        }
    }
}