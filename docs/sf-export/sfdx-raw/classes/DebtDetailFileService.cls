public inherited sharing class DebtDetailFileService {
 	@TestVisible
    private static Boolean throwExceptionForTest = false;
    
    public static void copyFilesFromParentToChildDebtDetails(Set<Id> opportunityIds) {
        try {
            
            if (throwExceptionForTest) {
                throw new IllegalArgumentException('Simulated exception for test coverage');
            }
            
            Map<Id, Debt_Details__c> childDetailsMap = DebtDetailsData.getChildDebtDetailsByOpportunities(opportunityIds);
    
            if (childDetailsMap.isEmpty()) {
                return;
            }
    
            Map<Id, Id> parentToChildMap = new Map<Id, Id>();
    
            for (Debt_Details__c child : childDetailsMap.values()) {
                parentToChildMap.put(child.Parent_Debt_Detail__c, child.Id);
            }
    
            List<ContentDocumentLink> parentCDLs = ContentDocumentLinkData.getContentDocumentLinksByLinkedEntity(parentToChildMap.keySet());
    
            List<ContentDocumentLink> cdlsToInsert = new List<ContentDocumentLink>();
            for (ContentDocumentLink parentCDL : parentCDLs) {
                Id childId = parentToChildMap.get(parentCDL.LinkedEntityId);
                if (childId == null) {
                    continue;
                }
                cdlsToInsert.add(ContentDocumentLinkHandler.createCDL(parentCDL.ContentDocumentId, childId));
            }
    
            if (!cdlsToInsert.isEmpty()) {
                List<Database.SaveResult> results = Database.insert(cdlsToInsert, false);
                for (Integer i = 0; i < results.size(); i++) {
                    if (!results[i].isSuccess()) {
                        String errorMessage = '';
                        for (Database.Error err : results[i].getErrors()) {
                            errorMessage += err.getMessage() + '. ';
                        }
                        ApplicationLogger.logDMLException(
                            'Copying ContentDocumentLinks from Parent to Child Debt Detail',cdlsToInsert[i].ContentDocumentId,errorMessage,true
                        );
                    }
                }
                ApplicationLogger.insertStoredLogs();
            }
        } catch (Exception ex) {
            ApplicationLogger.logDMLException(
                'copyFilesFromParentToChildDebtDetails',
                null,
                ex.getMessage() + ' | Line: ' + ex.getLineNumber(),
                true
            );
            ApplicationLogger.insertStoredLogs();
        }
    }
}