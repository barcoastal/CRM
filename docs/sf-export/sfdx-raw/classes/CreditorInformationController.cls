public without sharing class CreditorInformationController {

    @AuraEnabled
    public static string saveDebtDetails(Id oppId, String debtDetails, Decimal totalWeeklyPayment){
        String result = '';
        try {
            List<Debt_Details__c> debtDetailsList = (List<Debt_Details__c>)JSON.deserialize(debtDetails, List<Debt_Details__c>.class);
            List<Program_Plan__c> programPlanList = ProgramPlanData.queryProgramPlanDetails(oppId, new List<String> {'Id'});
            Set<Id> debtDetailIdSet = new Set<Id>(); 
            
            Opportunity opp = [SELECT Id, Current_Weekly_Payment__c, Current_Monthly_Payment__c,AccountId FROM Opportunity WHERE Id = :oppId LIMIT 1];
            opp.Current_Weekly_Payment__c = totalWeeklyPayment;
            opp.Current_Monthly_Payment__c = totalWeeklyPayment*4;
            update opp;
            
            if (programPlanList != null && !programPlanList.isEmpty()) {
                
                for (Debt_Details__c debts : debtDetailsList) {
                    debts.Opportunity__c = oppId;
                    debts.Program_Plan__c = programPlanList[0].Id;
                     debts.Account__c = opp.AccountId;
                }
                
                List<Debt_Details__c> debtDetialsToDelete = [SELECT Id FROM Debt_Details__c WHERE Opportunity__c = :oppId AND Id NOT IN :debtDetailsList];
                if (debtDetialsToDelete != null && !debtDetialsToDelete.isEmpty()) {
                    delete debtDetialsToDelete;
                }
                
                for(Database.upsertResult response : Database.upsert(debtDetailsList,false)) {
                    if (response.isSuccess()) {
                        debtDetailIdSet.add(response.getId());
                    }
                }
                result = 'success'; 
            } else {
                result = 'Insert failed. Please create a program plan to add debt details.';
            }              
        } catch (Exception e) {
            result = e.getMessage();
        }
        return result;
    }
    
    @AuraEnabled
    public static List<Debt_Details__c> getDebtDetails(Id oppId) {
        return DebtDetailsData.getDebtDetailByOppId(oppId);
    }
    
    @AuraEnabled
    public static Opportunity getActiveOpportunity(Id accId) {
        return OpportunityData.getActiveInProgressOpportunityId(accId);
    }
    
}