public without sharing class DispositionController {

    private static String DUMMY_RT_ID = '012000000000000AAA';

    @AuraEnabled
    public static ApexActionResult getRTDetailsOfRecord(Id recordId) {
        final String SCOPE = 'DispositionController.getRTDetailsOfRecord';
        ApexActionResult result = new ApexActionResult(SCOPE);
        RecordDetails recordDetailWrap = new RecordDetails();
        try {
            ApexUtil.requireValue('Record Id', recordId);
            if (LeadUtil.isLeadId(recordId)) {
                Lead leadRecord = LeadUtil.getRTDetailsOfRecord(recordId);
                recordDetailWrap.objectName = new LeadUtil().getSObjName();
                recordDetailWrap.recordTypeId = leadRecord.RecordType.Id;
                recordDetailWrap.dispositionField = LeadUtil.FIELD_DISPOSITION;
                recordDetailWrap.subDispositionField = LeadUtil.FIELD_SUB_DISPOSITION;
                recordDetailWrap.callTransferStatusField = LeadUtil.FIELD_CALL_TRANSFER_STATUS;
                recordDetailWrap.dispositionValue = leadRecord.Status;
                recordDetailWrap.subDispositionValue = leadRecord.Sub_Disposition__c;
            } else if (OpportunityUtil.isOppId(recordId)) {
                List<Opportunity> opportunities = OpportunityData.queryOpportunity(recordId);
                if (!opportunities.isEmpty()) {
                    Opportunity oppRecord = opportunities[0];
                    recordDetailWrap.dispositionValue = oppRecord.StageName;
                    recordDetailWrap.subDispositionValue = oppRecord.Sub_Disposition__c;
                    if(oppRecord.AccountId != null){
                        recordDetailWrap.accountDetails = AccountData.queryAccount(oppRecord.AccountId)[0];
                    }
                }
                
                recordDetailWrap.objectName = new OpportunityUtil().getSObjName();
                recordDetailWrap.recordTypeId = DUMMY_RT_ID;
                recordDetailWrap.dispositionField = OpportunityUtil.FIELD_DISPOSITION;
                recordDetailWrap.subDispositionField = OpportunityUtil.FIELD_SUB_DISPOSITION;
                recordDetailWrap.callTransferStatusField = OpportunityUtil.FIELD_CALL_TRANSFER_STATUS;
            } else if (AccountUtil.isAccountId(recordId)) {
                List<Account> accounts = AccountData.queryAccount(recordId);
                if (!accounts.isEmpty()) {
                    Account accountRecord = accounts[0];
                    recordDetailWrap.dispositionValue = accountRecord.Client_Status__c;
                    recordDetailWrap.subDispositionValue = accountRecord.Sub_Disposition__c;
                }
                recordDetailWrap.objectName = new AccountUtil().getSObjName();
                recordDetailWrap.recordTypeId = DUMMY_RT_ID;
                recordDetailWrap.dispositionField = AccountUtil.FIELD_DISPOSITION;
                recordDetailWrap.subDispositionField = AccountUtil.FIELD_SUB_DISPOSITION;
            }
            result.data = JSON.serialize(recordDetailWrap);
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }

    public class RecordDetails {
        public String objectName;
        public Id recordTypeId;
        public String dispositionField;
        public String subDispositionField;
        public String callTransferStatusField;
        public String dispositionValue;
        public String subDispositionValue;
        public Boolean setCustomerStatus;
        public Boolean skipSyncWithProcessor;
        public String processorStatus;
        public Boolean isPassedPicklistTransistion;
        public Account accountDetails;
    }
    
    @AuraEnabled
    public static ApexActionResult saveDispositionDetails(String dispositionDetails) {
        final String SCOPE = 'DispositionController.saveDispositionDetails';
        ApexActionResult result = new ApexActionResult(SCOPE);
        System.Savepoint sp = Database.setSavepoint();
        try {
            ApexUtil.requireValue('Dispostion Form Details', dispositionDetails);
            Map<String, Object> dispositionMap = (Map<String, Object>) JSON.deserializeUntyped(dispositionDetails);
            if (dispositionMap.containsKey('dispositionRecord')) {
                String dispositionRecord = JSON.serialize(dispositionMap.get('dispositionRecord'));
                Task dispositionTaskToDML = (Task)JSON.deserialize(dispositionRecord, Task.class);
                if (dispositionTaskToDML != null) {
                    dispositionTaskToDML.recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_DISPOSITION);
                    if (dispositionTaskToDML.ReminderDateTime != null) {
                        Task reminderTask = createReminderTask(dispositionTaskToDML);
                        insert reminderTask;
                    }
                    insert dispositionTaskToDML;
                }
            } else if (dispositionMap.containsKey('dispositionEventRecord')) {
                String dispositionRecord = JSON.serialize(dispositionMap.get('dispositionEventRecord'));
                Event dispositionEventToDML = (Event)JSON.deserialize(dispositionRecord, Event.class);
                if (dispositionEventToDML.EndDateTime == null) {
                    dispositionEventToDML.DurationInMinutes = 30;
                }
                if (dispositionEventToDML != null) {
                    dispositionEventToDML.recordTypeId = EventUtil.getRecordTypeId(EventUtil.RT_EVENT_DISPOSITION);
                    insert dispositionEventToDML;
                }
            } else if (dispositionMap.containsKey('noteRecord')) {
                String dispositionRecord = JSON.serialize(dispositionMap.get('noteRecord'));
                Task dispositionNoteToDML = (Task)JSON.deserialize(dispositionRecord, Task.class);
                if (dispositionNoteToDML != null) {
                    dispositionNoteToDML.recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_NOTE);
                    insert dispositionNoteToDML;
                }
            }
            if (dispositionMap.containsKey('leadRecord')) {
                String leadRecord = JSON.serialize(dispositionMap.get('leadRecord'));
                Lead leadToDML = (Lead)JSON.deserialize(leadRecord, Lead.class);
                if (leadToDML != null) {
                    if (leadToDML.Sub_Disposition__c == 'Call Transferred from Fronter') {
                        leadToDML.CloserLookup__c = UserInfo.getUserId();
                        leadToDML.OwnerId = UserInfo.getUserId();
                        leadToDML.Call_Received_By_Lookup__c = UserInfo.getUserId();
                        leadToDML.Call_Received_Date__c = System.now();
                    }
                    //Static variable to prevent creating task in lead trigger.
                    LeadTriggerHandler.preventTaskCreationOnStatusChange = true;
                    update leadToDML;
                    LeadTriggerHandler.preventTaskCreationOnStatusChange = false;
                }
            } else if (dispositionMap.containsKey('oppportunityRecord')) {
                Boolean eligibleToUpdateHighUCC = false;
                Boolean eligibleToUpdateToBackOfficeDefaultTeam = false;
                String opportunityRecord = JSON.serialize(dispositionMap.get('oppportunityRecord'));
                Opportunity opportunityToDML = (Opportunity)JSON.deserialize(opportunityRecord, Opportunity.class);
                if (opportunityToDML != null) {
                    if (opportunityToDML.Sub_Disposition__c == 'Call Transferred from Fronter') {
                        opportunityToDML.CloserLookup__c = UserInfo.getUserId();
                        opportunityToDML.Call_Received_By_Lookup__c = UserInfo.getUserId();
                        opportunityToDML.Call_Received_Date__c = System.now();
                    }
                    Opportunity existingOpp = [SELECT Id, Sub_Disposition__c, AccountId FROM Opportunity WHERE Id = :opportunityToDML.Id LIMIT 1];
                    opportunityToDML.AccountId = existingOpp.AccountId;
                    if ((existingOpp.Sub_Disposition__c != 'High UCC Risk' && opportunityToDML.Sub_Disposition__c == 'High UCC Risk')
                        || (existingOpp.Sub_Disposition__c != 'High UCC - Liened' && opportunityToDML.Sub_Disposition__c == 'High UCC - Liened')
                    ) {
                        eligibleToUpdateHighUCC = true;
                    } else if (existingOpp.Sub_Disposition__c != 'Buyout Program Not Qualified' && opportunityToDML.Sub_Disposition__c == 'Buyout Program Not Qualified') {
                        DispositionHelper.handleBuyoutNotQualifiedOpportunity(opportunityToDML);
                        eligibleToUpdateToBackOfficeDefaultTeam = true;
                    }
                    //Static variable to prevent creating task in opportunity trigger.
                    OpportunityTriggerHandler.preventTaskCreationOnStageChange = true;
                    OpportunityLockService.disableOppLockForSystemUpdates();
                    update opportunityToDML;
                    //Allowing the opp to DML with the Archived Dispo and High UCC Risk sub dispo first, then changing its stage and sub disposition.
                    //Reason: Then only, the history records will be clean and we know what happened behind.
                    if (eligibleToUpdateHighUCC == true) {
                        Opportunity oppToUpdateHighUCC = DispositionHelper.handleHighUCCOpportunity(opportunityToDML);
                        Account acct = AccountData.queryAccountWithUnSyncedStatus(opportunityToDML.AccountId)[0]; 
                        Decimal completedDraftCount = 0;
                        List<AggregateResult> draftResult = DraftData.getCompletedDraftDetails(opportunityToDML.Id,opportunityToDML.AccountId);
                        if (!draftResult.isEmpty()) {
                            for (AggregateResult ar : draftResult) {
                                if (ar.get('completedDraftsAmount') != null) {
                                    completedDraftCount += (Decimal)ar.get('completedDraftsAmount');
                                }
                            }
                        }
                        
                        if (oppToUpdateHighUCC != null) {
                            update oppToUpdateHighUCC;

                            Account accountToUpdate = new Account();
                            accountToUpdate.Id = opportunityToDML.AccountId;
                            accountToUpdate.OwnerId = oppToUpdateHighUCC.OwnerId;
                            if(acct.Client_Status__c == AccountUtil.CLIENT_STATUS_CANCELLED){                                
                                accountToUpdate.Client_Status__c = completedDraftCount > 0 ? AccountUtil.CLIENT_STATUS_ACTIVE: AccountUtil.CLIENT_STATUS_WAITING_FIRST_PAYMENT;
                                accountToUpdate.External_SAS_Id__c = '';
                                accountToUpdate.External_RAM_Id__c = '';
                            }
                            update accountToUpdate;
                            DispositionHelper.updateContacts(opportunityToDML.AccountId, oppToUpdateHighUCC.OwnerId);  
                        }
                    } else if (eligibleToUpdateToBackOfficeDefaultTeam == true) {
                        Account accountToUpdate = new Account();
                        accountToUpdate.Id = opportunityToDML.AccountId;
                        accountToUpdate.OwnerId = opportunityToDML.OwnerId;
                        update accountToUpdate;
                        DispositionHelper.updateContacts(opportunityToDML.AccountId, opportunityToDML.OwnerId);  
                    }
                    OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
                    OpportunityTriggerHandler.preventTaskCreationOnStageChange = false;
                }
            } else if (dispositionMap.containsKey('accountRecord')) {
                String accountRecord = JSON.serialize(dispositionMap.get('accountRecord'));
                Account accountToDML = (Account)JSON.deserialize(accountRecord, Account.class);
                if (accountToDML != null) {
                    update accountToDML;
                }                
                if(accountToDML.Client_Status__c == 'Cancelled'){
                    
                        Opportunity oppDetail = OpportunityData.getOpportunityId(accountToDML.Id);
                        if (oppDetail != null) {
                            oppDetail.StageName = OpportunityUtil.STAGE_CLOSED_LOST;
                            OpportunityLockService.disableOppLockForSystemUpdates();
                            update oppDetail;
                            OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
                        }
                    
                }
            }
        } catch (Exception ex) {
            Database.rollback(sp);
            result.thrown(ex);
        }
        return result;
    }
    
    @AuraEnabled
    public static ApexActionResult setCustomerStatus(Id recordId, String clientStatus) {
        final String SCOPE = 'DispositionController.setCustomerStatus';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try{        
            RecordDetails recordDetailWrap = new RecordDetails();
            Account acct = AccountData.queryAccountWithUnSyncedStatus(recordId)[0];       
            String currentClientStatus = acct.Client_Status__c != null ? acct.Client_Status__c : '';               
            if(currentClientStatus != clientStatus){
                String uniqueIdentifier = PicklistValueTransitionHelper.generateAccountStatusUniqueIdentifer(currentClientStatus, clientStatus);
                if(uniqueIdentifier != null){
                    Map<String, Boolean> identifierMap = PicklistValueTransitionHelper.verifyPicklistTransition(new Set<String>{uniqueIdentifier});
                    if(identifierMap.containsKey(uniqueIdentifier) && identifierMap.get(uniqueIdentifier)){
                        Account_Status_Mapping__mdt acctMappingMdt = getCustomerStatus(clientStatus);
                        if(acct.External_SAS_Id__c != null && acctMappingMdt != null) {  
                            recordDetailWrap.setCustomerStatus = ProcessorAPI.setCustomerStatus(recordId, acctMappingMdt.SAS_Status_Lookup_Id__c); 
                            recordDetailWrap.processorStatus = acctMappingMdt.Processor_Status__c;                               
                        } else if(acct.External_RAM_Id__c != null && acctMappingMdt != null){
                            recordDetailWrap.setCustomerStatus = ProcessorAPI.setCustomerStatus(recordId, acctMappingMdt.RAM_Processor_Status__c); 
                            recordDetailWrap.processorStatus = acctMappingMdt.Processor_Status__c;    
                        }else{
                            recordDetailWrap.skipSyncWithProcessor = true;
                        }
                        recordDetailWrap.isPassedPicklistTransistion = true;
                    }else {
                        recordDetailWrap.isPassedPicklistTransistion = false;
                    }
                }
            }else{
                recordDetailWrap.isPassedPicklistTransistion = true;
                recordDetailWrap.skipSyncWithProcessor = true;
            }
            result.data = JSON.serialize(recordDetailWrap);
        }catch (Exception ex) {
            ApplicationLogger.logException('Failed setcustomstatus in SAS account', recordId, ex.getMessage());
            result.thrown(ex);
        }
        return result;        
    }
    
    public static Account_Status_Mapping__mdt getCustomerStatus(String clientStatus){
       Account_Status_Mapping__mdt acctStatusMap = [SELECT Client_Status__c, Processor_Status__c, SAS_Status_Lookup_Id__c, RAM_Processor_Status__c FROM Account_Status_Mapping__mdt WHERE Client_Status__c =:clientStatus];
       return acctStatusMap;    
    }

    public static Task createReminderTask(Task parentTask) {
        Task reminderTask = parentTask.clone();
        reminderTask.recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_ACTIVITY);
        reminderTask.Subject = 'Reminder: ' + parentTask.Subject;
        reminderTask.IsReminderSet = true;
        reminderTask.ReminderDateTime = parentTask.ReminderDateTime;
        reminderTask.Status = 'In Progress';
        return reminderTask;
    }
}