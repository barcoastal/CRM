public inherited sharing class ChecklistData {

    public static List<Checklist__c> getActiveChecklistItem(Id accountId) {
        return [SELECT Id, Name FROM Checklist__c WHERE Account__c = :accountId and Active__c = true ORDER BY CreatedDate DESC];
    }
}