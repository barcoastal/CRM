public inherited sharing class DebtDetailsData {

    public static List<AggregateResult> aggregateDebtDetails(Id opportunityId) {
        return [SELECT COUNT(Id) noOfDebts, SUM(Debt_Amount__c) totalDebt
            FROM Debt_Details__c 
            WHERE Opportunity__c = :opportunityId
        ];
    }

    public static List<AggregateResult> aggregateDebtsIncludedInProgram(Id opportunityId) {
        return [SELECT COUNT(Id) noOfDebts, SUM(Debt_Amount__c) totalDebt
            FROM Debt_Details__c 
            WHERE Opportunity__c = :opportunityId
            AND Include_in_the_Program__c = true
        ];
    }

    public static List<Debt_Details__c> getDebtDetailByOppId(Id opportunityId) {
        return [
            SELECT Id,Name, Creditor_Name__c, Debt_Amount__c, Payment__c, Payment_Frequency__c, Opportunity__c, Program_Plan__c,  Creditor_Fees__c,UCC_Funds_onHold__c,
            Original_Creditor__c, Current_Creditor__c, Original_Creditor__r.Name, Current_Creditor__r.Name,Debt_Status__c,Account__c,Debt_Amount_With_Fees__c
            FROM Debt_Details__c WHERE Opportunity__c = :opportunityId
        ];
    }

    public static List<Debt_Details__c> getDebtDetailByAcctId(Id accountId) {
        return [
            SELECT Id,Name, Creditor_Name__c, Debt_Amount__c, Payment__c, Payment_Frequency__c, Opportunity__c, Program_Plan__c,  Creditor_Fees__c,UCC_Funds_onHold__c,
            Original_Creditor__c, Current_Creditor__c, Original_Creditor__r.Name, Current_Creditor__r.Name,Debt_Status__c,Account__c,Debt_Amount_With_Fees__c
            FROM Debt_Details__c WHERE Account__c = :accountId
        ];
    }

    /**
     * description: method to get the aggregated debt amount grouped by opportunity
     * @params: list of debt detail records with opportunityId and Debt Amount
     * @return: list of AggregateResult of debt amount
     * usage: DebtDetailsTriggerHandler
     */
    public static List<AggregateResult> aggregateDebtAmountByOpportunity(Set<Id> opportunityIdSet) {
        return [SELECT Opportunity__c, SUM(Debt_Amount__c) totalDebt
            FROM Debt_Details__c 
            WHERE Opportunity__c IN :opportunityIdSet
            GROUP BY Opportunity__c
        ];
    }

    /**
     * @Description: Method the fetch debtDetails based on accountId
    */
    public static List<Debt_Details__c> getDebtDetailsByAccount(Set<Id> accountIdSet){
        return [Select id,Legal_Status__c,Account__c,Negotiation_Status__c from Debt_Details__c where Account__c IN:accountIdSet];
    }
    
     /**
     * @Description: Method the fetch debtDetails based on recordId
    */
     public static Map<Id,Debt_Details__c> getDebtDetails(set<Id> debtDetailsId) {
         Map<Id,Debt_Details__c> debtDetailsMap =  new Map<Id, Debt_Details__c>([SELECT Id, Account__c,Creditor_Name__c, Debt_Amount__c, Payment__c, Payment_Frequency__c, Opportunity__c, Program_Plan__c, 
                                                    Original_Creditor__c, Current_Creditor__c, Original_Creditor__r.Name, Current_Creditor__r.Name
                                                    FROM Debt_Details__c WHERE Id IN: debtDetailsId]);
         
         return debtDetailsMap;
     }

     public static List<Debt_Details__c> getDebtDetails(Id debtDetailId) {
        return [SELECT Id, Debt_Amount__c, Opportunity__c, Account__c, Account__r.External_SAS_Id__c,
            UCC_Funds_onHold__c, Program_Plan__r.Total_Debt__c, Program_Plan__r.Settlement_Percentage__c,
            Program_Plan__r.Weekly_Draft_Amount__c, Current_Creditor__r.Name,Creditor_Name__c
            FROM Debt_Details__c WHERE Id = :debtDetailId AND Account__c != null];
    }

    public static List<Debt_Details__c> getAllDebtDetailByOppId(Id opportunityId) {
        return [
            SELECT Id,Name, Creditor_Name__c, Debt_Amount__c, Payment__c, Payment_Frequency__c, Opportunity__c, Program_Plan__c, Creditor_Fees__c,UCC_Funds_onHold__c,
            Original_Creditor__c, Current_Creditor__c, Original_Creditor__r.Name, Current_Creditor__r.Name,Debt_Status__c,Account__c,Debt_Amount_With_Fees__c
            FROM Debt_Details__c WHERE Opportunity__c = :opportunityId
        ];
    }

    
    public static list<Debt_Details__c> getProgramPlanByDebtDetials(Id debtDetailsId){
        return [
           SELECT Id, Debt_Amount__c, Program_Plan__r.Weekly_Draft_Amount__c , Program_Plan__r.Total_Debt__c, Program_Plan__r.Settlement_Percentage__c FROM Debt_Details__c WHERE Id = :debtDetailsId
        ];
   }

   public static List<Debt_Details__c> getAllDebtDetailByAccId(Id accountId) {
    return [
        SELECT Id,Name, Creditor_Name__c, Debt_Amount__c, Payment__c, Payment_Frequency__c, Opportunity__c, Program_Plan__c, Creditor_Fees__c,UCC_Funds_onHold__c,Legal_Status__c,Negotiation_Status__c,
        Original_Creditor__c, Current_Creditor__c, Original_Creditor__r.Name, Current_Creditor__r.Name,Debt_Status__c,Account__c,Debt_Amount_With_Fees__c, Creditor_Name_Formula__c,Lien_Position__c
        FROM Debt_Details__c WHERE Account__c = :accountId
    ];
    }
  public static List<Debt_Details__c> getDebtDetailWithOutCreditorByOppId(Id opportunityId) {
        return [
            SELECT Id,Name, Creditor_Name__c, Debt_Amount__c, Payment__c, Payment_Frequency__c, Opportunity__c, Program_Plan__c,  Creditor_Fees__c,UCC_Funds_onHold__c,
            Original_Creditor__c, Current_Creditor__c, Original_Creditor__r.Name, Current_Creditor__r.Name,Debt_Status__c,Account__c,Debt_Amount_With_Fees__c
            FROM Debt_Details__c WHERE Opportunity__c = :opportunityId AND Current_Creditor__c = null
        ];
    }
    public static Map<Id, Debt_Details__c> getChildDebtDetailsByOpportunities(Set<Id> opportunityIds) {
        return new Map<Id, Debt_Details__c>([
            SELECT Id, Parent_Debt_Detail__c
            FROM Debt_Details__c
            WHERE Opportunity__c IN :opportunityIds
            AND Parent_Debt_Detail__c != null
        ]);
    }
    
    public static List<Debt_Details__c> getAllDebtDetailByOppId(Set<Id> opportunityIds){
        return [ SELECT  Id,
                    Opportunity__c,
                    Current_Creditor__c,
                    Current_Creditor__r.Creditor_Category__c
            FROM    Debt_Details__c
            WHERE   Opportunity__c IN :opportunityIds
              AND   Current_Creditor__c != null];
    }
}