public inherited sharing class AppendLeadsMappingData {
    
    public static List<Append_Leads_Mapping__mdt> queryAppendLeadsMapping() {
        if (Test.isRunningTest()) {
            return DataFactoryTest.createAppendLeadsMapping();
        } else {
            return [SELECT Id, DeveloperName, Source_Field__c, Target_Field__c FROM Append_Leads_Mapping__mdt];
        }
    }
    
    public static List<Append_Leads_Mapping__mdt> queryAppendLeadsMappingForBatch() {
        
            return [SELECT Id, DeveloperName, Source_Field__c, Target_Field__c FROM Append_Leads_Mapping__mdt];
    }
}