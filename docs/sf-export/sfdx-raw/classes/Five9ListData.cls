/*---------------------------------------------------------------------------------------------------
    Author: Dharanya Sekar
    Description: Data Class to retrieve and process the data from Five9_List and Five9_List_Item objects.
    Test Class: Five9ListData_Test

    History
    <Date>           <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Mar-20-2024       Dharanya Sekar           Initial Development                 100%
------------------------------------------------------------------------------------------------------*/
public inherited sharing class Five9ListData {
    
    //Method to get the five9 list records based on the unique five9 list name.
    public static Five9LSP__Five9_List__c getFive9List(String five9ListName, String objectName) {
        List<Five9LSP__Five9_List__c> five9Lists = [
            SELECT Id, Name, Five9LSP__API_URL__c, Five9LSP__Controlling_Object__c, Five9LSP__Field_Mapping__c, 
            Five9LSP__Five9_Call_ASAP__c, Five9LSP__Five9_Domain__c, Five9LSP__Five9_User_Name__c, Five9LSP__Five9_User_Password__c 
            FROM Five9LSP__Five9_List__c WHERE Name = :five9ListName and Five9LSP__Controlling_Object__c =:objectName
        ];
        return five9Lists != null && !five9Lists.isEmpty() ? five9Lists[0] : null;
    }
    
    //Method to get the five9 list records based on the unique five9 list name.
    public static five9_lsp2__Five9_List_Config__c getFive9Lsp2List(String five9ListName, String objectName) {
        List<five9_lsp2__Five9_List_Config__c> five9Lists = [
            SELECT Id,Name, five9_lsp2__Five9_List_Name__c, five9_lsp2__Object_Name__c, five9_lsp2__Object_Fields_Mapping__c,five9_lsp2__Is_Enabled__c 
            FROM five9_lsp2__Five9_List_Config__c WHERE five9_lsp2__Five9_List_Name__c = :five9ListName and five9_lsp2__Object_Name__c =:objectName
        ];
        return five9Lists != null && !five9Lists.isEmpty() ? five9Lists[0] : null;
    }

    //Method to process the five9 list items to get the set of Id of the controlling object Lead.
    public static Set<Id> getLeadIdSet(List<Five9LSP__Five9_List_Item__c> five9ListItems) {
        Set<Id> leadIdSet = new Set<Id>();
        for (Five9LSP__Five9_List_Item__c listItem : five9ListItems) {
            leadIdSet.add(listItem.Five9LSP__Lead__c);
        }
        return leadIdSet;
    }

    //Method to retrieve the custom settings - Five9 LSP Settings
    public static Five9LSP__Five9_LSP_Settings__c getFive9Settings() {
        List<Five9LSP__Five9_LSP_Settings__c> five9SettingsList = [
            SELECT Id, Five9LSP__Admin_Email_Subject__c, Five9LSP__Admin_Email__c, Five9LSP__Statuses_to_retry__c 
            FROM Five9LSP__Five9_LSP_Settings__c
        ];
        return five9SettingsList != null && !five9SettingsList.isEmpty() ? five9SettingsList[0] : null;
    }
    
    public static Five9_API__c getFive9ApiSettings() {
        List<Five9_API__c> five9SettingsList = [
            SELECT Id, API_URL__c, Api_User_Name__c, Api_User_Password__c 
            FROM Five9_API__c
        ];
        return five9SettingsList != null && !five9SettingsList.isEmpty() ? five9SettingsList[0] : null; 
    }

    public static Map<String,Object> getFive9Lsp2FieldMappings(Id fieldMappingObjectId){
        Map<String,Object> fieldMappings = New Map<String,Object>();
       List<five9_lsp2__Five9_Field_Mapping__c> fieldMappingList = [SELECT id,five9_lsp2__Five9_Field_Name__c,five9_lsp2__Salesforce_Field_Name__c FROM five9_lsp2__Five9_Field_Mapping__c 
       Where five9_lsp2__Five9_Object_Fields_Mapping__c =: fieldMappingObjectId];

       if(!fieldMappingList.isEmpty()){
        for(five9_lsp2__Five9_Field_Mapping__c fieldMapping :fieldMappingList){
          fieldMappings.put(fieldMapping.five9_lsp2__Five9_Field_Name__c,fieldMapping.five9_lsp2__Salesforce_Field_Name__c);
        }
       }
       return fieldMappings;
    }
}