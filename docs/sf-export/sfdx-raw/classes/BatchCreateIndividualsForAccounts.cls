public without sharing class BatchCreateIndividualsForAccounts implements Database.Batchable<SObject>, Database.Stateful {

    public Set<String> phoneNumberGlobalSet = new Set<String>();
    
    public Database.QueryLocator start(Database.BatchableContext bc){
        return Database.getQueryLocator([SELECT Id, Name,Phone,Formatted_Phone__c FROM Account WHERE Individual__c = Null AND Phone != null ORDER BY Formatted_Phone__c]);
    }

    public void execute(Database.BatchableContext bc, List<SObject> scope) {
        try {
            Set<String> phoneNumberSet = new Set<String>();
            for (Account accountInstance : (List<Account>)scope) {
                if (accountInstance.Formatted_Phone__c != null && ApexUtil.isValidPhoneNumber(accountInstance.Formatted_Phone__c) && !phoneNumberGlobalSet.contains(accountInstance.Formatted_Phone__c)) {
                    phoneNumberSet.add(accountInstance.Formatted_Phone__c);
                    phoneNumberGlobalSet.add(accountInstance.Formatted_Phone__c);
                }
            }
            if (!phoneNumberSet.isEmpty()) {
                Set<Id> individualIds = new Set<Id>();

                List<Account> accountsWithoutIndividuals = AccountData.queryAccountsWithoutIndividualReference(phoneNumberSet);
                List<Account> accountsToUpdateList = IndividualHandler.constructAccountsWithIndividual(phoneNumberSet, accountsWithoutIndividuals);
                if (accountsToUpdateList != null && !accountsToUpdateList.isEmpty()) {
                    performUpdateDML(accountsToUpdateList, individualIds);
                }

                List<Opportunity> opportunitiesWithoutIndividuals = OpportunityData.queryOpportunitiesWithoutIndividualReference(phoneNumberSet);
                Map<Opportunity,Individual> opportunitiesToUpdateList = IndividualHandler.constructOpportunitiesWithIndividual(phoneNumberSet, opportunitiesWithoutIndividuals);
                if (opportunitiesToUpdateList != null && !opportunitiesToUpdateList.isEmpty()) {
                    performUpdateDML(New List<Opportunity>(opportunitiesToUpdateList.keySet()), individualIds);
                }

                if (!individualIds.isEmpty()) {
                    List<Individual> individualsToUpdate = IndividualService.evaluateAndPopulateActiveEntities(individualIds);
                    if (individualsToUpdate != null && !individualsToUpdate.isEmpty()) {
                        performUpdateDML(individualsToUpdate, null);
                    }
                }
            }
            ApplicationLogger.insertStoredLogs();
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, null);
        }
    }

    public void finish(Database.BatchableContext bc) {
    }

    private static void performUpdateDML(List<SObject> sObjectDMLList, Set<Id> individualIds) {
        Database.SaveResult[] saveResults = Database.update(sObjectDMLList, false);
        Integer counter = 0;
        for (Database.SaveResult saveResult : saveResults) {
            if (saveResult.isSuccess() ) {
                if( individualIds != null){
                if (ApexUtil.getSObjectName(sObjectDMLList[counter].Id) == 'Account') {
                    Account accountRecord = (Account)sObjectDMLList[counter];
                    individualIds.add(accountRecord.Individual__c);
                } else if (ApexUtil.getSObjectName(sObjectDMLList[counter].Id) == 'Opportunity') {
                    Opportunity opportunityRecord = (Opportunity)sObjectDMLList[counter];
                    individualIds.add(opportunityRecord.Individual__c);
                }
                }
            } else {
                String errorMessage;
                for (Database.Error err : saveResult.getErrors()) {
                    errorMessage += err.getMessage() + '. ';
                }
                ApplicationLogger.logDMLException('DML Error in Batch_CreateIndividualsForExistRecords', saveResult.getId(), errorMessage, true);
            }
            counter++;
        }
    }
}