@isTest
private class Five9ListService_Test {

    @testSetup
    static void makeData(){
        Five9_API__c five9ApiSettings = DataFactoryTest.createFive9ApiSettings();
        insert five9ApiSettings;

        Five9LSP__Five9_LSP_Settings__c five9Settings = DataFactoryTest.createFive9Settings();
        insert five9Settings;

        five9_lsp2__Five9_Data_Center__c five9Lsp2DataCenter = DataFactoryTest.createFive9Lsp2DataCenter();
        insert five9Lsp2DataCenter;
        five9_lsp2__Five9_Domain__c five9Lsp2Domain = DataFactoryTest.createFive9Lsp2Domain(five9Lsp2DataCenter.Id);
        insert five9Lsp2Domain;
        five9_lsp2__Five9_Object_Fields_Mapping__c five9Lsp2ObjectFieldsMapping = DataFactoryTest.createFive9Lsp2ObjectFieldMapping(five9Lsp2Domain.Id);
        insert five9Lsp2ObjectFieldsMapping;
        five9_lsp2__Five9_List_Config__c five9List = DataFactoryTest.createFive9Lsp2List(five9Lsp2ObjectFieldsMapping.Id);
        insert five9List;

        Lead leadInstance = DataFactoryTest.createListLead();
        LeadTriggerHandler.preventRecursion = true;
        leadInstance.Add_to_f9list_Id__c = five9List.Id;
        insert leadInstance;
    }

    @isTest
    static void getFive9StatusesToRetryTest() {

        Test.startTest();
        List<String> statusesToRetry = Five9ListService.getFive9StatusesToRetry();
        Test.stopTest();
        Assert.isNotNull(statusesToRetry, 'Verify the statuses are retrieved');
        Assert.isTrue(statusesToRetry[0].equalsIgnoreCase('pending'), 'Verify the status');
    }

    @isTest
    static void hasAuthorizationTest(){
        
        Test.startTest();
        five9_lsp2__Five9_List_Config__c five9List = [
            SELECT Id, five9_lsp2__Is_Enabled__c,five9_lsp2__Object_Fields_Mapping__c
            FROM five9_lsp2__Five9_List_Config__c LIMIT 1
        ];
        Assert.areEqual(true, Five9ListService.hasAuthorization(five9List), 'Verify the Authorization is success');
        Test.stopTest();
    }

    @isTest
    static void addtoFive9ListTest(){

        five9_lsp2__Five9_List_Config__c five9List = [
            SELECT Id, five9_lsp2__Is_Enabled__c,five9_lsp2__Object_Fields_Mapping__c
            FROM five9_lsp2__Five9_List_Config__c LIMIT 1
        ];
        List<Lead> leadList = [SELECT Id FROM Lead LIMIT 1];
        Set<Id> leadIds = New Set<Id>{leadList[0].Id};
           Map<String, Object> fieldMappingObject = new Map<String, Object>();
           fieldMappingObject.put('salesforce_id', 'Id');
        
        Test.startTest();
        DOM.Document document = Five9ListService.addtoFive9List(
            'Test List', leadIds, 
            fieldMappingObject
        );
        Test.stopTest();

        Assert.isNotNull(document, 'Verify the document is constructed');
    }

    @isTest
    static void getEndpointTest(){
        
        Five9_API__c five9ApiSettings = five9ListData.getFive9ApiSettings();

        Assert.areEqual('https://api.five9.test/wsadmin/v13/AdminWebService', Five9ListService.getEndpoint(five9ApiSettings.API_URL__c));
    }

    @isTest
    static void addToFive9ListTest_Success() {
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('addToList', true));
        Batch_AddToFive9List addToList = new Batch_AddToFive9List('Test List');
        Database.executeBatch(addToList);
        Test.stopTest();

