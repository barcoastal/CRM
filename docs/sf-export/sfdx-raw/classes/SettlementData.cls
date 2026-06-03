/**Test Class: SettlementDataTest */
public inherited sharing class SettlementData {

    public static List<Settlement__c> querySettlements(Id offerId) {
        return [SELECT Id, Opportunity__c, Account__c, Settlement_Date__c, Payment_Method__c, Payment_Method_Amount__c, Offer__r.Debt_Details__r.Current_Creditor__r.Name, AmountToCreditor__c,
            SettlementAmount__c, Settlement_Status__c, Sync_Status__c, RecordTypeId,Offer__r.Debt_Details__r.Creditor_Name__c,Is_Down_Payment__c FROM Settlement__c WHERE Offer__c = :offerId AND RecordType.DeveloperName = :SettlementUtil.RT_OFFERED_SETTLEMENTS  ORDER BY CreatedDate ASC
        ];
    }
    
    public static List<AggregateResult> aggregateSettlements(Set<Id> opportunityIds) {
        return [SELECT SUM(SettlementAmount__c) amt, Opportunity__c oppId, Settlement_Status__c settlementStatus FROM Settlement__c 
            WHERE Opportunity__c IN :opportunityIds AND RecordType.DeveloperName = :SettlementUtil.RT_SETTLEMENTS
            GROUP BY Opportunity__c, Settlement_Status__c];
    }

    public static List<Settlement__c> querySettlementsByAccountId(Id accountId) {
        return [SELECT Id, Settlement_Date__c, Creditor__r.Name, Payment_Method_Amount__c, AmountToCreditor__c, Settlement_Status__c,
            SettlementAmount__c FROM Settlement__c WHERE Client_Account__c = :accountId AND RecordType.DeveloperName = :SettlementUtil.RT_SETTLEMENTS 
            ORDER BY CreatedDate ASC
        ];
    }

    public static List<Settlement__c> querySettlementsByOpportunityId(Id oppId) {
        return [SELECT Id, Opportunity__c, Account__c, Settlement_Date__c,Offer__c, Offer__r.Debt_Details__r.Current_Creditor__r.Name, Payment_Method_Amount__c, Settlement_Status__c,
            SettlementAmount__c,RecordTypeId, AmountToCreditor__c,Offer__r.Debt_Details__r.Creditor_Name__c,Is_Down_Payment__c FROM Settlement__c WHERE Opportunity__c = :oppId AND RecordType.DeveloperName = :SettlementUtil.RT_SETTLEMENTS ORDER BY CreatedDate ASC
        ];
    }

    public static List<Settlement__c> queryDownPaymentSettlement(Id OfferId){
        return [SELECT Id, Opportunity__c, Account__c, Settlement_Date__c, Payment_Method__c, Payment_Method_Amount__c, Offer__r.Debt_Details__r.Current_Creditor__r.Name, AmountToCreditor__c,
        SettlementAmount__c, Settlement_Status__c, Sync_Status__c, RecordTypeId,Offer__r.Debt_Details__r.Creditor_Name__c FROM Settlement__c WHERE Offer__c = :offerId AND Is_Down_Payment__c = true AND RecordType.DeveloperName = :SettlementUtil.RT_OFFERED_SETTLEMENTS  ORDER BY CreatedDate ASC
        ];
    }

    public static List<Settlement__c> querySettlementsToDelete(Id offerId,List<Settlement__c> settlementList){
        return [SELECT Id FROM Settlement__c WHERE Offer__c =: offerId AND Id NOT IN : settlementList];
    }
}