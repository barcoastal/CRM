/**
 * @Description: A dedicated class for doing the pre-processing before the API calls. 
 * The logic should be generic and not to be dependent on any particular payment processor.
 */
public inherited sharing class UploadContractsAPI {
    
    /**
     * @Description: A method to do the pre-processing of request construction and invoke the payment processor to do the API call
    */
    public static void uploadContracts(Set<Id> contentDocumentIds) {
        if (contentDocumentIds != null && !contentDocumentIds.isEmpty()) {
            Map<Id, Account> accountsToDMLMap = new Map<Id, Account>();
            Map<Id, Id> contDocIdLinkedEntityIdMap = constructContDocIdLinkedEntityIdMap(contentDocumentIds);
            if (contDocIdLinkedEntityIdMap != null && !contDocIdLinkedEntityIdMap.isEmpty()) {
                Map<Id, ContentVersion> contDocIdContVersionMap = constructContDocIdContVersionMap(contDocIdLinkedEntityIdMap.keySet());
                Set<Id> oppIds = new Set<Id>(contDocIdLinkedEntityIdMap.values());
                Map<Id, Account> oppIdAccountMap = constructOppIdAccountMap(oppIds);
                Map<Id, Program_Plan__c> oppIdProgramPlanMap = constructOppIdProgramPlanMap(oppIds);
                for (Id contDocumentId : contDocIdLinkedEntityIdMap.keySet()) {
                    Id oppId = contDocIdLinkedEntityIdMap.get(contDocumentId);
                    if (oppIdAccountMap.containsKey(oppId) && contDocIdContVersionMap.containsKey(contDocumentId)
                        && oppIdProgramPlanMap.containsKey(oppId)
                    ) {
                        Account acctReccord = oppIdAccountMap.get(oppId);
                        ContentVersion contVersionRecord = contDocIdContVersionMap.get(contDocumentId);
                        Program_Plan__c prgmPlan = oppIdProgramPlanMap.get(oppId);
                        FileWrapper fileWrap = new FileWrapper(acctReccord, contVersionRecord);
                        PaymentProcessor paymentProcInstance = ProcessorAPI.getInstance(prgmPlan.Payment_Processor__r.Processor_Type__c);
                        ProcessorWrapper.UploadContractRequest uploadContrReq = new ProcessorWrapper.UploadContractRequest();
                        uploadContrReq.fileWrap = fileWrap;
                        ProcessorWrapper.API_Response apiResponse = paymentProcInstance.uploadContract(uploadContrReq);
                        if (apiResponse != null) {
                            Account acctToDML;
                            if (accountsToDMLMap.containsKey(acctReccord.Id)) {
                                acctToDML = accountsToDMLMap.get(acctReccord.Id);
                            } else {
                                acctToDML = new Account();
                                acctToDML.Id = acctReccord.Id;
                            }
                            if (apiResponse.isSuccess == true) {
                                acctToDML.Contract_Sync_Status__c = 'In Sync';
                            } else {
                                acctToDML.Contract_Sync_Status__c = 'Sync Failed';
                                ApplicationLogger.logException(null, acctToDML.Id, apiResponse.message);
                            }
                            accountsToDMLMap.put(acctToDML.Id, acctToDML);
                        }  
                    }
                }
                update accountsToDMLMap.values();
                ApplicationLogger.insertStoredLogs();
            }   
        }
    }

    /**
     * @Description: A method to map the Content Document Id and the Linked Entity Id
    */
    private static Map<Id, Id> constructContDocIdLinkedEntityIdMap(Set<Id> contentDocumentIds) {
        Map<Id, Id> contDocIdLinkedEntityIdMap = new Map<Id, Id>();
        for (ContentDocumentLink contDocLink : ContentDocumentLinkData.queryContentDocumentLinks(contentDocumentIds)) {
            if (OpportunityUtil.isOppId(contDocLink.LinkedEntityId)) {
                contDocIdLinkedEntityIdMap.put(contDocLink.ContentDocumentId, contDocLink.LinkedEntityId);
            }
        }
        return contDocIdLinkedEntityIdMap;
    }

    /**
     * @Description: A method to map the Content Document Id and Content Version record
    */
    private static Map<Id, ContentVersion> constructContDocIdContVersionMap(Set<Id> contentDocumentIds) {
        Map<Id, ContentVersion> contDocIdContVersionMap = new Map<Id, ContentVersion>();
        for (ContentVersion contVersion : ContentVersionData.getContentVersions(contentDocumentIds)) {
            if (!contDocIdContVersionMap.containsKey(contVersion.ContentDocumentId)) {
                contDocIdContVersionMap.put(contVersion.ContentDocumentId, contVersion);
            }
        }
        return contDocIdContVersionMap;
    }

    /**
     * @Description: A method to map the Opportunity Id and the Account record
    */
    private static Map<Id, Account> constructOppIdAccountMap(Set<Id> oppIds) {
        Map<Id, Account> oppIdAccountMap = new Map<Id, Account>();
        for (Opportunity oppRecord : OpportunityData.queryOpportunities(oppIds)) {
            Account acctRecord = (Account)oppRecord.getSObject('Account');
            oppIdAccountMap.put(oppRecord.Id, acctRecord);
        }
        return oppIdAccountMap;
    }

    /**
     * @Description: A method to map the Opportunity Id and the Active Program Plan
    */
    private static Map<Id, Program_Plan__c> constructOppIdProgramPlanMap(Set<Id> oppIds) {
        Map<Id, Program_Plan__c> oppIdProgramPlanMap = new Map<Id, Program_Plan__c>();
        for (Program_Plan__c prgmPlan : ProgramPlanData.getActiveProgramPlansOfOpportunties(oppIds)) {
            oppIdProgramPlanMap.put(prgmPlan.Opportunity__c, prgmPlan);
        }
        return oppIdProgramPlanMap;
    }
}