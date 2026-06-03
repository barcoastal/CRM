public inherited sharing class OfferData {
    
    public static List<Offer__c> queryOffers(Id opportunityId) {
        return [SELECT Id, Name, CreatedBy.Name, CreatedDate FROM Offer__c 
            WHERE Opportunity__c = :opportunityId
        ];
    }

    public static List<Offer__c> queryOffersByOfferId(Id offerId) {
        return [SELECT Id, Name,Payment_Method__c,Status__c,Offer_Status__c, CreatedBy.Name, CreatedDate, Settlement_Frequency__c, Opportunity__c, Debt_Details__c, Offer_Amount__c,
            Debt_Details__r.UCC_Funds_onHold__c, Account__c, Debt_Details__r.Current_Creditor__r.Name,Debt_Details__r.Creditor_Name__c, Debt_Details__r.Debt_Amount__c,
            Settlement_Term__c, Start_Date__c, Recurring_Day__c, Client_Account__c ,Down_Payment__c,First_Payment_Date__c,Second_Payment_Date__c FROM Offer__c 
            WHERE Id = :offerId
        ];
    }

    public static Map<Id, Decimal> aggregateSettlements(Set<Id> accountIds) {
        Map<Id, Decimal> accountIdSettlementAmountMap = new Map<Id, Decimal>();
        for (AggregateResult ar : [SELECT SUM(Offer_Amount__c) amt, Client_Account__c accountId FROM Offer__c 
            WHERE Client_Account__c IN :accountIds AND Offer_Status__c = 'Accepted'
            GROUP BY Client_Account__c]
        ) {
            Id accountId = (Id)ar.get('accountId');
            Decimal amt = (Decimal)ar.get('amt');
            accountIdSettlementAmountMap.put(accountId, amt);
        }
        return accountIdSettlementAmountMap;
    }

    public static List<Offer__c> getOffersListOfCreditor(Id debtDetailId){
        return [SELECT Id, Name,Client_Account__c,Debt_Details__c,Offer_Amount__c,Offer_Status__c,Opportunity__c,Payment_Method__c,Payment_Method_Amount__c
        ,Recurring_Day__c,Settlement_Frequency__c,Settlement_Term__c,Start_Date__c,Status__c,Total_Settlement_Amount__c,Down_Payment__c,First_Payment_Date__c,Second_Payment_Date__c FROM Offer__c WHERE Debt_Details__c =: debtDetailId];
   }

   public static List<Offer__c> queryOffersByDebtDetailId(Id debtDetailId) {
        return [SELECT Id, Account__c, Client_Account__c, Client_Account__r.External_SAS_Id__c,
            Debt_Details__r.Current_Creditor__r.External_SAS_Id__c FROM Offer__c 
            WHERE Debt_Details__c = :debtDetailId
            ORDER BY CreatedDate DESC
        ];
    }
}