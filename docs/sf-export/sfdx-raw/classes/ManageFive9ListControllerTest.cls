@isTest
private class ManageFive9ListControllerTest {

    @TestSetup
    static void makeData(){

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

        Campaign cmp = new Campaign();
        cmp.Name = 'Test Campaign';
        cmp.Five9_lsp2_List_Id__c = five9List.Id;
        insert cmp;
    }

    @IsTest
    static void getCampaignDataTest(){

        Id cmpId = [SELECT Id FROM Campaign LIMIT 1].Id;
        
        Test.startTest();
        Campaign cmpInstance = ManageFive9ListController.getCampaignData(cmpId);
        Test.stopTest();
        
        Assert.isNull(cmpInstance.Status);
        Assert.areEqual([SELECT Id FROM five9_lsp2__Five9_List_Config__c LIMIT 1].Id, cmpInstance.Five9_lsp2_List_Id__c);
    }

    @IsTest
    static void AppendLeadAndAddFive9ListTest(){

        Id cmpId = [SELECT Id FROM Campaign LIMIT 1].Id;
        Id five9ListId = [SELECT Id FROM five9_lsp2__Five9_List_Config__c LIMIT 1].Id;
        
        Test.startTest();
        ManageFive9ListController.updateCampaignWithStatus(cmpId, 'AppendLeadAndAddToFive9', five9ListId);
        Test.stopTest();
        List<AsyncApexJob> apexJobs = [SELECT Id FROM AsyncApexJob];
        Assert.areEqual(2, apexJobs.size(), 'Verifying the apex jobs size');
    }

    @IsTest
    static void AddFive9ListTest(){

        Id cmpId = [SELECT Id FROM Campaign LIMIT 1].Id;
        Id five9ListId = [SELECT Id FROM five9_lsp2__Five9_List_Config__c LIMIT 1].Id;
        
        Test.startTest();
        ManageFive9ListController.updateCampaignWithStatus(cmpId, 'AddToFive9', five9ListId);
        Test.stopTest();
        List<AsyncApexJob> apexJobs = [SELECT Id FROM AsyncApexJob];
        Assert.areEqual(1, apexJobs.size(), 'Verifying the apex jobs size');
    }

    @IsTest
    static void deactivateFive9ListTest(){

        Id cmpId = [SELECT Id FROM Campaign LIMIT 1].Id;
        Id five9ListId = [SELECT Id FROM five9_lsp2__Five9_List_Config__c LIMIT 1].Id;
        
        Test.startTest();
        ManageFive9ListController.updateCampaignWithStatus(cmpId, 'RemoveFromFive9', five9ListId);
        Test.stopTest();
        List<AsyncApexJob> apexJobs = [SELECT Id FROM AsyncApexJob];
        Assert.areEqual(1, apexJobs.size(), 'Verifying the apex jobs size');
    }
}