/**
 * @description: Class to query all the Files related data
**/
public inherited sharing class FileData {

    /**
     * @description: Querying the blob content of the latest active SAS contract of the opportunity record
    **/
    public static Blob getContractData(Opportunity oppRecord) {
        Blob contractData;
        List<ContentDocumentLink> contentDocumentLinkList = [SELECT Id, ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = :oppRecord.Id];
        if (contentDocumentLinkList != null && !contentDocumentLinkList.isEmpty()) {
            Set<Id> contentDocumentIds = new Set<Id>();
            for (ContentDocumentLink contentDocLink : contentDocumentLinkList) {
                contentDocumentIds.add(contentDocLink.ContentDocumentId);
            }
            if (!contentDocumentIds.isEmpty()) {
                String sasAggreementName = 'SAS Agreement%';
                String statusValue = '%' + FileUtil.DOCUMENT_SYNC_END_FORMAT + '%';
                for (ContentVersion contVersion : [SELECT Id, Title, VersionData FROM ContentVersion WHERE ContentDocumentId IN :contentDocumentIds 
                    AND ContentDocument.Title LIKE :sasAggreementName AND ContentDocument.Title LIKE :statusValue ORDER BY CreatedDate DESC]
                ) {
                    List<String> titleSplits = contVersion.Title.split('_');
                    if (contVersion.Title.startsWithIgnoreCase('SAS Agreement') && contVersion.Title.endsWithIgnoreCase('_completed.pdf')) {
                        contractData = contVersion.VersionData;
                        break;
                    }
                }
            }
        }
        return contractData;
    }

    /**
     * @description: Querying the blob content of the latest active SAS contract of the opportunity record
    **/
    public static Set<Id> getContentDocumentIdsForSync(Opportunity oppRecord) {
        Map<String, Id> documentTypeContractIdMap = new Map<String, Id>();
        List<ContentDocumentLink> contentDocumentLinkList = [SELECT Id, ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = :oppRecord.Id ORDER BY Id DESC];
        if (contentDocumentLinkList != null && !contentDocumentLinkList.isEmpty()) {
            Set<Id> contentDocumentIds = new Set<Id>();
            for (ContentDocumentLink contentDocLink : contentDocumentLinkList) {
                contentDocumentIds.add(contentDocLink.ContentDocumentId);
            }
            if (!contentDocumentIds.isEmpty()) {
                String documentSyncEndFormat = '%' + FileUtil.DOCUMENT_SYNC_END_FORMAT + '%';
                for (ContentVersion contVersion : [SELECT Id, ContentDocument.Title, VersionData, ContentDocumentId FROM ContentVersion WHERE ContentDocumentId IN :contentDocumentIds 
                    AND ContentDocument.Title LIKE :documentSyncEndFormat ORDER BY CreatedDate DESC]
                ) {
                    String title = contVersion.ContentDocument.Title;
                    if (title.endsWithIgnoreCase('.pdf')) {
                        title = title.removeEnd('.pdf');
                    }
                    if (title.endsWithIgnoreCase(FileUtil.DOCUMENT_SYNC_END_FORMAT)) {
                        String fileFormatNameForSync = FileUtil.getFileFormatNameForSync(title, oppRecord.Name);
                        if (oppRecord.Processor__c != null && oppRecord.Processor__c == OpportunityUtil.SAS_PROCESSOR_TYPE && String.isNotBlank(fileFormatNameForSync)
                            && fileFormatNameForSync != FileUtil.AGREEMENT_SAS && fileFormatNameForSync != FileUtil.AGREEMENT_RAM) {
                            Boolean isVLPAffiliate = oppRecord.Legal_Network__c == FileUtil.AGREEMENT_VICTORY;
                            Boolean isCitadelAffiliate = oppRecord.Legal_Network__c == FileUtil.CITADEL_LEGAL_PLAN;
                            if (!(isVLPAffiliate && fileFormatNameForSync == FileUtil.AGREEMENT_CITADEL)
                                && !(isCitadelAffiliate && fileFormatNameForSync == FileUtil.AGREEMENT_VICTORY)
                                && !documentTypeContractIdMap.containsKey(fileFormatNameForSync)) {
                                documentTypeContractIdMap.put(fileFormatNameForSync, contVersion.ContentDocumentId);
                            }
                            if (documentTypeContractIdMap.size() == 2) {
                                break;
                            }
                        } else if(oppRecord.Processor__c != null && oppRecord.Processor__c == OpportunityUtil.RAM_PROCESSOR_TYPE && String.isNotBlank(fileFormatNameForSync) && fileFormatNameForSync == FileUtil.AGREEMENT_RAM){
                            if (!documentTypeContractIdMap.containsKey(fileFormatNameForSync)) {
                                documentTypeContractIdMap.put(fileFormatNameForSync, contVersion.ContentDocumentId);
                            }
                        }
                        //SAS Agreement will sync as part of client sync api call itself. So, no need to sync it again in the upload contract api call.
                        documentTypeContractIdMap.remove(FileUtil.AGREEMENT_SAS);
                    }
                }
            }
        }
        return new Set<Id>(documentTypeContractIdMap.values());
    }  
    
    /**
     * @description: Querying the blob content of active Citadel contract of the opportunity record
    **/
    public static ContentVersion getCitadelContractData(Opportunity oppRecord) {
        ContentVersion con = new ContentVersion();
        List<ContentDocumentLink> contentDocumentLinkList = [SELECT Id, ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = :oppRecord.Id];
        if (contentDocumentLinkList != null && !contentDocumentLinkList.isEmpty()) {
            Set<Id> contentDocumentIds = new Set<Id>();
            for (ContentDocumentLink contentDocLink : contentDocumentLinkList) {
                contentDocumentIds.add(contentDocLink.ContentDocumentId);
            }
            if (!contentDocumentIds.isEmpty()) {
                String fileName = '%' + oppRecord.Name + '%';
                String citadelAggreementName = FileUtil.AGREEMENT_CITADEL+'%';
                String statusValue = '%Completed%';
                for (ContentVersion contVersion : [SELECT Id, Title, VersionData FROM ContentVersion WHERE ContentDocumentId IN :contentDocumentIds 
                    AND ContentDocument.Title LIKE :citadelAggreementName AND ContentDocument.Title LIKE :fileName AND ContentDocument.Title LIKE :statusValue ORDER BY CreatedDate DESC]
                ) {
                    List<String> titleSplits = contVersion.Title.split('_');
                    if (contVersion.Title.startsWithIgnoreCase(FileUtil.AGREEMENT_CITADEL) && contVersion.Title.endsWithIgnoreCase('_completed.pdf')) {
                        con = contVersion;
                        break;
                    }
                }
            }
        }
        return con;
    }  
    
    /**
     * @description: Querying the blob content of driver's license document of the opportunity record
    **/
    /*public static ContentVersion getDriverLicenceDocument(Opportunity oppRecord) {
        ContentVersion con;
        List<ContentDocumentLink> contentDocumentLinkList = [SELECT Id, ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = :oppRecord.Id];
         Set<Id> contentDocumentIds = new Set<Id>();
         String doucmentType = 'Driver' + '%';
        if (contentDocumentLinkList != null && !contentDocumentLinkList.isEmpty()) {           
            for (ContentDocumentLink contentDocLink : contentDocumentLinkList) {
                contentDocumentIds.add(contentDocLink.ContentDocumentId);
            }
            if (!contentDocumentIds.isEmpty()) { 
               List<ContentVersion> contVersions = [SELECT Id, Title, ContentDocumentId,Document_Type__c FROM ContentVersion WHERE ContentDocumentId IN :contentDocumentIds 
                    AND Document_Type__c LIKE :doucmentType ORDER BY CreatedDate DESC];
                    System.debug(':::contVersions:'+contVersions);
               if(!contVersions.isEmpty()){
                   con = contVersions[0]; 
               }                              
            }
        }
        return con;
    }*/
    
    /**
     * @description: Querying the blob content of the latest active SAS contract of the opportunity record
     * @param aggreementName- Aggreement Name like SAS, Costal & Citadel
     * @return ContentVersion - returns the ContentVersion record.
    **/
    /*public static ContentVersion getContentVersion(Opportunity oppRecord, String aggreementName) {
        ContentVersion con;
        List<ContentDocumentLink> contentDocumentLinkList = [SELECT Id, ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = :oppRecord.Id];
        if (contentDocumentLinkList != null && !contentDocumentLinkList.isEmpty()) {
            Set<Id> contentDocumentIds = new Set<Id>();
            for (ContentDocumentLink contentDocLink : contentDocumentLinkList) {
                contentDocumentIds.add(contentDocLink.ContentDocumentId);
            }
            if (!contentDocumentIds.isEmpty()) {
                String fileName = '%' + oppRecord.Name + '%';
                String filterAggreementName = aggreementName +'%';
                String statusValue = '%Completed%';
                for (ContentVersion contVersion : [SELECT Id, Title, VersionData,ContentDocumentId FROM ContentVersion WHERE ContentDocumentId IN :contentDocumentIds 
                    AND ContentDocument.Title LIKE :filterAggreementName AND ContentDocument.Title LIKE :fileName AND ContentDocument.Title LIKE :statusValue ORDER BY CreatedDate DESC]
                ) {
                    List<String> titleSplits = contVersion.Title.split('_');
                    if (contVersion.Title.startsWithIgnoreCase(aggreementName) && contVersion.Title.endsWithIgnoreCase('_completed.pdf')) {
                        con = contVersion;
                        break;
                    }
                }
            }
        }
        return con;
    }*/
    
     /**
     * @description: Querying the blob content of the latest active contracts of the opportunity record
    **/
    /*public static Map<String, Id> getContentDocumentIdsForRAMContractSync(Opportunity oppRecord) {
        Map<String, Id> documentTypeContractIdMap = new Map<String,Id>();
        List<ContentDocumentLink> contentDocumentLinkList = [SELECT Id, ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = :oppRecord.Id ORDER BY Id DESC];
        if (contentDocumentLinkList != null && !contentDocumentLinkList.isEmpty()) {
            Set<Id> contentDocumentIds = new Set<Id>();
            for (ContentDocumentLink contentDocLink : contentDocumentLinkList) {
                contentDocumentIds.add(contentDocLink.ContentDocumentId);
            }
            if (!contentDocumentIds.isEmpty()) {
                String documentSyncEndFormat = '%' + FileUtil.DOCUMENT_SYNC_END_FORMAT + '%';
                for (ContentVersion contVersion : [SELECT Id, ContentDocument.Title, VersionData, ContentDocumentId,Document_Type__c FROM ContentVersion WHERE ContentDocumentId IN :contentDocumentIds 
                    AND ContentDocument.Title LIKE :documentSyncEndFormat ORDER BY CreatedDate DESC]
                ) {
                    String title = contVersion.ContentDocument.Title;
                    if (title.endsWithIgnoreCase('.pdf')) {
                        title = title.removeEnd('.pdf');
                    }
                    if (title.endsWithIgnoreCase(FileUtil.DOCUMENT_SYNC_END_FORMAT)) {
                        String fileFormatNameForSync = FileUtil.getFileFormatNameForSync(title, oppRecord.Name);
                        if (String.isNotBlank(fileFormatNameForSync) && fileFormatNameForSync != FileUtil.AGREEMENT_SAS) {
                            if (!documentTypeContractIdMap.containsKey(fileFormatNameForSync)) {
                                documentTypeContractIdMap.put(fileFormatNameForSync, contVersion.ContentDocumentId);
                            }
                            if (documentTypeContractIdMap.size() == 3) {
                                break;
                            }
                        }
                    }
                }
            }
        }
        return documentTypeContractIdMap;
    }*/ 
    
}