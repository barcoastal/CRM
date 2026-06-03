public without sharing class Batch_PopulateANIFieldsSpecificLeads implements Database.Batchable<SObject>, Database.AllowsCallouts {
    Id campaignId;
    public static Integer batchSize = 20;
    public String queryString;
    
    public Batch_PopulateANIFieldsSpecificLeads(String queryString) {
        this.queryString = queryString;
    }
    
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator(this.queryString);
    }

    public void execute(Database.BatchableContext bc, List<Lead> scope) {
        try {
            Set<Id> leadIds = new Set<Id>();
            for (Lead leadRecord : (List<Lead>)scope) {
                leadIds.add(leadRecord.Id);
            }
            if(!leadIds.isEmpty()){
                OutboundAniService.doCallout(leadIds);
            }
        } catch(Exception ex){
            ApplicationLogger.logException(ex, null, 'Batch_PopulateANIFieldsSpecificLeads', 'High');
        }
    }

    public void finish(Database.BatchableContext bc) {
        
    }
}