public inherited sharing class OpportunityAfterTriggerHelper {

  public static Map<Opportunity,Individual> createIndividualRecords() {
        Map<Opportunity,Individual> opportunityIndividualMap = new Map<Opportunity,Individual>();
        try {
            Set<String> phoneNumbersSet = new Set<String>();
            List<Opportunity> opportunitiesToProcessList = new List<Opportunity>();
            List<Opportunity>  opportunitiesToUpdate = new List<Opportunity>();
            List<Account> updateAccts = new List<Account>();
            List<Contact> updateConts = new List<Contact>();
            Map<Id, String> accPhoneMap = new Map<Id, String>();
            if (Trigger.isAfter && (Trigger.isInsert || Trigger.isUpdate)) {
                for (Opportunity opportunityInst : (List<Opportunity>) Trigger.new) {
                    if (opportunityInst.Formatted_Phone__c != null && ApexUtil.isValidPhoneNumber(opportunityInst.Formatted_Phone__c)) {
                        if (Trigger.isInsert || Trigger.isUpdate && opportunityInst.Phone__c != ((Opportunity)Trigger.oldMap.get(opportunityInst.Id)).Phone__c) {
                            phoneNumbersSet.add(opportunityInst.Formatted_Phone__c);
                            opportunitiesToProcessList.add(opportunityInst);
                            if(Trigger.isUpdate) {
                            accPhoneMap.put(opportunityInst.AccountId, opportunityInst.Phone__c);
                        }
                    }
                } 
                } 
                
                for(Account acc: [SELECT Id, primary_Contact__c,Phone FROM Account WHERE Id IN :accPhoneMap.keySet()]){                    
                    Account acctRecord = new Account(Id = acc.Id, phone = accPhoneMap.get(acc.Id)); 
                    if(acc.primary_Contact__c != null){
                        Contact contInstance = new Contact(Id = acc.primary_Contact__c, Phone = accPhoneMap.get(acc.Id));
                        updateConts.add(contInstance);
                    } 
                    updateAccts.add(acctRecord);      
                }
                
                if(!updateAccts.isEmpty()){
                    update updateAccts;
                }
                
                if(!updateConts.isEmpty()){
                    update updateConts;
                }
                
                if (!phoneNumbersSet.isEmpty()) {
                    opportunityIndividualMap = IndividualHandler.constructOpportunitiesWithIndividual(phoneNumbersSet, opportunitiesToProcessList);
                }
                
                if (opportunityIndividualMap != null && !opportunityIndividualMap.isEmpty()) {
                    OpportunityTriggerHandler.byPassOpportunityTrigger = true;
                    List<Opportunity> opportunitiesListToUpdate = new List<Opportunity>(opportunityIndividualMap.keySet());
                    update opportunitiesListToUpdate;
                    OpportunityTriggerHandler.byPassOpportunityTrigger = false;
                }
            }
            if(!opportunityIndividualMap.values().isEmpty()){
                List<Individual> individualsToUpate = new List<Individual>();
                individualsToUpate = IndividualService.evaluateAndPopulateActiveOppAndAcc(opportunityIndividualMap.values());
                update individualsToUpate;
            }
        } catch (Exception ex) {
            ApplicationLogger.logExceptionWithData(ex, null, null, ApplicationLogger.SEVERITY_HIGH);
        }
        return opportunityIndividualMap;
    }
    
    public static void removeActiveOppFormIndividual(){
        try{
            List<Individual> individualsToUpdate = New List<Individual>();
            Set<Id> inActiveOpportunities = New Set<Id>();
            if (Trigger.isAfter && (Trigger.isInsert || Trigger.isUpdate )) {  
                for(Opportunity oppInst : (List<Opportunity>) Trigger.new){
                  if (Trigger.isInsert || Trigger.isUpdate && oppInst.StageName != ((Opportunity)Trigger.oldMap.get(oppInst.Id)).StageName) {
                    if(OpportunityUtil.NOT_ACTIVE_STAGES.contains(oppInst.StageName)){
                        if(oppInst.Individual__c != Null ){
                                inActiveOpportunities.add(oppInst.Id);
                        } 
                    }
                  }
                }
            }
            List<Individual> individualsList = IndividualData.queryIndividaulsByActiveOpportunity(inActiveOpportunities);
            for(Individual ind: individualsList){
                if(OpportunityUtil.NOT_ACTIVE_STAGES.contains(ind.Active_Opportunity__r.stageName)){
                  ind.Active_Opportunity__c = Null;
                  ind.Active_Account__c = Null;
                  ind.Active_Entities_Assignment_Status__c = IndividualUtil.NO_ACTIVE_ENTITIES;
                  individualsToUpdate.add(ind);
                }
            }
            update individualsToUpdate;
        }catch(Exception ex){
          ApplicationLogger.logExceptionWithData(ex, null, null, ApplicationLogger.SEVERITY_HIGH);
        }
    }  
    
    public static void handleFirstPayment(List<Opportunity> newOpps, Map<Id, Opportunity> oldMap) {
        List<First_Payment_Collection__c> collectionsToInsert = new List<First_Payment_Collection__c>();
        
        Set<Id> oppIds = new Set<Id>();
        List<Opportunity> eligibleOppsList = New List<Opportunity>();
        for (Opportunity opp : newOpps) {
            if (opp.First_Payment_Completed_Date__c != null && 
                opp.First_Payment_Completed_Date__c != oldMap.get(opp.Id).First_Payment_Completed_Date__c) {
                oppIds.add(opp.Id);
                eligibleOppsList.add(opp);
            }
        }

        if (oppIds.isEmpty()) return;

        try {
          
            Map<Id, Draft__c> oppToFirstDraftMap = new Map<Id, Draft__c>();
                        
            for (Draft__c draftRecord :  DraftData.completedDraftsByOppIds(oppIds)) {
                Id oppId = draftRecord.Program_Plan__r.Opportunity__c;
                
                if (!oppToFirstDraftMap.containsKey(oppId)) {
                    oppToFirstDraftMap.put(oppId, draftRecord);
                }
            }
            
            for (Opportunity opp : eligibleOppsList) {
                if (oppToFirstDraftMap.containsKey(opp.Id)) {
                    Draft__c firstDraft = oppToFirstDraftMap.get(opp.Id);
                    
                    collectionsToInsert.add(new First_Payment_Collection__c(
                        Closer__c = opp.OwnerId,
                        Opportunity__c = opp.Id,
                        First_Payment_Completed_Date__c = opp.First_Payment_Completed_Date__c,
                        First_Payment_Amount__c = firstDraft.Draft_Total_Amount__c,
                        Total_Debt_Amount__c = opp.Current_Total_Debt__c
                    ));
                }
            }
            if (!collectionsToInsert.isEmpty()) {
                DMLService.performInsertDML(collectionsToInsert,'handleFirstPayment');
            }

        } catch (Exception ex) {
            ApplicationLogger.logExceptionWithData(ex, null, 'Commission Structure Error',null, ApplicationLogger.SEVERITY_HIGH);
        }
    }
}