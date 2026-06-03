public without sharing class Batch_CreateIndividualsForExistRecords implements Database.Batchable<SObject>, Database.Stateful {

    public Set<String> phoneNumberGlobalSet = new Set<String>();
    
    public Database.QueryLocator start(Database.BatchableContext bc){
        String mdtFieldsList = fetchLeadFieldsMappingMdt();

        return Database.getQueryLocator('SELECT  Id, Phone, Formated_Phone__c,OwnerId,LeadSource,Status,Alternate_Email__c, '+ mdtFieldsList +' FROM Lead WHERE IndividualId = null AND Phone != null ORDER BY Formated_Phone__c ');
    }

    public void execute(Database.BatchableContext bc, List<SObject> scope) {
        try {
            Set<String> phoneNumberSet = new Set<String>();
            for (Lead leadInstance : (List<Lead>)scope) {
                if (leadInstance.Formated_Phone__c != null && ApexUtil.isValidPhoneNumber(leadInstance.Formated_Phone__c) && !phoneNumberGlobalSet.contains(leadInstance.Formated_Phone__c)) {
                    phoneNumberSet.add(leadInstance.Formated_Phone__c);
                    phoneNumberGlobalSet.add(leadInstance.Formated_Phone__c);
                }
            }
            if (!phoneNumberSet.isEmpty()) {
                Set<Id> individualIds = new Set<Id>();

                List<Lead> leadsWithoutIndividuals = LeadData.queryLeadsWithoutIndividualReference(phoneNumberSet);
                Map<Lead,Individual> leadsToUpdateMap = IndividualHandler.constructLeadsWithIndividual(phoneNumberSet, leadsWithoutIndividuals);
                if (leadsToUpdateMap != null && !leadsToUpdateMap.isEmpty()) {
                    performUpdateDML(new List<Lead>(leadsToUpdateMap.keySet()), individualIds);
                }

                List<Account> accountsWithoutIndividuals = AccountData.queryAccountsWithoutIndividualReference(phoneNumberSet);
                List<Account> accountsToUpdateList = IndividualHandler.constructAccountsWithIndividual(phoneNumberSet, accountsWithoutIndividuals);
                if (accountsToUpdateList != null && !accountsToUpdateList.isEmpty()) {
                    performUpdateDML(accountsToUpdateList, individualIds);
                }

                List<Opportunity> opportunitiesWithoutIndividuals = OpportunityData.queryOpportunitiesWithoutIndividualReference(phoneNumberSet);
                Map<Opportunity,Individual> opportunitiesToUpdateList = IndividualHandler.constructOpportunitiesWithIndividual(phoneNumberSet, opportunitiesWithoutIndividuals);
                if (opportunitiesToUpdateList != null && !opportunitiesToUpdateList.isEmpty()) {
                    performUpdateDML(new List<Opportunity>(opportunitiesToUpdateList.keySet()), individualIds);
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
    
    private static String fetchLeadFieldsMappingMdt() {
        Set<String> fetchLeadFieldsMappingMdt = new Set<String>();
        for (Append_Leads_Mapping__mdt mapping : AppendLeadsMappingData.queryAppendLeadsMappingForBatch()) {
            fetchLeadFieldsMappingMdt.add(mapping.Target_Field__c);
        }
        return  String.join(new List<String>(fetchLeadFieldsMappingMdt),',');
    }

    private static void performUpdateDML(List<SObject> sObjectDMLList, Set<Id> individualIds) {
        Database.SaveResult[] saveResults = Database.update(sObjectDMLList, false);
        Integer counter = 0;
        for (Database.SaveResult saveResult : saveResults) {
            if (saveResult.isSuccess() ) {
                if(individualIds != null){
                if (ApexUtil.getSObjectName(sObjectDMLList[counter].Id) == 'Lead') {
                    Lead leadRecord = (Lead)sObjectDMLList[counter];
                    individualIds.add(leadRecord.IndividualId);
                } else if (ApexUtil.getSObjectName(sObjectDMLList[counter].Id) == 'Account') {
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