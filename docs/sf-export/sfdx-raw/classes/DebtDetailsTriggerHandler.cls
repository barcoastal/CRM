/**
 * @Description: Hander class to process the functionality on debtDetailsTrigger which extends TriggerHandler.
 */
public without sharing class DebtDetailsTriggerHandler extends TriggerHandler {

    private Map<Id, Debt_Details__c> debtDetailsOldMap;

    public DebtDetailsTriggerHandler() {
        this.debtDetailsOldMap = (Map<Id, Debt_Details__c>) Trigger.oldMap;
    }
    
    /**
     * @description: Method to execute logic in the after insert trigger event.
     */
    public override void afterInsert() {
        aggregateDebtAmountFromCreditors(Trigger.new);
        rollupLegalNetworkToOpportunity(Trigger.new, null);
    }

    /**
     * @description: Method to execute logic in the after update trigger event.
     */
    public override void afterUpdate() {
        aggregateDebtAmountFromCreditors(Trigger.new);
        DebtDetailsToAccountHandler.legalStatusAssignment(Trigger.new,debtDetailsOldMap);
        DebtDetailsToAccountHandler.negotiationStatusAssignment(Trigger.new,debtDetailsOldMap);
        updateAccountOnNegotiationStatus(Trigger.new);
        rollupLegalNetworkToOpportunity(Trigger.new, debtDetailsOldMap);
    }
    
    /**
     * @description: Method to execute logic in the before delete trigger event.
     */
    public override void afterDelete() {
        aggregateDebtAmountFromCreditors(Trigger.old);
    }
    
     public override void beforeUpdate() {
        updateOriginalCreditor(Trigger.new);
        validateLockOpportunityList(Trigger.new);
        snapshotLegalNetworkOnDebtDetails(Trigger.new, null);
    }
    
     private void updateOriginalCreditor(List<Debt_Details__c> debtDetailsList) {
          for (Debt_Details__c debt : debtDetailsList) {
            if (debt.Current_Creditor__c != NULL && (
                (debt.Current_Creditor__c != this.debtDetailsOldMap.get(debt.Id).Current_Creditor__c)
            )) {
                debt.Original_Creditor__c = this.debtDetailsOldMap.get(debt.Id).Current_Creditor__c;
            }
        }
     }

    /**
     * description: method used to update the current total debt in opportunity by aggregating the debt amount in the related debt details record.
     * @param: list of all new/updated/deleted debt details
     */
    private void aggregateDebtAmountFromCreditors(List<Debt_Details__c> debtDetailsList) {
        
        Set<Id> opportunityIdSet = new Set<Id>();
        List<Opportunity> opportunityList = new List<Opportunity>();
        
        for (Debt_Details__c debt : debtDetailsList) {
            if (debt.Opportunity__c != NULL && (
                (Trigger.isUpdate && debt.Debt_Amount__c != this.debtDetailsOldMap.get(debt.Id).Debt_Amount__c) || 
                ((Trigger.isInsert || Trigger.isDelete) && debt.Debt_Amount__c != NULL)
            )) {
                opportunityIdSet.add(debt.Opportunity__c);
            }
        }

        List<AggregateResult> aggResultList = DebtDetailsData.aggregateDebtAmountByOpportunity(opportunityIdSet);

        for (AggregateResult aggResult : aggResultList) {
            Opportunity opp = new Opportunity();
            opp.Id = (Id)aggResult.get('Opportunity__c');
            opp.Current_Total_Debt__c = (Decimal)aggResult.get('totalDebt');
            opportunityList.add(opp);
            opportunityIdSet.remove(opp.Id);
        }

        if (opportunityIdSet != NULL && !opportunityIdSet.isEmpty()) {
            for (Id oppId : opportunityIdSet) {
                Opportunity opp = new Opportunity();
                opp.Id = oppId;
                opp.Current_Total_Debt__c = 0;
                opportunityList.add(opp);
            }
        }

        update opportunityList;
    }
    
    private void updateAccountOnNegotiationStatus(List<Debt_Details__c> debtDetailsList) {
        Set<String> completedStatusSet = new Set<String>{'Settled lump sum','Settled payments','Settled PIF'};
        Set<Id> accountIds = new Set<Id>();

        for (Debt_Details__c debt : debtDetailsList) {
            Debt_Details__c oldDebt = this.debtDetailsOldMap.get(debt.Id);
            Boolean statusChangedToCompleted = 
                debt.Negotiation_Status__c != oldDebt.Negotiation_Status__c &&
                completedStatusSet.contains(debt.Negotiation_Status__c);
            if (statusChangedToCompleted && debt.Account__c != NULL) {
                accountIds.add(debt.Account__c);
            }
        }

        if (accountIds.isEmpty()) {
            return;
        }

        Map<Id, List<Debt_Details__c>> accountToDebtsMap = new Map<Id, List<Debt_Details__c>>();
        for (Debt_Details__c debt : [
            SELECT Id, Account__c, Negotiation_Status__c
            FROM Debt_Details__c
            WHERE Account__c IN :accountIds 
            AND Opportunity__r.Active_Opportunity__c = true
        ]) {
            if (!accountToDebtsMap.containsKey(debt.Account__c)) {
                accountToDebtsMap.put(debt.Account__c, new List<Debt_Details__c>());
            }
            accountToDebtsMap.get(debt.Account__c).add(debt);
        }

        List<Account> accountsToUpdate = new List<Account>();

        for (Id accId : accountIds) {
            if(accountToDebtsMap.containsKey(accId)){ 
                List<Debt_Details__c> allDebts = accountToDebtsMap.get(accId);

                Boolean allSettled = true;
                for (Debt_Details__c debt : allDebts) {
                    if (!completedStatusSet.contains(debt.Negotiation_Status__c)) {
                        allSettled = false;
                        break;
                    }
                }
            
                Account acc = new Account();
                acc.Id = accId;
                acc.Graduation_Status__c = allSettled
                    ? DebtDetailUtil.STATUS_FULLY_GRADUATED
                    : DebtDetailUtil.STATUS_PARTIALLY_GRADUATED;
                accountsToUpdate.add(acc);
            }
        }

        if (!accountsToUpdate.isEmpty()) {
            update accountsToUpdate;
        }
    }
    
    public override void beforeInsert() {
    	validateLockOpportunityList(Trigger.new);
        snapshotLegalNetworkOnDebtDetails(Trigger.new, null);
    }
    
    public override void beforeDelete() {
    	validateLockOpportunityList(Trigger.old);
    }

    private void validateLockOpportunityList(List<Debt_Details__c> recordsToBlock) {
        OpportunityLockService.validateLockOpportunity(recordsToBlock, 'Opportunity__c');
    }

    /**
     * Called in BEFORE context → direct field assignment on Trigger.new → ZERO DML.
     */
    private static void snapshotLegalNetworkOnDebtDetails(List<Debt_Details__c> newList,Map<Id, Debt_Details__c> oldMap) {
        Set<Id> creditorIds    = new Set<Id>();
        List<Debt_Details__c> relevantDDs = new List<Debt_Details__c>();

        for (Debt_Details__c dd : newList) {
            Boolean isInsert        = (oldMap == null);
            Boolean creditorChanged = !isInsert
                && dd.Current_Creditor__c != oldMap.get(dd.Id).Current_Creditor__c;

            if ((isInsert || creditorChanged) && dd.Current_Creditor__c != null) {
                relevantDDs.add(dd);
                creditorIds.add(dd.Current_Creditor__c);
            }
        }

        if (relevantDDs.isEmpty()) return;

        Map<Id,Account> creditorMap = AccountData.getAccountsWithCreditorsId(creditorIds);

        for (Debt_Details__c dd : relevantDDs) {
            Account creditor = creditorMap.get(dd.Current_Creditor__c);
            if (creditor == null || creditor.Creditor_Category__c == null) continue;
            dd.Legal_Network__c = creditor.Creditor_Category__c;
        }
    }

    /**
     * Rolls up Legal_Network__c to the parent Opportunity.
     * Reads DD.Legal_Network__c (already stamped in before context).
     */
    public static void rollupLegalNetworkToOpportunity(
        List<Debt_Details__c> newList,
        Map<Id, Debt_Details__c> oldMap
    ) {
        Set<Id> opportunityIds = new Set<Id>();

        for (Debt_Details__c dd : newList) {
            Boolean isInsert        = (oldMap == null);
            Boolean creditorChanged = !isInsert
                && dd.Current_Creditor__c != oldMap.get(dd.Id).Current_Creditor__c;

            if (dd.Opportunity__c != null && (isInsert || creditorChanged)) {
                opportunityIds.add(dd.Opportunity__c);
            }
        }

        if (opportunityIds.isEmpty()) return;

        Map<Id, List<Debt_Details__c>> oppToDebtDetails = fetchDebtDetailsByOpportunity(opportunityIds);
        List<Opportunity> oppsToUpdate = evaluateLegalNetworkType(oppToDebtDetails);

        if (!oppsToUpdate.isEmpty()) {
            OpportunityLockService.disableOppLockForSystemUpdates();
            update oppsToUpdate;
            OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        }
    }

    private static Map<Id, List<Debt_Details__c>> fetchDebtDetailsByOpportunity(Set<Id> opportunityIds) {
        Map<Id, List<Debt_Details__c>> oppToDebtDetails = new Map<Id, List<Debt_Details__c>>();

        for (Id oppId : opportunityIds) {
            oppToDebtDetails.put(oppId, new List<Debt_Details__c>());
        }

        for (Debt_Details__c dd : DebtDetailsData.getAllDebtDetailByOppId(opportunityIds)) {
            oppToDebtDetails.get(dd.Opportunity__c).add(dd);
        }

        return oppToDebtDetails;
    }

    private static List<Opportunity> evaluateLegalNetworkType(
        Map<Id, List<Debt_Details__c>> oppToDebtDetails
    ) {
        List<Opportunity> oppsToUpdate = new List<Opportunity>();

        for (Id oppId : oppToDebtDetails.keySet()) {
            List<Debt_Details__c> debtDetails = oppToDebtDetails.get(oppId);

            if (debtDetails.isEmpty()) continue;

            Boolean allVLP = true;
            for (Debt_Details__c dd : debtDetails) {
                if (dd.Current_Creditor__r.Creditor_Category__c != DebtDetailUtil.CREDITOR_CATEGORY_VLP) {
                    allVLP = false;
                    break;
                }
            }

            oppsToUpdate.add(new Opportunity(
                Id               = oppId,
                Legal_Network__c = allVLP
                    ? DebtDetailUtil.CREDITOR_CATEGORY_VLP
                    : DebtDetailUtil.CREDITOR_CATEGORY_CITADEL
            ));
        }

        return oppsToUpdate;
    }
}