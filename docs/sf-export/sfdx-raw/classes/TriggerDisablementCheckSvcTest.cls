@isTest
private class TriggerDisablementCheckSvcTest {
    
    @isTest
    static void testIsTriggerDisabled_LeadTriggerDisabled() {
        // Setup: Create custom setting with Lead trigger disabled
        SystemControlSettings__c setting = new SystemControlSettings__c();
        setting.Disable_Lead_Trigger__c = true;
        insert setting;
        
        // Execute
        Test.startTest();
        Boolean result = TriggerDisablementCheckSvc.isTriggerDisabled('Lead');
        Test.stopTest();
        
        // Verify
        System.assertEquals(true, result, 'Lead trigger should be disabled');
    }
    
    @isTest
    static void testIsTriggerDisabled_LeadTriggerEnabled() {
        // Setup: Create custom setting with Lead trigger enabled
        SystemControlSettings__c setting = new SystemControlSettings__c();
        setting.Disable_Lead_Trigger__c = false;
        insert setting;
        
        // Execute
        Test.startTest();
        Boolean result = TriggerDisablementCheckSvc.isTriggerDisabled('Lead');
        Test.stopTest();
        
        // Verify
        System.assertEquals(false, result, 'Lead trigger should be enabled');
    }
    
    @isTest
    static void testIsTriggerDisabled_TaskTriggerDisabled() {
        // Setup: Create custom setting with Task trigger disabled
        SystemControlSettings__c setting = new SystemControlSettings__c();
        setting.Disable_Task_Trigger__c = true;
        insert setting;
        
        // Execute
        Test.startTest();
        Boolean result = TriggerDisablementCheckSvc.isTriggerDisabled('Task');
        Test.stopTest();
        
        // Verify
        System.assertEquals(true, result, 'Task trigger should be disabled');
    }
    
    @isTest
    static void testIsTriggerDisabled_ContentDocumentLinkTriggerDisabled() {
        // Setup: Create custom setting with ContentDocumentLink trigger disabled
        SystemControlSettings__c setting = new SystemControlSettings__c();
        setting.Disable_Content_Document_Link_Trigger__c = true;
        insert setting;
        
        // Execute
        Test.startTest();
        Boolean result = TriggerDisablementCheckSvc.isTriggerDisabled('ContentDocumentLink');
        Test.stopTest();
        
        // Verify
        System.assertEquals(true, result, 'ContentDocumentLink trigger should be disabled');
    }
    
    @isTest
    static void testIsTriggerDisabled_AsyncOperationTriggerDisabled() {
        // Setup: Create custom setting with Async_Operation__c trigger disabled
        SystemControlSettings__c setting = new SystemControlSettings__c();
        setting.Disable_Async_Operation_Trigger__c = true;
        insert setting;
        
        // Execute
        Test.startTest();
        Boolean result = TriggerDisablementCheckSvc.isTriggerDisabled('Async_Operation__c');
        Test.stopTest();
        
        // Verify
        System.assertEquals(true, result, 'Async_Operation__c trigger should be disabled');
    }
    
    @isTest
    static void testIsTriggerDisabled_EventTriggerDisabled() {
        // Setup: Create custom setting with Event trigger disabled
        SystemControlSettings__c setting = new SystemControlSettings__c();
        setting.Disable_Event_Trigger__c = true;
        insert setting;
        
        // Execute
        Test.startTest();
        Boolean result = TriggerDisablementCheckSvc.isTriggerDisabled('Event');
        Test.stopTest();
        
        // Verify
        System.assertEquals(true, result, 'Event trigger should be disabled');
    }
    
    @isTest
    static void testIsTriggerDisabled_NoCustomSettingExists() {
        // Setup: No custom setting created
        
        // Execute
        Test.startTest();
        Boolean result = TriggerDisablementCheckSvc.isTriggerDisabled('Lead');
        Test.stopTest();
        
        // Verify: Should return false when no setting exists
        System.assertEquals(false, result, 'Should return false when custom setting does not exist');
    }
    
