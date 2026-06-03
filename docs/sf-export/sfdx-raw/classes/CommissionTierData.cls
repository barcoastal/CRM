public inherited sharing class CommissionTierData {
    
    public static List<Commission_Tier_Structure__c> getActiveTiers(){
        return [SELECT Id, Tier_Name__c, Minimum_Total_Debt_Amount__c, 
                             Maximum_Total_Debt_Amount__c, Commission_Rate__c 
                             FROM Commission_Tier_Structure__c 
                             WHERE Active__c = true 
                             ORDER BY Minimum_Total_Debt_Amount__c ASC];
    }
}