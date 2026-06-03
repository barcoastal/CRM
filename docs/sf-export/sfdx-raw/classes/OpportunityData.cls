public inherited sharing class OpportunityData {

    //Method to get the opportunity record based on the opportunity Id
    public static List<Opportunity> queryOpportunity(Id oppId) {
        return [SELECT Id,Name, AccountId, Account.External_SAS_Id__c, StageName, Sub_Disposition__c,Phone__c,DNC__c,Legal_Plan_Required__c, RecordType.Name,Processor__c, Lock_Opportunity__c FROM Opportunity WHERE Id = :oppId];
    }

    /**
     * @description: Querying the active opportunity record of the account.
    **/
    public static Opportunity getActiveOpportunityId(Id acctId) {
        Opportunity oppRecord;
        List<Opportunity> oppList = [SELECT Id, Name, AccountId,Account.External_SAS_Id__c, Account.External_RAM_Id__c, Processor__c, Legal_Network__c FROM Opportunity WHERE AccountId = :acctId AND StageName IN :OpportunityUtil.ACTIVE_STAGES];
        if (oppList != null && !oppList.isEmpty()) {
            oppRecord = oppList[0];
        }
        return oppRecord;
    }
    
    /**
     * @description: Querying the opportunity record of the account.
    **/
    public static Opportunity getOpportunityId(Id acctId) {
        Opportunity oppRecord;
        List<Opportunity> oppList = [SELECT Id, Name, AccountId, StageName FROM Opportunity WHERE AccountId = :acctId AND Active_Opportunity__c = true Limit 1];
        if (oppList != null && !oppList.isEmpty()) {
            oppRecord = oppList[0];
        }
        return oppRecord;
    }

    public static Opportunity getActiveInProgressOpportunityId(Id acctId) {
        Opportunity oppRecord;
        List<Opportunity> oppList = [SELECT Id, Name FROM Opportunity WHERE AccountId = :acctId AND (StageName IN :OpportunityUtil.ACTIVE_STAGES OR StageName IN :OpportunityUtil.IN_PROGRESS_STAGES)];
        if (oppList != null && !oppList.isEmpty()) {
            oppRecord = oppList[0];
        }
        return oppRecord;
    }

    public static List<Opportunity> queryOpportunities(Set<Id> oppIds) {
        return [SELECT Id, Name, AccountId, Account.Name, Account.External_SAS_Id__c, Account.External_RAM_Id__c FROM Opportunity WHERE Id IN :oppIds];
    }
    
    public static List<Opportunity> queryClosedWonOpportunities(Set<Id> oppIds) {
        return [SELECT Id, Name, AccountId FROM Opportunity WHERE Id IN :oppIds AND StageName = :OpportunityUtil.STAGE_CLOSED_WON_PENDING];
    }
    public static List<Opportunity> getOppIdAccountMap(Set<Id> oppIds) {
        return [SELECT Id, Name, AccountId, Account.Name, Account.External_SAS_Id__c FROM Opportunity WHERE Id IN :oppIds];
    }
    public static Map<Id, Opportunity> getOppIdMap(Set<Id> oppIds) {
        Map<Id, Opportunity> opportunityMap = new Map<Id, Opportunity>([SELECT Id, AccountId FROM Opportunity WHERE Id IN :oppIds]);
        return opportunityMap;
    }

    public static List<Opportunity> queryActiveOpportunities(Set<Id> accountIds) {
        return [SELECT Id, AccountId FROM Opportunity WHERE AccountId IN :accountIds];
    }

    public static Map<Id, OpportunityLineItem> queryOppLineItems(Set<Id> accountIds) {
        Map<Id, OpportunityLineItem> accountIdOppLineItemMap = new Map<Id, OpportunityLineItem>();
        for (OpportunityLineItem lineItem : [SELECT Id, TotalPrice, Opportunity.AccountId FROM OpportunityLineItem WHERE Opportunity.AccountId IN :accountIds]) {
            accountIdOppLineItemMap.put(lineItem.Opportunity.AccountId, lineItem);
        }
        return accountIdOppLineItemMap;
    }
    
    public static List<Opportunity> queryOpportunitiesWithSamePhone(Set<String> phoneToLeadMap){
        return [SELECT Id , Name,Phone__c FROM Opportunity WHERE Phone__c IN : phoneToLeadMap ];
    }

    public static List<Opportunity> queryActiveIndividualOpportunities(Set<Id> individualIds) {
        return [
            SELECT Id, AccountId, Individual__c
            FROM Opportunity
            WHERE Individual__c IN :individualIds
            AND StageName NOT IN :OpportunityUtil.NOT_ACTIVE_STAGES
        ];
    }
    
    public static List<Opportunity> queryActiveIndividualOpportunities(List<Individual> individualList) {
        return [
            SELECT Id, AccountId, Individual__c
            FROM Opportunity
            WHERE Individual__c IN :individualList
            AND StageName NOT IN :OpportunityUtil.NOT_ACTIVE_STAGES
        ];
    }


    public static List<Opportunity> queryOpportunitiesWithoutIndividualReference(Set<String> phoneNumberSet) {
        return [SELECT Id, Name, Formatted_Phone__c, Individual__c FROM Opportunity 
            WHERE Formatted_Phone__c IN : phoneNumberSet 
            AND Individual__c = null
        ];
    }

    public static List<Opportunity> getOpportunityDataById(Id opportunityId) {
        return [
            SELECT Id, Version_Status__c, Opportunity__c
            FROM Opportunity
            WHERE Id = :opportunityId
        ];
    }

    public static List<Opportunity> getChildOpportunityList(Id opportunityId) {
        return [
            SELECT Id
            FROM Opportunity
            WHERE Opportunity__c = :opportunityId
            AND Version_Status__c IN :OpportunityUtil.ACTIVE_VERSION_STATUS
        ];
    }
    public static Map<Id, Opportunity> getArchivedOpportunities(Set<Id> oppIds) {
        return new Map<Id, Opportunity>(
            [SELECT Id, StageName
             FROM Opportunity
             WHERE Id IN :oppIds AND StageName = :OpportunityUtil.STAGE_ARCHIVED]
        );
    }
    
    public static List<RecordType> queryRecordTypes() {
        return [SELECT Id, Name, DeveloperName FROM RecordType WHERE SobjectType = 'Opportunity'];
    }
      
       public static List<Opportunity> getLatestActiveOpportunityByAccount(Id accountId) {
        return [
            SELECT Id, Name, RecordType.DeveloperName,
                RecordType.Name, StageName, Opportunity__c, Version_Status__c
            FROM Opportunity
            WHERE AccountId = :accountId AND StageName != :OpportunityUtil.STAGE_ARCHIVED AND StageName != :OpportunityUtil.STAGE_CLOSED_LOST
            ORDER BY CreatedDate DESC
        ];
    }
     public static Map<Id,Opportunity> queryOpportunityMapByIds(Set<Id> oppIds){
         return new Map<Id,Opportunity>([SELECT Id,Ad_Click_Id__c FROM Opportunity WHERE Id IN :oppIds]);
    }

   public static List<Opportunity> getActiveOpportunitiesByPhoneNumbers(Set<String> phoneNumbers) {
        return [
            SELECT Id, Lead_Source_Category__c, Formatted_Phone__c, OwnerId, Owner.Email, Name,Owner.Name,StageName,
                   Opportunity_Reshuffled_DateTime__c, Re_shuffle_Opportunity__c,
                   Opportunity_Reinstated_DateTime__c, Opportunity_Reactivated_DateTime__c,Ad_Click_Id__c
            FROM Opportunity
            WHERE Formatted_Phone__c IN :phoneNumbers
            AND StageName IN :OpportunityUtil.OPP_ACTIVE_STAGES
            AND (
                (
                    Opportunity_Reshuffled_DateTime__c = null
                    AND Re_shuffle_Opportunity__c = false
                    AND Opportunity_Reinstated_DateTime__c = null
                    AND Opportunity_Reactivated_DateTime__c = null
                )
                OR StageName IN :OpportunityUtil.RESHUFFLED_ACTIVE_STAGES
            )
        ];
    }

    public static List<Opportunity> getInactiveReshuffledOpportunitiesByPhoneNumbers(Set<String> phoneNumbers) {
        return [
            SELECT Id, Name,Lead_Source_Category__c, Formatted_Phone__c, OwnerId, Owner.Email, StageName,Owner.Name,
                   Opportunity_Reshuffled_DateTime__c, Re_shuffle_Opportunity__c,
                   Opportunity_Reinstated_DateTime__c, Opportunity_Reactivated_DateTime__c
            FROM Opportunity
            WHERE Formatted_Phone__c IN :phoneNumbers 
            AND sub_Disposition__c != :OpportunityUtil.SUB_DISPO_OPP_AMENDED
            AND (
                (
                    (
                        Opportunity_Reshuffled_DateTime__c != null
                        OR Re_shuffle_Opportunity__c = true
                        OR Opportunity_Reinstated_DateTime__c != null
                        OR Opportunity_Reactivated_DateTime__c != null
                    )
                    AND StageName NOT IN :OpportunityUtil.RESHUFFLED_ACTIVE_STAGES
                )
                OR
                (
                    StageName = :OpportunityUtil.STAGE_ARCHIVED
                    OR StageName = :OpportunityUtil.STAGE_CLOSED_LOST
                )
            )
        ];
    }
    
    public static Map<Id,Opportunity> queryOpportunityMapByOppIds(Set<Id> oppIds){
         return new Map<Id,Opportunity>([
                SELECT Id, Lock_Opportunity__c, Bank_Change_Contract_Status__c
                FROM Opportunity
                WHERE Id IN :oppIds
         ]);
    }
    
    public static List<Opportunity> getLatestActiveOpportunityByAccount(Set<Id> accountIds) {
        return [
            SELECT Id, Name, StageName, Opportunity__c, Version_Status__c,AccountId
            FROM Opportunity
            WHERE AccountId IN :accountIds AND StageName != :OpportunityUtil.STAGE_ARCHIVED AND StageName != :OpportunityUtil.STAGE_CLOSED_LOST 
            AND (Opportunity__c = null OR StageName IN (:OpportunityUtil.STAGE_CLOSED_WON_PENDING,:OpportunityUtil.STAGE_CLOSED_WON_COMPLETED))
            ORDER BY CreatedDate DESC
        ];
    }
    
    public static List<Opportunity> getActiveOpportunityByAccountId(Id accountId) {
        return [
            SELECT Id, Name, StageName, Opportunity__c, Version_Status__c,AccountId
            FROM Opportunity
            WHERE AccountId = :accountId AND StageName != :OpportunityUtil.STAGE_ARCHIVED AND StageName != :OpportunityUtil.STAGE_CLOSED_LOST 
            AND (Opportunity__c = null OR StageName IN (:OpportunityUtil.STAGE_CLOSED_WON_PENDING,:OpportunityUtil.STAGE_CLOSED_WON_COMPLETED))
            ORDER BY CreatedDate DESC
        ];
    }
    
    public static Map<Id, Opportunity> getActiveOpportunitiesByAccountId(Set<Id> acctIds) {
        Map<Id, Opportunity> opportunityMap = new Map<Id, Opportunity>();
        for(Opportunity opp: [SELECT Id, Name, AccountId, StageName,Legal_Plan_Required__c FROM Opportunity WHERE AccountId IN :acctIds AND Active_Opportunity__c = true]){
            opportunityMap.put(opp.AccountId, opp);
        }        
        return opportunityMap;
    }
}