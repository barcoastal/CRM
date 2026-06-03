public inherited sharing class DraftData { 
    public static List<Draft__c> queryUnlockedDrafts(Id programPlanId) {
        return [SELECT Id, Draft_Date__c, Draft_Status__c,
            (SELECT Id, Fee_Date__c, Fee_Amount__c, RecordType.DeveloperName 
            FROM Fees__r) FROM Draft__c 
            WHERE Program_Plan__c = :programPlanId
            AND (Draft_Status__c IN :DraftUtil.unlockedStatuses)
            ORDER BY Draft_Date__c];
    }

    public static List<AggregateResult> getCompletedDraftDetails(Id opportunityId, Id accountId) {
        return [SELECT COUNT(Id) completedRecordsCount, SUM(Draft_Total_Amount__c) completedDraftsAmount, 
            Program_Plan__c prgmPlanId FROM Draft__c 
            WHERE Program_Plan__r.Opportunity__r.AccountId = :accountId
            AND(Valid_Payment__c = true OR Program_Plan__r.Opportunity__c = :opportunityId)
            AND Draft_Status__c = 'Completed' GROUP BY Program_Plan__c];
    }

    public static List<Draft__c> queryLockedDrafts(Id accountId, Id opportunityId) {
        return [SELECT Id, Draft_Date__c, Draft_Amount__c, Program_Plan__r.Debit_Schedule_Id__c,Citadel_Fee__c,Draft_Total_Excl_Monthly_Processor_Fee__c,
                External_SAS_Id__c, External_RAM_Id__c, Program_Plan__r.Client__r.External_SAS_Id__c, 
            Retainer_Fee__c, Setup_Fee__c, Processor_Fee__c,Program_Fee__c,Retainer_SetupFee_Draft__c,
            Service_Fee__c, Draft_Status__c, Program_Plan__c,Program_Plan__r.Client__c,Program_Plan__r.Opportunity__c,
            Wire_Payment__c, Wire_Fee__c, Wire_Type__c,
            Draft_Total_Amount__c FROM Draft__c 
            WHERE Program_Plan__r.Opportunity__r.AccountId = :accountId
            AND(Valid_Payment__c = true OR Program_Plan__r.Opportunity__c = :opportunityId)
            AND Draft_Status__c IN :DraftUtil.lockedStatuses
            ORDER BY Draft_Date__c];
    }
    
    public static List<Draft__c> queryDraftsByStaus(Id programPlanId, Set<String> draftStatus) {
        return [SELECT Id, Draft_Date__c, Draft_Status__c,
            (SELECT Id, Fee_Date__c, Fee_Amount__c, RecordType.DeveloperName 
            FROM Fees__r) FROM Draft__c 
            WHERE Program_Plan__c = :programPlanId
            AND (Draft_Status__c IN :draftStatus)
            ORDER BY Draft_Date__c];
    }

    public static List<Draft__c> queryDraftsByDate(Id opportunityId, Date dateToCheck) {
        return [
            SELECT Id, Draft_Date__c, Draft_Status__c 
            FROM Draft__c
            WHERE Program_Plan__r.Opportunity__c = :opportunityId
            AND Draft_Status__c = 'Scheduled'
            AND Draft_Date__c >= TODAY
            AND Draft_Date__c <= :dateToCheck
        ];
    }


    //Added Citadel_Fee_Payee_Id__c in the draft queries
    public static List<Draft__c> queryDrafts(Id accountId, Id opportunityId) {
        return [SELECT Id, Draft_Date__c, Draft_Amount__c, Account__c, Program_Plan__r.Opportunity__c, Program_Plan__r.Debit_Schedule_Id__c,
            Program_Plan__r.Opportunity__r.Version_Status__c,            Retainer_Fee__c, Setup_Fee__c, Processor_Fee__c, Citadel_Fee__c, Draft_Total_Excl_Monthly_Processor_Fee__c,
            Service_Fee__c, Draft_Status__c, Program_Plan__c, Program_Plan__r.Client__c, Program_Plan__r.Client__r.External_SAS_Id__c,
            Draft_Total_Amount__c, Program_Fee__c, Retainer_SetupFee_Draft__c, External_SAS_Id__c, Sync_Status__c, External_RAM_Id__c,
            Wire_Payment__c, Wire_Fee__c, Wire_Type__c,
            (SELECT Id, Fee_Amount__c, Fee_Date__c, RecordType.DeveloperName, Program_Plan__r.Payment_Processor__r.Retainer_Fee_Payee_Id__c,
            Program_Plan__r.Payment_Processor__r.Service_Fee_Payee_Id__c, Program_Plan__r.Payment_Processor__r.Setup_Fee_Payee_Id__c,
            Program_Plan__r.Payment_Processor__r.Citadel_Fee_Payee_Id__c, Program_Plan__r.Payment_Processor__r.Program_Fee_Payee_Id__c FROM Fees__r
            WHERE RecordType.DeveloperName IN :FeeUtil.FEES_INTEGRATION_SUPPORTED)
            FROM Draft__c 
            WHERE (Program_Plan__r.Opportunity__r.Version_Status__c = 'Archived' AND Program_Plan__r.Opportunity__c = :opportunityId)  OR 
            (Program_Plan__r.Opportunity__r.AccountId = :accountId 
            AND (Valid_Payment__c = true OR Program_Plan__r.Opportunity__c = :opportunityId))
            ORDER BY Draft_Date__c];
    }

    public static List<Draft__c> queryDraftsWithUnSyncedStatus(Id programPlanId, Id accountId) {
        return [SELECT Id, Draft_Date__c, Draft_Amount__c, Program_Plan__r.Opportunity__c, 
            Retainer_Fee__c, Setup_Fee__c, Processor_Fee__c, Draft_Total_Excl_Monthly_Processor_Fee__c, Program_Plan__r.Debit_Schedule_Id__c,
            Service_Fee__c, Draft_Status__c, Program_Plan__c, Program_Plan__r.Client__c, Program_Plan__r.Client__r.External_SAS_Id__c,
            Draft_Total_Amount__c, Program_Fee__c, Retainer_SetupFee_Draft__c, External_SAS_Id__c, Sync_Status__c, External_RAM_Id__c,
            (SELECT Id, Fee_Amount__c, Fee_Date__c, RecordType.DeveloperName, Program_Plan__r.Payment_Processor__r.Retainer_Fee_Payee_Id__c,
            Program_Plan__r.Payment_Processor__r.Service_Fee_Payee_Id__c, Program_Plan__r.Payment_Processor__r.Setup_Fee_Payee_Id__c,
            Program_Plan__r.Payment_Processor__r.Citadel_Fee_Payee_Id__c, Program_Plan__r.Payment_Processor__r.Program_Fee_Payee_Id__c FROM Fees__r
            WHERE RecordType.DeveloperName IN :FeeUtil.FEES_INTEGRATION_SUPPORTED)
            FROM Draft__c 
            WHERE (Sync_Status__c IN ('Sync Pending', 'Sync Failed', null) AND (
                (Program_Plan__c = :programPlanId)  OR (Program_Plan__r.Client__c = :accountId 
                 AND (External_SAS_Id__c != null OR External_RAM_Id__c != null)
                ))) AND Wire_Payment__c = false
            ORDER BY Draft_Date__c];
    }

    public static List<Draft__c> queryDrafts(Set<Id> draftIds) {
        return [SELECT Id, Draft_Date__c, Draft_Amount__c, Program_Plan__r.Opportunity__c, 
            Retainer_Fee__c, Setup_Fee__c, Processor_Fee__c,
            Service_Fee__c, Draft_Status__c, Program_Plan__c, Program_Plan__r.Client__c, Program_Plan__r.Client__r.External_SAS_Id__c,
            Draft_Total_Amount__c, Program_Fee__c, Retainer_SetupFee_Draft__c, External_SAS_Id__c,
            Program_Plan__r.Payment_Processor__r.Processor_Type__c,
            (SELECT Id, Fee_Amount__c, Fee_Date__c, RecordType.DeveloperName, Program_Plan__r.Payment_Processor__r.Retainer_Fee_Payee_Id__c,
            Program_Plan__r.Payment_Processor__r.Service_Fee_Payee_Id__c, Program_Plan__r.Payment_Processor__r.Setup_Fee_Payee_Id__c,
            Program_Plan__r.Payment_Processor__r.Citadel_Fee_Payee_Id__c, Program_Plan__r.Payment_Processor__r.Program_Fee_Payee_Id__c FROM Fees__r
            WHERE RecordType.DeveloperName IN :FeeUtil.FEES_INTEGRATION_SUPPORTED) 
            FROM Draft__c 
            WHERE Id = :draftIds
            ORDER BY Draft_Date__c
        ];
    }

    public static List<Draft__c> queryDraftsWithUnSyncedStatus(Set<Id> draftIds) {
        return [SELECT Id, Draft_Date__c, Draft_Amount__c, Program_Plan__r.Opportunity__c, 
            Retainer_Fee__c, Setup_Fee__c, Processor_Fee__c, Program_Plan__r.Debit_Schedule_Id__c,
            Service_Fee__c, Draft_Status__c, Program_Plan__c, Program_Plan__r.Client__c, Program_Plan__r.Client__r.External_SAS_Id__c,
            Draft_Total_Amount__c, Program_Fee__c, Retainer_SetupFee_Draft__c, External_SAS_Id__c,
            Program_Plan__r.Payment_Processor__r.Processor_Type__c,
            (SELECT Id, Fee_Amount__c, Fee_Date__c, RecordType.DeveloperName, Program_Plan__r.Payment_Processor__r.Retainer_Fee_Payee_Id__c,
            Program_Plan__r.Payment_Processor__r.Service_Fee_Payee_Id__c, Program_Plan__r.Payment_Processor__r.Setup_Fee_Payee_Id__c,
            Program_Plan__r.Payment_Processor__r.Citadel_Fee_Payee_Id__c, Program_Plan__r.Payment_Processor__r.Program_Fee_Payee_Id__c FROM Fees__r
            WHERE RecordType.DeveloperName IN :FeeUtil.FEES_INTEGRATION_SUPPORTED) 
            FROM Draft__c 
            WHERE Id = :draftIds AND Sync_Status__c IN ('Sync Pending', 'Sync Failed', null)
            ORDER BY Draft_Date__c
        ];
    }

    public static List<AggregateResult> getCompletedDraftDetails(Id opportunityId) {
        return [SELECT COUNT(Id) completedRecordsCount, SUM(Draft_Amount__c) completedDraftsAmount, 
            Program_Plan__c prgmPlanId FROM Draft__c 
            WHERE Program_Plan__r.Opportunity__c = :opportunityId
            AND Draft_Status__c IN :DraftUtil.completedStatuses GROUP BY Program_Plan__c];
    }
    
    /**
     * @description: Method to query the draft record based on draft external SAS payment Id set.
     * @param draftSASIdSet - SAS payment Id set
     * @return List<Draft__c> - returns the list of drafts
     */
    public static List<Draft__c> queryDraftBySASIds(Set<String> draftSASIdSet) {
        return [
            SELECT Id, External_SAS_Id__c, Draft_Status__c FROM Draft__c WHERE External_SAS_Id__c IN :draftSASIdSet
        ];
    }

    /**
     * @description: Method to query the draft record based on draft Id set.
     * @param draftIdSet - Draft Id set
     * @return List<Draft__c> - returns the list of drafts
     */
    public static List<Draft__c> queryDraftByIds(Set<String> draftIdSet) {
        return [
            SELECT Id, External_SAS_Id__c, Draft_Status__c FROM Draft__c WHERE Id IN :draftIdSet
        ];
    }

    public static List<Draft__c> queryDraftswithOpenOpportunity(Set<Id> programPlanIdSet) {
        return [
            SELECT Id, Draft_Total_Amount__c, Draft_Date__c, Program_Plan__c FROM Draft__c 
            WHERE Program_Plan__c IN :programPlanIdSet 
            AND Program_Plan__r.Opportunity__r.StageName NOT IN :OpportunityUtil.CLOSED_STAGES 
            ORDER BY Draft_Date__c ASC
        ];
    }

    public static List<Draft__c> queryDraftsBasedOnOpportunity(Set<Id> programPlanIdSet) {
        return [
            SELECT Id, Draft_Date__c, Draft_Total_Amount__c, Retainer_Fee__c, Setup_Fee__c, Program_Fee__c, Service_Fee__c,Draft_Amount__c
            FROM Draft__c 
            WHERE Program_Plan__c IN :programPlanIdSet 
        ];
    }

    //Method to get map of aggregate result of the min and max of draft date for the program plans
    public static Map<Id, AggregateResult> getStartEndDraftDates(Set<Id> programPlanIdList) {
        return new Map<Id, AggregateResult>([
            SELECT MIN(Draft_Date__c) startDate, MAX(Draft_Date__c) endDate, Program_Plan__c Id 
            FROM Draft__c WHERE Program_Plan__c IN :programPlanIdList GROUP BY Program_Plan__c
        ]);
    }
    
    public static Map<Id, AggregateResult> getStartEndDraftDatesByStaus(Set<Id> programPlanIdList, Set<String> draftStatus) {
        return new Map<Id, AggregateResult>([
            SELECT COUNT(Id) completedRecordsCount, MIN(Draft_Date__c) startDate, MAX(Draft_Date__c) endDate, Program_Plan__c Id 
            FROM Draft__c WHERE Program_Plan__c IN :programPlanIdList AND Draft_Status__c IN :draftStatus GROUP BY Program_Plan__c
        ]);
    }

    public static Map<Id, AggregateResult> getPaymentCountByStaus(Set<Id> acctIds, Set<String> draftStatus) {
        return new Map<Id, AggregateResult>([
            SELECT COUNT(Id) completedRecordsCount, Program_Plan__r.Client__c Id 
            FROM Draft__c WHERE Program_Plan__r.Client__c IN :acctIds AND Draft_Status__c IN :draftStatus GROUP BY Program_Plan__r.Client__c
        ]);
    }

    public static List<AggregateResult> aggregateDrafts(Set<Id> programPlanIds) {
        return [SELECT SUM(Draft_Total_Amount__c) amt, SUM(Draft_Amount__c) escrowAmount, Program_Plan__c prgmPlanId, Draft_Status__c draftStatus FROM Draft__c 
            WHERE Program_Plan__c IN :programPlanIds GROUP BY Program_Plan__c, Draft_Status__c];
    }

    public static List<Draft__c> queryDraftsByProgramPlanId(Id programPlanId) {
        return [SELECT Id, Account__c, Draft_Date__c, Draft_Total_Amount__c, Draft_Amount__c, Draft_Status__c, External_SAS_Id__c FROM Draft__c WHERE Program_Plan__c = :programPlanId];
    }
    
    public static List<Draft__c> queryPendingDraftsByAccountId(Id programPlanId) {
        return [SELECT Id, Draft_Amount__c, Program_Fee__c FROM Draft__c WHERE Program_Plan__c = :programPlanId AND Draft_Status__c IN :DraftUtil.unlockedStatuses];
    }

    public static AggregateResult queryCountOfDraftsByAccountId(Id AccountId){
        return [SELECT COUNT(Id) draftsCount FROM Draft__c WHERE Program_Plan__r.Client__c =: AccountId AND Draft_Status__c IN :DraftUtil.unlockedStatuses];
    }

    public static List<Draft__c> queryDraftsByIds(Set<Id> draftIds){
       return[ SELECT Id, Draft_Date__c, Draft_Amount__c, Program_Plan__r.Opportunity__c, 
            Retainer_Fee__c, Setup_Fee__c, Processor_Fee__c,
            Service_Fee__c, Draft_Status__c, Program_Plan__c, Program_Plan__r.Client__c, Program_Plan__r.Client__r.External_SAS_Id__c,
            Draft_Total_Amount__c, Program_Fee__c, Retainer_SetupFee_Draft__c, External_SAS_Id__c,
            Program_Plan__r.Payment_Processor__r.Processor_Type__c 
            FROM Draft__c 
            WHERE Id = :draftIds];
    }

    public static Map<String,Draft__c> queryDraftsBySASIds(Set<String> draftSASIds){
        Map<String,Draft__c> draftMap = New Map<String,Draft__c>();
        for(Draft__C draft : [ SELECT Id, Draft_Date__c, Draft_Amount__c, Program_Plan__r.Opportunity__c, 
            Retainer_Fee__c, Setup_Fee__c, Processor_Fee__c,
            Service_Fee__c, Draft_Status__c, Program_Plan__c, Program_Plan__r.Client__c, Program_Plan__r.Client__r.External_SAS_Id__c,
            Draft_Total_Amount__c, Program_Fee__c, Retainer_SetupFee_Draft__c, External_SAS_Id__c,
            Program_Plan__r.Payment_Processor__r.Processor_Type__c 
            FROM Draft__c 
            WHERE External_SAS_Id__c IN :draftSASIds ]){
                draftMap.put(draft.External_SAS_Id__c,draft);
        }
        return draftMap;
    }
    public static List<draft__c> completedDraftsByOppIds(Set<Id> oppIds){
     return [
                SELECT Id, Draft_Total_Amount__c, Draft_Date__c, Program_Plan__r.Opportunity__c 
                FROM Draft__c 
                WHERE Program_Plan__r.Opportunity__c IN :oppIds 
                AND Draft_Status__c = :DraftUtil.STATUS_COMPLETED
                ORDER BY Draft_Date__c ASC
            ];
    }
}