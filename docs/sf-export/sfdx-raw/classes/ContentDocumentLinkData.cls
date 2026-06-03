public inherited sharing class ContentDocumentLinkData {

    //Method to get the content document link records based on linked entity Ids and the content document titles.
    public static List<ContentDocumentLink> getContentDocumentLinks(Set<Id> linkedEntityIdSet, Set<String> contentDocumentTitleSet) {
        return [
            SELECT Id, LinkedEntityId, ContentDocumentId, ContentDocument.Title FROM ContentDocumentLink
            WHERE LinkedEntityId IN :linkedEntityIdSet AND ContentDocument.Title IN :contentDocumentTitleSet
        ];
    }

    /**
     * @Description: Querying the Content Document Link records based on the Content Document Ids
    */
    public static List<ContentDocumentLink> queryContentDocumentLinks(Set<Id> contentDocumentIds) {
        return [SELECT Id, LinkedEntityId, ContentDocumentId FROM ContentDocumentLink
            WHERE ContentDocumentId IN :contentDocumentIds
        ];
    }

    /**
     * @Description: Method to get the content document link records based on linked entity Ids.
    */
    public static List<ContentDocumentLink> getContentDocumentLinksByLinkedEntity(Set<Id> linkedEntityIdSet) {
        return [
            SELECT Id, LinkedEntityId, ContentDocumentId, ContentDocument.Title FROM ContentDocumentLink
            WHERE LinkedEntityId IN :linkedEntityIdSet
        ];
    }

    /**
     * @Description: Querying the Content Document Link records based on the Content Document Ids
    */
    public static List<ContentDocumentLink> queryContentDocumentLinksByParentIds(Set<Id> oppIds) {
        return [SELECT Id, LinkedEntityId, ContentDocumentId FROM ContentDocumentLink
            WHERE LinkedEntityId IN :oppIds
        ];
    }

    /**
     * @Description: Querying ContentDocumentLink records by ContentDocumentId and filtering
     *               in Apex for Opportunity-linked records only.
     *               NOTE: Salesforce does not allow filtering on relationship fields (e.g. LinkedEntity.Type)
     *               on ContentDocumentLink in SOQL — only LinkedEntityId with = operator is permitted.
     *               The Opportunity key prefix is retrieved dynamically via ApexUtil.getKeyPrefix() — no hardcoded strings.
    */
    public static List<ContentDocumentLink> getContentDocuments(Set<Id> contentDocIds) {
       return [
            SELECT ContentDocumentId, LinkedEntityId
            FROM ContentDocumentLink
            WHERE ContentDocumentId IN :contentDocIds
        ];
    }
}