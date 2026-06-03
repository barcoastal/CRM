trigger AgentMonthlyTierTrigger on Agent_Monthly_Tier__c (before insert, before update, after insert, after update, after delete) {
       new AgentMonthlyTierTriggerHandler().run();
}