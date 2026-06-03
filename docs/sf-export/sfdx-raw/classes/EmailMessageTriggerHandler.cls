/**
* @Description: Handler class to process the functionality on Email Message trigger which extends TriggerHandler.
*/
public with sharing class EmailMessageTriggerHandler extends TriggerHandler {
	/**
	* @description: Method to execute logic in the after insert trigger event.
	*/
	public override void afterInsert() { 
        
		List<ContentDocumentLink> contentDocumentLinkList = new List<ContentDocumentLink>();
        Map<Id, Set<Id>> existingRecIdWithDocIdsMap = new Map<Id, Set<Id>>();
        Map<Id, Id> emailMsgIdWithRelatedIdMap = new Map<Id, Id>();
        
        FOR (EmailMessage emailMsgInstance : (List<EmailMessage>)Trigger.new) {
            IF (emailMsgInstance.RelatedToId != NULL) {
                emailMsgIdWithRelatedIdMap.put(emailMsgInstance.Id, emailMsgInstance.RelatedToId);
            }
        }
        
        IF (emailMsgIdWithRelatedIdMap != NULL) {
            
            IF (emailMsgIdWithRelatedIdMap.values() != NULL && !emailMsgIdWithRelatedIdMap.values().isEmpty()) {
                FOR (ContentDocumentLink cdl : [
                    SELECT ContentDocumentId,LinkedEntityId,ShareType,Visibility 
                    FROM ContentDocumentLink WHERE LinkedEntityId IN :emailMsgIdWithRelatedIdMap.values()
                ]) {
                    IF (!existingRecIdWithDocIdsMap.containsKey(cdl.LinkedEntityId)) {
                        existingRecIdWithDocIdsMap.put(cdl.LinkedEntityId, new Set<Id>());
                    }
                    existingRecIdWithDocIdsMap.get(cdl.LinkedEntityId).add(cdl.ContentDocumentId);
                }
            }
            
            IF (emailMsgIdWithRelatedIdMap.keySet() != NULL && !emailMsgIdWithRelatedIdMap.keySet().isEmpty()) {
                FOR (ContentDocumentLink cdl : [
                    SELECT ContentDocumentId,LinkedEntityId,ShareType,Visibility 
                    FROM ContentDocumentLink WHERE LinkedEntityId IN :emailMsgIdWithRelatedIdMap.keySet()
                ]) {
                    Id relatedRecId = emailMsgIdWithRelatedIdMap.get(cdl.LinkedEntityId);
                    IF (!existingRecIdWithDocIdsMap.isEmpty() && existingRecIdWithDocIdsMap.containsKey(cdl.LinkedEntityId) 
                    	&& existingRecIdWithDocIdsMap.get(relatedRecId).contains(cdl.ContentDocumentId)
                    ) {
                        continue;
                    }
                    ContentDocumentLink newCDL = cdl.clone(false, false, false, false);
                    newCDL.LinkedEntityId = relatedRecId;
                    contentDocumentLinkList.add(newCDL);
                }
            }            
        }
                
		IF (!contentDocumentLinkList.isEmpty()) {
        	FOR (Database.SaveResult saveResult : Database.insert(contentDocumentLinkList, false)) {
            	IF (!saveResult.isSuccess()) {
                    String errorMessage = '';
                    FOR (Database.Error err : saveResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('Adding Files in the Email to Related record got failed', null, errorMessage, true);
                }
        	}
            //insert all the application logs captured in the execution
        	ApplicationLogger.insertStoredLogs();
		}
	}
    public override void beforeInsert() {
        validateLockOpportunityEmail(Trigger.new);
    }
    
    public override void beforeDelete() {
        validateLockOpportunityEmail(Trigger.old);
    }
    
    public override void beforeUpdate() {
        validateLockOpportunityEmail(Trigger.new);
    }
    
    private void validateLockOpportunityEmail(List<EmailMessage> emailRecords) {
        Set<Id> oppIds = new Set<Id>();
        for (EmailMessage em : emailRecords) {
            if (em.RelatedToId != null && ApexUtil.getSObjectName(em.RelatedToId) == 'Opportunity') {
                oppIds.add(em.RelatedToId);
            }
        }
        
        Map<Id, Opportunity> archivedOppMap = OpportunityData.getArchivedOpportunities(oppIds);
        
        List<EmailMessage> oppEmailRecords = new List<EmailMessage>();
        for (EmailMessage em : emailRecords) {
            if (archivedOppMap.containsKey(em.RelatedToId)) {
                oppEmailRecords.add(em);
            }
        }
        
        if (!oppEmailRecords.isEmpty()) {
            OpportunityLockService.validateLockOpportunity(oppEmailRecords, 'RelatedToId');
        }
    }

}