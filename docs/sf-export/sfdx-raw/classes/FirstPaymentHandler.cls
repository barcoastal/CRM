public without sharing class FirstPaymentHandler {

    public static void handleBeforeInsert(List<First_Payment_Collection__c> records) {
        try {
        Set<Id> userIds = new Set<Id>();
        
        for (First_Payment_Collection__c fpc : records) {
            if (fpc.First_Payment_Completed_Date__c == null || fpc.Closer__c == null) continue;
          
            userIds.add(fpc.Closer__c);
            
        }

        Map<Id,Agent_Monthly_Tier__c> closerToActiveAMTMap = AgentMonthlyTierData.getCloserToActiveAMT(userIds);
        Map<Id,Agent_Weekly_payroll__c> closerToActiveAWPMap = AgentWeeklyPayrollData.getCloserToActiveAWP(userIds);
        Map<Id,Agent_Monthly_Tier__c> closerToPreviousMonthAMTMap = AgentMonthlyTierData.getPreviousMonthAMTByCloser(userIds);

        for (First_Payment_Collection__c fpc : records) {
            if (fpc.First_Payment_Completed_Date__c == null || fpc.Closer__c == null) continue;
            
            if (closerToActiveAMTMap.containsKey(fpc.Closer__c)) {
                fpc.Agent_Monthly_Tier__c = closerToActiveAMTMap.get(fpc.Closer__c)?.Id;
            }

            if (closerToActiveAWPMap.containsKey(fpc.Closer__c)) {
                fpc.Agent_Weekly_Payroll__c = closerToActiveAWPMap.get(fpc.Closer__c)?.Id;
            }
            
            if (closerToPreviousMonthAMTMap.containsKey(fpc.Closer__c)){
                fpc.Previous_Agent_Monthly_Tier__c = closerToPreviousMonthAMTMap.get(fpc.Closer__c)?.Id;
            }
        }
      }catch(Exception ex){
        ApplicationLogger.logExceptionWithData(ex, null, 'Commission Structure Error',null, ApplicationLogger.SEVERITY_HIGH);
      }
    }

    public static void handleRollups(Set<Id> userIds) {
        if (userIds == null || userIds.isEmpty()) return;
        try {
            updateMonthlyRollups(userIds);
            updateWeeklyRollups(userIds);
        } catch (Exception ex) {
            ApplicationLogger.logExceptionWithData(ex, null, 'Commission Structure Error',null, ApplicationLogger.SEVERITY_HIGH);
        }
    }

    private static void updateMonthlyRollups(Set<Id> userIds) {
        List<Agent_Monthly_Tier__c> monthsToUpdate = new List<Agent_Monthly_Tier__c>();
        
        for (AggregateResult ar : FirstPaymentData.getMonthlyRollupsByUser(userIds)) {
            monthsToUpdate.add(new Agent_Monthly_Tier__c(
                Id = (Id)ar.get('amtId'),
                Total_First_Payment_Collected__c = (Decimal)ar.get('totalFirstPaymentAmount'),
                Total_Debt_Amount__c = (Decimal)ar.get('totalDebtAmount'),
                Record_Updated_By__c = 'System' 
            ));
        }
        
        if (!monthsToUpdate.isEmpty()) {
            DMLService.performUpdateDML(monthsToUpdate, 'FirstPaymentHandler.MonthlyRollup');
        }
    }

    private static void updateWeeklyRollups(Set<Id> userIds) {
        List<Agent_Weekly_Payroll__c> weeksToUpdate = new List<Agent_Weekly_Payroll__c>();
        
        for (AggregateResult ar : FirstPaymentData.getWeeklyRollupsByUser(userIds)) {
            weeksToUpdate.add(new Agent_Weekly_Payroll__c(
                Id = (Id)ar.get('wpId'),
                Total_First_Payment_Collected__c = (Decimal)ar.get('totalFirstPaymentAmount'),
                Total_Debt_Amount__c = (Decimal)ar.get('totalDebtAmount'),
                Total_Payout_Amount__c = (Decimal)ar.get('totalPayoutAmount'),
                Record_Updated_By__c = 'System'
            ));
        }
        
        if (!weeksToUpdate.isEmpty()) {
            DMLService.performUpdateDML(weeksToUpdate, 'FirstPaymentHandler.WeeklyRollup');
        }
    }
}