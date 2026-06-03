/*
    Class Name: TaskServices
    Description: This class handles the services that needs to be executed on Tasks (TaskHandler)
    Created By: Aditya T.
    **********************************************************************************************************************************
        Date            Modified By             Description     
    **********************************************************************************************************************************
        Feb-2-2024      Aditya T.               Initial Development
        Mar-8-2024      Dharanya S.             CD-288: Overrdide Subject of Five9 Task
    **********************************************************************************************************************************
*/
public inherited sharing class TaskServices {

    /**
     * @description: Method to update Last Contacted DateTime in Lead & Opportunity.
     */
    public static void updateLastContactedDateTime(List<Task> tasks) {
        Map<Id, Lead> leadsToUpdate = new MAp<Id, Lead>();
        Map<Id, Opportunity> opptysToUpdate = new Map<Id, Opportunity>();
        Map<Id, Account> accountToUpdate = new Map<Id, Account>();
        
        for (Task taskRecord : tasks) {
            if (String.isNotBlank(taskRecord.whoId) && LeadUtil.isLeadId(taskRecord.whoId)) {
                Lead leadInstance = new Lead(Id = taskRecord.whoId);
                leadInstance.Last_Contacted_DateTime__c = taskRecord.LastModifiedDate;
                leadsToUpdate.put(leadInstance.Id, leadInstance);
                
            } else if (String.isNotBlank(taskRecord.whatId) && OpportunityUtil.isOppId(taskRecord.whatId)) {
                Opportunity oppInstance = new Opportunity(Id = taskRecord.whatId);
                oppInstance.Last_Contacted_DateTime__c = taskRecord.LastModifiedDate;
                opptysToUpdate.put(oppInstance.Id, oppInstance);
                
            } else if (String.isNotBlank(taskRecord.whatId) && AccountUtil.isAccountId(taskRecord.whatId)) {
                Account accInstance = new Account(Id = taskRecord.whatId);
                accInstance.Last_Contacted_DateTime__c = taskRecord.LastModifiedDate;
                accountToUpdate.put(accInstance.Id, accInstance);
            } else if (String.isNotBlank(taskRecord.whoId) && ContactUtil.isContactId(taskRecord.whoId)) {
                Account accInstance = AccountData.queryAccountRelatedToContact(taskRecord.whoId)[0];
                accInstance.Last_Contacted_DateTime__c = taskRecord.LastModifiedDate;
                accountToUpdate.put(accInstance.Id, accInstance);
            }
        }    
        update leadsToUpdate.values();

        OpportunityLockService.disableOppLockForSystemUpdates();
        update opptysToUpdate.values();
        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        
        if(!accountToUpdate.values().isEmpty()){
            update accountToUpdate.values();
        }
    }
    
    /**
     * @description: Method to update Lead fields when Task has "CALL TRANSFERRED" disposition.
     */
    public static void populateLeadFieldsForCallTransfer(List<Task> tasks) {
        List<Lead> leadsToUpdate = new List<Lead>();
        Set<String> agentNames = new Set<String>();

        for (Task taskRecord : tasks) {
            if (isCallTransferred(taskRecord)
                && String.isNotBlank(taskRecord.WhoId)
                && LeadUtil.isLeadId(taskRecord.WhoId)
                && String.isNotBlank(taskRecord.Five9_Agent__c)) {
                agentNames.add(taskRecord.Five9_Agent__c);
            }
        }

        Map<String, Id> userMap = new Map<String, Id>();
        
        if(agentNames.size() > 0) {
        	userMap = UserUtil.getUserMapByUserNames(agentNames);
        }
        
        for (Task taskRecord : tasks) {
            if (isCallTransferred(taskRecord)) {
                if (String.isNotBlank(taskRecord.whoId) && LeadUtil.isLeadId(taskRecord.whoId)) {
                    Lead leadInstance = new Lead(Id = taskRecord.whoId);
                    Id userId = userMap.get(taskRecord.Five9_Agent__c);
                    if (userId != null) {
                        leadInstance.FronterLookup__c = userId;
                        leadInstance.Call_Transferred_By_Lookup__c = userId;
                    } else {
                        ApplicationLogger.logDetails('TaskServices.populateLeadFieldsForCallTransfer', taskRecord.whoId, 'User not found for agent: ' + taskRecord.Five9_Agent__c);
                    }

                    leadInstance.Call_Tranferred_DateTime__c = System.now();
                    leadsToUpdate.add(leadInstance);
                }
            }
        }
        ApplicationLogger.insertStoredLogs();

        if (!leadsToUpdate.isEmpty()) {
            update leadsToUpdate;
        }
    }

    /**
     * @description: Check if the task has "CALL TRANSFERRED" disposition.
     * @return boolean - True if the task has "CALL TRANSFERRED" disposition, False otherwise.
     */
    private static boolean isCallTransferred(Task task) {
        return task.Disposition__c == 'CALL TRANSFERRED';
    }
    
    /**
     * @description: Check if the task is related to a Lead.
     * @return boolean - True if the task is related to a Lead, False otherwise.
     */
    public static boolean isLeadRelatedTask(Task task) {
        return String.isNotBlank(task.whoId) && LeadUtil.isLeadId(task.whoId);
    }

    /**
     * @description: Check if the task is related to an Opportunity.
     * @return boolean - True if the task is related to an Opportunity, False otherwise.
     */
    public static boolean isOpportunityRelatedTask(Task task) {
        return String.isNotBlank(task.whatId) && OpportunityUtil.isOppId(task.whatId);
    }
    
    /**
     * @description: Check if the task is related to Account.
     * @return boolean - True if the task is related to Account, False otherwise.
     */
    public static boolean isAccountRelatedTask(Task task) {
        return String.isNotBlank(task.whatId) && AccountUtil.isAccountId(task.whatId);
    }
    
    /**
     * @description: Method to populate Task Subject With Disposition
     */
    public static void populateSubjectWithDisposition(List<Task> tasks) {
        Set<Id> accountIds = new Set<Id>();
        for (Task taskRecord : tasks) {
            if (isFive9CallTask(taskRecord) && !subjectContainsDisposition(taskRecord)) {
                taskRecord.Subject = updateSubjectWithDisposition(taskRecord);
            }
            if(taskRecord.WhatId != null){
                String objectName = ApexUtil.getSObjectName(taskRecord.WhatId);
                if ( objectName == 'Account') {
                    accountIds.add(taskRecord.WhatId);
                }
            }
        }
        if(!accountIds.isEmpty()){
            populateSubDispostionOnTask(tasks,accountIds);
        }
    }
    
    public static void populateLastCallLastEmail(List<Task> tasks) {
        try {
            Map<Id, DateTime> callAccountDates = new Map<Id, DateTime>();
            Map<Id, DateTime> callOpportunityDates = new Map<Id, DateTime>();
            Map<Id, DateTime> emailAccountDates = new Map<Id, DateTime>();
            Map<Id, DateTime> emailOpportunityDates = new Map<Id, DateTime>();
            for (Task taskRecord : tasks) {
                String linkedWhatId = taskRecord.WhatId;
                if (isEmailTask(taskRecord) && taskRecord.WhatId == null) {
                    linkedWhatId = taskRecord.AccountId;
                }
                if(linkedWhatId != null) { 
                    String objectName = ApexUtil.getSObjectName(linkedWhatId);
                    DateTime createdDate = taskRecord.CreatedDate;
                    if (isFive9CallTask(taskRecord)) {
                        if (objectName == 'Account') {
                            updateLatestDate(callAccountDates, linkedWhatId, createdDate);
                        } else if (objectName == 'Opportunity') {
                            updateLatestDate(callOpportunityDates, linkedWhatId, createdDate);
                        }
                    }
                    if (isEmailTask(taskRecord)) {
                        if (objectName == 'Account') {
                            updateLatestDate(emailAccountDates, linkedWhatId, createdDate);
                        } else if (objectName == 'Opportunity') {
                            updateLatestDate(emailOpportunityDates, linkedWhatId, createdDate);
                        }
                    }
                }
            }
            updateAccountsWithDates(callAccountDates, Account.Last_Call__c, Account.Last_Contacted_DateTime__c);
            updateOpportunitiesWithDates(callOpportunityDates, Opportunity.Last_Call__c, Opportunity.Last_Contacted_DateTime__c);
            updateAccountsWithDates(emailAccountDates, Account.Last_Email__c, Account.Last_Contacted_DateTime__c);
            updateOpportunitiesWithDates(emailOpportunityDates, Opportunity.Last_Email__c, Opportunity.Last_Contacted_DateTime__c);
        } catch (Exception ex) {
            ApplicationLogger.logException('TaskServices.populateLastCallLastEmail', null, ex.getMessage());
        } finally {
            ApplicationLogger.insertStoredLogs();
        }
    }
    private static void updateLatestDate(Map<Id, DateTime> mapToUpdate, Id recordId, DateTime newDate) {
        if (!mapToUpdate.containsKey(recordId)) {
            mapToUpdate.put(recordId, newDate);
        }
    }
     private static boolean isEmailTask(Task task) {
        return String.isNotBlank(task.TaskSubtype) && task.TaskSubtype.equals('Email');
    }
    
    private static void updateAccountsWithDates(Map<Id, DateTime> idDateMap, SObjectField field1, SObjectField field2) {
        if (idDateMap.isEmpty()) return;
        List<Account> accountsToUpdate = new List<Account>();
        for (Id accId : idDateMap.keySet()) {
            DateTime dt = idDateMap.get(accId);
            Account acc = new Account(Id = accId);
            acc.put(field1, dt);
            acc.put(field2, dt);
            accountsToUpdate.add(acc);
        }
        for (Database.SaveResult saveResult : Database.update(accountsToUpdate , false)) {
            if (!saveResult.isSuccess()) {
                String errorMessage;
                for (Database.Error err : saveResult.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                ApplicationLogger.logDMLException('Updating Opportunity fields is failed', saveResult.getId(), errorMessage, true);
            }
        }
    }
    private static void updateOpportunitiesWithDates(Map<Id, DateTime> idDateMap, SObjectField field1, SObjectField field2) {
        if (idDateMap.isEmpty()) return;
        List<Opportunity> oppsToUpdate = new List<Opportunity>();
        for (Id oppId : idDateMap.keySet()) {
            DateTime dt = idDateMap.get(oppId);
            Opportunity opp = new Opportunity(Id = oppId);
            opp.put(field1, dt);
            opp.put(field2, dt);
            oppsToUpdate.add(opp);
        }
        OpportunityLockService.disableOppLockForSystemUpdates();
        for (Database.SaveResult saveResult : Database.update(oppsToUpdate , false)) {
            if (!saveResult.isSuccess()) {
                String errorMessage;
                for (Database.Error err : saveResult.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                ApplicationLogger.logDMLException('Updating Opportunity fields is failed', saveResult.getId(), errorMessage, true);
            }
        }
        OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
    }
    public static void updateOpportunities(Set<Id> opportunityIds, Map<SObjectField, Object> fieldValueMap) {
        if (opportunityIds.isEmpty() || fieldValueMap == null || fieldValueMap.isEmpty()) return;
        List<Opportunity> oppList = new List<Opportunity>();
        for (Id oppId : opportunityIds) {
            Opportunity opp = new Opportunity(Id = oppId);
            for (SObjectField field : fieldValueMap.keySet()) {
                opp.put(field, fieldValueMap.get(field));
            }
            oppList.add(opp);
        }
        if (!oppList.isEmpty()) {
            OpportunityLockService.disableOppLockForSystemUpdates();
            for (Database.SaveResult saveResult : Database.update(oppList , false)) {
                if (!saveResult.isSuccess()) {
                    String errorMessage;
                    for (Database.Error err : saveResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('Updating Opportunity fields is failed', saveResult.getId(), errorMessage, true);
                }
            }
            OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        }
    }
    public static void updateAccounts(Set<Id> accountIds, Map<SObjectField, Object> fieldValueMap) {
        if (accountIds.isEmpty() || fieldValueMap == null || fieldValueMap.isEmpty()) return;
        List<Account> accList = new List<Account>();
        for (Id accId : accountIds) {
            Account acc = new Account(Id = accId);
            for (SObjectField field : fieldValueMap.keySet()) {
                acc.put(field, fieldValueMap.get(field));
            }
            accList.add(acc);
        }
        if (!accList.isEmpty()) {
            for (Database.SaveResult saveResult : Database.update(accList , false)) {
                if (!saveResult.isSuccess()) {
                    String errorMessage;
                    for (Database.Error err : saveResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('Updating Account fields is failed', saveResult.getId(), errorMessage, true);
                }
            }   
        }
    }
    
    
    public static void populateSubDispostionOnTask(List<Task> tasks,  Set<Id> accountIds ){
        if (!accountIds.isEmpty()) {
            Map<Id, Account> accountMap = new Map<Id, Account>(
                AccountData.queryAccountBasedOnIds(accountIds)
            );
            
            for (Task t : tasks) {
                if (accountMap.containsKey(t.WhatId)) {
                    t.Sub_Disposition__c = accountMap.get(t.WhatId).Sub_Disposition__c;
                }
            }
        }
    }
    
    /**
     * @description: Check if the task is a "Five9 Call" task.
     * @return boolean - True if the task is a "Call" task, False otherwise.
     */
    private static boolean isFive9CallTask(Task task) {
        return String.isNotBlank(task.Subject) && task.Subject.startsWithIgnoreCase('Call') 
            && String.isNotBlank(task.Five9__Five9TaskType__c) && task.Five9__Five9TaskType__c.equals('Call');
    }

    /**
     * @description: Check if the subject contains disposition.
     * @return boolean - True if the subject contains disposition, False otherwise.
     */
    private static boolean subjectContainsDisposition(Task task) {
        return String.isNotBlank(task.Subject) && ((String.isNotBlank(task.Disposition__c) && task.Subject.contains(task.Disposition__c)) 
            || (String.isNotBlank(task.CallDisposition) && task.Subject.contains(task.CallDisposition)));
    }

    /**
     * @description: Update subject with disposition.
     * @return String - Updated subject.
     */
    private static String updateSubjectWithDisposition(Task task) {
        String subject = task.Subject;
        List<String> subjectParts = task.Subject.split(' ', 2);
        String disposition = task.Disposition__c != null ? task.Disposition__c : task.CallDisposition;
        if (subjectParts != null && !subjectParts.isEmpty() && subjectParts.size() == 2) {
            subject = subjectParts[0] + '-' + disposition  + '-' + subjectParts[1];
        }
        return subject;
    }
 
    /**
     * @description: Format current date time in the specified format.
     * @return String - Formatted date time string.
     */
    private static String formatDateTime() {
        Datetime now = Datetime.now();
        return now.format('MM/dd/yyyy hh:mm a z', 'EST');
    }
}