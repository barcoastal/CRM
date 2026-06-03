public class ContentDocumentTriggerHandler  extends TriggerHandler{
        
    Map<Id,ContentDocument> oldMap = (Map<Id,ContentDocument>)Trigger.oldMap;
    
    public override void afterUpdate() {
        
        Set<Id> docIds = new Set<Id>();

        for (ContentDocument cd : (List<ContentDocument>)Trigger.new) {
            ContentDocument oldCd = oldMap.get(cd.Id);
            if (oldCd.LatestPublishedVersionId != null && cd.publishStatus == 'p') {
                docIds.add(cd.Id);
            }
        }
        
        if (!docIds.isEmpty()) {
           processByDocumentIds(docIds);
        }
    }
    
    public static void processByDocumentIds(Set<Id> docIds) {

        if (ContentDocumentLinkHandler.notesPopulatedInOpp || docIds == null || docIds.isEmpty()) return;

        try {
            String oppPrefix =  ApexUtil.getKeyPrefix('Opportunity');

            Set<Id> oppIds = new Set<Id>();

            for (ContentDocumentLink cdl : ContentDocumentLinkData.getContentDocuments(docIds)) {
                if (cdl.LinkedEntityId != null &&
                    String.valueOf(cdl.LinkedEntityId).startsWith(oppPrefix)) {
                    oppIds.add(cdl.LinkedEntityId);
                }
            }

            if (oppIds.isEmpty()) return;

            Map<Id, Id> docToOppMap = new Map<Id, Id>();
            Set<Id> allDocIds = new Set<Id>();

            for (ContentDocumentLink cdl : ContentDocumentLinkData.queryContentDocumentLinksByParentIds(oppIds)) {
                if (cdl.LinkedEntityId != null &&
                    String.valueOf(cdl.LinkedEntityId).startsWith(oppPrefix)) {

                    docToOppMap.put(cdl.ContentDocumentId, cdl.LinkedEntityId);
                    allDocIds.add(cdl.ContentDocumentId);
                }
            }

            if (allDocIds.isEmpty()) return;

            Map<Id, Id> oppToLatestDocId = new Map<Id, Id>();
            Set<Id> processedOpps = new Set<Id>();

            for (ContentDocument cd : ContentDocumentData.getLatestContentDocuments(allDocIds)) {
                Id oppId = docToOppMap.get(cd.Id);

                if (oppId == null || processedOpps.contains(oppId)) continue;

                processedOpps.add(oppId);
                oppToLatestDocId.put(oppId, cd.Id);

                if (processedOpps.size() == oppIds.size()) break;
            }

            if (oppToLatestDocId.isEmpty()) return;

            Map<Id, Id> docToOppFinalMap = new Map<Id, Id>();

            for (Id oppId : oppToLatestDocId.keySet()) {
                docToOppFinalMap.put(oppToLatestDocId.get(oppId), oppId);
            }

            Map<Id, Opportunity> oppUpdates = new Map<Id, Opportunity>();

            for (ContentVersion cv : ContentVersionData.getContentVersionNotes(docToOppFinalMap.keySet())) {

                Id oppId = docToOppFinalMap.get(cv.ContentDocumentId);
                if (oppId == null) continue;

                String noteContent = '';

                if (cv.VersionData != null) {
                    noteContent = cv.VersionData.toString().stripHtmlTags();
                }

                oppUpdates.put(oppId, new Opportunity(
                    Id = oppId,
                    Has_Closer_Notes__c = true,
                    Latest_Closer_Notes__c = noteContent
                ));
            }

            if (!oppUpdates.isEmpty()) {
                OpportunityLockService.disableOppLockForSystemUpdates();
                update oppUpdates.values();
                ContentDocumentLinkHandler.notesPopulatedInOpp = true;
                OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
            }
        }catch(Exception ex){
             ApplicationLogger.logExceptionWithData(ex, null, null, ApplicationLogger.SEVERITY_HIGH);
        }

    }
}