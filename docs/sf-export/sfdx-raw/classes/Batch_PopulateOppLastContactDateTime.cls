public without sharing class Batch_PopulateOppLastContactDateTime implements Database.Batchable<SObject> {
    
    public String query = '';

    public Batch_PopulateOppLastContactDateTime() {
        this.query = 'SELECT Id, Last_SMS__c, Last_Call__c, Last_Email__c FROM Opportunity WHERE CreatedDate = Last_N_Days:7';
    }
    
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator(query);
    }

    public void execute(Database.BatchableContext bc, List<Opportunity> scope) { 
        try {

            Map<Id, DateTime> opportunitySMSDateTimeMap = new Map<Id, DateTime>();
            for (smagicinteract__smsMagic__c sms : [SELECT Id, smagicinteract__Opportunity__c,CreatedDate FROM smagicinteract__smsMagic__c WHERE smagicinteract__Opportunity__c IN :scope ORDER BY CreatedDate DESC]) {
                if (!opportunitySMSDateTimeMap.containsKey(sms.smagicinteract__Opportunity__c)) {
                    opportunitySMSDateTimeMap.put(sms.smagicinteract__Opportunity__c, sms.CreatedDate);
                }
            }

            Map<Id, DateTime> opportunityCallDateTimeMap = new Map<Id, DateTime>();
            for (Task taskRec : [SELECT Id, WhatId, CreatedDate FROM Task WHERE WhatId IN :scope AND Subject LIKE 'Call%' AND Five9__Five9TaskType__c LIKE 'Call%' ORDER BY CreatedDate DESC]) {
                if (!opportunityCallDateTimeMap.containsKey(taskRec.WhatId)) {
                    opportunityCallDateTimeMap.put(taskRec.WhatId, taskRec.CreatedDate);
                }
            }
            
            Map<Id, DateTime> opportunityEmailDateTimeMap = new Map<Id, DateTime>();
            for (Task taskRec : [SELECT Id, WhatId, CreatedDate FROM Task WHERE WhatId IN :scope AND TaskSubtype LIKE 'Email%' ORDER BY CreatedDate DESC]) {
                if (!opportunityEmailDateTimeMap.containsKey(taskRec.WhatId)) {
                    opportunityEmailDateTimeMap.put(taskRec.WhatId, taskRec.CreatedDate);
                }
            }

            List<Opportunity> oppsToUpdateList = new List<Opportunity>();
            for (Opportunity oppRec : scope) {
                DateTime lastContactDateTime;
                DateTime smsDateTime;
                DateTime callDateTime;
                DateTime emailDateTime;

                if (opportunitySMSDateTimeMap.containsKey(oppRec.Id)) {
                    smsDateTime = opportunitySMSDateTimeMap.get(oppRec.Id);
                }
                if (opportunityCallDateTimeMap.containsKey(oppRec.Id)) {
                    callDateTime = opportunityCallDateTimeMap.get(oppRec.Id);
                }
                if (opportunityEmailDateTimeMap.containsKey(oppRec.Id)) {
                    emailDateTime = opportunityEmailDateTimeMap.get(oppRec.Id);
                }

                if (oppRec.Last_SMS__c != smsDateTime || oppRec.Last_Call__c != callDateTime || oppRec.Last_Email__c != emailDateTime) {
                    Opportunity oppToUpdate = new Opportunity();
                    oppToUpdate.Id = oppRec.Id;
                    if (oppRec.Last_SMS__c != smsDateTime) {
                        oppToUpdate.Last_SMS__c = smsDateTime;
                    }
                    if (oppRec.Last_Call__c != callDateTime) {
                        oppToUpdate.Last_Call__c = callDateTime;
                    }
                    if (oppRec.Last_Email__c != emailDateTime) {
                        oppToUpdate.Last_Email__c = emailDateTime;
                    }
                    findLatestContactDateTimeAndUpdate(oppRec);
                    oppsToUpdateList.add(oppToUpdate);
                }
            }

            if (!oppsToUpdateList.isEmpty()) {
                OpportunityLockService.disableOppLockForSystemUpdates();
                DMLService.performUpdateDML(oppsToUpdateList, 'Batch_PopulateLastContactDateTime');
                OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
            }
        } catch (Exception ex) {
            ApplicationLogger.logException(ex, null, 'Batch_PopulateLastContactDateTime', ApplicationLogger.SEVERITY_HIGH);
        } finally {
            ApplicationLogger.insertStoredLogs();
        }
    }

    public void finish(Database.BatchableContext bc) {
    }

    private static void findLatestContactDateTimeAndUpdate(Opportunity opportunityRec) {
        DateTime lastContactDateTime;
        if (opportunityRec.Last_SMS__c != null) {
            lastContactDateTime = opportunityRec.Last_SMS__c;
        }
        if (opportunityRec.Last_Call__c != null) {
            if (lastContactDateTime == null || opportunityRec.Last_Call__c > lastContactDateTime) {
                lastContactDateTime =  opportunityRec.Last_Call__c;
            } 
        }
        if (opportunityRec.Last_Email__c != null) {
            if (lastContactDateTime == null || opportunityRec.Last_Email__c > lastContactDateTime) {
                lastContactDateTime = opportunityRec.Last_Email__c;
            }
        }
        opportunityRec.Last_Contacted_DateTime__c = lastContactDateTime;
    }
}