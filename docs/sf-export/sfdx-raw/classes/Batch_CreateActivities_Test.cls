@isTest
private class Batch_CreateActivities_Test {
    
    /*@isTest
    static void Batch_CreateActivities_Success() {
		
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        Lead newLead = DataFactoryTest.createBusinessLead();
        newLead.External_Legacy_CRM_Id__c = '2247124';
        insert newLead;

        Account newAcc = DataFactoryTest.createBusinessAccount();
        newAcc.External_Legacy_CRM_Id__c = '2404840';
        insert newAcc;

        Opportunity newOpp = DataFactoryTest.createOpportunity();
        newOpp.External_Legacy_CRM_Id__c = '2404840';
        newOpp.AccountId = newAcc.Id;
        insert newOpp;

        Contact newCon = DataFactoryTest.createContact();
        newCon.External_Legacy_CRM_Id__c = '2404840';
        newCon.AccountId = newAcc.Id;
        insert newCon;

        LegacyCRMNote__c crmLeadNote = new LegacyCRMNote__c();
        crmLeadNote.Deal_Id__c = '2247124';
        crmLeadNote.Disp_Id__c = '151368';
        crmLeadNote.Date__c = Date.newInstance(2023, 07, 07);
        crmLeadNote.Time__c = Time.newInstance(08, 13, 00, 000);
        crmLeadNote.User__c = 'Johnny Angelides';
        crmLeadNote.Dispo__c = 'Working Lead';
        crmLeadNote.Note__c = 'CALL BACK DATE/TIME-> 20230710 @ 03:00 PM EST';

        LegacyCRMNote__c crmOppNote = new LegacyCRMNote__c();
        crmOppNote.Deal_Id__c = '2404840';
        crmOppNote.Disp_Id__c = '151324';
        crmOppNote.Date__c = Date.newInstance(2023, 06, 07);
        crmOppNote.Time__c = Time.newInstance(18, 01, 00, 000);
        crmOppNote.User__c = 'Christopher Boulahanis Closer';
        crmOppNote.Dispo__c = 'CBK-Call Back';
        crmOppNote.Note__c = 'texted client sop pays done. Missed welcome call advised to call the back f/u\nCALL BACK DATE/TIME-> 20230707 @ 11:15 AM EST';
        
        LegacyCRMNote__c crmNote = new LegacyCRMNote__c();
        crmNote.Deal_Id__c = '2247124';
        crmNote.Disp_Id__c = '';
        crmNote.Date__c = Date.newInstance(2023, 06, 07);
        crmNote.Time__c = Time.newInstance(08, 13, 00, 000);
        crmNote.User__c = 'Johnny Angelides';
        crmNote.Dispo__c = 'Working Lead';
        crmNote.Note__c = 'CALL BACK DATE/TIME-> 20230710 @ 03:00 PM EST';
        
        insert new List<LegacyCRMNote__c> {crmLeadNote, crmOppNote, crmNote};
        
        Test.startTest();
        Database.executeBatch(new Batch_CreateActivities());
        Test.stopTest();

        List<Task> verifyTask = [
            SELECT Id, ActivityDate, RecordTypeId, External_Legacy_CRM_Id__c, Subject, Description, 
            Legacy_CRM_User__c, WhoId, WhatId, Legacy_CRM_Activity_DateTime__c, AccountId FROM Task
        ];
        Id dispositionRTId = TaskUtil.getRecordTypeId('Disposition');

        if (verifyTask[0].External_Legacy_CRM_Id__c == '151368') {
            System.assertEquals(Date.newInstance(2023, 07, 07), verifyTask[0].ActivityDate);
            System.assertEquals(dispositionRTId, verifyTask[0].RecordTypeId);
            System.assertEquals('Working Lead', verifyTask[0].Subject);
            System.assertEquals('CALL BACK DATE/TIME-> 20230710 @ 03:00 PM EST', verifyTask[0].Description);
            System.assertEquals('Johnny Angelides', verifyTask[0].Legacy_CRM_User__c);
            System.assertEquals(newLead.Id, verifyTask[0].WhoId);
            System.assertEquals(Datetime.newInstance(2023, 07, 07, 08, 13, 00), verifyTask[0].Legacy_CRM_Activity_DateTime__c);
        } else {
            System.assertEquals(Date.newInstance(2023, 06, 07), verifyTask[1].ActivityDate);
            System.assertEquals(dispositionRTId, verifyTask[1].RecordTypeId);
            System.assertEquals('151324', verifyTask[1].External_Legacy_CRM_Id__c);
            System.assertEquals('CBK-Call Back', verifyTask[1].Subject);
            System.assertEquals('texted client sop pays done. Missed welcome call advised to call the back f/u\nCALL BACK DATE/TIME-> 20230707 @ 11:15 AM EST', verifyTask[1].Description);
            System.assertEquals('Christopher Boulahanis Closer', verifyTask[1].Legacy_CRM_User__c);
            System.assertEquals(newCon.Id, verifyTask[1].WhoId);
            System.assertEquals(newOpp.Id, verifyTask[1].WhatId);
            System.assertEquals(newAcc.Id, verifyTask[1].AccountId);
            System.assertEquals(Datetime.newInstance(2023, 06, 07, 18, 01, 00), verifyTask[1].Legacy_CRM_Activity_DateTime__c);
        }
        
        List<LegacyCRMNote__c> crmNotes = [SELECT Id, Converted_to_Activity__c FROM LegacyCRMNote__c];
        
        System.assertEquals(true, crmNotes[0].Converted_to_Activity__c);
        System.assertEquals(true, crmNotes[1].Converted_to_Activity__c);
        System.assertEquals(false, crmNotes[2].Converted_to_Activity__c);
        
        Application_Log__c verifyLog = [SELECT Id, Exception_Message__c, Statement__c, Log_Type__c FROM Application_Log__c WHERE Legacy_CRM_Note__c != NULL LIMIT 1];
        System.assertEquals('External_Legacy_CRM_Id__c not specified.', verifyLog.Exception_Message__c);
    }*/
}