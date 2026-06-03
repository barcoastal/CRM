/**
 * Description: Batch to create disposition records using the data from legacy CRM which is stored in the LegacyCRMNote object
 */
public with sharing class Batch_CreateActivities implements Database.Batchable<AggregateResult> {
    
    /**
     * Start method to query all the records from the LegacyCRMNote object grouped by the LegacyCRMLeadId
     * Used the grouped by deal Id to avoid quering same Lead records in different executions.
     */ 
    public Iterable<AggregateResult> start(Database.BatchableContext BC) {
        return [SELECT Deal_Id__c Id, COUNT(Id) LeadCount FROM LegacyCRMNote__c GROUP BY Deal_Id__c];
    }

    public void execute(Database.BatchableContext BC, List<AggregateResult> scope) {
		
        List<Task> taskList = new List<Task>();
        Map<Id, AggregateResult> aggResultMap = new Map<Id, AggregateResult>(scope);
        Map<String, Id> crmIdWithLeadId = new Map<String, Id>();
        Map<String, Id> crmIdWithOpportunityId = new Map<String, Id>();
        Map<String, Id> crmIdWithContactId = new Map<String, Id>();
        List<LegacyCRMNote__c> crmNotesToUpdate = new List<LegacyCRMNote__c>();
        Id dispositionRTId = TaskUtil.getRecordTypeId('Disposition');
        
        // query the lead using the legacy CRM deal Ids.
        for (Lead leadInstance : [SELECT Id, External_Legacy_CRM_Id__c FROM Lead WHERE External_Legacy_CRM_Id__c IN :aggResultMap.keySet()]) {
            crmIdWithLeadId.put(leadInstance.External_Legacy_CRM_Id__c, leadInstance.Id);
        }

        // query the contact using the legacy CRM deal Ids.
        for (Contact conInstance : [SELECT Id, External_Legacy_CRM_Id__c FROM Contact WHERE External_Legacy_CRM_Id__c IN :aggResultMap.keySet()]) {
            crmIdWithContactId.put(conInstance.External_Legacy_CRM_Id__c, conInstance.Id);
        }

         // query the opportunity using the legacy CRM deal Ids.
         for (Opportunity oppInstance : [SELECT Id, External_Legacy_CRM_Id__c FROM Opportunity WHERE External_Legacy_CRM_Id__c IN :aggResultMap.keySet()]) {
            crmIdWithOpportunityId.put(oppInstance.External_Legacy_CRM_Id__c, oppInstance.Id);
        }

        List<LegacyCRMNote__c> crmNoteList = [
            SELECT Id, Name, Deal_Id__c, Disp_Id__c, Date__c, Time__c, User__c, Dispo__c, Note__c 
            FROM LegacyCRMNote__c WHERE Deal_Id__c IN :aggResultMap.keySet()
        ];
        
        for (LegacyCRMNote__c customNote : crmNoteList) {
            Task newTask = new Task();
            newTask.ActivityDate = customNote.Date__c;
            newTask.RecordTypeId = dispositionRTId;
            newTask.External_Legacy_CRM_Id__c = customNote.Disp_Id__c;
            newTask.Subject = customNote.Dispo__c;
            newTask.Description = customNote.Note__c;            
            newTask.Legacy_CRM_User__c = customNote.User__c;
            if (crmIdWithLeadId.containsKey(customNote.Deal_Id__c)) {
                newTask.WhoId = crmIdWithLeadId.get(customNote.Deal_Id__c);//Lead Id
            } else if (crmIdWithContactId.containsKey(customNote.Deal_Id__c)) {
                newTask.WhoId = crmIdWithContactId.get(customNote.Deal_Id__c); //Contact Id
                newTask.WhatId = crmIdWithOpportunityId.get(customNote.Deal_Id__c); // Opportunity Id
            }
            newTask.Legacy_CRM_Activity_DateTime__c = DateTime.newInstance(customNote.Date__c, customNote.Time__c);
            taskList.add(newTask);
        }

        if (!taskList.isEmpty()) {
            Integer i = 0;
            //Upsert all the task records from legacy CRM based on the external lead Id.
            for (Database.UpsertResult urTask : Database.upsert(taskList, Task.Fields.External_Legacy_CRM_Id__c, false)) {
                if (urTask.isSuccess()) {          
                    LegacyCRMNote__c crmNote = new LegacyCRMNote__c();
                    crmNote.Id = crmNoteList[i].Id;
                    crmNote.Converted_to_Activity__c = true;
                    crmNotesToUpdate.add(crmNote);
                } else {
                    String errorMessage = '';
                    for (Database.Error err : urTask.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('Conversion from Legacy CRM Note to Disposition is failed', crmNoteList[i].Id, errorMessage, true);
                }
                i++;
            }
            if (!crmNotesToUpdate.isEmpty()) {
                Integer j = 0;
                for (Database.SaveResult saveResult : Database.update(crmNotesToUpdate, false)) {
                    if (!saveResult.isSuccess()) {
                        String errorMessage;
                        for (Database.Error err : saveResult.getErrors()) {
                            errorMessage += err.getMessage() + '. ';
                        }
                        ApplicationLogger.logDMLException('Updating Legacy Lead Note with Converted_To_Activity__c true is failed', crmNotesToUpdate[j].Id, errorMessage, true);
                    }
                    j++;
                }
            }
            ApplicationLogger.insertStoredLogs();
        }
    }

    public void finish(Database.BatchableContext BC) {

    }
}