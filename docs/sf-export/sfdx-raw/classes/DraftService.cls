public inherited sharing class DraftService {
    
    public static void updateOpportunityBasedOnFirstPaymentComplete(Map<Id,List<Draft__c>> completedDrafts,Map<Id,Draft__c> draftOldMap) {
    
        Map<Id, AggregateResult> prgmPlanIdWithDraftDateMap = DraftData.getStartEndDraftDatesByStaus(completedDrafts.keySet(), new Set<String>{'Completed'});
        Map<Id, Program_Plan__c> programPlanMap = ProgramPlanData.getProrgamPlanOfOpportunties(completedDrafts.keySet());
        List<sObject> updateOppsAndAccs = new List<sObject>();
        Set<Id> AccountIdsToUpate = new Set<Id>();
        Map<Id, Date> accountDatesToUpdate = new Map<Id, Date>();
        
        for(Id programPlanId : completedDrafts.keySet()) {
            for(Draft__c draft : completedDrafts.get(programPlanId)){
                if(draft.Draft_Date__c == prgmPlanIdWithDraftDateMap.get(programPlanId).get('startDate') 
                    && programPlanMap.get(programPlanId).Opportunity__r.First_Payment_Completed__c == false){
                    Draft__c oldDraft = draftOldMap != null ? draftOldMap.get(draft.Id) : null;
                    Id accId = programPlanMap.get(programPlanId).Opportunity__r.AccountId;
                    AccountIdsToUpate.add(accId);
                    Opportunity oppRec = new Opportunity(
                        Id = programPlanMap.get(programPlanId).Opportunity__c, 
                        StageName = OpportunityUtil.STAGE_CLOSED_WON_COMPLETED,
                        First_Payment_Completed__c = true
                    );
                    if(draft.Draft_Cleared_Date__c != null && 
                       (oldDraft == null || draft.Draft_Cleared_Date__c != oldDraft.Draft_Cleared_Date__c)) {
                        oppRec.First_Payment_Completed_Date__c = draft.Draft_Cleared_Date__c;
                        accountDatesToUpdate.put(accId, draft.Draft_Cleared_Date__c);
                    }
                    updateOppsAndAccs.add(oppRec);
                }
            }
        }

        List<Account> accList = AccountData.queryAccounts(AccountIdsToUpate);
            if(!accList.isEmpty() && accList.size() > 0){
                for(Account acc: accList){
                if(accountDatesToUpdate.containsKey(acc.Id)){
                   acc.First_Payment_Completed_Date__c = accountDatesToUpdate.get(acc.Id);
                }
                acc.Client_Status__c = AccountUtil.CLIENT_STATUS_ACTIVE;
                updateOppsAndAccs.add(acc);
                }
            }
        if(!updateOppsAndAccs.isEmpty()){
            Update updateOppsAndAccs;
        }        
    }
    
    public static void updatePaymentCountByStatus(Map<Id,List<Draft__c>> completedDrafts) {
    
        Map<Id, Program_Plan__c> programPlanMap = ProgramPlanData.getProrgamPlanOfOpportunties(completedDrafts.keySet());
        Set<Id> acctIds = new Set<Id>();
        List<Account> accountToUpdate = new List<Account>();
        
        for(Id programPlanId : completedDrafts.keySet()) {            
            acctIds.add(programPlanMap.get(programPlanId).Opportunity__r.AccountId);    
        }
        
        Map<Id, AggregateResult> prgmPlanIdWithDraftCountMap = DraftData.getPaymentCountByStaus(acctIds, new Set<String>{'Completed'}); 
        for(Id acctId: prgmPlanIdWithDraftCountMap.keySet()){
           if(prgmPlanIdWithDraftCountMap.containsKey(acctId)){
               Account acctInstance = new Account();
               acctInstance.Id = acctId;
               acctInstance.Completed_Draft_Count__c = (Integer)prgmPlanIdWithDraftCountMap.get(acctId).get('completedRecordsCount');
               accountToUpdate.add(acctInstance);  
           }  
        }
                
        if(!accountToUpdate.isEmpty()){
            Update accountToUpdate;
        }
    }
    
    //This method will update first draft date on Account When draft status changed
    public static void updateFirstDraftDateOnAccount(Map<Id,List<Draft__c>> statusChangedDrafts) {
    
        Map<Id, AggregateResult> prgmPlanIdWithDraftDateMap = DraftData.getStartEndDraftDatesByStaus(statusChangedDrafts.keySet(), DraftUtil.firstDraftDateStatus);
        Map<Id, Program_Plan__c> programPlanMap = ProgramPlanData.getProrgamPlanOfOpportunties(statusChangedDrafts.keySet());
        Set<Id> AccountIdsToUpate = new Set<Id>();
        List<Account> updateAccts = new List<Account>();
        Map<Id, Id> acctProgramPlanMap = new Map<Id, Id>();
        
        for(Id programPlanId : statusChangedDrafts.keySet()) {
            AccountIdsToUpate.add(programPlanMap.get(programPlanId).Opportunity__r.AccountId);
            acctProgramPlanMap.put(programPlanMap.get(programPlanId).Opportunity__r.AccountId, programPlanId);
        }  
        
        for(Account acc: AccountData.queryAccounts(AccountIdsToUpate)) {                
            if(acctProgramPlanMap.containsKey(acc.Id) && prgmPlanIdWithDraftDateMap.containsKey(acctProgramPlanMap.get(acc.Id)) && acc.First_Draft_Date__c != prgmPlanIdWithDraftDateMap.get(acctProgramPlanMap.get(acc.Id)).get('startDate')){
                acc.First_Draft_Date__c = Date.valueOf(prgmPlanIdWithDraftDateMap.get(acctProgramPlanMap.get(acc.Id)).get('startDate'));
                updateAccts.add(acc);
            }
        } 
        
        if(!updateAccts.isEmpty()){
            Update updateAccts;
        }  
    }
}