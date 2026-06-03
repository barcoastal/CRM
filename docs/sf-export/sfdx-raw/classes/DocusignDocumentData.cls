public inherited sharing class DocusignDocumentData {
    
    //Method to get the docusign document records with content version file type based on the docusign Id from the envelope
    public static List<dfsle__Document__c> getDocuments(Set<String> docusignIdSet) {
        return [
            SELECT Id, dfsle__FullName__c, dfsle__Envelope__r.dfsle__SourceId__c FROM dfsle__Document__c 
            WHERE dfsle__Envelope__r.dfsle__DocuSignId__c IN :docusignIdSet AND dfsle__Type__c = 'ContentVersion'
        ];
    }
    
    //Method to get the docusign document records with template file type based on the docusign Id from the envelope
    public static List<dfsle__Document__c> getDocusignDocuments(Set<String> docusignIdSet) {
        return [
            SELECT Id, dfsle__FullName__c, dfsle__Envelope__r.dfsle__SourceId__c,dfsle__Type__c FROM dfsle__Document__c 
            WHERE dfsle__Envelope__r.dfsle__DocuSignId__c IN :docusignIdSet
        ];
    }

    public static dfsle__GenTemplate__c getGenTemplateByName(String genTemplateName) {
        List<dfsle__GenTemplate__c> genTemplateList = [
            SELECT Id, Name, dfsle__Description__c FROM dfsle__GenTemplate__c 
            WHERE Name = :genTemplateName
        ];
        return genTemplateList != null && !genTemplateList.isEmpty() ? genTemplateList[0] : null;
    }
}