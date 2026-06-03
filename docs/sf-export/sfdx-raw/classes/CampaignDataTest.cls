@isTest
private class CampaignDataTest {

    @TestSetup
    static void makeData(){

        Five9LSP__Five9_List__c five9List = new Five9LSP__Five9_List__c();
        five9List.Name = 'Test Lead List';
        five9List.Five9LSP__API_URL__c = 'https://test.five9.com';
        five9List.Five9LSP__Five9_Domain__c = 'sandbox';
        five9List.Five9LSP__Five9_User_Name__c = 'User Test';
        five9List.Five9LSP__Five9_User_Password__c = 'q2w3e456y7';
        five9List.Five9LSP__Controlling_Object__c = 'lead';
        insert five9List;

        Campaign cmp = new Campaign();
        cmp.Name = 'Test Campaign';
        cmp.Five9_List_Id__c = five9List.Id;
        cmp.Status = 'In Progress';
        insert cmp;
        
        Id preLeadRTId = LeadUtil.getRecordTypeId(LeadUtil.RT_PRE_LEAD);
        lead leadList = new Lead();
        leadList.LastName = 'test';
        leadList.phone = '123454345';
        leadList.industry = 'Automotive';
        leadlist.recordTypeId = preLeadRTId;
        insert leadList;
        
        campaignMember campMember = new CampaignMember();
        campMember.CampaignId = cmp.Id;
        campMember.LeadId = leadList.Id;
        insert campMember;
    }
    
    @IsTest
    static void queryCampaignTest(){

        Id cmpId = [SELECT Id FROM Campaign LIMIT 1].Id;
        
        Test.startTest();
        Campaign verifyCampaign = CampaignData.queryCampaign(cmpId)[0];
        Test.stopTest();
        
        Assert.areEqual('In Progress', verifyCampaign.Status);
        Assert.areEqual([SELECT Id FROM Five9LSP__Five9_List__c LIMIT 1].Id, verifyCampaign.Five9_List_Id__c);
    }
    
    @IsTest
    static void campaingLeadsWithoutOutboundANITest(){

        Id cmpId = [SELECT Id FROM Campaign LIMIT 1].Id;
        Test.startTest();
        List<AggregateResult> leadsCount = CampaignData.campaingLeadsWithoutOutboundANI(cmpId);
        Test.stopTest();
        
        Assert.areEqual(Integer.valueOf(leadsCount[0].get('leadsCount')),1);
    }
}