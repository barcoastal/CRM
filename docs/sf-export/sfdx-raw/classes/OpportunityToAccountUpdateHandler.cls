public without sharing class OpportunityToAccountUpdateHandler {
    
    public void closerAssignment(List<Opportunity> newOppList,Map<Id, Opportunity> oldOppMap){
        Set<Id> accountIds = new Set<Id>();
        Map<Id, Id> oppToOwnerMap = new Map<Id, Id>();
        List<Account> accountsToUpdate = New List<Account>();
        for (Opportunity newOpp : newOppList) {
            Opportunity oldOpp = (oldOppMap != null && oldOppMap.containsKey(newOpp.Id)) ? oldOppMap.get(newOpp.Id) : null;
            
            // Proceed if account is not null and owner has changed or it's a new record
            if (newOpp.AccountId != null && (oldOpp == null || newOpp.OwnerId != oldOpp.OwnerId)) {
                accountIds.add(newOpp.AccountId);
                oppToOwnerMap.put(newOpp.AccountId, newOpp.OwnerId);
            }
        }
        if (!accountIds.isEmpty()) {
            List<Account> queriedAccounts = AccountData.queryAccounts(accountIds);
            
            for (Account acc : queriedAccounts) {
                Account accInstance = new Account();
                // Update Closer__c with Opportunity Owner Id
                if (acc.Closer__c == null || acc.Closer__c != oppToOwnerMap.get(acc.Id)) {
                    accInstance.Closer__c = oppToOwnerMap.get(acc.Id);
                    accInstance.id = acc.Id;
                    accountsToUpdate.add(accInstance);
                }
            }
            if (!accountsToUpdate.isEmpty()) {
                AccountService accountService = new AccountService();
                accountService.updateAccountData(accountsToUpdate);
                //update accountsToUpdate;
            }  
        } 
    }
    
    public void clientStatusAssignment(List<Opportunity> newOppList,Map<Id, Opportunity> oldOppMap){
        set<Id> accountIdSet = New Set<Id>();
        List<Account> accountsToUpdate = new List<Account>();
        for (Opportunity opp : newOppList){
            if (opp.StageName.equals(OpportunityUtil.STAGE_CLOSED_WON_PENDING) && opp.AccountId != null && oldOppMap.get(opp.id).StageName!=OpportunityUtil.STAGE_CLOSED_WON_PENDING){
                accountIdSet.add(opp.AccountId);
            }
        }
        if(!accountIdSet.isEmpty()){
            for (Account acc : AccountData.queryAccounts(accountIdSet)) {
                Account accInstance = New Account();
                accInstance.Id = acc.Id;
                accInstance.Client_Status__c = AccountUtil.CLIENT_STATUS_WAITING_FIRST_PAYMENT;
                accountsToUpdate.add(accInstance);
            }
        }
        if (!accountsToUpdate.isEmpty()) {
            AccountService accountService = new AccountService();
            AccountHandler.skipValidation = true;
            accountService.updateAccountData(accountsToUpdate);
            AccountHandler.skipValidation = false;
        }
    }
    
    public void makeUpdateClientSync(List<Opportunity> newOppList,Map<Id, Opportunity> oldOppMap){
        if (Trigger.new.size() == 1 && ApexUtil.isAsyncContext() == false) {
            for (Opportunity opp : newOppList){
                if(opp.Phone__c !=  oldOppMap.get(opp.id).Phone__c && opp.AccountId != null){
                   FutureHandler.makeUpdateClientSync(opp.AccountId, opp.Id);                    
                }
            }
        }
    }
    
    public void clientSync(List<Opportunity> newOppList,Map<Id, Opportunity> oldOppMap){
        //Whenever the contract signed, We are syncing the client with processor. It willn't work for bulk record at a time.        
        if (Trigger.new.size() == 1 && ApexUtil.isAsyncContext() == false) {
            Id oppDebtSettlementRTId =  ApexUtil.getRecordTypeIdbyDeveloperName(OpportunityUtil.getSObjectName(), OpportunityUtil.DEBT_SETTLEMENT_RECORDTYPE);
            for (Opportunity opp : newOppList){
                if(opp.StageName !=  oldOppMap.get(opp.id).StageName && opp.StageName == OpportunityUtil.STAGE_CONTRACT_SINGED && opp.AccountId != null && opp.RecordTypeId == oppDebtSettlementRTId){ 
                    System.enqueueJob(new ProcessorSyncQueueable(opp.AccountId));
                } 
            }                
        }
    }
    
    public void syncLegalNetworkToAccount(List<Opportunity> newOppList, Map<Id, Opportunity> oldOppMap) {
        Map<Id, String> accountIdToLegalNetwork = new Map<Id, String>();
        for (Opportunity opp : newOppList) {
            if (opp.StageName != oldOppMap.get(opp.Id).StageName
                && opp.StageName == OpportunityUtil.STAGE_CONTRACT_SINGED) {
                accountIdToLegalNetwork.put(opp.AccountId, opp.Legal_Network__c);
            }
        }
        if (!accountIdToLegalNetwork.isEmpty()) {
            List<Account> accountsToUpdate = new List<Account>();
            for (Id accId : accountIdToLegalNetwork.keySet()) {
                accountsToUpdate.add(new Account(
                    Id = accId,
                    Legal_Network__c = accountIdToLegalNetwork.get(accId)
                ));
            }
            AccountService accountService = new AccountService();
            accountService.updateAccountData(accountsToUpdate);
        }
    }
    
    public void makeAccountSync(List<Opportunity> newOppList,Map<Id, Opportunity> oldOppMap){
        if (Trigger.new.size() == 1 && ApexUtil.isAsyncContext() == false) {
            Id oppDebtSettlementRTId =  ApexUtil.getRecordTypeIdbyDeveloperName(OpportunityUtil.getSObjectName(), OpportunityUtil.DEBT_SETTLEMENT_RECORDTYPE);
            for (Opportunity opp : newOppList){
                 if(opp.Bank_Change_Contract_Status__c != oldOppMap.get(opp.id).Bank_Change_Contract_Status__c && opp.Bank_Change_Contract_Status__c == 'Completed' && opp.AccountId != null && opp.RecordTypeId == oppDebtSettlementRTId){
                    FutureHandler.makeCreateBankAccountSync(opp.AccountId, opp.Id);                    
                }
            }                
        }
    }
}