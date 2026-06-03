/*----------------------------------------------------------------
    Author: Dharanya Sekar
    Description: A batch class to re-sync the lead to five9 list.
    Test Class: Batch_SyncToFive9List_Test

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Dec-07-2023     Dharanya Sekar          Initial Development                 78%
--------------------------------------------------------------------*/
public without sharing class Batch_SyncToFive9List implements Database.Batchable<SObject>{
    
    // Start method to query the Lead records in which the Redial Time is less than or equal to 1 hour.
    public Database.QueryLocator start(Database.BatchableContext bc){

        String query = 'SELECT Id, Five9_List_Id__c FROM Lead WHERE Redial_Time__c <= :dtLast1Hour'
        +' AND Synced_to_Five9_List__c = FALSE AND Five9_List_Id__c != NULL';

        Map<String, Object> acctBinds = new Map<String, Object>{'dtLast1Hour' => Datetime.now().addHours(1)};

        return Database.getQueryLocatorWithBinds(query, acctBinds, AccessLevel.SYSTEM_MODE);
    }

    // Execute method to update the Lead and sync to Five9 List based on the Re-Synced to Five9 List checkbox.
    public void execute(Database.BatchableContext bc, List<Lead> scope) {

        List<Lead> leadUpdatedList = new List<Lead>();

        for (Lead leadInstance : scope) {
            Lead newLead = new Lead();
            newLead.Id = leadInstance.Id;
            newLead.Add_to_f9list_Id__c = leadInstance.Five9_List_Id__c;
            newLead.Synced_to_Five9_List__c = true;
            leadUpdatedList.add(newLead);
        }

        for (Database.SaveResult saveResult : Database.update(leadUpdatedList, false)) {
            if (!saveResult.isSuccess()) {
                String errorMessage;
                for (Database.Error err : saveResult.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                ApplicationLogger.logDMLException('Updating Lead with Five9List Id is failed', saveResult.getId(), errorMessage, true);
            }
        }
        ApplicationLogger.insertStoredLogs();
    }

    public void finish(Database.BatchableContext bc) {

    }
}