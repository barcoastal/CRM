public without sharing class TriggerDisablementCheckSvc {
    
    public static Boolean isTriggerDisabled(String objectName) {
        String fieldName  = getFieldNameForObject(objectName);
        // Query the custom setting to check if the trigger is disabled
        SystemControlSettings__c setting = SystemControlSettings__c.getInstance();
        return setting != null && setting.get(fieldName) == true; 
    }

    private static String getFieldNameForObject(String objectName) {
        if (objectName == Lead.getSObjectType().getDescribe().getName()) {
            return 'Disable_Lead_Trigger__c';
        } else if (objectName == Task.getSObjectType().getDescribe().getName()) {
            return 'Disable_Task_Trigger__c';
        } else if (objectName == ContentDocumentLink.getSObjectType().getDescribe().getName()) {
            return 'Disable_Content_Document_Link_Trigger__c';
        } else if (objectName == Async_Operation__c.getSObjectType().getDescribe().getName()) {
            return 'Disable_Async_Operation_Trigger__c';
        } else if (objectName == Event.getSObjectType().getDescribe().getName()) {
            return 'Disable_Event_Trigger__c';
        } else {
            return null;
        }
    }
}