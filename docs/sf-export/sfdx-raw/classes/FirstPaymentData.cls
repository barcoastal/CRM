public with sharing class FirstPaymentData {

     public static List<AggregateResult> getMonthlyRollupsByUser(Set<Id> userIds){
       return  [SELECT Agent_Monthly_Tier__c amtId, SUM(First_Payment_Amount__c) totalFirstPaymentAmount ,SUM(Total_Debt_Amount__c) totalDebtAmount
                                      FROM First_Payment_Collection__c 
                                      WHERE Closer__c IN :userIds AND Agent_Monthly_Tier__c != null 
                                      GROUP BY Agent_Monthly_Tier__c];
    }
    
    public static List<AggregateResult> getWeeklyRollupsByUser(Set<Id> userIds){
       return [SELECT Agent_Weekly_Payroll__c wpId, SUM(First_Payment_Amount__c) totalFirstPaymentAmount ,SUM(Total_Debt_Amount__c) totalDebtAmount,
                                      SUM(Payout_Amount__c) totalPayoutAmount
                                      FROM First_Payment_Collection__c 
                                      WHERE Closer__c IN :userIds AND Agent_Weekly_Payroll__c != null 
                                      GROUP BY Agent_Weekly_Payroll__c];
    }
}