public inherited sharing class AppendLeadsConfigData {

    public static List<Append_Leads_Config__mdt> queryAppendLeadsConfig() {
        return [SELECT Id, DeveloperName, Dispositions_to_Exclude__c, Hopper_Priority__c, Batch_Size__c FROM Append_Leads_Config__mdt];
    }
}