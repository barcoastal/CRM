public without sharing class DocumentController {
    @AuraEnabled(cacheable=true)
    public static List<Debt_Details__c> getDebtDetails(Id recordId) {
        List<Debt_Details__c> results = new List<Debt_Details__c>();
        String objectName = ApexUtil.getSObjectName(recordId);
        if (objectName == 'Opportunity') { // Opportunity
            results = DebtDetailsData.getDebtDetailByOppId(recordId);
        }if (objectName == 'Account'){
            results = DebtDetailsData.getDebtDetailByAcctId(recordId);
        }
        return results;
    }
    
    @AuraEnabled
    public static void saveDocumentDetails(String documentDetails) {
        DocumentDetailsWrapper doctDetails = (DocumentDetailsWrapper) JSON.deserialize(documentDetails, DocumentDetailsWrapper.class);
        try {
            String fileName;
            List<Opportunity> oppList = OpportunityData.queryOpportunity(doctDetails.oppId); 
            List<Account> accList = AccountData.queryAccount(doctDetails.accountId); 
            Opportunity oppRelatedToAcc = OpportunityData.getOpportunityId(doctDetails.accountId);
            String recordName = (doctDetails.accountId != null) ? accList[0].Name : oppList[0].Name; 
            if(String.isBlank(doctDetails.creditorName)){
                 fileName = recordName +'_'+ doctDetails.category + '_' + doctDetails.documentName;
            }
            else {
                 fileName = recordName +'_'+ doctDetails.category + '_' + doctDetails.creditorName + '_' + doctDetails.documentName;
            }

            ContentVersion cv = ContentVersionData.getContentVersion(doctDetails.fileId);
            cv.Title = fileName;
            update cv;
            
            List<ContentDocumentLink> cdlList = new List<ContentDocumentLink>();
            if ((doctDetails.accountId != null || oppList[0].AccountId != null) && doctDetails.fileId != null) {
                ContentDocumentLink contentDocumentLinkToAccount = new ContentDocumentLink();
                contentDocumentLinkToAccount.ContentDocumentId = doctDetails.fileId;                
                contentDocumentLinkToAccount.LinkedEntityId = doctDetails.accountId != null ? doctDetails.accountId : doctDetails.oppId != null ? oppList[0].AccountId :oppRelatedToAcc.AccountId;
                contentDocumentLinkToAccount.ShareType = 'V';
                cdlList.add(contentDocumentLinkToAccount);
            }
            if(doctDetails.oppId!= null || oppRelatedToAcc != null){
                ContentDocumentLink contentDocumentLinkToOpp = new ContentDocumentLink();
                contentDocumentLinkToOpp.ContentDocumentId = doctDetails.fileId;
                contentDocumentLinkToOpp.LinkedEntityId = doctDetails.oppId != null ? doctDetails.oppId : oppRelatedToAcc.Id;
                contentDocumentLinkToOpp.ShareType = 'V';
                cdlList.add(contentDocumentLinkToOpp);
            }
            
            if (!cdlList.isEmpty()) {
                insert cdlList;
            }
            // Create task
            Id taskRecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName('Task', 'Activity');
            Task ts = new Task();
            ts.Subject = fileName+' Uploaded';
            ts.WhatId = doctDetails.oppId;
            ts.RecordTypeId = taskRecordTypeId;
            ts.Status = 'Completed';
            insert ts;
        } catch (Exception e) {   
            ApplicationLogger.logException(e, doctDetails.oppId);
        }
    }
    
    @AuraEnabled
    public static void deleteDocument(Id recordId) {
        try {
            ContentDocument contDoc = [SELECT Id FROM ContentDocument WHERE Id = :recordId LIMIT 1];
            delete contDoc;
        } catch (Exception e) {
            ApplicationLogger.logException(e, recordId);
        }
    }
    
    public class DocumentDetailsWrapper {
        @AuraEnabled public Id accountId;
        @AuraEnabled public String documentName;
        @AuraEnabled public Id fileId;
        @AuraEnabled public Id oppId;
        @AuraEnabled public String category;
        @AuraEnabled public String creditorName;
    }
}