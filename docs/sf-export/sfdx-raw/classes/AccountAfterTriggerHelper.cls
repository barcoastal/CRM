/*----------------------------------------------------------------
    Author: Vignesh P
    Description: A helper class to perform the account after trigger actions.
    Test Class: 

    History
    <Date>          <Authors Name>          <Brief Description of Change>   
    Oct-02-2024     Vignesh                  Initial Development                
--------------------------------------------------------------------*/
public inherited sharing class AccountAfterTriggerHelper {
    
    /**
     * @description: To Perform the after update trigger actions
    **/
    public static void performAfterUpdateOperations() {
        createAccountTeamMembersForClosers();
    }

    /**
     * @description: Create Account Team Member to provide the account access to the closers.
    **/
    private static void createAccountTeamMembersForClosers() {
        Map<Id, Id> accountIdCloserIdsMap = new Map<Id, Id>();
        Map<Id, Id> accountIdOldCloserIdsMap = new Map<Id, Id>();
        for (Account accountRecord : (List<Account>)Trigger.new) {
            Account oldAccountRecord = (Account)Trigger.oldMap.get(accountRecord.Id);
            if (accountRecord.Closer__c != null && accountRecord.Closer__c != oldAccountRecord.Closer__c) {
                accountIdCloserIdsMap.put(accountRecord.Id, accountRecord.Closer__c);
                accountIdOldCloserIdsMap.put(accountRecord.Id, oldAccountRecord.Closer__c);
            }
        }
        if (!accountIdCloserIdsMap.isEmpty()) {
            Set<Id> accountIdsAlreadyhasTM = new Set<Id>();
            List<AccountTeamMember> acctTeamMembersToDelete = new List<AccountTeamMember>();
            for (AccountTeamMember acctTeamMember : 
                TeamMemberData.queryAccountTeamMembersCustSvcRep(accountIdCloserIdsMap.keySet())
            ) {
                if (accountIdCloserIdsMap.containsKey(acctTeamMember.AccountId)) {
                    if (accountIdCloserIdsMap.get(acctTeamMember.AccountId) == acctTeamMember.UserId) {
                        accountIdsAlreadyhasTM.add(acctTeamMember.AccountId);
                    } else if (accountIdOldCloserIdsMap.get(acctTeamMember.AccountId) == acctTeamMember.UserId) {
                        acctTeamMembersToDelete.add(acctTeamMember);
                    }
                }
            }
            if (!accountIdCloserIdsMap.isEmpty()) {
                List<AccountTeamMember> accountTeamMembersToInsert = new List<AccountTeamMember>();
                for (Id acctId : accountIdCloserIdsMap.keySet()) {
                    if (!accountIdsAlreadyhasTM.contains(acctId)) {
                        AccountTeamMember acctTeamMemToInsert = createAccountTeamMemberInstance(acctId, accountIdCloserIdsMap.get(acctId));
                        accountTeamMembersToInsert.add(acctTeamMemToInsert);
                    }
                }
                insert accountTeamMembersToInsert;
            }
            delete acctTeamMembersToDelete;
        }
    }
    
    public static void updateOppRecordTypeToBuyout(){
         try{
             Set<Id> accountIds = New Set<Id>();
             if (Trigger.isAfter && Trigger.isUpdate) {
                 for (Account acct : (List<Account>)Trigger.new) {
                     if(acct.HIGH_UCC_RISK__c == True && ((Account)Trigger.oldMap.get(acct.Id)).HIGH_UCC_RISK__c != acct.HIGH_UCC_RISK__c){
                         accountIds.add(acct.Id);
                     }
                 }
                 
                 if(!accountIds.IsEmpty()){
                     List<Opportunity> oppsToUpdate = New List<Opportunity>();
                     List<Account> accountsWithLatestOpp = AccountData.getActiveOppOfAccounts(accountIds);
                     
                     for(Account acct : accountsWithLatestOpp){
                         if(!acct.Opportunities.isEmpty()){
                             Opportunity opp = acct.Opportunities[0];
                             opp.recordtypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Opportunity','Buyout');
                             oppsToUpdate.add(opp);
                         } 
                     }
                     if(!oppsToUpdate.isEmpty()){
                         update oppsToUpdate;
                     } else {
                           throw new auraException('No valid opportunity is available for this account to move into the Buyout program.');
                     }   
                 } 
             }
         }catch(Exception Ex){
             ApplicationLogger.logExceptionWithData(ex, null, null, ApplicationLogger.SEVERITY_HIGH);
         }
     }

    /**
     * @description: Reusable method to create the account team member instance.
    **/
    private static AccountTeamMember createAccountTeamMemberInstance(Id acctId, Id userId) {
        AccountTeamMember acctTeamMemToInsert = new AccountTeamMember();
        acctTeamMemToInsert.AccountId = acctId;
        acctTeamMemToInsert.UserId = userId;
        acctTeamMemToInsert.TeamMemberRole = TeamMemberUtil.ROLE_CLOSER;
        acctTeamMemToInsert.AccountAccessLevel = 'Edit';
        acctTeamMemToInsert.ContactAccessLevel = 'Edit';
        acctTeamMemToInsert.CaseAccessLevel = 'None';
        //OpportunityAccessLevel is not provided by assuming the closers will have access to the opp record already
        return acctTeamMemToInsert;
    }

    public static void preserveOpportunityOwner() {
        Set<Id> accountIds = new Set<Id>();
        for (Account acct : (List<Account>)Trigger.new) {
            Account oldAcct = (Account)Trigger.oldMap.get(acct.Id);
            if (acct.OwnerId != oldAcct.OwnerId) {
                accountIds.add(acct.Id);
            }
        }
        if (accountIds != null && AccountHandler.oppIdOwnerIdOldMap != null && !AccountHandler.oppIdOwnerIdOldMap.isEmpty()) {
            List<Opportunity> oppToUpdateList = new List<Opportunity>();
            for (Opportunity opp : [SELECT Id, OwnerId FROM Opportunity WHERE AccountId = :accountIds]) {
                if (AccountHandler.oppIdOwnerIdOldMap.containsKey(opp.Id)) {
                    Id oldOwnerId = AccountHandler.oppIdOwnerIdOldMap.get(opp.Id);
                    if (opp.OwnerId != oldOwnerId) {
                        Opportunity oppToUpdate = new Opportunity();
                        oppToUpdate.Id = opp.Id;
                        oppToUpdate.OwnerId = oldOwnerId;
                        oppToUpdateList.add(oppToUpdate);
                    }
                }
            }
            OpportunityLockService.disableOppLockForSystemUpdates();
            update oppToUpdateList;
            OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        }
    }
    
    public static void createIndividualRecords() {
        try {
            Set<String> phoneNumbersSet = new Set<String>();
            List<Account> accountsToProcessList = new List<Account>();
            List<Account> accountsToUpdate = new List<Account>();
            if (Trigger.isAfter && (Trigger.isInsert || Trigger.isUpdate)) {
                for (Account accountInst : (List<Account>) Trigger.new) {
                    if (accountInst.Formatted_Phone__c != null && ApexUtil.isValidPhoneNumber(accountInst.Formatted_Phone__c)) {
                        if (Trigger.isInsert || Trigger.isUpdate && accountInst.Phone != ((Account)Trigger.oldMap.get(accountInst.Id)).Phone) {
                            phoneNumbersSet.add(accountInst.Formatted_Phone__c);
                            accountsToProcessList.add(accountInst);
                        }
                    }
                } 
                if (!phoneNumbersSet.isEmpty()) {
                    accountsToUpdate = IndividualHandler.constructAccountsWithIndividual(phoneNumbersSet, accountsToProcessList);
                }
                
                if (accountsToUpdate != null && !accountsToUpdate.isEmpty()) {
                    AccountHandler.byPassAccountTrigger = true;
                    update accountsToUpdate;
                    AccountHandler.byPassAccountTrigger = false;
                }
            }
        } catch(Exception ex) {
            ApplicationLogger.logExceptionWithData(ex, null, null, ApplicationLogger.SEVERITY_HIGH);
        }
     }
       
    /**
     * @description Updates Payment_Processor__c on active Program_Plan__c records when an Account's BillingState changes.
     *              The method identifies accounts with state changes, determines the appropriate payment processor 
     *              based on the state (case-insensitive), and updates associated Program_Plan__c records.
     * @param newAccounts - List of new Account records after update.
     * @param oldAccounts - Map of old Account records before update.
     */
    public static void updateProgramPlanProcessor(List<Account> newAccounts, Map<Id, Account> oldAccounts) {
        // Map to store account IDs where billing state changed
        Map<Id, Account> accountsWithStateChange = new Map<Id, Account>();
        
        // Check which accounts have billing state changes that are not blank or null
        Map<ID, String> accountPaymentProcessorMap = new Map<ID, String>();
        Map<ID, String> accountStateMap = new Map<ID, String>();
        for (Account thisAccount : newAccounts) {
            Account oldAccount = oldAccounts.get(thisAccount.Id);
            if (thisAccount.BillingState != oldAccount.BillingState && String.isNotBlank(thisAccount.BillingState)) {
                accountsWithStateChange.put(thisAccount.Id, thisAccount);
                accountStateMap.put(thisAccount.Id, thisAccount.BillingState.toUpperCase());
            }
        }
    
        // If no state changes, exit early
        if (accountsWithStateChange.isEmpty()) {
            return;
        }


        // Retrieve eligible payment processor IDs based on account states
        Map<String, Id> statePaymentProcessorMap = PaymentProcessorSvc.getEligiblePaymentProcessorId(new Set<String>(accountStateMap.values()));
        // Get the program plans associated with the accounts that have state changes
        Map<Id, Program_Plan__c> accountProgramPlanMap = ProgramPlanData.getProgramPlanOfAccounts(accountsWithStateChange.keySet());
        List<Program_Plan__c> programPlansToUpdate = new List<Program_Plan__c>();
        List<Account> accountsToUpdate = new List<Account>();   

        // Iterate over each account that has a state change
        for (Account thisAccount : accountsWithStateChange.values()) {
            // Retrieve the program plan associated with the current account
            Program_Plan__c thisProgramPlan = accountProgramPlanMap.get(thisAccount.Id);
            // If the payment processor for the program plan has changed, update it
            if (thisProgramPlan.Payment_Processor__c != statePaymentProcessorMap.get(accountStateMap.get(thisAccount.Id))
                && thisProgramPlan.Opportunity__r.Lock_opportunity__c == false
            ) {
                // Update the payment processor for the program plan
                thisProgramPlan.Payment_Processor__c = statePaymentProcessorMap.get(accountStateMap.get(thisAccount.Id));
                // Prepare the account for update by setting the reschedule flag
                Account updateAccount = new Account(Id = thisAccount.Id);
                updateAccount.Reschedule_Program_Pending__c = true;
                accountsToUpdate.add(updateAccount);
                programPlansToUpdate.add(thisProgramPlan);
            }
        }
        
        // If there are program plans to update, perform the updates
        if (programPlansToUpdate.size() > 0) {
            update accountsToUpdate; // Update the accounts
            update programPlansToUpdate; // Update the program plans
        }
    }

}