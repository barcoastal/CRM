/**
 * @Description: Hander class to process the functionality on Opportunity trigger which extends TriggerHandler.
 */
public without sharing class OpportunityContactRoleTriggerHandler extends TriggerHandler {

    private Map<Id, OpportunityContactRole> oppContRoleOldMap;

    public OpportunityContactRoleTriggerHandler() {
        this.oppContRoleOldMap = (Map<Id, OpportunityContactRole>) Trigger.oldMap;
    }

    /**
     * @description: Method to execute logic in the after insert trigger event.
     */
    public override void afterInsert() {

        List<OpportunityContactRole> filteredOppContactRoleList = new List<OpportunityContactRole>();
        
        for (OpportunityContactRole ocrInstance : (List<OpportunityContactRole>)Trigger.new) {
            //Checking whether the OpportunityContactRole is primary.
            if (ocrInstance.IsPrimary) {
                filteredOppContactRoleList.add(ocrInstance);
            }
        }

        if (!filteredOppContactRoleList.isEmpty()) {
            //Method call to update the opportunity's account with primary contact
            assignPrimaryContactInAccount(filteredOppContactRoleList);
        }
    }

    /**
     * @description: Method to execute logic in the after update trigger event.
     */
    public override void afterUpdate() {
        
        List<OpportunityContactRole> filteredOppContactRoleList = new List<OpportunityContactRole>();
        
        for (OpportunityContactRole ocrInstance : (List<OpportunityContactRole>)Trigger.new) {
            //Checking whether the OpportunityContactRole is primary and atleast contact or primary checkbox is changed.
            if (ocrInstance.IsPrimary && (ocrInstance.ContactId != this.oppContRoleOldMap.get(ocrInstance.Id).ContactId 
                || ocrInstance.IsPrimary != this.oppContRoleOldMap.get(ocrInstance.Id).IsPrimary
            )) {
                filteredOppContactRoleList.add(ocrInstance);
            }
        }

        if (!filteredOppContactRoleList.isEmpty()) {
            //Method call to update the opportunity's account with primary contact
            assignPrimaryContactInAccount(filteredOppContactRoleList);
        }
    }

    /**
     * description: Method to assign the primary contact from OpportunityContactRole to Account
     * params: oppContactRoleList - filtered OpportunityContactRole records from the after update and after insert trigger.
     */
    private static void assignPrimaryContactInAccount(List<OpportunityContactRole> oppContactRoleList) {

        List<Account> accountUpdateList = new List<Account>();

        if (oppContactRoleList != null && !oppContactRoleList.isEmpty()) {
            
            Map<Id,Opportunity> opportunityMap = new Map<Id,Opportunity>([
                SELECT Id, AccountId FROM Opportunity 
                WHERE Id IN (SELECT OpportunityId FROM OpportunityContactRole WHERE Id IN :oppContactRoleList)
            ]);
            for (OpportunityContactRole ocrInstance : oppContactRoleList) {
                if (opportunityMap.get(ocrInstance.OpportunityId).AccountId != null) {
                    Account accInstance = new Account(
                        Id = opportunityMap.get(ocrInstance.OpportunityId).AccountId,
                        Primary_Contact__c = ocrInstance.ContactId
                    );
                    accountUpdateList.add(accInstance);
                }
            }
        }

        if (!accountUpdateList.isEmpty()) {
            update accountUpdateList;
        }
    }
}