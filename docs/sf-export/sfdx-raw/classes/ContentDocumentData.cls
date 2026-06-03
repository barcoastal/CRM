public inherited sharing class ContentDocumentData {
    
    //Method to get the content document records based on the content document Ids
    public static List<ContentDocument> getContentDocuments(Set<Id> contentDocumentIdSet) {
        return [SELECT Id,FileType,CreatedDate FROM ContentDocument WHERE Id IN :contentDocumentIdSet];
    }   
    
    public static List<ContentDocument> getLatestContentDocuments(Set<Id> allDocIds) {
        return [SELECT Id,FileType,CreatedDate FROM ContentDocument WHERE Id IN :allDocIds ORDER BY CreatedDate DESC];
    }
}