@IsTest
public with sharing class Batch_PopulateOppLastContactDateTimeTest {

    @testSetup
    static void setupData() {
        Account acct = new Account(Name = 'Test Account');
        insert acct;
  
        Opportunity opportunity = new Opportunity(
            Name = 'Test Opportunity', StageName = OpportunityUtil.STAGE_CLOSED_WON_PENDING,
            CloseDate = Date.today(), AccountId = acct.Id
        );
        insert opportunity;
		DateTime testCreatedDate = DateTime.now().addDays(-15);

        smagicinteract__smsMagic__c sms = new smagicinteract__smsMagic__c(
            smagicinteract__Opportunity__c = opportunity.Id,
            smagicinteract__PhoneNumber__c = '987654321',
            smagicinteract__SenderId__c = 'Transactional',
            smagicinteract__external_field__c = smagicinteract.ApexAPI.generateUniqueKey(),
            smagicinteract__SMSText__c= 'test'
        );
        insert sms;
        Test.setCreatedDate(sms.Id, testCreatedDate);

        Task callTask = new Task(
            WhatId = opportunity.Id,
            Subject = 'Call with customer',
            Five9__Five9TaskType__c = 'Call'
        );
        insert callTask;
		Test.setCreatedDate(callTask.Id, testCreatedDate);
        Task emailTask = new Task(
            WhatId = opportunity.Id,
            Subject = 'Email to customer',
            TaskSubtype = 'Email'
        );
        insert emailTask;
		Test.setCreatedDate(emailTask.Id, testCreatedDate);
    }

    @IsTest
    static void testBatchPopulateLastContactDateTime() {
        Test.startTest();
        Batch_PopulateOppLastContactDateTime batch = new Batch_PopulateOppLastContactDateTime();
        batch.query = 'SELECT Id, Last_SMS__c, Last_Call__c, Last_Email__c FROM Opportunity WHERE CreatedDate = Last_N_Days:7';
        Database.executeBatch(batch, 200);
        Test.stopTest();
        List<Opportunity> updatedOpps = [SELECT Id, Last_SMS__c, Last_Call__c, Last_Email__c, Last_Contacted_DateTime__c 
                                         FROM Opportunity WHERE CreatedDate = Last_N_Days:7];
        for (Opportunity opp : updatedOpps) {
            System.assertNotEquals(null, opp.Last_SMS__c, 'Last_SMS__c should be populated');
            System.assertNotEquals(null, opp.Last_Call__c, 'Last_Call__c should be populated');
            System.assertNotEquals(null, opp.Last_Email__c, 'Last_Email__c should be populated');
            System.assertNotEquals(null, opp.Last_Contacted_DateTime__c, 'Last_Contacted_DateTime__c should be populated');
        }
    }
}