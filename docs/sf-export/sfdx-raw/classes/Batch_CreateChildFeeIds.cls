public without sharing class Batch_CreateChildFeeIds implements Database.Batchable<SObject> {

    public static String query = 'SELECT Id, Draft__c, RecordType.DeveloperName FROM Fee__c WHERE Unique_Id__c = null';

    public Database.QueryLocator start(Database.BatchableContext BC) {
        return Database.getQueryLocator(query);
    }

    public void execute(Database.BatchableContext BC, List<SObject> scope) {
        try {
            List<Fee__c> feesToUpdateList = new List<Fee__c>();
            for (Fee__c feeRecord : (List<Fee__c>)scope) {
                Fee__c feeToUpdate = new Fee__c();
                feeToUpdate.Id = feeRecord.Id;
                feeToUpdate.Unique_Id__c = constructFeeUniqueId(feeRecord.Draft__c, feeRecord.RecordType.DeveloperName);
                feesToUpdateList.add(feeToUpdate);
            }
            Database.SaveResult[] dmlResults = Database.update(feesToUpdateList, false);
            for (Database.SaveResult saveResult : dmlResults) {
                if (!saveResult.isSuccess()) {
                    String errorMessage = getErrorMessage(saveResult); ApplicationLogger.logDMLException('Batch_CreateChildFeeIds - Bulk Update',saveResult.getId(),errorMessage,true);
                }
            }
            ApplicationLogger.insertStoredLogs();
        } catch(Exception ex) {

        }
    }

    public void finish(Database.BatchableContext BC) {
    }

    public static String constructFeeUniqueId(Id draftId, String feeType) {
        return draftId + '-' + feeType;
    }

    public static String getErrorMessage(Database.SaveResult saveResult) {
        String errorMessage = '';
        for (Database.Error err : saveResult.getErrors()) {
            errorMessage += err.getMessage() + '. ';
        }
        return errorMessage;
    }
}