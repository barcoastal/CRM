/**
 * @Description: Hander class to process the functionality on Opportunity trigger which extends TriggerHandler.
 */
public without sharing class OpportunityTriggerHandler extends TriggerHandler {

    public static Boolean byPassOpportunityTrigger = false;

    //Static varible to prevent recursion
    public static Boolean preventRecursion = false;
    //Static variable to prevent creating task if stage is updated from disposition component.
    public static Boolean preventTaskCreationOnStageChange = false;
    private Map<Id, Opportunity> opportunityOldMap;
    public static Boolean preventOpportunityLock = false;
    public static Boolean bypassForDeDuplication = false;
    private static final String ARCHIVED_FINALIZED = OpportunityUtil.STAGE_ARCHIVED_FINALIZED;
    
    public OpportunityTriggerHandler() {
        this.opportunityOldMap = (Map<Id, Opportunity>) Trigger.oldMap;
    }
    
    /**
     * @description: Method to execute logic in the before update trigger event.
     */
    public override void beforeUpdate() {
        
        for (Opportunity oppInstance : (List<Opportunity>)Trigger.new) {
            //Assign last dispostion based on the stage change
            if (oppInstance.StageName != this.opportunityOldMap.get(oppInstance.Id).StageName) {
                oppInstance.Last_Disposition__c = this.opportunityOldMap.get(oppInstance.Id).StageName;
                oppInstance.Last_Disposition_DateTime__c = System.now();
                
                //Assign add five9 list id to delete five9 list id whenever stageName change to 'Closed Won First Payment Pending'
                if(oppInstance.StageName == OpportunityUtil.STAGE_CLOSED_WON_PENDING && oppInstance.Five9_List_Id__c != null){
                      oppInstance.Delete_from_f9list_id__c = oppInstance.Five9_List_Id__c;
                      oppInstance.Five9_List_Id__c = '';
                   
                }
            } 
            //Assign last Sub Disposition based on the Sub Disposition change
            if (oppInstance.Sub_Disposition__c != this.opportunityOldMap.get(oppInstance.Id).Sub_Disposition__c) {
                oppInstance.Last_Sub_Disposition__c = this.opportunityOldMap.get(oppInstance.Id).Sub_Disposition__c;
                oppInstance.Last_Disposition_DateTime__c = System.now();
            }  
            //Assign Total debt value to Amount whenever changes. DBST-187
            if (oppInstance.Total_Debt__c != this.opportunityOldMap.get(oppInstance.Id).Total_Debt__c) {
                oppInstance.Amount = oppInstance.Total_Debt__c;
            }

            if(oppInstance.OwnerId != this.opportunityOldMap.get(oppInstance.Id).OwnerId){
                oppInstance.Opportunity_Assignment_Date__c = Date.Today();
            }
        }
        validateLockOpportunityList((List<Opportunity>)Trigger.new);
       // validateVersionStatus();
       // validateOpportunityStages();
       validateStageChange((List<Opportunity>)Trigger.new,opportunityOldMap);
    }

    public override void beforeDelete() {
        validateLockOpportunityList((List<Opportunity>)Trigger.old);
    }
        private void processOpportunitiesSendEmail() {
        Set<Id> opportunityIds = new Set<Id>();
        for (Opportunity opp : (List<Opportunity>)Trigger.new) {
            Opportunity oldOpp = Trigger.isUpdate ? (Opportunity)Trigger.oldMap.get(opp.Id) : null;
            if (opp.HIGH_UCC_RISK__c == true && opp.Qualified_Financial_Formula__c == true && 
                (Trigger.isInsert || ((oldOpp.HIGH_UCC_RISK__c != opp.HIGH_UCC_RISK__c) ||  (opp.Qualified_Financial_Formula__c!= oldOpp.Qualified_Financial_Formula__c)))) {
                opportunityIds.add(opp.Id);
            }
        }
        if (!opportunityIds.isEmpty()) {
            sendEmailToAdminGroup(opportunityIds);
        }
        Set<Id> opportunityIdsToProcessEmail = new Set<Id>();
        for (Opportunity opp :  (List<Opportunity>)Trigger.new) {
            Opportunity oldOpp = Trigger.isUpdate ? (Opportunity)Trigger.oldMap.get(opp.Id) : null;
            if(Trigger.isUpdate) {
                Boolean financialStatusIsTrue = opp.Qualified_Financial_Formula__c == true;
                Boolean stageChanged = oldOpp.StageName != opp.StageName;
                
                if (financialStatusIsTrue && stageChanged && opp.StageName != OpportunityUtil.STAGE_ARCHIVED) {
                    opportunityIdsToProcessEmail.add(opp.Id);
                }
            } 
        }
        
        if (!opportunityIdsToProcessEmail.isEmpty()) {
            sendOpportunityUpdateEmails(opportunityIdsToProcessEmail);
        }
    }
    
    public static void sendOpportunityUpdateEmails(Set<Id> opportunityIds) {
        List<Messaging.SingleEmailMessage> emails = new List<Messaging.SingleEmailMessage>();
        Map<Id, Opportunity> opportunityMap = new Map<Id, Opportunity>(
            [SELECT Id, Name, StageName, Owner.Email FROM Opportunity WHERE Id IN :opportunityIds]
        );
        EmailTemplate et =  EmailTemplateService.getEmailTemplateByName('Opportunity Stage Update');
        List<EmailTemplateService.EmailRequest> emailRequests = new List<EmailTemplateService.EmailRequest>();
        for (Opportunity opp : opportunityMap.values()) {
            Map<String, String> mergeFields =  new Map<String, String>();
            if (String.isNotBlank(opp.Owner.Email)) { 
                mergeFields.put('Opportunity.Name',opp.Name);
                mergeFields.put('Opportunity.StageName',opp.StageName);
                emailRequests.add(new EmailTemplateService.EmailRequest( 
                    EmailTemplateService.getUserEmailsFromGroups(), 
                    et.Subject, 
                    et.HtmlValue,
                    true,mergeFields)
                );
            }
        }
        EmailTemplateService.sendBulkEmails(emailRequests);
        
    }
    
     public static void sendEmailToAdminGroup(Set<Id> opportunityIds) {
        List<Opportunity> opportunities = [
            SELECT Id, Name, Sub_Disposition__c ,Total_Debt__c
            FROM Opportunity 
            WHERE Id IN :opportunityIds
        ];

        List<String> opportunityNames = new List<String>();
        for (Opportunity opp : opportunities) {
            opportunityNames.add('• ' + opp.Name);
        }
        List<String> adminEmails = new List<String>();
        List<GroupMember> adminGroupMembers = [
            SELECT TYPEOF UserOrGroup 
                    WHEN User THEN Email 
                END 
            FROM GroupMember 
            WHERE  Group.Name = 'Affiliate Group'
        ];
        for (GroupMember gm : adminGroupMembers) {
            if (gm.UserOrGroup != null && gm.UserOrGroup.Email != null) {
                adminEmails.add(gm.UserOrGroup.Email);
            }
        }
         if (!adminEmails.isEmpty()) {
             List<Messaging.SingleEmailMessage> emailMessages = new List<Messaging.SingleEmailMessage>();
             
             for (Opportunity opp : opportunities) { 
                 Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
                 email.setToAddresses(adminEmails);
                 email.setSubject('A new High UCC risk Opportunity is assigned to you.');
                 email.setPlainTextBody(
                     'Opportunity ' + opp.Name + ' with total Debt of $' + opp.Total_Debt__c + ' is assigned to you.'
                 );
                 emailMessages.add(email);
             }
             
             if (!emailMessages.isEmpty()) {
                 Messaging.sendEmail(emailMessages);
             }
         }

    }
    
    /**
     * @description: Method to execute logic in the after update trigger event.
     */
    public override void afterUpdate() {
        //Method to process the opportunity records and check for updates.
        processOpportunities();
        processOpportunitiesSendEmail();
        updatePartnerContactEmail((List<Opportunity>)Trigger.new, (Map<Id, Opportunity>)Trigger.oldMap);
        OpportunityToAccountUpdateHandler handler = new OpportunityToAccountUpdateHandler();
        handler.closerAssignment((List<Opportunity>)Trigger.new, (Map<Id, Opportunity>)Trigger.oldMap);
        handler.clientStatusAssignment((List<Opportunity>)Trigger.new, (Map<Id, Opportunity>)Trigger.oldMap);
        handler.makeUpdateClientSync((List<Opportunity>)Trigger.new, (Map<Id, Opportunity>)Trigger.oldMap);
        handler.clientSync((List<Opportunity>)Trigger.new, (Map<Id, Opportunity>)Trigger.oldMap);
        handler.makeAccountSync((List<Opportunity>)Trigger.new, (Map<Id, Opportunity>)Trigger.oldMap);
        handler.syncLegalNetworkToAccount((List<Opportunity>)Trigger.new, (Map<Id, Opportunity>)Trigger.oldMap);
        OpportunityAfterTriggerHelper.removeActiveOppFormIndividual();
        OpportunityAfterTriggerHelper.createIndividualRecords();
        //Invoking the method create async operation records.
        OpportunityAfterTriggerAsyncOpHelper.createAsyncOperationRecords();
        handleOpportunityVersionUpdate((List<Opportunity>)Trigger.new, (Map<Id, Opportunity>)Trigger.oldMap);
        processBankOpportunities((List<Opportunity>)Trigger.new);
        populateFronterDetailsInLead();
        //Due to sep-12, 24 release Commented this method.
        //OpportunityAfterTriggerHelper.removeRelatedLeadsFromFive9();
        OpportunityAfterTriggerHelper.handleFirstPayment((List<Opportunity>)Trigger.new, (Map<Id, Opportunity>)Trigger.oldMap);
    }

    //Method to loop over and process all the opportunity records.
    private void processOpportunities() {

        List<Task> taskList = new List<Task>();
        List<Opportunity> closedWonFirstPaymentPendingOppList = new List<Opportunity>();
        Map<Id, Id> oppotunityIdAcctIdMap = new Map<Id, Id>();
        Set<Id> contractSignedOppIds = new Set<Id>();
        for (Opportunity oppInstance : (List<Opportunity>)Trigger.new) {

            // Checking if the opportunity stage is changed
            if (oppInstance.StageName != this.opportunityOldMap.get(oppInstance.Id).StageName) {
                //Static variable to prevent creating task if opportunity stage is updated from disposition component.
                if (!preventTaskCreationOnStageChange) {
                    taskList.add(createTaskForStageChange(
                        oppInstance,
                        this.opportunityOldMap.get(oppInstance.Id).StageName,
                        oppInstance.StageName
                    ));
                }
                //Check if the opportunity stage is changed to Closed Won First Payment Pending.[CD-348]
                if (oppInstance.StageName.equals(OpportunityUtil.STAGE_CLOSED_WON_PENDING) && oppInstance.AccountId != null) {
                    closedWonFirstPaymentPendingOppList.add(oppInstance);
                    oppotunityIdAcctIdMap.put(oppInstance.Id, oppInstance.AccountId);
                }
                if (oppInstance.StageName.equals(OpportunityUtil.STAGE_CONTRACT_SINGED) && oppInstance.Opportunity__c != null) {
                    contractSignedOppIds.add(oppInstance.Id);
                }
            }
            // Checking if the opportunity transfer qualification is changed
            if (oppInstance.Transfer_Qualification__c != this.opportunityOldMap.get(oppInstance.Id).Transfer_Qualification__c) {
                taskList.add(createTaskForTransferQualificationChange(
                    oppInstance,
                    this.opportunityOldMap.get(oppInstance.Id).Transfer_Qualification__c,
                    oppInstance.Transfer_Qualification__c
                ));
            }
        }
        //create task record if the opportunity stage is changed
        if (!taskList.isEmpty()) {
            insert taskList;
        }
        //Method invocation to populate the program start date and end start in the account.[CD-348]
        if (!closedWonFirstPaymentPendingOppList.isEmpty()) {
            assignProgramStartEndDate(closedWonFirstPaymentPendingOppList);
            linkDocumentToAccount(oppotunityIdAcctIdMap);
        }
        if (!contractSignedOppIds.isEmpty()) {
            DebtDetailFileService.copyFilesFromParentToChildDebtDetails(contractSignedOppIds);
        }
    }


    //Method to create task instance based on the opportunity stage change.
    private Task createTaskForStageChange(Opportunity oppInstance, String oldOppStage, String newOppStage) {
        Task taskInstance = new Task(
            WhatId = oppInstance.Id,
            Description = 'Opportunity Stage changed from '
                +(String.isNotBlank(oldOppStage) ? oldOppStage : '-None-')+' to '
                +(String.isNotBlank(newOppStage) ? newOppStage : '-None-'),
            Status = 'Completed',
            RecordTypeId = TaskUtil.RTID_DISPOSITION,
            Subject = 'Stage Changed to '+newOppStage
        );
        return taskInstance;
    }

    //Method to create Task instance based on the transfer qualification value change
    private Task createTaskForTransferQualificationChange(Opportunity oppInstance, String oldOppQualification, String newOppQualification) {
        Task taskInstance = new Task(
            WhatId = oppInstance.Id,
            Description = 'The opportunity transfer qualification changed from '
                +(String.isNotBlank(oldOppQualification) ? oldOppQualification : '-None-')+' to '
                +(String.isNotBlank(newOppQualification) ? newOppQualification : '-None-'),
            Status = 'Completed',
            RecordTypeId = TaskUtil.RTID_DISPOSITION,
            Subject = 'Transfer Qualification changed to '+newOppQualification
        );
        return taskInstance;
    }

    //Method to populate the program start date and end start in the account.[CD-348]
     private void assignProgramStartEndDate(List<Opportunity> oppList) {
         List<Account> accToUpdateList = new List<Account>();
        //Query and retrieve the program plans for the filtered opportunities.
        Map<Id, Id> accIdWithPrgmPlanIdIdMap = ProgramPlanData.getAccountsWithProgramPlans(oppList);

        if (accIdWithPrgmPlanIdIdMap != null && !accIdWithPrgmPlanIdIdMap.values().isEmpty()) {
            //Query and retrieve the min and max of draft date for the program plans related to the opportunities.
            Map<Id, AggregateResult> prgmPlanIdWithDraftDateMap = DraftData.getStartEndDraftDates(
                new Set<Id>(accIdWithPrgmPlanIdIdMap.values())
            );
            
            for (Opportunity opp : oppList) {
                Account acc = new Account();
                acc.Id = opp.AccountId;
                //Assign program START date from the aggregate result
                if (accIdWithPrgmPlanIdIdMap.get(opp.AccountId) != null 
                    && prgmPlanIdWithDraftDateMap.get(accIdWithPrgmPlanIdIdMap.get(opp.AccountId)) != null
                    && prgmPlanIdWithDraftDateMap.get(accIdWithPrgmPlanIdIdMap.get(opp.AccountId)).get('startDate') != null
                ) {
                    acc.Program_Start_Date__c = (Date)prgmPlanIdWithDraftDateMap.get(accIdWithPrgmPlanIdIdMap.get(opp.AccountId)).get('startDate');
                }
                //Assign program END date from the aggregate result
                if (accIdWithPrgmPlanIdIdMap.get(opp.AccountId) != null 
                    && prgmPlanIdWithDraftDateMap.get(accIdWithPrgmPlanIdIdMap.get(opp.AccountId)) != null
                    && prgmPlanIdWithDraftDateMap.get(accIdWithPrgmPlanIdIdMap.get(opp.AccountId)).get('endDate') != null
                ) {
                    acc.Program_End_Date__c = (Date)prgmPlanIdWithDraftDateMap.get(accIdWithPrgmPlanIdIdMap.get(opp.AccountId)).get('endDate');
                }
                accToUpdateList.add(acc);
            }
        }
         
        //Update the account with program start and end date
        if (!accToUpdateList.isEmpty()) {
            update accToUpdateList;
        }
    }
    
    public override void afterInsert() {
        processOpportunitiesSendEmail();
        updatePartnerContactEmail((List<Opportunity>)Trigger.new, (Map<Id, Opportunity>)Trigger.oldMap);
        OpportunityToAccountUpdateHandler handler = new OpportunityToAccountUpdateHandler();
        handler.closerAssignment((List<Opportunity>)Trigger.new, (Map<Id, Opportunity>)Trigger.oldMap);  
        OpportunityAfterTriggerHelper.removeActiveOppFormIndividual();
        OpportunityAfterTriggerHelper.createIndividualRecords();
        OpportunityAfterTriggerAsyncOpHelper.createAsyncOperationRecords();
       // OpportunityAfterTriggerHelper.handleFirstPayment((List<Opportunity>)Trigger.new, (Map<Id, Opportunity>)Trigger.oldMap);
    }
    
    private void updatePartnerContactEmail(List<Opportunity> opps , Map<Id, Opportunity> oldOppMap) {
        Set<Id> accountIds = new Set<Id>();
        List<Contact> contactsToUpdate = new List<Contact>();
        Map<Id, String> accountOpportunityEmailMap = new Map<Id, String>();
        
        for (Opportunity opp : opps) {
            if ((oldOppMap == null ||opp.Email__c != oldOppMap.get(opp.Id).Email__c) && opp.AccountId != null) {
                accountIds.add(opp.AccountId);
            }
        }
        
        Map<Id, Account> accountMap = AccountData.queryAccountBasedOnIds(accountIds);
        
        for (Opportunity opp : opps) {
            if (opp.AccountId != null && accountMap.containsKey(opp.AccountId)) {
                if (accountMap.get(opp.AccountId).Primary_Contact__c != null) {
                    Contact primaryContact = new Contact(
                        Id = accountMap.get(opp.AccountId).Primary_Contact__c,
                        Email = opp.Email__c
                    );
                    contactsToUpdate.add(primaryContact);
                }
            }
        }

        if (!contactsToUpdate.isEmpty()) {
            update contactsToUpdate;
        }
    }

    private void linkDocumentToAccount(Map<Id, Id> oppotunityIdAcctIdMap) {
        List<ContentDocumentLink> cdlToInsertList = new List<ContentDocumentLink> ();
        for (ContentDocumentLink cdkInstance :ContentDocumentLinkData.getContentDocumentLinksByLinkedEntity(oppotunityIdAcctIdMap.keySet())) {
            ContentDocumentLink cdlInst = ContentDocumentLinkHandler.createCDL(cdkInstance.ContentDocumentId, oppotunityIdAcctIdMap.get(cdkInstance.LinkedEntityId));
            cdlToInsertList.add(cdlInst);
        }
        List<Database.SaveResult> dmlResultList = Database.insert(cdlToInsertList, false);
        Integer i = 0;
        for (Database.SaveResult saveResult : dmlResultList) {
            if (!saveResult.isSuccess()) {
                String errorMessage = '';
                for (Database.Error err : saveResult.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                ApplicationLogger.logDMLException(
                    'Linking Document from Opportunity to Account', //Statement
                    cdlToInsertList[i].ContentDocumentId, //Opportunity Id
                    errorMessage, //exceptionMessage,
                    true //Store log
                );
            }
        }
        ApplicationLogger.insertStoredLogs();
    }  
    
    private void validateLockOpportunityList(List<Opportunity> oppRecords) {
        List<Opportunity> recordsToBlock = new List<Opportunity>();
        for (Opportunity opp : oppRecords) {
            if (opp.Lock_Opportunity__c) {
                recordsToBlock.add(opp);
            }
        }
        if (!recordsToBlock.isEmpty()) {
            OpportunityLockService.validateLockOpportunity(recordsToBlock, 'Id');
        }
    }
    public static void handleOpportunityVersionUpdate(List<Opportunity> newList, Map<Id, Opportunity> oldMap) {
        Set<Id> relatedOppIds = new Set<Id>();

        for (Opportunity opp : newList) {
            Opportunity oldOpp = oldMap.get(opp.Id);

            if (opp.Version_Status__c == 'Active' && oldOpp.Version_Status__c != 'Active') {
                if (opp.Opportunity__c != null) {
                    relatedOppIds.add(opp.Opportunity__c);
                }
            }
        }

        if (!relatedOppIds.isEmpty()) {
            updateRelatedDrafts(relatedOppIds);
        }
    }

    private static void updateRelatedDrafts(Set<Id> relatedOppIds) {
        Set<String> lockedStatuses = new Set<String> {'Completed', 'NSF','Skipped Payment'};
        List<Draft__c> draftsToUpdate = [
            SELECT Id, Draft_Status__c,  Program_Plan__r.Opportunity__r.AccountId
            FROM Draft__c
            WHERE Program_Plan__r.Opportunity__c IN :relatedOppIds
            AND Draft_Date__c >= Today
            AND Draft_Status__c NOT IN:lockedStatuses
        ];

        if (!draftsToUpdate.isEmpty()) {
            FutureHandler.initiatePaymentProcessorSync(draftsToUpdate[0].Program_Plan__r.Opportunity__r.AccountId);
        }
    }
    
    //Validating the version status and prevent the wrong transition.
  /*  private static void validateVersionStatus(){
        Set<String> versionStatusIdentifiers = new Set<String>();
        String objectName = OpportunityUtil.getSObjectName();
        String fieldName = OpportunityUtil.FIELD_VERSION_STATUS;
        for(Opportunity oppRec : (List<Opportunity>)Trigger.new){
            Opportunity oldOppt = (Opportunity)Trigger.oldMap.get(oppRec.Id);
            if(oppRec.Version_Status__c != oldOppt.Version_Status__c){
                String uniqueIdentifier = PicklistValueTransitionHelper.generateUniqueIdentifier(oldOppt.Version_Status__c, oppRec.Version_Status__c, objectName, fieldName);                
                versionStatusIdentifiers.add(uniqueIdentifier);
            }     
        }
        
        if(!versionStatusIdentifiers.isEmpty()){
            Map<String, Boolean> uniqueIdentifierMap = PicklistValueTransitionHelper.verifyPicklistTransition(versionStatusIdentifiers);
            for(Opportunity oppt : (List<Opportunity>)Trigger.new){
                Opportunity oldOppt = (Opportunity)Trigger.oldMap.get(oppt.Id);
                String uniqueIdentifier = PicklistValueTransitionHelper.generateUniqueIdentifier(oldOppt.Version_Status__c, oppt.Version_Status__c, objectName, fieldName); 
                if(uniqueIdentifierMap.containsKey(uniqueIdentifier) && !uniqueIdentifierMap.get(uniqueIdentifier)){
                    oppt.addError('Opportunity Version Status update not allowed. The selected transition is invalid.');
                }
            }
        }
    }
    
    //Validating the opportunity stages and prevent the wrong transition.
    private static void validateOpportunityStages(){
        Set<String> stageNameIdentifiers = new Set<String>();
        String objectName = OpportunityUtil.getSObjectName();
        String fieldName = OpportunityUtil.FIELD_DISPOSITION;
        for(Opportunity oppRec : (List<Opportunity>)Trigger.new){
            Opportunity oldOppt = (Opportunity)Trigger.oldMap.get(oppRec.Id);
            if(oppRec.StageName!= oldOppt.StageName){
                String uniqueIdentifier = PicklistValueTransitionHelper.generateUniqueIdentifier(oldOppt.StageName, oppRec.StageName, objectName, fieldName);                
                stageNameIdentifiers.add(uniqueIdentifier);
            }     
        }
        
        if(!stageNameIdentifiers.isEmpty()){
            Map<String, Boolean> uniqueIdentifierMap = PicklistValueTransitionHelper.verifyPicklistTransition(stageNameIdentifiers);
            for(Opportunity oppt : (List<Opportunity>)Trigger.new){
                Opportunity oldOppt = (Opportunity)Trigger.oldMap.get(oppt.Id);
                String uniqueIdentifier = PicklistValueTransitionHelper.generateUniqueIdentifier(oldOppt.StageName, oppt.StageName, objectName, fieldName); 
                if(uniqueIdentifierMap.containsKey(uniqueIdentifier) && !uniqueIdentifierMap.get(uniqueIdentifier)){
                   oppt.addError('Opportunity Stage update not allowed. The selected transition is invalid.');
                }
            }
        }
    }
*/

    private void processBankOpportunities(List<Opportunity> newOpps) {
        List<Task> taskList = new List<Task>();
        Set<Id> accountIds = new Set<Id>();
        for (Opportunity oppInstance : newOpps) {
            if (oppInstance.AccountId != null) {
                accountIds.add(oppInstance.AccountId);
            }
        }
    
        Map<Id, Account> accountMap = AccountData.getAccountsWithOwner(accountIds);
        Id activityRecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Task', 'Activity');
    
        for (Opportunity oppInstance : newOpps) {
            Opportunity oldOpp = this.opportunityOldMap.get(oppInstance.Id);
            if (oppInstance.Bank_Change_Contract_Status__c != oldOpp.Bank_Change_Contract_Status__c &&
                oppInstance.Bank_Change_Contract_Status__c == 'Completed' && oppInstance.AccountId != null) {
                Account acc = accountMap.get(oppInstance.AccountId);
                taskList.add(
                    createTaskForBankContractChange(
                        oppInstance,
                        acc,
                        activityRecordTypeId
                    )
                );
            }
        }
    
        if (!taskList.isEmpty()) {
            insert taskList;
        }
    }
    
    public static void populateFronterDetailsInLead(){
        try{
           Map<Id, opportunity> oppOldMap = (Map<Id, opportunity>) Trigger.oldMap;
           Map<String, opportunity> oppIdToLeadMap = new Map<String, opportunity>();
           Set<String> leadIds = New Set<String>();
           if (Trigger.isAfter && Trigger.isUpdate ) {  
               for(opportunity oppInstance : (List<opportunity>) trigger.new){
                   if( ((oppOldMap.get(oppInstance.Id)).FronterLookup__c  != oppInstance.FronterLookup__c  
                                              || (oppOldMap.get(oppInstance.Id)).Call_Transferred_By_Lookup__c != oppInstance.Call_Transferred_By_Lookup__c
                                              || (oppOldMap.get(oppInstance.Id)).Call_Tranferred_DateTime__c != oppInstance.Call_Tranferred_DateTime__c
                                               )){
                    oppIdToLeadMap.put(oppInstance.Lead_Id__c, oppInstance);
                   }
               }
               
               if(!oppIdToLeadMap.isEmpty()) {
                 syncLeads(oppIdToLeadMap);
               }
            }
        }catch(Exception ex){
             ApplicationLogger.logExceptionWithData(ex,Null, 'populateFronterDetailsInLead On Opportunity Trigger Failed ', ApplicationLogger.SEVERITY_HIGH);
        }
    }
    
    public static void syncLeads(Map<String, Opportunity> leadIdToOppMap){
        List<lead> leadsToUpdate = new List<lead>();

        List<Lead> relatedLeads = LeadData.getLeadsByLeadId(leadIdToOppMap.keySet());
        for (Lead leadInstance : relatedLeads) {
            Opportunity opp = leadIdToOppMap.get(leadInstance.Lead_Id__c);

            leadInstance.FronterLookup__c = opp.FronterLookup__c;
            leadInstance.Call_Transferred_By_Lookup__c = opp.Call_Transferred_By_Lookup__c;
            leadInstance.Call_Tranferred_DateTime__c = opp.Call_Tranferred_DateTime__c;
            
            leadsToUpdate.add(leadInstance);
        }

        if (!leadsToUpdate.isEmpty()) {
            LeadTriggerHandler.byPassLeadTrigger = true;
            update leadsToUpdate;
            LeadTriggerHandler.byPassLeadTrigger = false;
        }
    }
    
    private Task createTaskForBankContractChange(Opportunity oppInstance, Account acc, Id activityRecordTypeId) {
        Task t = new Task();
        t.Subject      = 'Bank Account Change Contract - Successfully Signed by the Customer';
        t.ActivityDate = Date.today();
        t.OwnerId      = acc.OwnerId;
        t.WhatId       = acc.Id;
        t.RecordTypeId = activityRecordTypeId;
        return t;
    }

    /**
     * @description Entry point called from the trigger.
     * @param newList  Trigger.new
     * @param oldMap   Trigger.oldMap
     */
    public static void validateStageChange(
        List<Opportunity> newList,
        Map<Id, Opportunity> oldMap
    ) {
        // 1. Check DeDuplication bypass flag (in-memory, set by calling code)
        if (bypassForDeDuplication) {
            return;
        }

        // 2. Check Custom Setting bypass flag 
        if (isValidationDisabledViaCustomSetting()) {
            return;
        }

        // 3. Enforce the stage restriction
        for (Opportunity newOpp : newList) {
            Opportunity oldOpp = oldMap.get(newOpp.Id);

            Boolean isTransitioningToArchived =
                newOpp.StageName == ARCHIVED_FINALIZED &&
                oldOpp.StageName != ARCHIVED_FINALIZED;

            if (isTransitioningToArchived) {
                newOpp.StageName.addError(
                    'Stage cannot be changed to "Archived - Finalized" directly. ' +
                    'This transition is only allowed through the DeDuplication process.'
                );
            }
        }
    }

    // ─── Private Helpers ──────────────────────────────────────────────────────

    /**
     * @description Reads the Hierarchy Custom Setting for the running user.
     *              Returns true if the validation should be skipped.
     */
    private static Boolean isValidationDisabledViaCustomSetting() {
        SystemControlSettings__c settings =
            SystemControlSettings__c.getInstance(); 

        return settings != null &&
               settings.Disable_Archived_Finalized_Validation__c == true;
    }
}