public inherited sharing class Five9CallLogService {

    //Method to loop over and process all the five9CallLog records.
    public static void processFive9CallLogRecords(List<Five9_Call_Log__c> five9List) {
         Map<Id, Lead> leadMap = new Map<Id, Lead>();
         List<Opportunity> updateOpportunities = new List<Opportunity>();
         List<Task> createTasks = new List<Task>();
         Map<String, Five9_Connector_Disposition__mdt> five9DispositionMap = new Map<String,Five9_Connector_Disposition__mdt>(); 
         List<Five9_Settings__mdt> five9SettingMdt = [SELECT Id, Label,Five9_Final_Stage__c FROM Five9_Settings__mdt];
         List<String> finalFive9Disposition = (five9SettingMdt != null && five9SettingMdt[0].Five9_Final_Stage__c != null) ? five9SettingMdt[0].Five9_Final_Stage__c.split(',') : null;        
         
         for(Five9_Connector_Disposition__mdt five9Disposition: [SELECT Id, Label, Stage__c,Create_Task__c,Sub_Disposition__c FROM Five9_Connector_Disposition__mdt]){
             five9DispositionMap.put(five9Disposition.Label , five9Disposition);
         }
         
         try {         
             for (Five9_Call_Log__c five9Instance : five9List) {
                  if(five9Instance.Lead__c != null){
                    Lead leadInstance = new Lead();
                    leadInstance.Id = five9Instance.Lead__c; 
                    leadInstance.five9_Disposition__c = five9Instance.Disposition__c;
                    leadInstance.five9_Last_Disposition__c = five9Instance.f9_Last_Disposition__c != null ? five9Instance.f9_Last_Disposition__c : '';
                    
                    if(five9Instance.Attempt_Count__c != null) {
                        leadInstance.Call_counter__c = Decimal.valueOf(five9Instance.Attempt_Count__c);
                    }
                    if(five9DispositionMap.containsKey(five9Instance.Disposition__c)){
                        if(five9DispositionMap.get(five9Instance.Disposition__c).Sub_Disposition__c != null){
                            leadInstance.Sub_Disposition__c = five9DispositionMap.get(five9Instance.Disposition__c).Sub_Disposition__c;
                        }
                        if(five9DispositionMap.get(five9Instance.Disposition__c).Stage__c != null){
                            leadInstance.Status = five9DispositionMap.get(five9Instance.Disposition__c).Stage__c;
                        }
                    }
                    
                    if(finalFive9Disposition != null && finalFive9Disposition.contains(five9Instance.Disposition__c)){
                        leadInstance.Five9_Final_Stage__c = true;
                        leadInstance.Status = 'Archive Disposition';
                        leadInstance.Sub_Disposition__c = 'Final Stage';
                    }
                    leadMap.put(five9Instance.Lead__c, leadInstance);
                    //updateLeads.add(leadInstance);                 
                }
                
                if(five9Instance.Opportunity__c != null){
                    Opportunity oppInstance = new Opportunity(
                        Id = five9Instance.Opportunity__c, 
                        five9_Disposition__c = five9Instance.Disposition__c,  
                        five9_Last_Disposition__c = five9Instance.f9_Last_Disposition__c != null ? five9Instance.f9_Last_Disposition__c : ''
                    );
                    updateOpportunities.add(oppInstance);
                                     
                }
                
                if(five9Instance.Disposition__c != null && five9DispositionMap.containsKey(five9Instance.Disposition__c) && five9DispositionMap.get(five9Instance.Disposition__c).Create_Task__c) {
                    Task taskInstance = createTask(five9Instance);
                    createTasks.add(taskInstance);    
                }
             }
             
             if(leadMap != null){
                 updateCallCountOnLead(leadMap);
             }
             
             if(!updateOpportunities.isEmpty()){
                 for (Database.SaveResult srData : Database.update(updateOpportunities, false)) {
                    if (!srData.isSuccess()) {           
                        for (Database.Error err : srData.getErrors()) {
                            ApplicationLogger.logDMLException(
                                'Opportunity fields that affected this error : ' + String.join(err.getFields(), ', '), 
                                srData.getId(), err.getStatuscode() + ': ' + err.getMessage()
                            );
                        }
                    }
                }
             }
             
             if(!createTasks.isEmpty()){
                 for (Database.SaveResult srData : Database.insert(createTasks, false)) {
                    if (!srData.isSuccess()) {           
                        for (Database.Error err : srData.getErrors()) {
                            ApplicationLogger.logDMLException(
                                'Task fields that affected this error : ' + String.join(err.getFields(), ', '), 
                                srData.getId(), err.getStatuscode() + ': ' + err.getMessage()
                            );
                        }
                    }
                }
             }
         }catch (Exception e) {
            ApplicationLogger.logException('Five9CallLogTriggerHandler.processFive9CallLogRecords', null, e.getMessage());
        }
    }

    //Create task method with call log instance. 
    private static Task createTask(Five9_Call_Log__c five9CallLog){
        String five9IntegrationUserId = System.Label.Five9_Task_Owner_Id;
        Task taskInstance = new Task(); 
        taskInstance.Disposition__c = five9CallLog.Disposition__c;
        taskInstance.CallDisposition = five9CallLog.Disposition__c;
        taskInstance.Five9__Five9SessionId__c = five9CallLog.Session_Id__c != null ? five9CallLog.Session_Id__c : '';
        taskInstance.Five9_ANI__c = five9CallLog.ANI__c != null ? five9CallLog.ANI__c : '';
        taskInstance.Five9_Agent__c = five9CallLog.Agent_Full_Name__c != null ? five9CallLog.Agent_Full_Name__c : '';
        taskInstance.Five9_Attempt_Count__c = five9CallLog.Attempt_Count__c != null ? Decimal.valueOf(five9CallLog.Attempt_Count__c) : 0.00;
        taskInstance.Five9_Call_ID__c = five9CallLog.Call_Id__c != null ? five9CallLog.Call_Id__c : ''; 
        taskInstance.Five9_Campaign__c = five9CallLog.Campaign_Name__c != null ? five9CallLog.Campaign_Name__c : '';
        taskInstance.Five9__Five9TaskType__c = 'Call'; 
        taskInstance.Status = 'Completed'; 
        taskInstance.ActivityDate = System.Date.today(); 
        
        if(five9CallLog.f9_Call_Type__c != null){      
            taskInstance.subject = five9CallLog.f9_Call_Type__c + '-'+five9CallLog.Disposition__c + '-' + formatDate(five9CallLog.createdDate); 
        }else{
            taskInstance.subject = 'Call-'+five9CallLog.Disposition__c + '-' + formatDate(five9CallLog.createdDate);
        }    
        
        if(five9CallLog.Lead__c != null){
            taskInstance.WhoId = five9CallLog.Lead__c;
        } else if(five9CallLog.Opportunity__c != null){
            taskInstance.WhatId = five9CallLog.Opportunity__c;
        }
        taskInstance.ownerId = five9IntegrationUserId;

        return taskInstance;
    }

    private static String formatDate(DateTime dt) {
        return dt.format('yyyy-MM-dd h:mm a');
    }  
    
    //This method will update call counter on lead based on five9 call log record count under lead
    public static void updateCallCountOnLead(Map<Id, Lead> leadMap) {
        
        if(leadMap != null){
            List<Lead> updateLeadList = new List<Lead>();
            Map<Id, AggregateResult> five9AggregateResult = Five9CallLogData.getFive9RecordCountRelatedLead(leadMap.keySet());            
            if(five9AggregateResult != null){
                for(Id leadId : leadMap.keySet()){
                    if(five9AggregateResult.containsKey(leadId) && leadMap.containsKey(leadId)){
                        Lead leadRec = leadMap.get(leadId);
                        leadRec.Call_counter__c = Integer.valueOf(five9AggregateResult.get(leadId).get('expr0'));
                        updateLeadList.add(leadRec);
                    }
                }
            }
            
            if(!updateLeadList.isEmpty()){
                updateLeads(updateLeadList);
            }
        }  
    }
    
    public static void updateLeads(List<Lead> updateLeadList) {
        for (Database.SaveResult saveResult : Database.update(updateLeadList , false)) {
            if (!saveResult.isSuccess()) {
                String errorMessage;
                for (Database.Error err : saveResult.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                ApplicationLogger.logDMLException('Updating lead fields is failed', saveResult.getId(), errorMessage, true);
            }
        }   
    }
}