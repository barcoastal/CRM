@isTest
private class Schedule_SyncToFive9List_Test {

    @isTest
    static void syncToFive9ListTest() {
        
        Five9LSP__Five9_List__c five9List = DataFactoryTest.createFive9List();
        insert five9List;

        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());

        Campaign cmp = new Campaign();
        cmp.Name = 'Test Campaign';
        cmp.Five9_List_Id__c = five9List.Id;
        insert cmp;

        Lead newLead = DataFactoryTest.createListLead();
        newLead.Five9_List_Id__c = five9List.Id;
        newLead.Synced_to_Five9_List__c = false;
        newLead.Redial_Time__c = Datetime.now().addMinutes(-75);
        insert newLead;

        CampaignMember cmpMbr = new CampaignMember(CampaignId = cmp.Id, LeadId = newLead.Id);
        insert cmpMbr;

        Test.startTest();

        //Re-Sync the Lead to five9 list based on Redial Time
        Datetime dt = System.now().addMinutes(1);
        String CRON_EXP = '0 '+ dt.minute() + ' * ' + dt.day() + ' ' + dt.month() + ' ? ' + dt.year();
        string jobid = System.schedule('Sync to Five9 List'+System.now(), CRON_EXP, new Schedule_SyncToFive9List());

        Test.stopTest();

        List<AsyncApexJob> jobsScheduled = [SELECT Id, ApexClassID, ApexClass.Name, Status, JobType FROM AsyncApexJob WHERE JobType = 'ScheduledApex'];
        Assert.areEqual(1, jobsScheduled.size(), 'Expecting one scheduled job');
        Assert.areEqual('Schedule_SyncToFive9List', jobsScheduled[0].ApexClass.Name, 'Expecting specific scheduled job');

        List<AsyncApexJob> jobsApexBatch = [SELECT Id, ApexClassID, ApexClass.Name, Status, JobType FROM AsyncApexJob WHERE JobType = 'BatchApex'];
        Assert.areEqual(1, jobsApexBatch.size(), 'Expecting one apex batch job');
        Assert.areEqual('Batch_SyncToFive9List', jobsApexBatch[0].ApexClass.Name, 'Expecting specific batch job');   
    }
}