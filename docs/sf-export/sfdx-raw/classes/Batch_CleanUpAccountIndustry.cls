public without sharing class Batch_CleanUpAccountIndustry implements Database.Batchable<SObject> {

    private Set<String> industries = new Set<String> {'Automotive', 'Construction', 'Health / Medical', 'Home Health Care', 'Hospitality', 'Janitorial', 'Landscaping', 'Law Office', 'Restaurant', 'Retail', 'Spas & Salons', 'Technology', 'Trucking / Transportation', 'Other', 'Online Retail', 'Real Estate', 'Financial', 'DayCare', 'Security'};
    public String query = 'SELECT Id, Industry FROM Account WHERE Industry NOT IN :industries AND Industry != null';
    
    public Database.QueryLocator start(Database.BatchableContext BC) {
        return Database.getQueryLocator(query);
    }

    public void execute(Database.BatchableContext BC, List<SObject> scope) {
        try {
            List<Account> accountsToUpdate = new List<Account>();
            for (Account accountRecord : (List<Account>)scope) {
                Account accountToUpdate = new Account();
                accountToUpdate.Id = accountRecord.Id;
                accountToUpdate.Other_Industry__c = accountRecord.Industry;
                accountToUpdate.Industry = 'Other';
                accountsToUpdate.add(accountToUpdate);
            }
            update accountsToUpdate;
        } catch(Exception ex) {
            ApplicationLogger.logException('Batch_CleanUpAccountIndustry', null, ex.getMessage());
        } finally {
            ApplicationLogger.insertStoredLogs();
        }
    }

    public void finish(Database.BatchableContext BC) {
    }
}