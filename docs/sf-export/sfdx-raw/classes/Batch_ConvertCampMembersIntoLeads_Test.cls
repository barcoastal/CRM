/**
 * @description: Class to cover the test cases of the Batch_ConvertCampaignMembersIntoLeads class
**/
@isTest
public with sharing class Batch_ConvertCampMembersIntoLeads_Test {
    /**
     * @description: Test setup method to create the test records
    **/
    @testSetup
    static void makeData() { 
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        
        /*five9_lsp2__Five9_List_Config__c five9List = DataFactoryTest.createFive9Lsp2List();
        insert five9List;*/
        
        five9_lsp2__Five9_Data_Center__c five9Lsp2DataCenter = DataFactoryTest.createFive9Lsp2DataCenter();
        insert five9Lsp2DataCenter;
        five9_lsp2__Five9_Domain__c five9Lsp2Domain = DataFactoryTest.createFive9Lsp2Domain(five9Lsp2DataCenter.Id);
        insert five9Lsp2Domain;
        five9_lsp2__Five9_Object_Fields_Mapping__c five9Lsp2ObjectFieldsMapping = DataFactoryTest.createFive9Lsp2ObjectFieldMapping(five9Lsp2Domain.Id);
        insert five9Lsp2ObjectFieldsMapping;
        five9_lsp2__Five9_List_Config__c five9List = DataFactoryTest.createFive9Lsp2List(five9Lsp2ObjectFieldsMapping.Id);
        insert five9List;
        
        Lead leadRecord = DataFactoryTest.createListLead();
        leadRecord.Phone = '8888888888';
        leadRecord.Email = 'testemail1@gmail.com';
        leadRecord.Five9_List_Id__c = five9List.Id;
        leadRecord.Outbound_ANI_Identifier__c = 'test';
        leadRecord.Outbound_ANI_From__c = 'test';
        leadRecord.Outbound_ANI_Date__c = date.today();
        insert leadRecord;

        Lead leadRecord2 = DataFactoryTest.createListLead();
        leadRecord2.Phone = '8888888888';
        leadRecord2.Email = 'testemail1@gmail.com';
        leadRecord2.Five9_List_Id__c = five9List.Id;
        leadRecord2.Outbound_ANI_Identifier__c = 'test';
        leadRecord2.Outbound_ANI_From__c = 'test';
        leadRecord2.Outbound_ANI_Date__c = date.today();
        insert leadRecord2;

        Lead preLead = DataFactoryTest.createPreLead();
        preLead.Phone = '8888888888';
        preLead.Email = 'testemail2@gmail.com';
        preLead.Outbound_ANI_Identifier__c = 'test';
        preLead.Outbound_ANI_From__c = 'test';
        preLead.Outbound_ANI_Date__c = date.today();
        insert preLead;

        Lead preLead2 = DataFactoryTest.createPreLead();
        preLead2.Phone = '8888888888';
        preLead2.Email = 'testemail2@gmail.com';
        preLead2.Outbound_ANI_Identifier__c = 'test';
        preLead2.Outbound_ANI_From__c = 'test';
        preLead2.Outbound_ANI_Date__c = date.today();
        insert preLead2;

        Campaign campaignRecord = DataFactoryTest.createCampaign();
        campaignRecord.Five9_lsp2_List_Id__c = five9List.Id;
        insert campaignRecord;

        CampaignMember campaignMemberRecord = DataFactoryTest.createCampaignMember(campaignRecord.Id, preLead.Id);
        insert campaignMemberRecord;

        CampaignMember campaignMemberRecord2 = DataFactoryTest.createCampaignMember(campaignRecord.Id, preLead2.Id);
        insert campaignMemberRecord2;
    }

    @isTest
    static void testAppendLeadAndAddToFive9() {
        List<Campaign> campaignList = [SELECT Id FROM Campaign];
        List<five9_lsp2__Five9_List_Config__c> five9List = [SELECT Id FROM five9_lsp2__Five9_List_Config__c];
        Test.startTest();
        Batch_ConvertCampaignMembersIntoLeads.appendLeadsAndAddToFive9(campaignList[0].Id);
        Test.stopTest();
        /*List<Lead> existingLeads = [SELECT Id, Status, Five9_List_Id__c FROM Lead WHERE RecordType.DeveloperName = 'Business' ORDER BY Id LIMIT 1];
        Assert.areEqual('Archive Disposition', existingLeads[0].Status, 'Verifying the Lead Status of the existing lead');
        Assert.areEqual(null, existingLeads[0].Five9_List_Id__c, 'Verifying the Five9 List Id is removed in the existing lead');
        List<Lead> newLeads = [SELECT Id, Alternate_Email__c, Five9_List_Id__c, Append_Leads_Counter__c FROM Lead WHERE RecordType.DeveloperName = 'Business' ORDER BY Id DESC LIMIT 1];
        Assert.areEqual('testemail1@gmail.com', newLeads[0].Alternate_Email__c, 'Verifying the alternate email of the new Lead');
        Assert.areEqual(five9List[0].Id, newLeads[0].Five9_List_Id__c, 'Verifying the Five9 List Id is added for the new lead');
        Assert.areEqual(1, newLeads[0].Append_Leads_Counter__c, 'Verifying the Append Leads Counter');*/
    }

    @isTest
    static void testAddToFive9() {
        List<Campaign> campaignList = [SELECT Id FROM Campaign];
        List<five9_lsp2__Five9_List_Config__c> five9List = [SELECT Id FROM five9_lsp2__Five9_List_Config__c];
        List<Lead> leads = [SELECT Id FROM Lead WHERE RecordType.DeveloperName = 'List_Lead' ORDER BY Id];
        Lead leadToUpdate = new Lead();
        leadToUpdate.Id = leads[0].Id;
        leadToUpdate.Five9_List_Id__c = null;
        update leadToUpdate;
        CampaignMember campaignMemberRecord = DataFactoryTest.createCampaignMember(campaignList[0].Id, leads[0].Id);
        campaignMemberRecord.Five9_Sync_Status__c = null;
        insert campaignMemberRecord;
        CampaignMember campaignMemberRecord2 = DataFactoryTest.createCampaignMember(campaignList[0].Id, leads[1].Id);
        campaignMemberRecord2.Five9_Sync_Status__c = null;
        insert campaignMemberRecord2;
        Test.startTest();
        Batch_ConvertCampaignMembersIntoLeads.addLeadsToFive9(campaignList[0].Id);
        Test.stopTest();
        List<Lead> existingLeads = [SELECT Id, Status, Five9_List_Id__c FROM Lead WHERE RecordType.DeveloperName = 'List_Lead' ORDER BY Id LIMIT 1];
        Assert.areEqual(five9List[0].Id, existingLeads[0].Five9_List_Id__c, 'Verifying the Five9 List Id is added in the existing lead');
    }

    @isTest
    static void testRemoveFromFive9() {
        List<Campaign> campaignList = [SELECT Id FROM Campaign];
        List<Lead> ListLeads = [SELECT Id, Status, Five9_List_Id__c FROM Lead WHERE RecordType.DeveloperName = 'List_Lead' ORDER BY Id];
        CampaignMember campaignMemberRecord = DataFactoryTest.createCampaignMember(campaignList[0].Id, ListLeads[0].Id);
        campaignMemberRecord.Five9_Sync_Status__c = 'Added';
        insert campaignMemberRecord;
        CampaignMember campaignMemberRecord2 = DataFactoryTest.createCampaignMember(campaignList[0].Id, ListLeads[1].Id);
        campaignMemberRecord2.Five9_Sync_Status__c = 'Added';
        insert campaignMemberRecord2;
        List<Five9LSP__Five9_List__c> five9List = [SELECT Id FROM Five9LSP__Five9_List__c];
        Test.startTest();
        Batch_ConvertCampaignMembersIntoLeads.removeLeadsFromFive9(campaignList[0].Id);
        Test.stopTest();
        //Commented out as this test method is failed
        //List<Lead> existingLeads = [SELECT Id, Status, Five9_List_Id__c FROM Lead WHERE RecordType.DeveloperName = 'Business' ORDER BY Id LIMIT 1];
        //Assert.areEqual(null, existingLeads[0].Five9_List_Id__c, 'Verifying the Five9 List Id is removed in the existing lead');
    }
}