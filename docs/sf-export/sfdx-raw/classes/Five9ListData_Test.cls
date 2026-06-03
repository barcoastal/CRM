@isTest
private class Five9ListData_Test {

    @testSetup
    static void makeData(){
         Five9_API__c five9ApiSettings = DataFactoryTest.createFive9ApiSettings();
        insert five9ApiSettings;
        
        Five9LSP__Five9_LSP_Settings__c five9Settings = DataFactoryTest.createFive9Settings();
        insert five9Settings;

        Five9LSP__Five9_List__c five9List = DataFactoryTest.createFive9List();
        insert five9List;        
         
        five9_lsp2__Five9_Data_Center__c five9Lsp2DataCenter = DataFactoryTest.createFive9Lsp2DataCenter();
        insert five9Lsp2DataCenter;
        five9_lsp2__Five9_Domain__c five9Lsp2Domain = DataFactoryTest.createFive9Lsp2Domain(five9Lsp2DataCenter.Id);
        insert five9Lsp2Domain;
        five9_lsp2__Five9_Object_Fields_Mapping__c five9Lsp2ObjectFieldsMapping = DataFactoryTest.createFive9Lsp2ObjectFieldMapping(five9Lsp2Domain.Id);
        insert five9Lsp2ObjectFieldsMapping;
        five9_lsp2__Five9_List_Config__c five9Lsp2List = DataFactoryTest.createFive9Lsp2List(five9Lsp2ObjectFieldsMapping.Id);
        insert five9Lsp2List;

        Lead leadInstance = DataFactoryTest.createListLead();
        LeadTriggerHandler.preventRecursion = true;
        leadInstance.Add_to_f9list_Id__c = five9List.Id;
        insert leadInstance;
    }

    @isTest
    static void getFive9ListTest(){
        
        Five9LSP__Five9_List__c five9List = Five9ListData.getFive9List(system.label.Five9_List_Name,'lead');

        Assert.isNotNull(five9List, 'Verify the five9 list is retrieved');
        Assert.areEqual(system.label.Five9_List_Name, five9List.Name, 'Verify the five9 list name');
        Assert.areEqual('Coastal Debt Resolve Test', five9List.Five9LSP__Five9_Domain__c, 'Verify the five9 domain');
        Assert.areEqual('Five9APIuser@CoastalDebtResolve.Test', five9List.Five9LSP__Five9_User_Name__c, 'Verify the five9 username');
    }

    @IsTest
    static void getLeadIdSetTest(){

        Id leadId = [SELECT Id FROM Lead LIMIT 1].Id;
        List<Five9LSP__Five9_List_Item__c> five9ListItems = [SELECT Id, Five9LSP__Lead__c FROM Five9LSP__Five9_List_Item__c];
        
        Test.startTest();
        Set<Id> leadIdSet = Five9ListData.getLeadIdSet(five9ListItems);
        Test.stopTest();

        Assert.isTrue(leadIdSet.contains(leadId), 'Verify the leadId is received');
    }

    @isTest
    static void getFive9SettingsTest(){
        
        Five9LSP__Five9_LSP_Settings__c five9Settings = Five9ListData.getFive9Settings();
        
        Assert.isNotNull(five9Settings, 'Verify the five9 settings is retrieved');
        Assert.areEqual('Five9 List Authentication Failure', five9Settings.Five9LSP__Admin_Email_Subject__c, 'Verify the email subject');
        Assert.areEqual('sample@company.test', five9Settings.Five9LSP__Admin_Email__c, 'Verify the admin email');
        Assert.isTrue(five9Settings.Five9LSP__Statuses_to_retry__c.equalsIgnoreCase('pending'), 'Verify the statuses to retry');
    }
    
    @isTest
    static void getFive9Lsp2ListTest(){
        five9_lsp2__Five9_List_Config__c five9Lsp2List = Five9ListData.getFive9Lsp2List(system.label.Five9_List_Name,'Lead');
        
        Assert.areEqual(system.label.Five9_List_Name, five9Lsp2List.five9_lsp2__Five9_List_Name__c, 'Verify the five9 list name');
    }
    
    @isTest
    static void getFive9ApiSettingsTest(){
        Five9_API__c five9ApiSetting = five9ListData.getFive9ApiSettings();
        
        Assert.isNotNull(five9ApiSetting, 'Verify the five9 settings is retrieved');
        Assert.isNotNull(five9ApiSetting.API_URL__c,'https://api.five9.test');
    }
    
    @isTest
    static void getFive9Lsp2FieldMappingsTest(){
        five9_lsp2__Five9_Object_Fields_Mapping__c fieldMapping = [SELECT Id, Name FROM five9_lsp2__Five9_Object_Fields_Mapping__c LIMIT 1];
        
        Map<String,Object> ObjectfieldMapping = five9ListData.getFive9Lsp2FieldMappings(fieldMapping.Id);
        
        Assert.isNotNUll(ObjectfieldMapping,'Verify Object fieldMappings are retrieved');
    }
}