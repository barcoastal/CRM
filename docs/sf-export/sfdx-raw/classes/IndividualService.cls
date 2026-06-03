public inherited sharing class IndividualService {
    
    public static Map<String, Individual> createIndividuals(Map<String,String> phoneNumberNameMap) {
        Map<String, Individual> phoneNumberIndividualMap = new Map<String, Individual>();
        if (!phoneNumberNameMap.isEmpty()) {
            phoneNumberIndividualMap = prepareIndividualRecords(phoneNumberNameMap); 
            if (phoneNumberIndividualMap != null && !phoneNumberIndividualMap.isEmpty()) {
                insert phoneNumberIndividualMap.values();
            }
        }
        return phoneNumberIndividualMap;
    }
    
    private static Map<String, Individual> prepareIndividualRecords(Map<String, String> phoneNumberNameMap) {
        Map<String, Individual> individualMap = new Map<String, Individual>();
        for (String phone : phoneNumberNameMap.keySet()) {
            individualMap.put(phone, new Individual(Phone__c = phone, LastName = phoneNumberNameMap.get(phone)));
        }
        return individualMap;
    }
    
    public static List<Individual> evaluateAndPopulateActiveOppAndAcc(List<Individual> individualList){
        List<Individual> individualsToUpdate = new List<Individual>();
        Map<Id, List<Opportunity>> indIdOpportunityMap = getOpportunityMap(individualList);
        individualsToUpdate = populateIndividualEntities(individualList,indIdOpportunityMap,null);
        return individualsToUpdate;
    }

    public static List<Individual> evaluateAndPopulateActiveEntities(Set<Id> individualIds) {
        List<Individual> individualsToUpdate = new List<Individual>();
        if (!individualIds.isEmpty()) {
            Map<Id, List<Opportunity>> indIdOpportunityMap = getOpportunityMap(individualIds);
            Map<Id, List<Lead>> indIdLeadMap = getLeadMap(individualIds);
            individualsToUpdate = populateIndividualEntities(individualIds, indIdOpportunityMap, indIdLeadMap);
        }    
        return individualsToUpdate;
    }

    private static Map<Id, List<Opportunity>> getOpportunityMap(Set<Id> individualIds) {
        Map<Id, List<Opportunity>> opportunityMap = new Map<Id, List<Opportunity>>();
        for (Opportunity opp : OpportunityData.queryActiveIndividualOpportunities(individualIds)) {
            Id individualId = opp.Individual__c;
            if (!opportunityMap.containsKey(individualId)) {
                opportunityMap.put(individualId, new List<Opportunity>());
            }
            opportunityMap.get(individualId).add(opp);
        }
        return opportunityMap;
    }

    private static Map<Id, List<Lead>> getLeadMap(Set<Id> individualIds) {
        Map<Id, List<Lead>> leadMap = new Map<Id, List<Lead>>();
        for (Lead ld : LeadData.queryIndividualLeadRecords(individualIds)) {
            Id individualId = ld.IndividualId;
            if (!leadMap.containsKey(individualId)) {
                leadMap.put(individualId, new List<Lead>());
            }
            leadMap.get(individualId).add(ld);
        }
        return leadMap;
    }

     private static List<Individual> populateIndividualEntities(List<Individual> individualIds, Map<Id, List<Opportunity>> indIdOpportunityMap, Map<Id, List<Lead>> indIdLeadMap) {
        List<Individual> individualsToUpdate = new List<Individual>();
        for (Individual indId : individualIds) {
            List<Opportunity> activeOpportunities;
            List<Lead> activeLeads;
           // Individual ind = new Individual(Id = indId);
            if(indIdOpportunityMap != null && !indIdOpportunityMap.isEmpty()){
                if (indIdOpportunityMap.containsKey(indId.Id)) {
                    activeOpportunities = indIdOpportunityMap.get(indId.Id);
                }
            }
            if(indIdLeadMap != null && !indIdLeadMap.isEmpty()){
                if (indIdLeadMap.containsKey(indId.Id)) {
                    activeLeads = indIdLeadMap.get(indId.Id);
                } 
            }
            setActiveEntityFields(indId, activeOpportunities, activeLeads);
            individualsToUpdate.add(indId);
        }
        return individualsToUpdate;
    }

    private static List<Individual> populateIndividualEntities(Set<Id> individualIds, Map<Id, List<Opportunity>> indIdOpportunityMap, Map<Id, List<Lead>> indIdLeadMap) {
        List<Individual> individualsToUpdate = new List<Individual>();
        for (Id indId : individualIds) {
            List<Opportunity> activeOpportunities;
            List<Lead> activeLeads;
            Individual ind = new Individual(Id = indId);
            if (indIdOpportunityMap.containsKey(indId)) {
                activeOpportunities = indIdOpportunityMap.get(indId);
            }
            if (indIdLeadMap.containsKey(indId)) {
                activeLeads = indIdLeadMap.get(indId);
            } 
            setActiveEntityFields(ind, activeOpportunities, activeLeads);
            individualsToUpdate.add(ind);
        }
        return individualsToUpdate;
    }

    private static void setActiveEntityFields(Individual ind, List<Opportunity> activeOpportunities, List<Lead> activeLeads) {
        ind.Active_Lead__c = null;
        ind.Active_Opportunity__c = null;
        ind.Active_Account__c = null;
        if (activeOpportunities != null && !activeOpportunities.isEmpty()) {
            if (activeOpportunities.size() == 1) {
                ind.Active_Opportunity__c = activeOpportunities[0].Id;
                ind.Active_Account__c = activeOpportunities[0].AccountId;
                ind.Active_Entities_Assignment_Status__c = IndividualUtil.ACTIVE_ENTITY_ASSIGNED;
            } else {
                ind.Active_Entities_Assignment_Status__c = IndividualUtil.MULTIPLE_ACTIVE_OPPORTUNITIES;
            }
        } else  if (activeLeads != null && !activeLeads.isEmpty()) {
            List<lead> activeWebLeads = New List<Lead>();
            List<lead> activeNonWebLeads = New List<Lead>();
            if (activeLeads.size() == 1) {
                ind.Active_Lead__c = activeLeads[0].Id;
                ind.Active_Entities_Assignment_Status__c = IndividualUtil.ACTIVE_ENTITY_ASSIGNED;
            } else {
                for(lead leadInstance : activeLeads){
                    if(leadInstance.Lead_Source_Category__c == 'Web'){
                        activeWebLeads.add(leadInstance);
                   }else{
                       activeNonWebLeads.add(leadInstance);
                   }
                }
                lead activeLead = getActiveLead(activeWebLeads,activeNonWebLeads);
                ind.Active_Lead__c = activeLead.Id;
                ind.Active_Entities_Assignment_Status__c = IndividualUtil.MULTIPLE_ACTIVE_LEADS;
            }
        } else {
            ind.Active_Entities_Assignment_Status__c = IndividualUtil.NO_ACTIVE_ENTITIES;
        }
    }
    
    public static List<Individual> evaluateAndPopulateActiveEntities(List<Individual> individualsList) {
        List<Individual> individualsToUpdate = new List<Individual>();
        if (!individualsList.isEmpty()) {
            Map<Id, List<Opportunity>> indIdOpportunityMap = getOpportunityMap(individualsList);
            Map<Id, List<Lead>> indIdLeadMap = getLeadMap(individualsList);
            individualsToUpdate = populateIndividualEntities(individualsList, indIdOpportunityMap, indIdLeadMap);
        }    
        return individualsToUpdate;
    }
    
     private static Map<Id, List<Opportunity>> getOpportunityMap(List<Individual> individualsList) {
        Map<Id, List<Opportunity>> opportunityMap = new Map<Id, List<Opportunity>>();
        for (Opportunity opp : OpportunityData.queryActiveIndividualOpportunities(individualsList)) {
            Id individualId = opp.Individual__c;
            if (!opportunityMap.containsKey(individualId)) {
                opportunityMap.put(individualId, new List<Opportunity>());
            }
            opportunityMap.get(individualId).add(opp);
        }
        return opportunityMap;
    }
    
    private static Map<Id, List<Lead>> getLeadMap(List<Individual> individualsList) {
        Map<Id, List<Lead>> leadMap = new Map<Id, List<Lead>>();
        for (Lead ld : LeadData.queryIndividualLeadRecords(individualsList)) {
            Id individualId = ld.IndividualId;
            if (!leadMap.containsKey(individualId)) {
                leadMap.put(individualId, new List<Lead>());
            }
            leadMap.get(individualId).add(ld);
        }
        return leadMap;
    }

    private static Lead getActiveLead(List<Lead> webLeads,List<Lead> nonWebLeads){
        if (!webLeads.isEmpty()) {
            return getMostRecentLead(webLeads);
        } else if (!nonWebLeads.isEmpty()) {
            return getMostRecentLead(nonWebLeads);
        }
        return null;
    }
    
    private static Lead getMostRecentLead(List<Lead> leads) {
      Lead mostRecent = null;
        for (Lead l : leads) {
            if (mostRecent == null || l.LastModifiedDate > mostRecent.LastModifiedDate) {
                mostRecent = l;
            }
        }
    return mostRecent;
    }
}