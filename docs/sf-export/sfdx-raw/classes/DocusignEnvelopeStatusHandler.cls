public without sharing class DocusignEnvelopeStatusHandler extends TriggerHandler {
    
    private Map<Id, dfsle__EnvelopeStatus__c> envelopeStatusOldMap;

    public DocusignEnvelopeStatusHandler() {
        this.envelopeStatusOldMap = (Map<Id, dfsle__EnvelopeStatus__c>) Trigger.oldMap;
    }
    
    //Method to execute logic in the after insert trigger event.
    public override void afterInsert() {
        processEnvelopeStatus();
    }
    
    //Method to execute logic in the before update trigger event.
    public override void afterUpdate() {
        processEnvelopeStatus();
    }

    //Method to loop over and process all the enveloper status records.
    private void processEnvelopeStatus() {
        
        Set<String> completedDocuSignIdSet = new Set<String>();
        Set<String> sentDocusignOppIdSet = new Set<String>();
        Set<String> completedDocusignOppIdSet = new Set<String>();
        Set<String> oppIds = new Set<String>();
        
        Set<Id> oppRecordIds = new Set<Id>();
        
        for (dfsle__EnvelopeStatus__c env :  (List<dfsle__EnvelopeStatus__c>)Trigger.new) {
            if (Trigger.isUpdate && env.dfsle__Opportunity__c != null) {
                oppRecordIds.add(env.dfsle__Opportunity__c);
            }
        }
        Map<Id, Opportunity> oppMap = OpportunityData.queryOpportunityMapByOppIds(oppRecordIds);

        for (dfsle__EnvelopeStatus__c envelopeStatus : (List<dfsle__EnvelopeStatus__c>)Trigger.new) {

            //Filter only the Completed Status to collect the Docusign Id.
            if (Trigger.isUpdate && hasCompletedStatus(envelopeStatus)) {
                completedDocuSignIdSet.add(envelopeStatus.dfsle__DocuSignId__c);
                if(envelopeStatus.dfsle__Opportunity__c != null){
                    oppIds.add(envelopeStatus.dfsle__Opportunity__c);
                }  
                if(envelopeStatus.dfsle__Opportunity__c != null && 
                   oppMap.get(envelopeStatus.dfsle__Opportunity__c).Bank_Change_Contract_Status__c == 'Pending'){
                 	completedDocusignOppIdSet.add(envelopeStatus.dfsle__Opportunity__c);
                }
            }
            if(Trigger.isUpdate && hasSentStatus(envelopeStatus)) {
                if(envelopeStatus.dfsle__Opportunity__c != null && 
                  oppMap.get(envelopeStatus.dfsle__Opportunity__c).Lock_Opportunity__c){
                 sentDocusignOppIdSet.add(envelopeStatus.dfsle__Opportunity__c);
                }
            }
            /*else if(hasSentStatus(envelopeStatus)){
                sentDocuSignIdSet.add(envelopeStatus.dfsle__DocuSignId__c);
            }*/
        }

        if (!completedDocuSignIdSet.isEmpty()) {
            //Method call to process the docusign documents based on the unique Docusign Id.
            DocusignEnvelopeStatusService.processDocuments(completedDocuSignIdSet);
        }
        
        //Commented deleted unsigned contracts functionality
        /*if(!sentDocuSignIdSet.isEmpty()){
            DocusignEnvelopeStatusService.processUnSentDocuments(sentDocuSignIdSet);
        }*/
        
        if(!sentDocusignOppIdSet.isEmpty()) {
            DocusignEnvelopeStatusService.updateOpportunity(sentDocusignOppIdSet, 'Pending');
        }
        if(!completedDocusignOppIdSet.isEmpty()) {
        	DocusignEnvelopeStatusService.updateOpportunity(completedDocusignOppIdSet, 'Completed');
        }
        if(!oppIds.isEmpty()){
            DocusignEnvelopeStatusService.updateContractSignedDateOnOppty(oppIds);
        }
    }

    //method to check if the updated envelope status record has Completed status
    private Boolean hasCompletedStatus(dfsle__EnvelopeStatus__c envelopeStatus) {

        return (
            envelopeStatus.dfsle__Status__c != this.envelopeStatusOldMap.get(envelopeStatus.Id).dfsle__Status__c 
            && envelopeStatus.dfsle__Status__c.equals('Completed')
        );
    }
    
    //method to check if the updated envelope status record has Sent status
    private Boolean hasSentStatus(dfsle__EnvelopeStatus__c envelopeStatus) {

        return (
           envelopeStatus.dfsle__Status__c.equals('Sent')
        );
    }
}