public without sharing class Batch_UpdatePhoneDatabase implements Database.Batchable<SObject> {

    public static String query = 'SELECT Id, Formated_Phone__c FROM Lead WHERE Formated_Phone__c != null AND Status != \'Archive Disposition\'';
    
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator(query);
    }

    public void execute(Database.BatchableContext bc, List<Lead> scope) { 
        try {
            Set<String> phoneNumberSet = new Set<String>();
            for (Lead leadRec : (List<Lead>)scope) {
                phoneNumberSet.add(leadRec.Formated_Phone__c);
            }
            Map<String, Integer> phNumberCountMap = new Map<String, Integer>(); 
            for (Phone_Database__c phDatabase : [SELECT Id, Count__c, Phone_Number__c FROM Phone_Database__c WHERE Phone_Number__c IN :phoneNumberSet]) {
                phNumberCountMap.put(phDatabase.Phone_Number__c, Integer.valueOf(phDatabase.Count__c));
            }
            List<Phone_Database__c> phoneDatabaseToUpsertList = new List<Phone_Database__c>();
            for (Lead leadRec : (List<Lead>)scope) {
                Phone_Database__c phDBToUpsert = new Phone_Database__c();
                phDBToUpsert.Phone_Number__c = leadRec.Formated_Phone__c;
                if (phNumberCountMap.containsKey(phDBToUpsert.Phone_Number__c)) {
                    if (phNumberCountMap.get(phDBToUpsert.Phone_Number__c) == null) {
                        phDBToUpsert.Count__c = 1;
                    } else {
                        phDBToUpsert.Count__c = phNumberCountMap.get(phDBToUpsert.Phone_Number__c) + 1;
                    }
                } else {
                    phDBToUpsert.Count__c = 1;
                }
                phoneDatabaseToUpsertList.add(phDBToUpsert);
            }
            for (Database.UpsertResult upsertResult : Database.upsert(phoneDatabaseToUpsertList, Phone_Database__c.Phone_Number__c, false)) {
                if (!upsertResult.isSuccess()) {
                    String errorMessage;
                    for (Database.Error err : upsertResult.getErrors()) {
                        errorMessage += err.getMessage() + '. ';
                    }
                    ApplicationLogger.logDMLException('Batch_UpdatePhoneDatabase', upsertResult.getId(), errorMessage, true);
                }
            }
            ApplicationLogger.insertStoredLogs();
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, null,'Batch_UpdatePhoneDatabase', 'High');
        }
    }

    public void finish(Database.BatchableContext bc) {
    }
}