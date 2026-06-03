public class SMSMagicTriggerHandler extends TriggerHandler {

    public override void afterInsert() {
        handleSMSUpdates((List<smagicinteract__smsMagic__c>) Trigger.new);
    }

    public static void handleSMSUpdates(List<smagicinteract__smsMagic__c> smsList) {
        Map<Id, DateTime> accountDates = new Map<Id, DateTime>();
        Map<Id, DateTime> contactDates = new Map<Id, DateTime>();
        Map<Id, DateTime> opportunityDates = new Map<Id, DateTime>();
  		try {  
            collectSMSDates(smsList, accountDates, contactDates, opportunityDates);
            resolveContactsToAccounts(contactDates, accountDates);
            updateAccounts(accountDates);
        	updateOpportunities(opportunityDates);
        } catch (Exception e) {
            ApplicationLogger.logException('SMSMagicTriggerHandler.handleSMSUpdates', null, e.getMessage());
        } finally {
            ApplicationLogger.insertStoredLogs();
        }
    }

    private static void collectSMSDates(
        List<smagicinteract__smsMagic__c> smsList,
        Map<Id, DateTime> accountDates,
        Map<Id, DateTime> contactDates,
        Map<Id, DateTime> opportunityDates
    ) {
        for (smagicinteract__smsMagic__c sms : smsList) {
            DateTime dt = sms.CreatedDate;

            if (sms.smagicinteract__Account__c != null) {
                accountDates.put(sms.smagicinteract__Account__c, dt);
            }

            if (sms.smagicinteract__Contact__c != null) {
                contactDates.put(sms.smagicinteract__Contact__c, dt);
            }

            if (sms.smagicinteract__Opportunity__c != null) {
                opportunityDates.put(sms.smagicinteract__Opportunity__c, dt);
            }
        }
    }

    private static void resolveContactsToAccounts(
        Map<Id, DateTime> contactDates,
        Map<Id, DateTime> accountDates
    ) {
        if (contactDates.isEmpty()) return;
        Map<Id, Id> contactToAccountMap = ContactData.fetchContactToAccountMap(contactDates.keySet());
        
        for (Id contactId : contactDates.keySet()) {
            Id accountId = contactToAccountMap.get(contactId);
            if (accountId != null) {
                accountDates.put(accountId, contactDates.get(contactId));
            }
        }
    }

    private static void updateAccounts(Map<Id, DateTime> accountDates) {
        try {  
        if (accountDates.isEmpty()) return;
        
        Map<SObjectField, Object> fieldValues;
        Set<Id> accountIds = new Set<Id>();
        
        for (Id accId : accountDates.keySet()) {
            accountIds.add(accId);
            if (fieldValues == null) {
                DateTime dt = accountDates.get(accId);
                fieldValues = new Map<SObjectField, Object>{
                    Account.Last_SMS__c => dt,
					Account.Last_Contacted_DateTime__c => dt
                };
        	}
        }
            if (!accountIds.isEmpty() && fieldValues != null) {
                TaskServices.updateAccounts(accountIds, fieldValues);
            }
       } catch (Exception e) {
       		ApplicationLogger.logException('SMSMagicTriggerHandler.updateAccounts', null, e.getMessage());
       }
    }
    
    private static void updateOpportunities(Map<Id, DateTime> opportunityDates) {
        try {  
        Map<SObjectField, Object> fieldValues;
        Set<Id> opportunityIds = new Set<Id>();
        
        for (Id oppId : opportunityDates.keySet()) {
            opportunityIds.add(oppId);
            if (fieldValues == null) {
                DateTime dt = opportunityDates.get(oppId);
                    fieldValues = new Map<SObjectField, Object> { 
                    Opportunity.Last_SMS__c => dt,
                    Opportunity.Last_Contacted_DateTime__c => dt
                 };
            }
        }
        
        if (!opportunityIds.isEmpty() && fieldValues != null) {
            TaskServices.updateOpportunities(opportunityIds, fieldValues);
        }
       } catch (Exception e) {
       		ApplicationLogger.logException('SMSMagicTriggerHandler.updateOpportunities', null, e.getMessage());
       }
    }

}