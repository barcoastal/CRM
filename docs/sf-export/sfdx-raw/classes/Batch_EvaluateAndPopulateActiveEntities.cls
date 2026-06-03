public without sharing class Batch_EvaluateAndPopulateActiveEntities implements Database.Batchable<SObject>{
    
    public Database.QueryLocator start(Database.BatchableContext bc){
        return Database.getQueryLocator([SELECT Id,Name,Active_Lead__c,Active_Opportunity__c,Active_Account__c,Phone__c,Active_Entities_Assignment_Status__c FROM Individual WHERE 
                                        Active_Lead__c = NUll AND Active_Opportunity__c = NUll]);
    }
    
    public void Execute(Database.BatchableContext bc,List<Individual> individualList){
        List<Individual> individualsToUpdate = IndividualService.evaluateAndPopulateActiveEntities(individualList);
        performUpdateDML(individualsToUpdate);
    }
    
    public void finish(Database.BatchableContext bc){
    
    }
    
    private static void performUpdateDML(List<Individual> IndividualsToUpdate) {
        Database.SaveResult[] saveResults = Database.update(IndividualsToUpdate, false);
        for (Database.SaveResult saveResult : saveResults) {
            if (!saveResult.isSuccess() ) {
                String errorMessage;
                for (Database.Error err : saveResult.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
               ApplicationLogger.logDMLException('DML Error in Batch_EvaluateAndPopulateActiveEntities', saveResult.getId(), errorMessage, true);
            }
        }
    }
}