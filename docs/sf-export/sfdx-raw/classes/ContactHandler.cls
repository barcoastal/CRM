/** Test Class: ContactTrigger_Test */
public without sharing class ContactHandler extends TriggerHandler {

    public override void beforeInsert() {
        assignSSNEncryptedToSSNText();
    }

    public override void beforeUpdate() {
        assignSSNEncryptedToSSNText();
    }
    
    public override void afterInsert() {
    }
    
    public override void afterUpdate() {
        populateSyncPending();
    }

    //Populating the Account's Sync Status fields if the payment processor integration related fields are updated
    private static void populateSyncPending() {
        Map<Id, Account> accountsToUpdateMap = new Map<Id, Account>();
        for (Contact cont : (List<Contact>)Trigger.new) {
            if (Trigger.isUpdate) {
                Contact oldCont = (Contact)Trigger.oldMap.get(cont.Id);
                Boolean syncPending = false;
                Boolean syncStatusBankAccount = false;
                for (Schema.SObjectField sObjField : ClientWrapper.contactFields) {
                    if (cont.get(sObjField) != oldCont.get(sObjField)) {
                        syncPending = true;
                        break;
                    }
                }
                for (Schema.SObjectField sObjField : BankAccountWrapper.bankAccountContactFields) {
                    if (cont.get(sObjField) != oldCont.get(sObjField)) {
                        syncStatusBankAccount = true;
                        break;
                    }
                }
                if ((syncPending == true || syncStatusBankAccount == true) && !accountsToUpdateMap.containsKey(cont.AccountId)) {
                    Account acctToUpdate = new Account();
                    acctToUpdate.Id = cont.AccountId;
                    if (syncPending == true) {
                        acctToUpdate.Sync_Status__c = 'Sync Pending';
                    }
                    if (syncStatusBankAccount == true) {
                        acctToUpdate.Bank_Account_Sync_Status__c = 'Sync Pending';
                    }
                    accountsToUpdateMap.put(acctToUpdate.Id, acctToUpdate);
                }
            }
        }
        if (!accountsToUpdateMap.isEmpty()) {
            update accountsToUpdateMap.values();
        }   
    }

    private static void assignSSNEncryptedToSSNText() {
        for (Contact cont : (List<Contact>)Trigger.new) {
            if ((Trigger.isInsert && cont.SSN_Encrypted__c != null) || (Trigger.isUpdate && cont.SSN_Encrypted__c != ((Contact)Trigger.oldMap.get(cont.Id)).SSN_Encrypted__c)) {
                cont.SSN__c = cont.SSN_Encrypted__c;
            }
        }
    }

    //This method can be removed as the logic moved to Sync to Payment Processor button click
    /*private static void createPayeesWithPaymentProcessor() {
        if (Trigger.new.size() == 1) {
            List<Id> payeeIds = new List<Id>();
            Set<Id> contactIds = new Set<Id>();
            Id creditorRecordTypeId = AccountUtil.getRecordTypeId(AccountUtil.RT_CREDITOR);
            for (Contact contactRecord : (List<Contact>)Trigger.new) {
                if (contactRecord.AccountId != null) {
                    Boolean eligibleForPayeeSync = true;
                    for (Schema.SObjectField sObjField : ClientWrapper.payeeContactFields) {
                        if (contactRecord.get(sObjField) == null) {
                            eligibleForPayeeSync = false;
                            break;
                        }
                    }
                    if (eligibleForPayeeSync) {
                        contactIds.add(contactRecord.Id);
                    }
                }
            }
            if (!contactIds.isEmpty()) {
                for (Contact contRecord : [SELECT Id, AccountId FROM Contact 
                    WHERE Id IN :contactIds AND Account.RecordType.DeveloperName = :AccountUtil.RT_CREDITOR
                ]) {
                    payeeIds.add(contRecord.AccountId);
                }
            }
            if (!payeeIds.isEmpty()) {
                syncPayeesFuture(payeeIds[0]);
            }
        }
    }*/

    //This method can be removed as the logic moved to Sync to Payment Processor button click
    /*private static void updatePayeesWithPaymentProcessor() {
        if (Trigger.new.size() == 1) {
            List<Id> payeeIds = new List<Id>();
            Set<Id> contactIds = new Set<Id>();
            Id creditorRecordTypeId = AccountUtil.getRecordTypeId(AccountUtil.RT_CREDITOR);
            for (Contact contactRecord : (List<Contact>)Trigger.new) {
                if (contactRecord.AccountId != null) {
                    Contact oldContactRecord = (Contact)Trigger.oldMap.get(contactRecord.Id);
                    for (Schema.SObjectField sObjField : ClientWrapper.payeeContactFields) {
                        if (contactRecord.get(sObjField) != oldContactRecord.get(sObjField)) {
                            contactIds.add(contactRecord.Id);
                            break;
                        }
                    }
                }
            }
            if (!contactIds.isEmpty()) {
                for (Contact contRecord : [SELECT Id, AccountId FROM Contact 
                    WHERE Id IN :contactIds AND Account.RecordType.DeveloperName = :AccountUtil.RT_CREDITOR
                ]) {
                    payeeIds.add(contRecord.AccountId);
                }
            }
            if (!payeeIds.isEmpty()) {
                syncPayeesFuture(payeeIds[0]);
            }
        }
    }

    @future(Callout=true)
    private static void syncPayeesFuture(Id accountId) {
        ProcessorAPI.syncPayees(accountId);
    }*/
}