@IsTest
private class RelateSMSTaskHandlerTest {

    @IsTest
    static void createChildTaskTest(){
        
        /*Account acct = DataFactoryTest.createAccount();
        insert acct;
        
        Contact cont = DataFactoryTest.createContact();
        insert cont;
        
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        Lead lead = DataFactoryTest.createBusinessLead();
        lead.MobilePhone = '+18734560945';
        lead.Work_Phone__c = '8734560945';
        insert lead;

        SMS__c inboundSMS = DataFactoryTest.createInboundSMS();
        SMS__c outboundSMS = DataFactoryTest.createOutboundSMS();
        outboundSMS.To_Phone__c = '+18734560945';
        
        Test.startTest();
        List<Id> fixedSearchResults = new List<Id>{acct.Id, cont.Id, lead.Id};
        Test.setFixedSearchResults(fixedSearchResults);
        insert new List<SMS__c> {inboundSMS, outboundSMS};
        Test.stopTest();
        
        List<Task> verifyTask = [SELECT Id, Parent_SMS__c, WhoId, WhatId, Subject, Description, Status FROM Task];
        System.assertEquals(10, verifyTask.size());
        System.assertEquals(inboundSMS.Id, verifyTask[0].Parent_SMS__c);
        System.assertEquals(outboundSMS.Id, verifyTask[1].Parent_SMS__c);
        System.assertEquals(lead.Id, verifyTask[1].WhoId);
        System.assertEquals('SMS', verifyTask[2].Subject);
        System.assertEquals('Test SMS', verifyTask[3].Description);
        System.assertEquals('Completed', verifyTask[4].Status);
        System.assertEquals('Completed', verifyTask[5].Status);
        System.assertEquals(inboundSMS.Id, verifyTask[6].Parent_SMS__c);
        System.assertEquals(outboundSMS.Id, verifyTask[7].Parent_SMS__c);
        System.assertEquals(acct.Id, verifyTask[6].WhatId);
        System.assertEquals('SMS', verifyTask[7].Subject);
        System.assertEquals('Test SMS', verifyTask[6].Description);
        System.assertEquals('Completed', verifyTask[7].Status);
        System.assertEquals(inboundSMS.Id, verifyTask[8].Parent_SMS__c);
        System.assertEquals(outboundSMS.Id, verifyTask[9].Parent_SMS__c);
        System.assertEquals(cont.Id, verifyTask[8].WhoId);
        System.assertEquals('SMS', verifyTask[9].Subject);
        System.assertEquals('Test SMS', verifyTask[8].Description);
        System.assertEquals('Completed', verifyTask[9].Status);*/
    }
}