@IsTest
private class Batch_ManageFive9List_Test {
    
    @IsTest
    static void addFive9ListIdTest(){

        Five9LSP__Five9_List__c five9List = new Five9LSP__Five9_List__c();
        five9List.Name = 'Test Lead List';
        five9List.Five9LSP__API_URL__c = 'https://test.five9.com';
        five9List.Five9LSP__Five9_Domain__c = 'test-sandbox';
        five9List.Five9LSP__Five9_User_Name__c = 'User Test';
        five9List.Five9LSP__Five9_User_Password__c = 'q2w3e456y7';
        five9List.Five9LSP__Controlling_Object__c = 'lead';
        insert five9List;

        Test.startTest();

        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());

        Campaign cmp = new Campaign();
        cmp.Name = 'Test Campaign';
        cmp.Five9_List_Id__c = five9List.Id;
        insert cmp;

        Lead newLead = new Lead(LastName = 'Test Lead', Phone='4166661216', Company = 'Test Company',Outbound_ANI_From__c = '32423423423',Outbound_ANI_Date__c = Date.today(),Outbound_ANI_Identifier__c = '32423423423');
        insert newLead;

        CampaignMember cmpMbr = new CampaignMember(CampaignId = cmp.Id, LeadId = newLead.Id);
        insert cmpMbr;

        //Activated the five9 list in campaign record
        Id jobId = Database.executeBatch(new Batch_ManageFive9List(cmp.Id, true, five9List.Id));

        Test.stopTest();

        Lead verifyLead = [SELECT Id, Add_to_f9list_Id__c, Five9_List_Id__c FROM Lead LIMIT 1];

        Assert.isNotNull(jobId);
        Assert.isNull(verifyLead.Add_to_f9list_Id__c);
        Assert.areEqual(five9List.Id, verifyLead.Five9_List_Id__c);
        Assert.areEqual('Active', [SELECT Id, Status FROM Campaign LIMIT 1].Status);        
    }

    @IsTest
    static void deleteFive9ListIdTest(){
        
        Five9LSP__Five9_List__c five9List = new Five9LSP__Five9_List__c();
        five9List.Name = 'Test Lead List';
        five9List.Five9LSP__API_URL__c = 'https://test.five9.com';
        five9List.Five9LSP__Five9_Domain__c = 'test-sandbox';
        five9List.Five9LSP__Five9_User_Name__c = 'User Test';
        five9List.Five9LSP__Five9_User_Password__c = 'q2w3e456y7';
        five9List.Five9LSP__Controlling_Object__c = 'lead';
        insert five9List;

        Test.startTest();

        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());

        Campaign cmp = new Campaign();
        cmp.Name = 'Test Campaign';
        cmp.Five9_List_Id__c = five9List.Id;
        insert cmp;

        Lead newLead = new Lead(LastName = 'Test Lead', Phone='4166661216', Company = 'Test Company');
        insert newLead;

        CampaignMember cmpMbr = new CampaignMember(CampaignId = cmp.Id, LeadId = newLead.Id);
        insert cmpMbr;

        //Deactivated the five9 list in campaign record
        Id jobId = Database.executeBatch(new Batch_ManageFive9List(cmp.Id, false, five9List.Id));

        Test.stopTest();

        Lead verifyLead = [SELECT Id, Delete_from_f9list_id__c, Five9_List_Id__c FROM Lead LIMIT 1];

        Assert.isNotNull(jobId);
        Assert.isNull(verifyLead.Delete_from_f9list_id__c);
        Assert.isNull(verifyLead.Five9_List_Id__c);
        Assert.areEqual('Inactive', [SELECT Id, Status FROM Campaign LIMIT 1].Status);        
    }
}