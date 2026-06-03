public without sharing class Batch_CleanUpLeadIndustry implements Database.Batchable<SObject> {

    private Set<String> industries = new Set<String> {'Automotive', 'Construction', 'Health / Medical', 'Home Health Care', 'Hospitality', 'Janitorial', 'Landscaping', 'Law Office', 'Restaurant', 'Retail', 'Spas & Salons', 'Technology', 'Trucking / Transportation', 'Other', 'Online Retail', 'Real Estate', 'Financial', 'DayCare', 'Security'};
    public String query = 'SELECT Id, Industry from Lead WHERE Industry NOT IN :industries AND IsConverted = false AND Industry != null';
    
    public Database.QueryLocator start(Database.BatchableContext BC) {
        return Database.getQueryLocator(query);
    }

    public void execute(Database.BatchableContext BC, List<SObject> scope) {
        try {
            List<Lead> leadsToUpdate = new List<Lead>();
            for (Lead leadRecord : (List<Lead>)scope) {
                Lead leadToUpdate = new Lead();
                leadToUpdate.Id = leadRecord.Id;
                leadToUpdate.Other_Industry__c = leadRecord.Industry;
                leadToUpdate.Industry = 'Other';
                leadsToUpdate.add(leadToUpdate);
            }
            update leadsToUpdate;
        } catch(Exception ex) {
            ApplicationLogger.logException('Batch_CleanUpAccountIndustry', null, ex.getMessage());
        } finally {
            ApplicationLogger.insertStoredLogs();
        }
    }

    public void finish(Database.BatchableContext BC) {
    }
}