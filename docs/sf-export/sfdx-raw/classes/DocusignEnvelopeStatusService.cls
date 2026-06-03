public inherited sharing class DocusignEnvelopeStatusService {
    
    //Method to get and process docusign document records based on the unqiue docusign Ids
    public static void processDocuments(Set<String> docusignIdSet) {

        Set<Id> sourceIdSet = new Set<Id>();
        Set<String> fileNameSet = new Set<String>();
        
        //Collect the document's source record Id and name
        for (dfsle__Document__c doc : DocusignDocumentData.getDocuments(docusignIdSet)) {
            sourceIdSet.add(doc.dfsle__Envelope__r.dfsle__SourceId__c);
            fileNameSet.add(doc.dfsle__FullName__c);
        }

        //Method call to delete the unsigned contracts based on the sourceId and file name
        if (!sourceIdSet.isEmpty() && !fileNameSet.isEmpty()) {
            deleteUnSignedContracts(sourceIdSet, fileNameSet);
        }
    }
    
    //Method to delete unsent docusign document from source record.
    public static void processUnSentDocuments(Set<String> docusignIdSet) {
        
        Set<String> envelopeTemplates = new Set<String>(System.Label.Docusign_Envelope_Name.Split(','));
        Integer documentCount = 0; 
        String docusignFullName = '';
        Set<Id> sourceIdSet = new Set<Id>();
        Set<String> fileNameSet = new Set<String>();
        Set<Id> contentDocumentIdSet = new Set<Id>();
        Set<Id> deleteDocumentIdSet = new Set<Id>();
        
        //Collect the document's source record Id and name
        for (dfsle__Document__c doc : DocusignDocumentData.getDocusignDocuments(docusignIdSet)) {
            if(doc.dfsle__Type__c == 'Template'){
                docusignFullName = doc.dfsle__FullName__c; 
            }else if(doc.dfsle__Type__c == 'ContentVersion'){
                sourceIdSet.add(doc.dfsle__Envelope__r.dfsle__SourceId__c);
                fileNameSet.add(doc.dfsle__FullName__c);
                documentCount++;
            }            
        }
        
        if(envelopeTemplates.contains(docusignFullName)){        
            DateTime conVersionCreatedDate;
            Integer i = 0;         
            
            //Collect the content document record Ids to delete the documents based on the linkedEntityId
            for (ContentDocumentLink cdl : ContentDocumentLinkData.getContentDocumentLinksByLinkedEntity(sourceIdSet)) {
                contentDocumentIdSet.add(cdl.ContentDocumentId);
            }             
            
            for(ContentVersion conVer :ContentVersionData.getContentVersions(contentDocumentIdSet)){                        
                if(i<=documentCount){
                    conVersionCreatedDate = conVer.CreatedDate;
                    if(conVersionCreatedDate == conVer.CreatedDate && !fileNameSet.contains(conVer.Title)){
                        deleteDocumentIdSet.add(conVer.ContentDocumentId);
                        i++;                        
                    }
                }          
            }
    
            //Delete the unsigned contracts (content documents)
            if (!deleteDocumentIdSet.isEmpty()) {
                delete ContentDocumentData.getContentDocuments(deleteDocumentIdSet);
            }
        }        
    }  
    
    /**Method to get the content documents based on the related source record Ids & the document names 
     * and delete the un-signed docusign contracts once the contract is signed.*/
    private static void deleteUnSignedContracts(Set<Id> sourceIdSet, Set<String> fileNameSet) {

        Set<Id> contentDocumentIdSet = new Set<Id>();
        
        //Collect the content document record Ids to delete the documents based on the linkedEntityId and the document name
        for (ContentDocumentLink cdl : ContentDocumentLinkData.getContentDocumentLinks(sourceIdSet, fileNameSet)) {
            contentDocumentIdSet.add(cdl.ContentDocumentId);
        }

        //Delete the unsigned contracts (content documents)
        if (!contentDocumentIdSet.isEmpty()) {
            delete ContentDocumentData.getContentDocuments(contentDocumentIdSet);
        }
    }
    
    //Method to get and process docusign document records based on the unqiue docusign Ids
    public static void updateContractSignedDateOnOppty(Set<String> oppIds) {
        List<Account> updateAccts = new List<Account>();
        for(Account acc: [SELECT Id, First_Contract_Signed_Date__c FROM Account WHERE Id IN (SELECT AccountId FROM Opportunity WHERE Id IN :oppIds)]){
            if(acc.First_Contract_Signed_Date__c == null){
                acc.First_Contract_Signed_Date__c = System.now();
                updateAccts.add(acc);
            }
        }
        
        if(!updateAccts.isEmpty()){
            update updateAccts;
        }
    }
    public static void updateOpportunity(Set<String> oppIds, String status) {
        List<Opportunity> oppRecords = new List<Opportunity>();
        for(String oppId : oppIds) {
            Opportunity opp = new Opportunity();
            opp.Id = oppId;
            opp.Bank_Change_Contract_Status__c = status;
            oppRecords.add(opp);
        }
        if(!oppRecords.isEmpty()){
            OpportunityLockService.disableOppLockForSystemUpdates();
 			update oppRecords;
            OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        }
    }
}