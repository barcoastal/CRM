//Commented the code as part of the deployment(CRM-2170), as the batch class is not used any where. Will be uncommented and deployed once the batch class is needed.

public with sharing class Batch_AssignCloserAsLeadOwner implements Database.Batchable<AggregateResult> {

    public Iterable<AggregateResult> start(Database.BatchableContext BC) {
        return [SELECT Closer__c, COUNT(ID) FROM Lead WHERE Closer__c != NULL GROUP BY Closer__c];
    }

    public void execute(Database.BatchableContext BC, List<AggregateResult> scope) {

       /* Set<String> closerSet = new Set<String>();
        Map<String, Id> userNameWithIdMap = new Map<String, Id>();
        List<Lead> leadUpdateList = new List<Lead>();

        FOR (AggregateResult aggr : scope) {
            closerSet.add((String)aggr.get('Closer__c'));
        }

        FOR (User userInstance : [SELECT Id, Name FROM User WHERE Name IN :closerSet]) {
            userNameWithIdMap.put(userInstance.Name, userInstance.Id);
        }

        FOR (Lead leadInstance : [SELECT Id, Name, Closer__c, OwnerId FROM Lead WHERE Closer__c IN :userNameWithIdMap.keySet()]) {
            leadInstance.OwnerId = userNameWithIdMap.get(leadInstance.Closer__c);
            leadUpdateList.add(leadInstance);
        }

        IF (!leadUpdateList.isEmpty()) {
            FOR (Database.SaveResult saveResult : Database.update(leadUpdateList, false)) {
                IF (!saveResult.isSuccess()) {
                    String errorMessage;
                    FOR (Database.Error err : saveResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('Updating Lead Owner is failed', saveResult.getId(), errorMessage, true);
                }
            }
        }
        ApplicationLogger.insertStoredLogs();*/
    }

    public void finish(Database.BatchableContext BC) {

    }
}