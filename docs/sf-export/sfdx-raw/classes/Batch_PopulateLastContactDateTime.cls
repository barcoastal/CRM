public without sharing class Batch_PopulateLastContactDateTime implements Database.Batchable<SObject> {
    
    public String query = '';

    public Batch_PopulateLastContactDateTime() {
        this.query = 'SELECT Id, Last_SMS__c, Last_Call__c, Last_Email__c FROM Account WHERE CreatedDate = Last_N_Days:7';
    }
    
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator(query);
    }

    public void execute(Database.BatchableContext bc, List<Account> scope) { 
        try {

            Map<Id, DateTime> accountSMSDateTimeMap = new Map<Id, DateTime>();
            for (smagicinteract__smsMagic__c sms : [SELECT Id, smagicinteract__Account__c,CreatedDate FROM smagicinteract__smsMagic__c WHERE smagicinteract__Account__c IN :scope ORDER BY CreatedDate DESC]) {
                if (!accountSMSDateTimeMap.containsKey(sms.smagicinteract__Account__c)) {
                    accountSMSDateTimeMap.put(sms.smagicinteract__Account__c, sms.CreatedDate);
                }
            }

            Map<Id, DateTime> accountCallDateTimeMap = new Map<Id, DateTime>();
            for (Task taskRec : [SELECT Id, WhatId, CreatedDate FROM Task WHERE WhatId IN :scope AND Subject LIKE 'Call%' AND Five9__Five9TaskType__c LIKE 'Call%' ORDER BY CreatedDate DESC]) {
                if (!accountCallDateTimeMap.containsKey(taskRec.WhatId)) {
                    accountCallDateTimeMap.put(taskRec.WhatId, taskRec.CreatedDate);
                }
            }
            
            Map<Id, DateTime> accountEmailDateTimeMap = new Map<Id, DateTime>();
            for (Task taskRec : [SELECT Id, WhatId, CreatedDate FROM Task WHERE WhatId IN :scope AND TaskSubtype LIKE 'Email%' ORDER BY CreatedDate DESC]) {
                if (!accountEmailDateTimeMap.containsKey(taskRec.WhatId)) {
                    accountEmailDateTimeMap.put(taskRec.WhatId, taskRec.CreatedDate);
                }
            }

            List<Account> accountsToUpdateList = new List<Account>();
            for (Account accountRec : scope) {
                DateTime lastContactDateTime;
                DateTime smsDateTime;
                DateTime callDateTime;
                DateTime emailDateTime;

                if (accountSMSDateTimeMap.containsKey(accountRec.Id)) {
                    smsDateTime = accountSMSDateTimeMap.get(accountRec.Id);
                }
                if (accountCallDateTimeMap.containsKey(accountRec.Id)) {
                    callDateTime = accountCallDateTimeMap.get(accountRec.Id);
                }
                if (accountEmailDateTimeMap.containsKey(accountRec.Id)) {
                    emailDateTime = accountEmailDateTimeMap.get(accountRec.Id);
                }

                if (accountRec.Last_SMS__c != smsDateTime || accountRec.Last_Call__c != callDateTime || accountRec.Last_Email__c != emailDateTime) {
                    Account acctToUpdate = new Account();
                    acctToUpdate.Id = accountRec.Id;
                    if (accountRec.Last_SMS__c != smsDateTime) {
                        acctToUpdate.Last_SMS__c = smsDateTime;
                    }
                    if (accountRec.Last_Call__c != callDateTime) {
                        acctToUpdate.Last_Call__c = callDateTime;
                    }
                    if (accountRec.Last_Email__c != emailDateTime) {
                        acctToUpdate.Last_Email__c = emailDateTime;
                    }
                    findLatestContactDateTimeAndUpdate(accountRec);
                    accountsToUpdateList.add(acctToUpdate);
                }
            }

            if (!accountsToUpdateList.isEmpty()) {
                DMLService.performUpdateDML(accountsToUpdateList, 'Batch_PopulateLastContactDateTime');
            }
        } catch (Exception ex) {
            ApplicationLogger.logException(ex, null, 'Batch_PopulateLastContactDateTime', ApplicationLogger.SEVERITY_HIGH);
        } finally {
            ApplicationLogger.insertStoredLogs();
        }
    }

    public void finish(Database.BatchableContext bc) {
    }

    private static void findLatestContactDateTimeAndUpdate(Account accountRec) {
        DateTime lastContactDateTime;
        if (accountRec.Last_SMS__c != null) {
            lastContactDateTime = accountRec.Last_SMS__c;
        }
        if (accountRec.Last_Call__c != null) {
            if (lastContactDateTime == null || accountRec.Last_Call__c > lastContactDateTime) {
                lastContactDateTime =  accountRec.Last_Call__c;
            } 
        }
        if (accountRec.Last_Email__c != null) {
            if (lastContactDateTime == null || accountRec.Last_Email__c > lastContactDateTime) {
                lastContactDateTime = accountRec.Last_Email__c;
            }
        }
        accountRec.Last_Contacted_DateTime__c = lastContactDateTime;
    }
}