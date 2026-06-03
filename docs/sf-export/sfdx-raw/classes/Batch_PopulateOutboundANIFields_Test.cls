/**
 * @description: Class to cover the test cases of the Batch_PopulateOutboundANIFields class
**/
@isTest
public with sharing class Batch_PopulateOutboundANIFields_Test {
    /**
     * @description: Test setup method to create the test records
    **/
    @testSetup
    static void makeData() { 
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler());
        
        Five9LSP__Five9_LSP_Settings__c five9Settings = DataFactoryTest.createFive9Settings();
        insert five9Settings;
           Five9_API__c five9ApiSettings = DataFactoryTest.createFive9ApiSettings();
        insert five9ApiSettings;

       five9_lsp2__Five9_Data_Center__c five9Lsp2DataCenter = DataFactoryTest.createFive9Lsp2DataCenter();
        insert five9Lsp2DataCenter;
        five9_lsp2__Five9_Domain__c five9Lsp2Domain = DataFactoryTest.createFive9Lsp2Domain(five9Lsp2DataCenter.Id);
        insert five9Lsp2Domain;
        five9_lsp2__Five9_Object_Fields_Mapping__c five9Lsp2ObjectFieldsMapping = DataFactoryTest.createFive9Lsp2ObjectFieldMapping(five9Lsp2Domain.Id);
        insert five9Lsp2ObjectFieldsMapping;
        five9_lsp2__Five9_List_Config__c five9List = DataFactoryTest.createFive9Lsp2List(five9Lsp2ObjectFieldsMapping.Id);
        five9List.five9_lsp2__Five9_List_Name__c = 'Test List';
        insert five9List;

        Lead leadRecord = DataFactoryTest.createBusinessLead();
        leadRecord.Phone = '8888888888';
        leadRecord.Email = 'testemail1@gmail.com';
        leadRecord.Five9_List_Id__c = five9List.Id;
        insert leadRecord;

        Lead leadRecord2 = DataFactoryTest.createBusinessLead();
        leadRecord2.Phone = '8888888888';
        leadRecord2.Email = 'testemail1@gmail.com';
        leadRecord2.Five9_List_Id__c = five9List.Id;
        insert leadRecord2;

        Lead preLead = DataFactoryTest.createPreLead();
        preLead.Phone = '8888888888';
        preLead.Email = 'testemail2@gmail.com';
        insert preLead;

        Lead preLead2 = DataFactoryTest.createPreLead();
        preLead2.Phone = '8888888888';
        preLead2.Email = 'testemail2@gmail.com';
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
        List<Five9LSP__Five9_List__c> five9List = [SELECT Id FROM Five9LSP__Five9_List__c];
        Test.startTest();
        Batch_PopulateOutboundANIFields.PopulateOutboundANIFields(campaignList[0].Id);
        Test.stopTest();       
    }
}