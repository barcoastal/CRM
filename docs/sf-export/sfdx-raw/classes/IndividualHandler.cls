public inherited sharing class IndividualHandler {

    public static Map<Lead,Individual> constructLeadsWithIndividual(Set<String> phoneNumberSet, List<Lead> leadsToProcessList) {
        List<Lead> leadsToUpdateList = new List<Lead>();
        Map<lead,Individual> leadIdToIndividualMap = new Map<lead, Individual>();
        if (phoneNumberSet != null && !phoneNumberSet.isEmpty() && leadsToProcessList != null && !leadsToProcessList.isEmpty()) {
            Map<String, Individual> phoneToIndividualMap = getIndividualsByPhone(phoneNumberSet);
            List<Lead> leadsDontHaveIndividualList = new List<Lead>();
            Map<String, String> phoneNumberNameMap = new Map<String, String>();
            for (Lead leadInstance : leadsToProcessList) {
                if (phoneToIndividualMap.containsKey(leadInstance.Formated_Phone__c)) {
                    Lead leadInstanceToUpdate = populateIndividualIdInLead(leadInstance, phoneToIndividualMap);
                    leadsToUpdateList.add(leadInstanceToUpdate);
                    leadIdToIndividualMap.put(leadInstanceToUpdate,phoneToIndividualMap.get(leadInstance.Formated_Phone__c));
                } else {
                    leadsDontHaveIndividualList.add(leadInstance);
                    phoneNumberNameMap.put(leadInstance.Formated_Phone__c, leadInstance.LastName);
                }
            }
            if (!phoneNumberNameMap.isEmpty()) {
                Map<String, Individual> phoneNewIndividualMap = IndividualService.createIndividuals(phoneNumberNameMap);
                for (Lead leadInstance : leadsDontHaveIndividualList) {
                    if (phoneNewIndividualMap.containsKey(leadInstance.Formated_Phone__c)) {
                        Lead leadInstanceToUpdate = populateIndividualIdInLead(leadInstance, phoneNewIndividualMap);
                        leadsToUpdateList.add(leadInstanceToUpdate);
                        leadIdToIndividualMap.put(leadInstanceToUpdate,phoneNewIndividualMap.get(leadInstance.Formated_Phone__c));
                    }
                }
            }
        }
        return leadIdToIndividualMap;
    }

    private static Lead populateIndividualIdInLead(Lead leadInstance, Map<String, Individual> phoneIndividualMap) {
        Lead leadInstanceToUpdate = new Lead();
        leadInstanceToUpdate.Id = leadInstance.Id;
        LeadUtil.constructLeadWithAppendLeadMappingMdt(leadInstance,leadInstanceToUpdate);
        leadInstanceToUpdate.IndividualId = phoneIndividualMap.get(leadInstance.Formated_Phone__c).Id;
        leadInstanceToUpdate.Phone = leadInstance.Phone;
        return leadInstanceToUpdate;
    }

    public static List<Account> constructAccountsWithIndividual(Set<String> phoneNumberSet, List<Account> accountsToProcessList) {
        List<Account> accountsToUpdateList = new List<Account>();
        if (phoneNumberSet != null && !phoneNumberSet.isEmpty() && accountsToProcessList != null && !accountsToProcessList.isEmpty()) {
            Map<String, Individual> phoneToIndividualMap = getIndividualsByPhone(phoneNumberSet);
            List<Account> accountsDontHaveIndividualList = new List<Account>();
            Map<String, String> phoneNumberNameMap = new Map<String, String>();
            for (Account accountInstance : accountsToProcessList) {
                if (phoneToIndividualMap.containsKey(accountInstance.Formatted_Phone__c)) {
                    Account accountInstanceToUpdate = populateIndividualIdInAccount(accountInstance, phoneToIndividualMap);
                    accountsToUpdateList.add(accountInstanceToUpdate);
                } else {
                    accountsDontHaveIndividualList.add(accountInstance);
                    phoneNumberNameMap.put(accountInstance.Formatted_Phone__c, accountInstance.Name);
                }
            }
            if (!phoneNumberNameMap.isEmpty()) {
                Map<String, Individual> phoneNewIndividualMap = IndividualService.createIndividuals(phoneNumberNameMap);
                for (Account accountInstance : accountsDontHaveIndividualList) {
                    if (phoneNewIndividualMap.containsKey(accountInstance.Formatted_Phone__c)) {
                        Account accountInstanceToUpdate = populateIndividualIdInAccount(accountInstance, phoneNewIndividualMap);
                        accountsToUpdateList.add(accountInstanceToUpdate);
                    }
                }
            }
        }
        return accountsToUpdateList;
    }

    private static Account populateIndividualIdInAccount(Account accountInstance, Map<String, Individual> phoneIndividualMap) {
        Account accountInstanceToUpdate = new Account();
        accountInstanceToUpdate.Id = accountInstance.Id;
        accountInstanceToUpdate.Individual__c = phoneIndividualMap.get(accountInstance.Formatted_Phone__c).Id;
        return accountInstanceToUpdate;
    }

    public static Map<Opportunity,Individual> constructOpportunitiesWithIndividual(Set<String> phoneNumberSet, List<Opportunity> opportunitiesToProcessList) {
        List<Opportunity> opportunitiesToUpdateList = new List<Opportunity>();
        Map<Opportunity,Individual> oppotunityToIndividualMap = new Map<Opportunity, Individual>();
        if (phoneNumberSet != null && !phoneNumberSet.isEmpty() && opportunitiesToProcessList != null && !opportunitiesToProcessList.isEmpty()) {
            Map<String, Individual> phoneToIndividualMap = getIndividualsByPhone(phoneNumberSet);
            List<Opportunity> opportunitiesDontHaveIndividualList = new List<Opportunity>();
            Map<String, String> phoneNumberNameMap = new Map<String, String>();
            for (Opportunity opportunityInstance : opportunitiesToProcessList) {
                if (phoneToIndividualMap.containsKey(opportunityInstance.Formatted_Phone__c)) {
                    Opportunity opportunityInstanceToUpdate = populateIndividualIdInOpportunity(opportunityInstance, phoneToIndividualMap);
                    opportunitiesToUpdateList.add(opportunityInstanceToUpdate);
                    oppotunityToIndividualMap.put(opportunityInstanceToUpdate,phoneToIndividualMap.get(opportunityInstance.Formatted_Phone__c));
                } else {
                    opportunitiesDontHaveIndividualList.add(opportunityInstance);
                    phoneNumberNameMap.put(opportunityInstance.Formatted_Phone__c, opportunityInstance.Name);
                }
            }
            if (!phoneNumberNameMap.isEmpty()) {
                Map<String, Individual> phoneNewIndividualMap = IndividualService.createIndividuals(phoneNumberNameMap);
                for (Opportunity opportunityInstance : opportunitiesDontHaveIndividualList) {
                    if (phoneNewIndividualMap.containsKey(opportunityInstance.Formatted_Phone__c)) {
                        Opportunity opportunityInstanceToUpdate = populateIndividualIdInOpportunity(opportunityInstance, phoneNewIndividualMap);
                        opportunitiesToUpdateList.add(opportunityInstanceToUpdate);
                        oppotunityToIndividualMap.put(opportunityInstanceToUpdate,phoneNewIndividualMap.get(opportunityInstance.Formatted_Phone__c));
                    }
                }
            }
        }
        return oppotunityToIndividualMap;
    }

    private static Opportunity populateIndividualIdInOpportunity(Opportunity opportunityInstance, Map<String, Individual> phoneIndividualMap) {
        Opportunity opportunityInstanceToUpdate = new Opportunity();
        opportunityInstanceToUpdate.Id = opportunityInstance.Id;
        opportunityInstanceToUpdate.Individual__c = phoneIndividualMap.get(opportunityInstance.Formatted_Phone__c).Id;
        return opportunityInstanceToUpdate;
    }

    private static Map<String,Individual> getIndividualsByPhone(Set<String> phoneSet) {
        Map<String,Individual> phoneToIndividualMap = new Map<String,Individual>();
        List<Individual> individualsWithoutActiveLookup = new List<Individual>();
        for (Individual individualInstance : IndividualData.queryIndividualByPhone(phoneSet)) {
            if(individualInstance.Active_Lead__c == Null && individualInstance.Active_Opportunity__c == Null){
                individualsWithoutActiveLookup.add(individualInstance);
            }else{
           phoneToIndividualMap.put(individualInstance.Phone__c, individualInstance);
       }
        }
        if(!individualsWithoutActiveLookup.isEmpty()){
            List<Individual> individaulsToupdate = IndividualService.evaluateAndPopulateActiveEntities(individualsWithoutActiveLookup);
            update individaulsToupdate;
            for(Individual individualInstance : individaulsToupdate){
               phoneToIndividualMap.put(individualInstance.Phone__c, individualInstance);
            }
        }
      
       return phoneToIndividualMap;
    }
}