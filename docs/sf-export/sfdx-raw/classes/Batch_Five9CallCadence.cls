/*----------------------------------------------------------------
    Author: Vinitha 
    Description: A batch class to set redial time and delete from Five9 List on lead.
    Test Class: Batch_Five9CallCadenceTest

    History
    <Date>          <Authors Name>          <Brief Description of Change>       <Code Coverage>
    Feb-21-2024      Vinitha                      Initial Development              72%   
--------------------------------------------------------------------*/
public without sharing class Batch_Five9CallCadence implements Database.Batchable<SObject> {
    
    public Id dispositionRTId = TaskUtil.getRecordTypeId('Disposition');
    
    //Start method to query the task records which has disposition recordtype and not synced with redial time.
    public Database.QueryLocator start(Database.BatchableContext bc){
        
        // Get Last batchrun time from custom settings: 
        Sync_Redial_Time__c synInstance = Sync_Redial_Time__c.getInstance();
        DateTime last_run_time = (synInstance != null && synInstance.Last_Run_Time__c != null) ? synInstance.Last_Run_Time__c : System.now().addHours(-1); // replace with custom setting value. 

        String query = 'SELECT Id, WhoId, WhatId, RecordTypeId, Redial_Sync_Failed__c, Disposition__c FROM Task WHERE RecordTypeId=:dispositionRTId AND (createdDate >=:last_run_time OR Redial_Sync_Failed__c=TRUE) AND Disposition__c != NULL AND (Who.type= \'Lead\' OR Who.type=\'Contact\' OR What.type=\'Opportunity\') ORDER BY CreatedDate DESC';
        return Database.getQueryLocator(query);
    } 
    
    // Execute method to update redial time and delete from f9list id on Lead.
    public void execute(Database.BatchableContext bc, List<Task> scope) {
        Set<Id> leadIds = new Set<Id>();
        Set<Id> oppIds = new Set<Id>();
        Set<Id> conIds = new Set<Id>();
        Map<String, List<Task>> taskDispositionMap = new Map<String, List<Task>>();
        List<Task> syncedRedialTasks = new List<Task>();
        List<Task> notSyncedRedialTaskList = new List<Task>();
        for(Task rec: scope){
            String parentId = '';
            if(rec.WhoId != null){ 
                if(LeadUtil.isLeadId(rec.WhoId) && !leadIds.contains(rec.WhoId)) {
                    leadIds.add(rec.WhoId);                                    
                }else if(ContactUtil.isContactId(rec.WhoId) && !conIds.contains(rec.WhoId)) {
                    conIds .add(rec.WhoId);                
                } 
                parentId = rec.WhoId;              
            }else if(rec.WhatId != null && OpportunityUtil.isOppId(rec.WhatId ) && !oppIds.contains(rec.WhatId)){
                oppIds.add(rec.WhatId );  
                parentId = rec.WhatId;           
            }
            
            if(parentId != null && !taskDispositionMap.containsKey(parentId)){
               taskDispositionMap.put(parentId, new List<Task>{}); 
            }
            
            if(parentId != null && taskDispositionMap.containsKey(parentId)){
                taskDispositionMap.get(parentId).add(rec);
            }
        }
        List<Lead> updateLeads = new List<Lead>();
        List<Opportunity> updateOpps = new List<Opportunity>();
        List<Contact> updateConts = new List<Contact>();
        Map<String, Redial_Cadence__mdt> redialCadenceMap = redialCadenceMapping();
        
        if(!leadIds.isEmpty() && redialCadenceMap != null){
            for(Lead leadRec:[SELECT Id, Status, Redial_Time__c, Delete_from_f9list_id__c, Add_to_f9list_Id__c,Five9_List_Id__c,Call_counter__c, Hopper_Priority__c,Archived_Date__c,Is_Archived__c FROM Lead WHERE Id IN :leadIds]){
                if(taskDispositionMap.containsKey(leadRec.Id) && redialCadenceMap.containsKey(taskDispositionMap.get(leadRec.Id)[0].Disposition__c)){                    
                    if(redialCadenceMap.get(taskDispositionMap.get(leadRec.Id)[0].Disposition__c).Final_stage__c){                        
                        leadRec.Redial_Time__c = null;
                        if(redialCadenceMap.get(taskDispositionMap.get(leadRec.Id)[0].Disposition__c).Lead_Stage__c != null)
                            leadRec.Status = redialCadenceMap.get(taskDispositionMap.get(leadRec.Id)[0].Disposition__c).Lead_Stage__c;
                    }else if(leadRec.Call_counter__c != null && leadRec.Call_counter__c >= redialCadenceMap.get(taskDispositionMap.get(leadRec.Id)[0].Disposition__c).Minimum_Call_Count__c
                        && leadRec.Call_counter__c <= redialCadenceMap.get(taskDispositionMap.get(leadRec.Id)[0].Disposition__c).Maximum_Call_Count__c){
                        Integer Hours = Integer.valueOf(redialCadenceMap.get(taskDispositionMap.get(leadRec.Id)[0].Disposition__c).Re_dial_time__c);
                        leadRec.Redial_Time__c = System.now().addHours(Hours);
                        leadRec.Hopper_Priority__c = Integer.valueOf(redialCadenceMap.get(taskDispositionMap.get(leadRec.Id)[0].Disposition__c).Hopper_Priority__c);                        
                    }
                  //  leadRec.Delete_from_f9list_id__c = leadRec.Five9_List_Id__c != null ? leadRec.Five9_List_Id__c : '';
                  //  leadRec.Five9_List_Id__c = null;
                    leadRec.Is_Archived__c = leadRec.Five9_List_Id__c != null ? True : False;
                    leadRec.Archived_Date__c = Date.Today();
                    updateLeads.add(leadRec);
                }                   
            }
                        
            for (Database.SaveResult saveResult : Database.update(updateLeads  , false)) {
                if (!saveResult.isSuccess()) {
                    notSyncedRedialTaskList.addAll(taskDispositionMap.get(saveResult.getId()));
                    String errorMessage;
                    for (Database.Error err : saveResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('Updating lead with redial time is failed', saveResult.getId(), errorMessage, true);
                }else{
                    syncedRedialTasks.addAll(taskDispositionMap.get(saveResult.getId()));
                }
            }
        }
        
        if(!oppIds.isEmpty() && redialCadenceMap != null){
            for(Opportunity oppRec:[SELECT Id, Name, Redial_Time__c FROM Opportunity WHERE Id IN :oppIds]){
                if(taskDispositionMap.containsKey(oppRec.Id) && redialCadenceMap.containsKey(taskDispositionMap.get(oppRec.Id)[0].Disposition__c)){
                    Integer Hours = Integer.valueOf(redialCadenceMap.get(taskDispositionMap.get(oppRec.Id)[0].Disposition__c).Re_dial_time__c);
                    oppRec.Redial_Time__c = System.now().addHours(Hours);
                    updateOpps.add(oppRec);
                } 
            }
            
            for (Database.SaveResult saveResult : Database.update(updateOpps, false)) {
                if (!saveResult.isSuccess()) {
                    String errorMessage;
                    notSyncedRedialTaskList.addAll(taskDispositionMap.get(saveResult.getId()));
                    for (Database.Error err : saveResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('Updating opportunity with redial time is failed', saveResult.getId(), errorMessage, true);
                }else{
                    syncedRedialTasks.addAll(taskDispositionMap.get(saveResult.getId()));
                }
            }
        }
        
        if(!conIds.isEmpty() && redialCadenceMap != null){
            for(Contact conRec:[SELECT Id, Name, Redial_Time__c FROM Contact WHERE Id IN :conIds]){
                if(taskDispositionMap.containsKey(conRec.Id) && redialCadenceMap.containsKey(taskDispositionMap.get(conRec.Id)[0].Disposition__c)){
                    Integer Hours = Integer.valueOf(redialCadenceMap.get(taskDispositionMap.get(conRec.Id)[0].Disposition__c).Re_dial_time__c);
                    conRec.Redial_Time__c = System.now().addHours(Hours);
                    updateConts.add(conRec);
                }
            }
            
            for (Database.SaveResult saveResult : Database.update(updateConts, false)) {
                if (!saveResult.isSuccess()) {
                    String errorMessage;
                    notSyncedRedialTaskList.addAll(taskDispositionMap.get(saveResult.getId()));
                    for (Database.Error err : saveResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('Updating contact with redial time is failed', saveResult.getId(), errorMessage, true);
                }else{
                    syncedRedialTasks.addAll(taskDispositionMap.get(saveResult.getId()));
                }
            }
        }
        
        //If redial time not successfully update with parent, then will update redial sync failed as true on task.     
        if(!notSyncedRedialTaskList.isEmpty()){
            for(Task rec :notSyncedRedialTaskList){
                rec.Redial_Sync_Failed__c = true;
            }
            
          /*  for (Database.SaveResult saveResult : Database.update(notSyncedRedialTaskList, false)) {
                if (!saveResult.isSuccess()) {
                    String errorMessage;
                    for (Database.Error err : saveResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('Updating Task redial time synced is failed', saveResult.getId(), errorMessage, true);
                }
            }*/
            performDML(notSyncedRedialTaskList);
        }
        
        //If redial time successfully update with parent, then will update redial sync failed as false on task.     
        if(!syncedRedialTasks.isEmpty()){
            for(Task rec :syncedRedialTasks){
                rec.Redial_Sync_Failed__c = false;
            }
            
         /*   for (Database.SaveResult saveResult : Database.update(syncedRedialTasks, false)) {
                if (!saveResult.isSuccess()) {
                    String errorMessage;
                    for (Database.Error err : saveResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('Updating Task redial time synced is failed', saveResult.getId(), errorMessage, true);
                }
            }  */
            performDML(syncedRedialTasks);
        }                                           
        ApplicationLogger.insertStoredLogs();
    }
    
    public void finish(Database.BatchableContext bc) {
        //Update batch last run time in sync redial time custom setting
        Sync_Redial_Time__c syncRedialSetting = [SELECT Id, Last_Run_Time__c FROM Sync_Redial_Time__c];
        syncRedialSetting.Last_Run_Time__c = System.now();
        UPDATE syncRedialSetting;
    }
    
    //Method construct the redialCadence meta data.
    public static Map<String, Redial_Cadence__mdt> redialCadenceMapping() {
        Map<String, Redial_Cadence__mdt> redialCadenceMap = new Map<String, Redial_Cadence__mdt>();
        for (Redial_Cadence__mdt redialInstance: [SELECT Id, Disposition__c, Re_dial_time__c,Hopper_Priority__c, Maximum_Call_Count__c, Minimum_Call_Count__c, Final_stage__c, Lead_Stage__c FROM Redial_Cadence__mdt WHERE Active__c = true]) {
            redialCadenceMap.put(redialInstance.Disposition__c, redialInstance);
        }
        return !redialCadenceMap.isEmpty() ? redialCadenceMap: null;
    }
    
     //Method construct the redialCadence meta data.
    public static Map<String, Redial_Cadence__mdt> redialCadenceMappingAll() {
        Map<String, Redial_Cadence__mdt> redialCadenceMap = new Map<String, Redial_Cadence__mdt>();
        for (Redial_Cadence__mdt redialInstance: [SELECT Id, Disposition__c, Re_dial_time__c,Hopper_Priority__c, Maximum_Call_Count__c, Minimum_Call_Count__c, Final_stage__c, Lead_Stage__c FROM Redial_Cadence__mdt WHERE Active__c = true]) {
            redialCadenceMap.put(redialInstance.Disposition__c, redialInstance);
        }
        return !redialCadenceMap.isEmpty() ? redialCadenceMap: null;
    }
    
    private static void performDML(List<Task> RedialTasks){
           for (Database.SaveResult saveResult : Database.update(RedialTasks, false)) {
                if (!saveResult.isSuccess()) {
                    String errorMessage;
                    for (Database.Error err : saveResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('Updating Task redial time synced is failed', saveResult.getId(), errorMessage, true);
                }
            }
    }
}