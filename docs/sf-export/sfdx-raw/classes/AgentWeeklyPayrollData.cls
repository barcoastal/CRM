public inherited sharing class AgentWeeklyPayrollData {

    public static List<Agent_Weekly_Payroll__c> getWeeklyPayrollByStartDateAndStatus(date preWeekStart) {
         return [SELECT Id, Calculation_Status__c 
                            FROM Agent_Weekly_Payroll__c 
                            WHERE Start_Date__c = :preWeekStart 
                            AND Calculation_Status__c = :AgentWeeklyPayrollUtil.CALCULATION_STATUS_DRAFT];
    }

    public static  Map<Id, Agent_Weekly_Payroll__c> getCloserToActiveAWP(Set<Id> activeCloserIds){
        Map<Id, Agent_Weekly_Payroll__c> closerToActiveAWPMap = new Map<Id, Agent_Weekly_Payroll__c>();
        for(Agent_Weekly_Payroll__c awp : [SELECT Id, Closer__c FROM Agent_Weekly_Payroll__c WHERE Active__c = true AND closer__c IN :activeCloserIds]){
            closerToActiveAWPMap.put(awp.Closer__c, awp);
        }

       return closerToActiveAWPMap;
    }
}