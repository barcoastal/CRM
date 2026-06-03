public inherited sharing class ContentVersionData {
    
    /**
     * @Description: Querying the Content Version records based on the Content Document Ids
    */
    public static List<ContentVersion> getContentVersions(Set<Id> contDocumentIds) {
        return [SELECT Id, Title, ContentDocumentId, VersionData, CreatedDate FROM ContentVersion WHERE ContentDocumentId IN :contDocumentIds ORDER BY CreatedDate DESC];
    }

    public static ContentVersion getContentVersion(Id contDocumentIds) {
        return [SELECT Id, Title, ContentDocumentId,Document_Type__c FROM ContentVersion WHERE ContentDocumentId =: contDocumentIds ORDER BY CreatedDate DESC];
    }
    
    public static List<ContentVersion> getContentVersionNotes(Set<Id> contentDocumentIds){
       return [
            SELECT Id, ContentDocumentId, VersionData, CreatedDate ,PublishStatus 
            FROM ContentVersion 
            WHERE ContentDocumentId IN :contentDocumentIds
            AND IsLatest = true 
            AND FileType = 'SNOTE'
            ORDER BY CreatedDate DESC
        ];
    }
}