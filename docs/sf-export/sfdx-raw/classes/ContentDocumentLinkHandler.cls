public without sharing class ContentDocumentLinkHandler extends TriggerHandler {
    
    public static Boolean notesPopulatedInOpp = false;
    
    public override void afterInsert() {
        linkDocumentToAccount();
        uploadFilesIntoPaymentProcessor();
        linkNoteToAccount(Trigger.new);
        notifyNoteToParent(Trigger.new);
        collectAndProcessOppNotes((List<ContentDocumentLink>)Trigger.new);
    }

    /**
     * @Description: Helper method to collect Opportunity IDs
     */
    private void collectAndProcessOppNotes(List<ContentDocumentLink> cdls) {
        try{
            if(notesPopulatedInOpp){
                return;
            }
            
            Set<Id> oppIdsForCloserNotes = new Set<Id>();
            Map<Id, Id> docIdToOppIdMap = new Map<Id, Id>();
            String oppPrefix = ApexUtil.getKeyPrefix('Opportunity');
            for (ContentDocumentLink cdl : cdls) {
                if (cdl.LinkedEntityId != null && String.valueOf(cdl.LinkedEntityId).startsWith(oppPrefix)) {
                    oppIdsForCloserNotes.add(cdl.LinkedEntityId);
                    docIdToOppIdMap.put(cdl.ContentDocumentId, cdl.LinkedEntityId);
                }
            }
            
            if (!oppIdsForCloserNotes.isEmpty()) {
                populateCloserNotes(oppIdsForCloserNotes,docIdToOppIdMap);
            }
        }catch(Exception Ex){
            ApplicationLogger.logExceptionWithData(ex, null, null, ApplicationLogger.SEVERITY_HIGH);
        }
    }

    public static void populateCloserNotes(Set<Id> oppIds,Map<Id, Id> contentDocIds) {
        if (oppIds == null || oppIds.isEmpty()) return;
    
        Map<Id, Opportunity> oppsToUpdateMap = new Map<Id, Opportunity>();
        
        for (ContentVersion cv : ContentVersionData.getContentVersionNotes(contentDocIds.keySet())) {
            Id parentOppId = contentDocIds.get(cv.ContentDocumentId);
            if (parentOppId != null && !oppsToUpdateMap.containsKey(parentOppId)) {
                String noteContent = cv.VersionData != null ? cv.VersionData.toString().stripHtmlTags() : '';
                
                oppsToUpdateMap.put(parentOppId, new Opportunity(
                    Id = parentOppId,
                    Has_Closer_Notes__c = true,
                    Latest_Closer_Notes__c = noteContent
                ));
            }
        }
    
        if (!oppsToUpdateMap.isEmpty()) {
            OpportunityLockService.disableOppLockForSystemUpdates();
            update oppsToUpdateMap.values();
            notesPopulatedInOpp = true;
            OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        }
    }
    
    /**
     * @Description: Helper method to validate the uploaded file and send to Upload Contract API call if it is eligible.
    */
    private static void uploadFilesIntoPaymentProcessor() {
        //When the contentDocument link is inserted, two records will be created, one is for the parent object and another one is for the user object
        if (Trigger.new.size() <= 2) {
            Map<Id, Id> contentDocumenIdOppIdMap = new Map<Id, Id>();
            for (ContentDocumentLink contentDocLink : (List<ContentDocumentLink>)Trigger.new) {
                if (OpportunityUtil.isOppId(contentDocLink.LinkedEntityId)) {
                    contentDocumenIdOppIdMap.put(contentDocLink.ContentDocumentId, contentDocLink.LinkedEntityId);
                }
            }
            if (!contentDocumenIdOppIdMap.isEmpty()) {
                Set<Id> contentDocumentIdsToSync = new Set<Id>();
                Set<Id> oppIds = new Set<Id>(contentDocumenIdOppIdMap.values());
                Map<Id, Opportunity> oppMap = new Map<Id, Opportunity>(OpportunityData.queryOpportunities(oppIds));
                for (ContentVersion contVersion : ContentVersionData.getContentVersions(contentDocumenIdOppIdMap.keySet())) {
                    if (contentDocumenIdOppIdMap.containsKey(contVersion.ContentDocumentId)) {
                        Id oppId = contentDocumenIdOppIdMap.get(contVersion.ContentDocumentId);
                        if (oppMap.containsKey(oppId)) {
                            Opportunity oppRecord = oppMap.get(oppId);
                            String title = contVersion.Title;
                            if (title.endsWithIgnoreCase('.pdf')) {
                                title = title.removeEnd('.pdf');
                            }
                            String fileFormatName = FileUtil.getFileFormatNameForSync(title, oppRecord.Name);
                            if (String.isNotBlank(fileFormatName)) {
                                contentDocumentIdsToSync.add(contVersion.ContentDocumentId);
                            }
                        }
                    }
                }
                if (!contentDocumentIdsToSync.isEmpty()) {
                    syncContracts(contentDocumentIdsToSync);
                }
            }
        }
    }
    private static void notifyNoteToParent(List<ContentDocumentLink> contentDocLinkList) {
        Set<Id> linkedOpportunityIds = new Set<Id>();
        
        for (ContentDocumentLink link : contentDocLinkList) {
            String objectName = ApexUtil.getSObjectName(link.LinkedEntityId);
            if (objectName == 'Opportunity') {
                Opportunity opp = OpportunityData.queryOpportunity(link.LinkedEntityId)[0];
                if(opp.StageName != OpportunityUtil.STAGE_ARCHIVED){ 
                    linkedOpportunityIds.add(link.LinkedEntityId);
                }
            }
        }
        
        if (!linkedOpportunityIds.isEmpty()) {
            sendNoteNotificationEmails(linkedOpportunityIds);
        }
    }
    
    private static void sendNoteNotificationEmails(Set<Id> opportunityIds) {
        List<Messaging.SingleEmailMessage> emails = new List<Messaging.SingleEmailMessage>();
        
        Map<Id, Opportunity> opportunityMap = new Map<Id, Opportunity>(
            [SELECT Id, Name, Owner.Email FROM Opportunity WHERE Id IN :opportunityIds AND Qualified_Financial_Formula__c = true]
        );
        EmailTemplate et =  EmailTemplateService.getEmailTemplateByName('Opportunity Notes Creation');
        List<EmailTemplateService.EmailRequest> emailRequests = new List<EmailTemplateService.EmailRequest>();

        for (Opportunity opp : opportunityMap.values()) {
            Map<String, String> mergeFields =  new Map<String, String>();
            if (String.isNotBlank(opp.Owner.Email)) { 
                mergeFields.put('Opportunity.Name',opp.Name);
                emailRequests.add(new EmailTemplateService.EmailRequest(
                    EmailTemplateService.getUserEmailsFromGroups(),
                    et.Subject, 
                    et.HtmlValue,
                    true,mergeFields)
                );
            }
        }
        EmailTemplateService.sendBulkEmails(emailRequests);
    }



    /**
     * @Description: Method the link the uploaded file need to Account if the opportunity is Closed won First Payment pending.
    */
    private static void linkDocumentToAccount() {
        Map<Id, Id> contentDocumenIdOppIdMap = new Map<Id, Id>();
        for (ContentDocumentLink contentDocLink : (List<ContentDocumentLink>)Trigger.new) {
            if (OpportunityUtil.isOppId(contentDocLink.LinkedEntityId)) {
                contentDocumenIdOppIdMap.put(contentDocLink.ContentDocumentId, contentDocLink.LinkedEntityId);
            }
        }
        if (!contentDocumenIdOppIdMap.isEmpty()) {
            Map<Id, Id> oppotunityIdAcctIdMap = new Map<Id, Id>();
            for (Opportunity opporRecord :OpportunityData.queryClosedWonOpportunities(new Set<Id> (contentDocumenIdOppIdMap.values()))) {
                oppotunityIdAcctIdMap.put(opporRecord.Id, opporRecord.AccountId);
            }
            List<ContentDocumentLink> contentDocumentLinkList = new List<ContentDocumentLink>();
            for(ContentDocument cd : ContentDocumentData.getContentDocuments(contentDocumenIdOppIdMap.keySet())) {
                if(cd.FileType != 'SNOTE'){
                    if (oppotunityIdAcctIdMap.containsKey(contentDocumenIdOppIdMap.get(cd.Id))) {
                        contentDocumentLinkList.add(createCDL(cd.Id, oppotunityIdAcctIdMap.get(contentDocumenIdOppIdMap.get(cd.id))));
                    }
                }
            }
            insert contentDocumentLinkList;
        }
    }
     /**
     * @Description: Method the link the note to Account when added on Debt Details or on Opportunity
    */
    private static void linkNoteToAccount(List<ContentDocumentLink> contentDocLinkList) {
        Map<Id, Id> contentDocIdToLinkedEntityId = new Map<Id, Id>();
        Map<Id,Debt_Details__c> debtDetailsMap = New Map<Id,Debt_Details__c>();
        Map<Id,Opportunity> opportunityMap = New Map<Id,Opportunity>();
        Set<Id> ContentDocumentId = new Set<Id>();
        Set<Id> linkedEntityIdSet = New Set<Id>();
        List<ContentDocumentLink> cdlList = new List<ContentDocumentLink>();
        String objectName;
        Id accountId;
        // Populate contentDocIds and contentDocIdToLinkedEntityId maps
        for (ContentDocumentLink link : contentDocLinkList) {
            objectName = ApexUtil.getSObjectName(link.LinkedEntityId);
            if(objectName!='User' && link.ContentDocumentId != null && (objectName=='Debt_Details__c' || objectName == 'Opportunity')){
                contentDocIdToLinkedEntityId.put(link.ContentDocumentId, link.LinkedEntityId);   
                ContentDocumentId.add(link.ContentDocumentId);
                linkedEntityIdSet.add(link.LinkedEntityId);
            }
        }
        if(objectName=='Debt_Details__c'){
             debtDetailsMap = DebtDetailsData.getDebtDetails(linkedEntityIdSet);
        }
        else if(objectName == 'Opportunity'){
           opportunityMap = OpportunityData.getOppIdMap(linkedEntityIdSet);
        }
        List<ContentDocument> contentDocs = ContentDocumentData.getContentDocuments(ContentDocumentId);
        Set<Id> contentDocIds = new Set<Id>();
        for (ContentDocument cd : contentDocs) {
            contentDocIds.add(cd.Id);
        }
        Map<Id, Set<Id>> contentDocIdToLinkedAccounts = new Map<Id, Set<Id>>();
        if(contentDocIds.size() > 0) {
            for (ContentDocumentLink cdl : [
                SELECT ContentDocumentId, LinkedEntityId 
                FROM ContentDocumentLink 
                WHERE ContentDocumentId IN :contentDocIds
            ]) {
                if (!contentDocIdToLinkedAccounts.containsKey(cdl.ContentDocumentId)) {
                    contentDocIdToLinkedAccounts.put(cdl.ContentDocumentId, new Set<Id>());
                }
                contentDocIdToLinkedAccounts.get(cdl.ContentDocumentId).add(cdl.LinkedEntityId);
            }
        }

       
        for (ContentDocument cd : ContentDocumentData.getContentDocuments(ContentDocumentId)) {
            if(cd.FileType == 'SNOTE'){
                if(contentDocIdToLinkedEntityId.containsKey(cd.Id)){
                    Id linkedId = contentDocIdToLinkedEntityId.get(cd.Id);
                    if (linkedId != null) {
                        if(objectName=='Debt_Details__c'){
                            Debt_Details__c debtInfo = debtDetailsMap.get(linkedId);
                            accountId = debtInfo.Account__c;
                        }
                        else if(objectName == 'Opportunity'){
                            Opportunity opp = opportunityMap.get(linkedId);
                            accountId = (opp != null) ? opp.AccountId : null;
                        }
                    }
                     if (accountId != null) {
                         Set<Id> linkedAccounts = contentDocIdToLinkedAccounts.get(cd.Id);
                         if (linkedAccounts == null || !linkedAccounts.contains(accountId)) {
                             cdlList.add(createCDL(cd.Id, accountId));
                         }
                    }
                }
            }
        }
        // Insert the ContentDocumentLinks 
        if (!cdlList.isEmpty()) {
            insert cdlList;
        }
    }
    public static ContentDocumentLink createCDL(Id contentDocumentId, Id linkedEntityId) {
        ContentDocumentLink CDLInstance = new ContentDocumentLink();
        CDLInstance.ContentDocumentId = contentDocumentId;
        CDLInstance.LinkedEntityId = linkedEntityId;
        return CDLInstance;
    }

    /**
     * @Description: A future method which takes the contentDocumentIds from the trigger context and send those to the UploadContracts API
    */
    @future(Callout=true)
    private static void syncContracts(Set<Id> contentDocumentIds) {
        ProcessorAPI.uploadContracts(contentDocumentIds);
    }
     public override void beforeInsert() {
        //validateLockOpportunityList(Trigger.new);
    }
    
    public override void beforeDelete() {
        //validateLockOpportunityList(Trigger.old);
    }
    
    public override void beforeUpdate() {
        //validateLockOpportunityList(Trigger.new);
    }
    
    private void validateLockOpportunityList(List<ContentDocumentLink> recordsToBlock) {
        List<ContentDocumentLink> oppContentRecords = new List<ContentDocumentLink>();
        for (ContentDocumentLink cdl : recordsToBlock) {
            if (cdl.LinkedEntityId != null && ApexUtil.getSObjectName(cdl.LinkedEntityId) == 'Opportunity') {
                oppContentRecords.add(cdl);
            }
        }
        if (!oppContentRecords.isEmpty()) {
            OpportunityLockService.validateLockOpportunity(oppContentRecords, 'LinkedEntityId');
        }
    }
}