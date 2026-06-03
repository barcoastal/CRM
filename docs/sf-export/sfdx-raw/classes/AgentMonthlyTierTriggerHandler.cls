public without sharing class AgentMonthlyTierTriggerHandler extends TriggerHandler {
    
    public override void beforeInsert() {
        calculateTire();
    }
    
    public override void beforeUpdate() {
         calculateTire();
    }
    
    public static void calculateTire(){
        Map<Id,Agent_Monthly_Tier__c> monthlyTierOldMap = (Map<Id, Agent_Monthly_Tier__c>) Trigger.oldMap;

        List<Agent_Monthly_Tier__c> recordsToCalc = new List<Agent_Monthly_Tier__c>();
        
        for(Agent_Monthly_Tier__c amt : (List<Agent_Monthly_Tier__c>)Trigger.new) {
            if (Trigger.isInsert || 
               (Trigger.isUpdate && amt.Total_Debt_Amount__c != monthlyTierOldMap.get(amt.Id).Total_Debt_Amount__c)) {
                recordsToCalc.add(amt);
            }
        }
    
        if(!recordsToCalc.isEmpty()) {
            CommissionService.calculateTier(recordsToCalc, 'Total_Debt_Amount__c');
        }
    }
}