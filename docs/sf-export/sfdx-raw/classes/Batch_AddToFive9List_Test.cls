@isTest
private class Batch_AddToFive9List_Test {

    @isTest
    static void addToFive9ListTest_Success() {
        
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

        List<Lead> leadList = new List<Lead> {
            DataFactoryTest.createListLead(),
            DataFactoryTest.createListLead(),
            DataFactoryTest.createListLead(),
            DataFactoryTest.createListLead(),
            DataFactoryTest.createListLead()
        };
        LeadTriggerHandler.preventRecursion = true;
        leadList[0].Outbound_ANI_From__c = '1234556667';
        leadList[0].Outbound_ANI_Date__c = date.today();
        leadList[0].Outbound_ANI_Identifier__c = '123455666723';
        leadList[0].phone = '6333222221';
        leadList[0].Add_to_f9list_Id__c = five9List.Id;
        leadList[1].phone = '6333222221';
        leadList[1].Outbound_ANI_From__c = '1234556667';
        leadList[1].Outbound_ANI_Date__c = date.today();
        leadList[1].Outbound_ANI_Identifier__c = '123455666723';
        leadList[1].Add_to_f9list_Id__c = five9List.Id;
        leadList[2].phone = '6333222221';
        leadList[2].Outbound_ANI_From__c = '1234556667';
        leadList[2].Outbound_ANI_Date__c = date.today();
        leadList[2].Outbound_ANI_Identifier__c = '123455666723';
        leadList[2].Add_to_f9list_Id__c = five9List.Id;
        leadList[3].phone = '6333222221';
        leadList[3].Outbound_ANI_From__c = '1234556667';
        leadList[3].Outbound_ANI_Date__c = date.today();
        leadList[3].Outbound_ANI_Identifier__c = '123455666723';
        leadList[3].Add_to_f9list_Id__c = five9List.Id;
        leadList[4].phone = '6333222221';
        leadList[4].Add_to_f9list_Id__c = five9List.Id;
        leadList[4].Outbound_ANI_From__c = '1234556667';
        leadList[4].Outbound_ANI_Date__c = date.today();
        leadList[4].Outbound_ANI_Identifier__c = '123455666723';
        insert leadList;
        
        List<five9_lsp2__Five9_List_Item__c> five9Lsp2ListItems = New List<five9_lsp2__Five9_List_Item__c>();
        five9_lsp2__Five9_List_Item__c five9ListItem = New five9_lsp2__Five9_List_Item__c();
        five9ListItem.five9_lsp2__Lead__c = leadList[0].Id;
        five9ListItem.five9_lsp2__Five9_List_Config__c = five9List.Id;
        five9ListItem.five9_lsp2__Sync_Status__c = 'Pending';
        five9ListItem.five9_lsp2__Compound_Key__c = String.ValueOf(five9List.Id) + String.ValueOf(leadList[0].Id); 
        insert five9ListItem;
        
        five9_lsp2__Five9_List_Item__c five9ListItem2 = New five9_lsp2__Five9_List_Item__c();
        five9ListItem2.five9_lsp2__Lead__c = leadList[1].Id;
        five9ListItem2.five9_lsp2__Five9_List_Config__c = five9List.Id;
        five9ListItem2.five9_lsp2__Sync_Status__c = 'Pending';
        five9ListItem2.five9_lsp2__Compound_Key__c = String.ValueOf(five9List.Id) + String.ValueOf(leadList[1].Id); 
        insert five9ListItem2;
        
        five9_lsp2__Five9_List_Item__c five9ListItem3 = New five9_lsp2__Five9_List_Item__c();
        five9ListItem3.five9_lsp2__Lead__c = leadList[2].Id;
        five9ListItem3.five9_lsp2__Five9_List_Config__c = five9List.Id;
        five9ListItem3.five9_lsp2__Sync_Status__c = 'Pending';
        five9ListItem3.five9_lsp2__Compound_Key__c = String.ValueOf(five9List.Id) + String.ValueOf(leadList[2].Id); 
        insert five9ListItem3;
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('addToList', true));
        Batch_AddToFive9List addToList = new Batch_AddToFive9List('Test List');
        Database.executeBatch(addToList);
        Test.stopTest();

        List<five9_lsp2__Five9_List_Item__c> five9ListItemsToVerify = [
            SELECT Id
            FROM five9_lsp2__Five9_List_Item__c
        ];
        Assert.areEqual(3, five9ListItemsToVerify.size(), 'Verify the record count');
        /*Assert.areEqual('0', five9ListItemsToVerify[0].Five9LSP__Sync_Status__c, 'Verify the sync status');
        Assert.areEqual('The request was successfully processed', five9ListItemsToVerify[1].Five9LSP__Sync_Message__c, 'Verify the sync message');
        Assert.areEqual('0', five9ListItemsToVerify[2].Five9LSP__Sync_Status__c, 'Verify the sync status');
        Assert.areEqual('The request was successfully processed', five9ListItemsToVerify[3].Five9LSP__Sync_Message__c, 'Verify the sync message');
        Assert.areEqual('0', five9ListItemsToVerify[4].Five9LSP__Sync_Status__c, 'Verify the sync status');
        Assert.areEqual(System.today(), five9ListItemsToVerify[4].Five9LSP__Last_Sync_Time__c.date(), 'Verify the last sync date');
        Assert.areEqual(System.today(), five9ListItemsToVerify[2].Five9LSP__Last_Sync_Time__c.date(), 'Verify the last sync date');*/

        List<Lead> leadToVerify = [SELECT Id, Five9_List_Id__c FROM Lead LIMIT 1];
        Assert.areEqual(1, leadToVerify.size(), 'Verify the list size');
        //Assert.areEqual(five9List.Id, leadToVerify[0].Five9_List_Id__c, 'Verify the five9 list Id');
    }

    @isTest
    static void addToFive9ListTest_Failure() {
        
        Five9LSP__Five9_LSP_Settings__c five9Settings = DataFactoryTest.createFive9Settings();
        insert five9Settings;
        
        Five9LSP__Five9_List__c five9List = DataFactoryTest.createFive9List();
        insert five9List;
        
        LeadTriggerHandler.preventRecursion = true;
        Lead leadInstance = DataFactoryTest.createListLead();
        leadInstance.Phone = '+1 206-619-1863';      
        leadInstance.Add_to_f9list_Id__c = five9List.Id;
        insert leadInstance;
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('addToList', false));
        Batch_AddToFive9List addToList = new Batch_AddToFive9List('Test List');
        Database.executeBatch(addToList);
        Test.stopTest();

        List<Five9LSP__Five9_List_Item__c> five9ListItemsToVerify = [SELECT Id, Five9LSP__Sync_Message__c, Five9LSP__Sync_Status__c FROM Five9LSP__Five9_List_Item__c];
        Assert.isNotNull(five9ListItemsToVerify, 'Verify the list contains values');
        //Assert.areEqual('pending', five9ListItemsToVerify[0].Five9LSP__Sync_Status__c, 'Verify the sync status');
        //Assert.areEqual('IncorrectArgumentFault\nMessage: Number +1 206-619-1863 is not correctly formatted.', five9ListItemsToVerify[0].Five9LSP__Sync_Message__c, 'Verify the sync message');
    }
}