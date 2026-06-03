@isTest
private class Batch_SyncToFive9List_Test {

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
        newLead.Redial_Time__c = Datetime.now().addMinutes(30);
        insert newLead;

        CampaignMember cmpMbr = new CampaignMember(CampaignId = cmp.Id, LeadId = newLead.Id);
        insert cmpMbr;

        Test.startTest();

        //Re-Sync the Lead to five9 list based on Redial Time
        Id jobId = Database.executeBatch(new Batch_SyncToFive9List());

        Test.stopTest();

        Assert.areEqual(true, [SELECT Id, Synced_to_Five9_List__c FROM Lead LIMIT 1].Synced_to_Five9_List__c);    
    }
}