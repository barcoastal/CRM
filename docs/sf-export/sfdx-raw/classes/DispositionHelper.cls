public inherited sharing class DispositionHelper {

    public static Opportunity handleHighUCCOpportunity(Opportunity oppInstance) {
        if (oppInstance != null && oppInstance.Id != null) {
            Opportunity oppToDML = new Opportunity();
            oppToDML.Id = oppInstance.Id;
            oppToDML.RecordTypeId = ApexUtil.getRecordTypeIdbyDeveloperName(OpportunityUtil.getSObjectName(), OpportunityUtil.RECORD_TYPE_BUYOUT);
            oppToDML.StageName = OpportunityUtil.STAGE_WORKING_OPPORTUNITY;
            oppToDML.Sub_Disposition__c = OpportunityUtil.SUB_DISPO_STAGE_CHANGE;
            List<User> usersList = UserData.queryBuyoutClosers();
            if (!usersList.isEmpty()) {
                oppToDML.OwnerId = usersList[0].Id;
            }
            return oppToDML;
        }
        return null;
    }

    public static void handleBuyoutNotQualifiedOpportunity(Opportunity oppInstance) {
        if (oppInstance != null) {
            oppInstance.Affiliate__c = null;
            List<User> usersList = UserData.queryDefaultSalesAdmin();
            if (!usersList.isEmpty()) {
                oppInstance.OwnerId = usersList[0].Id;
            }
        }
    }

    public static void updateContacts(Id accountId, Id newOwnerId) {
        List<Contact> contactsToDML = new List<Contact>();
        List<Contact> contactsQueried = ContactData.getContactsByAccountId(accountId);
        if (!contactsQueried.isEmpty()) {
            for (Contact contactRec : contactsQueried) {
                Contact contactToDML = new Contact();
                contactToDML.Id = contactRec.Id;
                contactToDML.OwnerId = newOwnerId;        
                contactsToDML.add(contactToDML);
            }
            if (!contactsToDML.isEmpty()) {
                update contactsToDML;
            }
        }
    }
}