    @isTest
    static void testIsTriggerDisabled_UnknownObjectType() {
        // Setup: Create custom setting
        SystemControlSettings__c setting = new SystemControlSettings__c();
        insert setting;
        
        // Execute & Verify: Should handle unknown object types gracefully
        Test.startTest();
        try {
            Boolean result = TriggerDisablementCheckSvc.isTriggerDisabled('UnknownObject');
            // If no exception is thrown, the method should return false or handle it gracefully
            // The current implementation will throw NullPointerException, which this test documents
            System.assert(false, 'Expected NullPointerException for unknown object type');
        } catch (NullPointerException e) {
            // Expected behavior with current implementation
            System.assert(true, 'NullPointerException expected for unknown object type');
        }
        Test.stopTest();
    }
    
    @isTest
    static void testIsTriggerDisabled_MultipleObjectsDisabled() {
        // Setup: Create custom setting with multiple triggers disabled
        SystemControlSettings__c setting = new SystemControlSettings__c();
        setting.Disable_Lead_Trigger__c = true;
        setting.Disable_Task_Trigger__c = true;
        setting.Disable_Event_Trigger__c = false;
        insert setting;
        
        // Execute
        Test.startTest();
        Boolean leadResult = TriggerDisablementCheckSvc.isTriggerDisabled('Lead');
        Boolean taskResult = TriggerDisablementCheckSvc.isTriggerDisabled('Task');
        Boolean eventResult = TriggerDisablementCheckSvc.isTriggerDisabled('Event');
        Test.stopTest();
        
        // Verify
        System.assertEquals(true, leadResult, 'Lead trigger should be disabled');
        System.assertEquals(true, taskResult, 'Task trigger should be disabled');
        System.assertEquals(false, eventResult, 'Event trigger should be enabled');
    }
    
    @isTest
    static void testGetFieldNameForObject_AllSupportedObjects() {
        // This test verifies the private method indirectly through the public method
        // Setup: Create custom setting with all triggers disabled
        SystemControlSettings__c setting = new SystemControlSettings__c();
        setting.Disable_Lead_Trigger__c = true;
        setting.Disable_Task_Trigger__c = true;
        setting.Disable_Content_Document_Link_Trigger__c = true;
        setting.Disable_Async_Operation_Trigger__c = true;
        setting.Disable_Event_Trigger__c = true;
        insert setting;
        
        // Execute & Verify
        Test.startTest();
        System.assertEquals(true, TriggerDisablementCheckSvc.isTriggerDisabled('Lead'), 
                          'Lead field mapping should work');
        System.assertEquals(true, TriggerDisablementCheckSvc.isTriggerDisabled('Task'), 
                          'Task field mapping should work');
        System.assertEquals(true, TriggerDisablementCheckSvc.isTriggerDisabled('ContentDocumentLink'), 
                          'ContentDocumentLink field mapping should work');
        System.assertEquals(true, TriggerDisablementCheckSvc.isTriggerDisabled('Async_Operation__c'), 
                          'Async_Operation__c field mapping should work');
        System.assertEquals(true, TriggerDisablementCheckSvc.isTriggerDisabled('Event'), 
                          'Event field mapping should work');
        Test.stopTest();
    }
    
    @isTest
    static void testIsTriggerDisabled_NullFieldValue() {
        // Setup: Create custom setting without setting the Lead trigger field (null value)
        SystemControlSettings__c setting = new SystemControlSettings__c();
        // Explicitly not setting Disable_Lead_Trigger__c
        insert setting;
        
        // Execute
        Test.startTest();
        Boolean result = TriggerDisablementCheckSvc.isTriggerDisabled('Lead');
        Test.stopTest();
        
        // Verify: Null should be treated as false (trigger not disabled)
        System.assertEquals(false, result, 'Null field value should be treated as false');
    }
}