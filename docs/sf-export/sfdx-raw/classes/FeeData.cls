public inherited sharing class FeeData {

    public static List<AggregateResult> aggregateDraftFees(Set<Id> programPlanIds, Set<String> feeTypes) {
        System.debug('programPlanIds--->'+programPlanIds);
        System.debug('feeTypes--->'+feeTypes);
        System.debug('query ' + [SELECT SUM(Fee_Amount__c) amt, Program_Plan__c prgmPlanId, RecordType.DeveloperName feeType, Fee_Status__c feeStatus FROM Fee__c 
        WHERE Program_Plan__c IN :programPlanIds AND RecordType.DeveloperName IN :feeTypes 
        GROUP BY Program_Plan__c, RecordType.DeveloperName, Fee_Status__c]);
        return [SELECT SUM(Fee_Amount__c) amt, Program_Plan__c prgmPlanId, RecordType.DeveloperName feeType, Fee_Status__c feeStatus FROM Fee__c 
            WHERE Program_Plan__c IN :programPlanIds AND RecordType.DeveloperName IN :feeTypes 
            GROUP BY Program_Plan__c, RecordType.DeveloperName, Fee_Status__c];
    }

    public static List<AggregateResult> aggregateSettlementFees(Set<Id> opportunityIds) {
        return [SELECT SUM(Fee_Amount__c) amt, Opportunity__c oppId, RecordType.DeveloperName feeType, Fee_Status__c feeStatus FROM Fee__c 
            WHERE Opportunity__c IN :opportunityIds GROUP BY Opportunity__c, RecordType.DeveloperName, Fee_Status__c];
    }

    public static List<Fee__c> getSettlementProgrmFees(Set<Id> opportunityIds) {
        return [SELECT Id, Opportunity__c, Account__c, Fee_Date__c, Fee_Amount__c, Fee_Status__c FROM Fee__c WHERE Opportunity__c IN :opportunityIds AND RecordType.DeveloperName = :FeeUtil.RT_PROGRAM_FEE_SETTLEMENTS];
    }
}