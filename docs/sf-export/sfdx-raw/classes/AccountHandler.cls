/** Test Class: AccountTrigger_Test */
public without sharing class AccountHandler extends TriggerHandler {
    
    public static Boolean byPassAccountTrigger = false;
    
    //Static varible to prevent recursion
    public static Boolean preventRecursion = false;
    public static final String CUSTOMER_SERVICES_CATEGORY = 'Customer Services';
    public static final String HANDLER_NAME = 'AccountHandler';
    public static Boolean skipAccountTrigger = false;
    public static Map<Id, Id> oppIdOwnerIdOldMap = new Map<Id, Id>();
    public static Boolean skipValidation = false;     

    public override void beforeInsert() {
        if (!skipAccountTrigger) {
            populateSyncPending();
        }
        validateAccountState();
    } 

    public override void beforeUpdate() {
        if (!skipAccountTrigger) {
            populateSyncPending();
        }
        validateAccountState();
        populateSyncProcessorDateTime();
        postAccountOwnerUpdateProcess();
        populateOppIdOwnerIdOldMap();
        handleReactivationBeforeUpdate((List<Account>)Trigger.new, (Map<Id, Account>) Trigger.oldMap);
        //updateCancellationDate((List<Account>)Trigger.new, (Map<Id, Account>) Trigger.oldMap);
        if(!skipValidation) {
            validateClientStatus();
        }
    }
    
      public static void updateCancellationDate(List<Account> newAccounts, Map<Id, Account> oldMap) {
        for (Account acc : newAccounts) {
            if (acc.Client_Status__c == 'Cancelled' && oldMap.get(acc.Id).Client_Status__c != 'Cancelled') {
                acc.Cancellation_Date__c = Date.today();
            }
        }
    }

    public override void afterInsert() {
        createChecklistItemsForCustomerServicesOnInsert();
        AccountAfterTriggerHelper.createIndividualRecords();
    }

    public override void afterUpdate() {
        oppSendEmailToAdminGroup();
        assignSSNToContact();
        createChecklistItemsForCustomerServicesOnUpdate();
        //changePaymentProcessor();
        //doCitadelCallout();
        dmlStoredAccountTeamMebers();
        //cancelClientInPaymentProcessor();
        
        closeCaseOnAccountStatusUpdate();
        AccountAfterTriggerHelper.performAfterUpdateOperations();
         AccountAfterTriggerHelper.updateOppRecordTypeToBuyout();
        AccountAfterTriggerHelper.preserveOpportunityOwner();
        AccountAfterTriggerHelper.createIndividualRecords();
        //Update processor status as "Fee Paid in Full" in Account and customer status in SAS When Fee paid checked.
        AccountAfterTriggerAsyncOpHelper.createAsyncOperationRecords();
        AccountAfterTriggerHelper.updateProgramPlanProcessor((List<Account>)Trigger.new, (Map<Id, Account>) Trigger.oldMap);
    }
      
    private static void populateOppIdOwnerIdOldMap() {
        Set<Id> accountIds = new Set<Id>();
        for (Account acct : (List<Account>)Trigger.new) {
            Account oldAcct = (Account)Trigger.oldMap.get(acct.Id);
            if (acct.OwnerId != oldAcct.OwnerId) {
                accountIds.add(acct.Id);
            }
        }
        if (!accountIds.isEmpty()) {
            for (Opportunity opp : [SELECT Id, OwnerId FROM Opportunity WHERE AccountId = :accountIds]) {
                oppIdOwnerIdOldMap.put(opp.Id, opp.OwnerId);
            }
        }
    }

    private static void assignSSNToContact() {
        List<Contact> contactsToUpdate = new List<Contact>();
        for (Account acct : (List<Account>)Trigger.new) {
            Account oldAcct = (Account)Trigger.oldMap.get(acct.Id);
            if (acct.SSN__c != oldAcct.SSN__c && acct.Primary_Contact__c != null) {
                Contact con = new Contact();
                con.Id = acct.Primary_Contact__c;
                con.SSN_Encrypted__c = acct.SSN__c;
                contactsToUpdate.add(con);
            }
        }
        if (!contactsToUpdate.isEmpty()) {
            update contactsToUpdate;
        }
    }

    private static void createChecklistItemsForCustomerServicesOnInsert() {
        List<ChecklistSvc.ChecklistCreationWrapper> checklistCreationWrapperList = new List<ChecklistSvc.ChecklistCreationWrapper>();
        for (Account acct : (List<Account>)Trigger.new) {
            if (acct.Client_Status__c != null)  {
                ChecklistSvc.ChecklistCreationWrapper checklistCreationWrapper = createInstanceChecklistCreationWrapper(
                    acct.Id, 
                    acct.Client_Status__c
                );
                checklistCreationWrapperList.add(checklistCreationWrapper);
            }
        }
        if (!checklistCreationWrapperList.isEmpty()) {
            ChecklistSvc.createChecklists(checklistCreationWrapperList);
        }
    }
    
     public static void handleReactivationBeforeUpdate(List<Account> newAccounts, Map<Id, Account> oldAccounts) {
        Integer restrictedDays = Integer.valueOf(System.label.Account_Restricted_Days); 
        for (Account acc : newAccounts) {
            Account oldAcc = oldAccounts.get(acc.Id);

            if (oldAcc.Client_Status__c == 'Cancelled' && acc.Client_Status__c == 'Active') {
                enforceReactivationRestriction(acc, oldAcc, restrictedDays);
            }
        }
    }

    private static void enforceReactivationRestriction(Account acc, Account oldAcc, Integer restrictedDays) {
        Boolean hasManagerOverride = FeatureManagement.checkPermission('Manager_Override_Account_Reactivation');
        System.debug(hasManagerOverride);

        DateTime cancelledDate = oldAcc.Cancellation_Date__c;
        System.debug(cancelledDate);
        if (cancelledDate != null && cancelledDate.addDays(restrictedDays) < Date.today()) {
            if (!hasManagerOverride) {
                acc.addError('Reactivation is restricted as it has been more than ' + restrictedDays + ' days since cancellation.');
            }
        }
    }

    private static void createChecklistItemsForCustomerServicesOnUpdate() {
        List<ChecklistSvc.ChecklistCreationWrapper> checklistCreationWrapperList = new List<ChecklistSvc.ChecklistCreationWrapper>();
        for (Account acct : (List<Account>)Trigger.new) {
            Account oldAcct = (Account)Trigger.oldMap.get(acct.Id);
            if (acct.Client_Status__c != null && acct.Client_Status__c != oldAcct.Client_Status__c) {
                ChecklistSvc.ChecklistCreationWrapper checklistCreationWrapper = createInstanceChecklistCreationWrapper(
                    acct.Id, 
                    acct.Client_Status__c
                );
                System.debug('checklistCreationWrapper------>'+checklistCreationWrapper);
                checklistCreationWrapperList.add(checklistCreationWrapper);
            }
        }
        if (!checklistCreationWrapperList.isEmpty()) {
            System.debug('checklistCreationWrapperList------>'+checklistCreationWrapperList);
            ChecklistSvc.createChecklists(checklistCreationWrapperList);
        }
    }

    private static ChecklistSvc.ChecklistCreationWrapper createInstanceChecklistCreationWrapper(Id accountId, String checklistName) {
        ChecklistSvc.ChecklistCreationWrapper checklistCreationWrapper = new ChecklistSvc.ChecklistCreationWrapper();
        checklistCreationWrapper.sObjId = accountId;
        checklistCreationWrapper.categoryName = CUSTOMER_SERVICES_CATEGORY;
        checklistCreationWrapper.checklistName = checklistName;
        return checklistCreationWrapper;
    }

    // /**
    //  * @description: Method to assign the payment processor based on the state update
    // **/
    // private static void changePaymentProcessor() {
    //     Map<Id, String> acctIdStateMap = new Map<Id, String>();
    //     for (Account acctRecord : (List<Account>)Trigger.new) {
    //         Account oldAcct = (Account)Trigger.oldMap.get(acctRecord.Id);
    //         if (acctRecord.BillingState != oldAcct.BillingState && String.isNotBlank(acctRecord.BillingState)) {
    //             acctIdStateMap.put(acctRecord.Id, acctRecord.BillingState);
    //         }
    //     }
    //     if (acctIdStateMap != null && !acctIdStateMap.isEmpty()) {
    //         updatePaymentProcInPrgmPlan(acctIdStateMap);
    //     }
    // }

    // /**
    //  * @description: Method to update the program plan with the payment processor and account with the reschedule program pending flag.
    // **/
    // private static void updatePaymentProcInPrgmPlan(Map<Id, String> acctIdStateMap) {
    //     if (!acctIdStateMap.isEmpty()) {
    //         Set<String> distinctStates = new Set<String>(acctIdStateMap.values());
    //         Map<Id, Program_Plan__c> accountIdActiveProgramPlanIdMap = ProgramPlanData.getActiveProgramPlanOfAccounts(acctIdStateMap.keySet());
    //         Map<String, Id> statePaymentProcIdMap = PaymentProcessorSvc.getEligiblePaymentProcId(distinctStates);
    //         List<Program_Plan__c> programPlansToDML = new List<Program_Plan__c>();
    //         List<Account> accountsToDML = new List<Account>();
    //         for (Id acctId : acctIdStateMap.keySet()) {
    //             if (accountIdActiveProgramPlanIdMap.containsKey(acctId) && acctIdStateMap.containsKey(acctId)) {
    //                 String stateValue = acctIdStateMap.get(acctId).toUpperCase();
    //                 if (statePaymentProcIdMap.containsKey(stateValue)) {
    //                     Program_Plan__c prgmPlanQueried = accountIdActiveProgramPlanIdMap.get(acctId);
    //                     Id currentProcessorId = prgmPlanQueried.Payment_Processor__c;
    //                     Id newProcessorId = statePaymentProcIdMap.get(stateValue);
    //                     if (currentProcessorId != newProcessorId) {
    //                         Program_Plan__c prgmPlanToUpdate = new Program_Plan__c();
    //                         prgmPlanToUpdate.Id = prgmPlanQueried.Id;
    //                         prgmPlanToUpdate.Payment_Processor__c = newProcessorId;
    //                         programPlansToDML.add(prgmPlanToUpdate);

    //                         Account acctToDML= new Account();
    //                         acctToDML.Id = acctId;
    //                         acctToDML.Reschedule_Program_Pending__c = true;
    //                         accountsToDML.add(acctToDML);
    //                     }
    //                 }
    //             }
    //         }  
    //         update programPlansToDML; 
    //         update accountsToDML;
    //     }
    // }

    //Populating the Sync Status fields if the payment processor integration related fields are updated
    private static void populateSyncPending() {
        for (Account acct : (List<Account>)Trigger.new) {
            if (Trigger.isInsert) {
                acct.Sync_Status__c = 'Sync Pending';
                acct.Bank_Account_Sync_Status__c = 'Sync Pending';
            } else if (Trigger.isUpdate) {
                Account oldAcct = (Account)Trigger.oldMap.get(acct.Id);
                for (Schema.SObjectField sObjField : ClientWrapper.accountFields) {
                    if (acct.get(sObjField) != oldAcct.get(sObjField)) {
                        acct.Sync_Status__c = 'Sync Pending';
                        break;
                    }
                }
                for (Schema.SObjectField sObjField : BankAccountWrapper.bankAccountFields) {
                    if (acct.get(sObjField) != oldAcct.get(sObjField)) {
                        acct.Bank_Account_Sync_Status__c = 'Sync Pending';
                        break;
                    }
                }
            }
        }
    }
    
    //Populate sync to processor date time value when processor sync with RAM or SAS
    private static void populateSyncProcessorDateTime() {
        for (Account acct: (List<Account>)Trigger.new) {
            Account oldAcct = (Account)Trigger.oldMap.get(acct.Id);            
            if((oldAcct.External_RAM_Id__c == null && acct.External_RAM_Id__c != null) || (oldAcct.External_SAS_Id__c == null && acct.External_SAS_Id__c != null)){                
                acct.Synced_DateTime__c = System.now();
            }
        }
    }
    
    private void doCitadelCallout() {
        if (Trigger.new.size() == 1 && (!ApexUtil.isFuture() || !ApexUtil.isBatch())) {
            for (Account acct: (List<Account>)Trigger.new) {
                Account oldAcct = (Account)Trigger.oldMap.get(acct.Id);
                Opportunity opp = OpportunityData.getOpportunityId(acct.Id);                
                if(opp != null && acct.Completed_Draft_Count__c != null && oldAcct.Completed_Draft_Count__c != acct.Completed_Draft_Count__c && (acct.External_RAM_Id__c != null || acct.External_SAS_Id__c != null) && 
                    ((opp.Legal_Plan_Required__c && acct.Completed_Draft_Count__c == 1) || (!opp.Legal_Plan_Required__c && acct.Completed_Draft_Count__c == 2))) {
                    makeCitadelAPI(acct.Id);
                }
            }
        }
    }
    
    @future(Callout=true)
    private static void makeCitadelAPI(Id accId) {
        CitadelAPICallout.makeCitadelCallout(accId);
    }

    //This Method can be removed as it is moved to Sync to Payment Processor button click.
    /*private static void updatePayeesWithPaymentProcessor() {
        if (Trigger.new.size() == 1 && ApexUtil.isAsyncContext() == false) {
            List<Id> payeeIds = new List<Id>();
            Id creditorRecordTypeId = AccountUtil.getRecordTypeId(AccountUtil.RT_CREDITOR);
            for (Account accountRecord : (List<Account>)Trigger.new) {
                if (accountRecord.RecordTypeId == creditorRecordTypeId) {
                    if (Trigger.isInsert || (Trigger.isUpdate && String.isBlank(accountRecord.External_SAS_Id__c))) {
                        Boolean hasRequiredFieldsBlank = false;
                        for (Schema.SObjectField sObjField : ClientWrapper.payeeFields) {
                            if (accountRecord.get(sObjField) == null) {
                                hasRequiredFieldsBlank = true;
                                break;
                            }
                        }
                        if (hasRequiredFieldsBlank == true) {
                            payeeIds.add(accountRecord.Id);
                        }
                    } else if (Trigger.isUpdate && String.isNotBlank(accountRecord.External_SAS_Id__c)) {
                        Account oldAccount = (Account)Trigger.oldMap.get(accountRecord.Id);
                        for (Schema.SObjectField sObjField : ClientWrapper.payeeFields) {
                            if (accountRecord.get(sObjField) != oldAccount.get(sObjField)) {
                                payeeIds.add(accountRecord.Id);
                                break;
                            }
                        }
                    }
                }
            }
            if (!payeeIds.isEmpty()) {
                syncPayeesFuture(payeeIds[0]);
            }
        }
    }*/

    //Validating the billing state and preventing it to be updated to a no-business state.
    private static void validateAccountState() {
        for (Account acct : (List<Account>)Trigger.new) {
            if (Trigger.isInsert) {
                if (StateCodeUtil.isNoBusinessState(acct.BillingStateCode)) {
                    acct.addError(System.Label.No_Business_State_Validation);
                }
            } else if (Trigger.isUpdate) {
                Account oldAcct = (Account)Trigger.oldMap.get(acct.Id);
                if (acct.BillingStateCode != null && acct.BillingStateCode != oldAcct.BillingStateCode && StateCodeUtil.isNoBusinessState(acct.BillingStateCode)) {
                    acct.addError(System.Label.No_Business_State_Validation);
                }
            }
        }
    }

     //Validating the client status and prevent the wrong transition.
    private static void validateClientStatus(){
        Set<String> clientStatusIdentifiers = new Set<String>();
        for(Account acct : (List<Account>)Trigger.new){
            Account oldAcct = (Account)Trigger.oldMap.get(acct.Id);
            if(acct.Client_Status__c != oldAcct.Client_Status__c){
                String uniqueIdentifier = PicklistValueTransitionHelper.generateAccountStatusUniqueIdentifer(oldAcct.Client_Status__c, acct.Client_Status__c);                
                clientStatusIdentifiers.add(uniqueIdentifier);
            }     
        }
        
        if(!clientStatusIdentifiers.isEmpty()){
            Map<String, Boolean> uniqueIdentifierMap = PicklistValueTransitionHelper.verifyPicklistTransition(clientStatusIdentifiers);
            for(Account acct : (List<Account>)Trigger.new){
                Account oldAcct = (Account)Trigger.oldMap.get(acct.Id);
                String uniqueIdentifier = PicklistValueTransitionHelper.generateAccountStatusUniqueIdentifer(oldAcct.Client_Status__c, acct.Client_Status__c); 
                if(uniqueIdentifierMap.containsKey(uniqueIdentifier) && !uniqueIdentifierMap.get(uniqueIdentifier)){
                    acct.addError('Client Status update not allowed. The selected transition is invalid.');
                }
            }
        }
    }

    //This Method can be removed as it is moved to Sync to Payment Processor button click.
    /*@future(Callout=true)
    private static void syncPayeesFuture(Id accountId) {
        ProcessorAPI.syncPayees(accountId);
    }*/

    private static void postAccountOwnerUpdateProcess() {
        Set<Id> ownerChangedAccountIds = new Set<Id>();
        for (Account acctRecord : (List<Account>)Trigger.new) {
            Account oldAcctRecord = (Account)Trigger.oldMap.get(acctRecord.Id);
            if (acctRecord.OwnerId != oldAcctRecord.OwnerId) {
                ownerChangedAccountIds.add(acctRecord.Id);
            }
        }
        if (!ownerChangedAccountIds.isEmpty()) {
            List<AccountTeamMember> accountTeamMembersToRestoreList = new List<AccountTeamMember>();
            for (AccountTeamMember acctTeamMember : AccountTeamMemberData.getAccountTeamMembers(ownerChangedAccountIds)) {
                AccountTeamMember acctTeamMemberToRestore = new AccountTeamMember();
                acctTeamMemberToRestore.AccountAccessLevel = acctTeamMember.AccountAccessLevel;
                acctTeamMemberToRestore.AccountId = acctTeamMember.AccountId;
                acctTeamMemberToRestore.CaseAccessLevel = acctTeamMember.CaseAccessLevel;
                acctTeamMemberToRestore.ContactAccessLevel = acctTeamMember.ContactAccessLevel;
                acctTeamMemberToRestore.OpportunityAccessLevel = acctTeamMember.OpportunityAccessLevel;
                acctTeamMemberToRestore.TeamMemberRole = acctTeamMember.TeamMemberRole;
                acctTeamMemberToRestore.UserId = acctTeamMember.UserId;
                AccountUtil.accountTeamMembersToRestoreList.add(acctTeamMemberToRestore);
            }
        }
    }

    private static void dmlStoredAccountTeamMebers() {
        if (AccountUtil.accountTeamMembersToRestoreList != null && !AccountUtil.accountTeamMembersToRestoreList.isEmpty()) {
            insert AccountUtil.accountTeamMembersToRestoreList;
            AccountUtil.accountTeamMembersToRestoreList.clear();
        }
    }

    private static void cancelClientInPaymentProcessor() {
        if (Trigger.new.size() == 1) {
            Account acctRecord = (Account)Trigger.new[0];
            Account oldAcctRecord = (Account)Trigger.oldMap.get(acctRecord.Id);
            if (acctRecord.Status__c != oldAcctRecord.Status__c && acctRecord.Status__c == 'Cancelled') {
                cancelClientFuture(acctRecord.Id);
            }
        }
    }

    private static void closeCaseOnAccountStatusUpdate(){
        List<Case> casesToClose = new List<Case>();
        List<Task> tasksToComplete = new List<Task>();
        Set<Id> accountIdsToCloseCasesAndTasks = new Set<Id>();
        for (Account acc : (List<Account>)Trigger.new){
            Account oldAccount = (Account)Trigger.oldMap.get(acc.Id);
            if ((acc.Client_Status__c == AccountUtil.CLIENT_STATUS_CANCELLED && oldAccount.Client_Status__c != AccountUtil.CLIENT_STATUS_CANCELLED) ||
                ( acc.Client_Status__c == AccountUtil.CLIENT_STATUS_GRADUATED && oldAccount.Client_Status__c != AccountUtil.CLIENT_STATUS_GRADUATED)) {
                    
                    // Add the account ID to the set
                    accountIdsToCloseCasesAndTasks.add(acc.Id);
                }
        }
        List<Case> openCases = New List<Case>();
        List<Task> openTasks = New List<Task>();
        if (!accountIdsToCloseCasesAndTasks.isEmpty()) {
            // Query open cases related to the accounts in bulk
            openCases =CaseData.getCasesForAccount(accountIdsToCloseCasesAndTasks);
            openTasks = TaskData.queryOpenTasks(accountIdsToCloseCasesAndTasks);
            
        }
        
        Id recordTypeId = CaseUtil.getRecordTypeId(CaseUtil.RT_CUSTOMER_SERVICE);
        for (Case c : openCases) {
            if(c.recordTypeId == recordTypeId){
                c.Status = CaseUtil.CASE_CLOSED_STATUS;
                c.Resolution__c = CaseUtil.CASE_RESOLUTION;
                c.Resolution_Summary__c = CaseUtil.CASE_RESOLUTION;
                casesToClose.add(c);
            }
        }
        
        for (Task t : openTasks) {
            t.Status = TaskUtil.COMPLETED_STATUS;
            tasksToComplete.add(t);
        }
        
        if (!casesToClose.isEmpty()) {
            update casesToClose;
        }
        if (!tasksToComplete.isEmpty()) {
            update tasksToComplete;  
        }
    }
    
    @future(callout=true)
    private static void cancelClientFuture(Id acctId) {
        ProcessorAPI.cancelClient(acctId);
    }

    private static void oppSendEmailToAdminGroup() {
        Set<Id> accountIds = new Set<Id>();
        Set<Id> opportunityIds = new Set<Id>();
        for (Account acct : (List<Account>)Trigger.new) {
            Account oldAcct = (Account)Trigger.oldMap.get(acct.Id);
            if (acct.Qualified_Financial__c ==  true && acct.HIGH_UCC_RISK__c == true && 
                ((acct.Qualified_Financial__c != oldAcct.Qualified_Financial__c) || 
                (acct.HIGH_UCC_RISK__c != oldAcct.HIGH_UCC_RISK__c))) {
                accountIds.add(acct.Id);
            }
        }
        if (!accountIds.isEmpty()) {
            for (Opportunity opp : [SELECT Id, OwnerId FROM Opportunity WHERE AccountId = :accountIds]) {
                opportunityIds.add(opp.Id);
            }
        }
        
        if (!opportunityIds.isEmpty()) {
            OpportunityTriggerHandler.sendEmailToAdminGroup(opportunityIds);
        }
        
    }
}