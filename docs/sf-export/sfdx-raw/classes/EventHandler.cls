/*----------------------------------------------------------------
    Author: Vignesh
    Description: To send the custom notification to the user for the inbound message
    Test Class: EventHandlerTest
--------------------------------------------------------------------*/
public without sharing class EventHandler extends TriggerHandler {

    /**
     * @description: Method to execute logic in the before after insert trigger event.
    */
    public override void afterInsert() {
        EventHandler.populateLastContactedDateTime();
    }

    /**
     * @description: Method to update Last Contacted DateTime in Lead & Opportunity in the after insert trigger event.
    */
    public static void populateLastContactedDateTime() {
        Set<Lead> leadRecordsToUpdateSet = new Set<Lead>();
        Set<Opportunity> opportunityRecordsToUpdateSet = new Set<Opportunity>();
        for (Event eventRecord : (List<Event>)Trigger.new) {
            if (String.isNotBlank(eventRecord.whoId) && LeadUtil.isLeadId(eventRecord.whoId)) {
                Lead leadInstance = new Lead(Id = eventRecord.whoId);
                leadInstance.Last_Contacted_DateTime__c = System.now();
                leadRecordsToUpdateSet.add(leadInstance);
            } else if (String.isNotBlank(eventRecord.whatId) && OpportunityUtil.isOppId(eventRecord.whatId)) {
                Opportunity opportunityInstance = new Opportunity(Id = eventRecord.whatId);
                opportunityInstance.Last_Contacted_DateTime__c = System.now();
                opportunityRecordsToUpdateSet.add(opportunityInstance);
            }
        }
        if (!leadRecordsToUpdateSet.isEmpty()) {
            update new List<Lead>(leadRecordsToUpdateSet);
        }
        if (!opportunityRecordsToUpdateSet.isEmpty()) {
            OpportunityLockService.disableOppLockForSystemUpdates();
            update new List<opportunity>(opportunityRecordsToUpdateSet);
            OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        }
    }
    public override void beforeInsert() {
        validateLockOpportunityEvent(Trigger.new);
    }
    
    public override void beforeDelete() {
        validateLockOpportunityEvent(Trigger.old);
    }
    
    public override void beforeUpdate() {
        validateLockOpportunityEvent(Trigger.new);
    }
    private void validateLockOpportunityEvent(List<Event> eventRecords) {
        Set<Id> oppIds = new Set<Id>();
        for (Event ev : eventRecords) {
            if (ev.WhatId != null && ApexUtil.getSObjectName(ev.WhatId) == 'Opportunity') {
                oppIds.add(ev.WhatId);
            }
        }
        
        Map<Id, Opportunity> archivedOppMap = OpportunityData.getArchivedOpportunities(oppIds);
        
        List<Event> oppEventRecords = new List<Event>();
        for (Event ev : eventRecords) {
            if (archivedOppMap.containsKey(ev.WhatId)) {
                oppEventRecords.add(ev);
            }
        }
        
        if (!oppEventRecords.isEmpty()) {
            OpportunityLockService.validateLockOpportunity(oppEventRecords, 'WhatId');
        }
    }

}