        /*Five9LSP__Five9_List_Item__c five9ListItemToVerify = [
            SELECT Id, Five9LSP__Sync_Message__c, Five9LSP__Sync_Status__c 
            FROM Five9LSP__Five9_List_Item__c LIMIT 1
        ];*/
        /*Assert.areEqual('0', five9ListItemToVerify.Five9LSP__Sync_Status__c, 'Verify the sync status');
        Assert.areEqual('The request was successfully processed', five9ListItemToVerify.Five9LSP__Sync_Message__c, 'Verify the sync message');*/
    }

    @isTest
    static void addToFive9ListTest_Failure() {
        
        Lead leadInstance = [SELECT Id, Phone FROM Lead LIMIT 1];
        leadInstance.Phone = '+1 206-619-1863';
        LeadTriggerHandler.preventRecursion = true;
        update leadInstance;
        
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('addToList', false));
        Batch_AddToFive9List addToList = new Batch_AddToFive9List('Test List');
        Database.executeBatch(addToList);
        Test.stopTest();

        /*Five9LSP__Five9_List_Item__c five9ListItemToVerify = [
            SELECT Id, Five9LSP__Sync_Message__c, Five9LSP__Sync_Status__c 
            FROM Five9LSP__Five9_List_Item__c LIMIT 1
        ];*/
        /*Assert.areEqual('pending', five9ListItemToVerify.Five9LSP__Sync_Status__c, 'Verify the sync status');
        Assert.areEqual(
            'IncorrectArgumentFault\nMessage: Number +1 206-619-1863 is not correctly formatted.', 
            five9ListItemToVerify.Five9LSP__Sync_Message__c, 
            'Verify the sync message'
        );*/
    }
    @IsTest
    static void testAddNumbersToDnc() {
        List<String> numbers = new List<String>{'1234567890', '0987654321'};
            DOM.Document doc = Five9ListService.addNumbersToDnc(numbers);
        assert.areNotEqual(null, doc);
    }
    
    @IsTest
    static void testRemoveNumbersFromDnc() {
        List<String> numbers = new List<String>{'1234567890', '0987654321'};
            DOM.Document doc = Five9ListService.removeNumbersFromDnc(numbers);
       assert.areNotEqual(null, doc);
    }
    
     @IsTest
    static void testCheckDncForNumbers() {
        List<String> numbers = new List<String>{'1234567890', '0987654321'};
            DOM.Document doc = Five9ListService.checkDncForNumbers(numbers);
       assert.areNotEqual(null, doc);
    }
    
     @isTest
    static void testAddNumbersToDNCList(){
         five9_lsp2__Five9_List_Config__c five9List = [
            SELECT Id, five9_lsp2__Is_Enabled__c,five9_lsp2__Object_Fields_Mapping__c
            FROM five9_lsp2__Five9_List_Config__c LIMIT 1
        ];
        Lead leadInstance = DataFactoryTest.createListLead();
        leadInstance.Phone = '9876054322';
        leadInstance.Add_to_f9list_Id__c = five9List.Id;
        insert leadInstance;
        Test.startTest();
        lead l = [Select id,five9_Disposition__c from lead where id=: leadInstance.id];
        l.five9_Disposition__c = 'DO NOT CALL - DNC';
        update l;
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('checkDncForNumbers', true));
        Test.stopTest();
        assert.areNotEqual(leadInstance.five9_Disposition__c,l.five9_Disposition__c); 
    }
    
    @isTest
    static void testAddNumbersToDNCListFalse(){
       five9_lsp2__Five9_List_Config__c five9List = [
            SELECT Id, five9_lsp2__Is_Enabled__c,five9_lsp2__Object_Fields_Mapping__c
            FROM five9_lsp2__Five9_List_Config__c LIMIT 1
        ];
        Lead leadInstance = DataFactoryTest.createListLead();
        leadInstance.Phone = '9876054322';
        leadInstance.Add_to_f9list_Id__c = five9List.Id;
        insert leadInstance;
        Test.startTest();
        lead l = [Select id,five9_Disposition__c from lead where id=: leadInstance.id];
        l.five9_Disposition__c = 'DO NOT CALL - DNC';
        update l;
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('checkDncForNumbers', false));
        Test.stopTest();
        assert.areNotEqual(leadInstance.five9_Disposition__c,l.five9_Disposition__c); 
    }
    
    @isTest
    static void deleteLeadsFromFive9Test_Success() {
        Five9LSP__Five9_LSP_Settings__c five9Settings = DataFactoryTest.createFive9Settings();
        insert five9Settings;

        Five9LSP__Five9_List__c five9List = DataFactoryTest.createFive9List();
        five9List.Name = 'Test List';
        insert five9List;
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseHandler('deleteFromFive9List', true));
        Batch_DeleteLeadsFromFive9List deleteFromList = new Batch_DeleteLeadsFromFive9List('Test List');
        Database.executeBatch(deleteFromList);
        Test.stopTest();
    }
    
     @isTest
    static void deleteLeadsFromFive9Test(){
          Five9LSP__Five9_LSP_Settings__c five9Settings = DataFactoryTest.createFive9Settings();
        insert five9Settings;

        Five9LSP__Five9_List__c five9List = DataFactoryTest.createFive9List();
        five9List.Name = 'Test List';
        insert five9List;
       List<Lead> leadList = new List<Lead> {
            DataFactoryTest.createListLead(),
            DataFactoryTest.createListLead(),
            DataFactoryTest.createListLead(),
            DataFactoryTest.createListLead(),
            DataFactoryTest.createListLead()
        };
        LeadTriggerHandler.preventRecursion = true;
        leadList[0].status = leadUtil.LEAD_ARCHIVED_STATUS;
        leadList[0].phone = '1234567890';
        leadList[1].status = leadUtil.LEAD_ARCHIVED_STATUS;
        leadList[1].phone = '1234567891';
        leadList[2].status = leadUtil.LEAD_ARCHIVED_STATUS;
        leadList[2].phone = '1234567892';
        leadList[3].status = leadUtil.LEAD_ARCHIVED_STATUS;
        leadList[3].phone = '1234567893';
        leadList[4].status = leadUtil.LEAD_ARCHIVED_STATUS;
        leadList[4].phone = '1234567894';
        insert leadList;  
        Set<Id> leadIds= New Set<Id>();
        
        for(Lead leadInst : leadList){
            leadIds.add(leadInst.Id);
        }
        
        Test.startTest();
        DOM.Document document = Five9ListService.deleteFromFive9List(
            'Test List',leadIds, 
            (Map<String, Object>)JSON.deserializeUntyped(five9List.Five9LSP__Field_Mapping__c)
        );
        Test.stopTest();

        Assert.isNotNull(document, 'Verify the document is constructed');
    }
}