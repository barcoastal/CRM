public inherited sharing class IndividualData {
   
    public static List<Individual> queryIndividualByPhone(Set<String> phoneSet){
        return [SELECT Id, Phone__c,Active_Lead__c,Active_Opportunity__c,Active_Opportunity__r.OwnerId,Active_Entities_Assignment_Status__c FROM Individual WHERE Phone__c IN : phoneSet];
    }
    
    public static List<Individual> queryIndividaulsByActiveLead(Set<Id> leadIds){
        return [SELECT Id, Phone__c,Active_Lead__c,Active_Lead__r.status ,Active_Opportunity__c,Active_Opportunity__r.OwnerId,Active_Opportunity__r.StageName,Active_Account__c,Active_Entities_Assignment_Status__c FROM Individual WHERE Active_Lead__c IN: leadIds];
    }
    
    public static List<Individual> queryIndividaulsByActiveOpportunity(Set<Id> oppIds){
        return [SELECT Id, Phone__c,Active_Lead__c,Active_Lead__r.status ,Active_Opportunity__c,Active_Opportunity__r.OwnerId,Active_Opportunity__r.StageName,Active_Account__c,Active_Entities_Assignment_Status__c FROM Individual WHERE Active_Opportunity__c IN: oppIds];
    }
}