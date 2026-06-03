/**
 * @Description: Batch class to update the current balance in the Account record based on the SAS getBalances Bulk API response.
 */
public inherited sharing class BatchSASUpdateAccountBalance  implements Database.Batchable<sObject>{

    public Id calloutDataId;

    //Constructor to assign the Callout Data Id using the Id from the predecessor Batch
    public BatchSASUpdateAccountBalance(Id dataId) {
        this.calloutDataId = dataId;
    }

    //Start method to query the Callout Data Item record related the Callout Data created in the predecessor batch
    public Database.QueryLocator start(Database.BatchableContext BC){

        String query;
        
        if (String.isNotBlank(this.calloutDataId)) {
            query = 'SELECT Id, Record_Id__c, External_Id__c, Current_Balance__c FROM Callout_Data_Item__c'
            + ' WHERE Callout_Data__c = \''+ this.calloutDataId + '\'';
        } else {
            throw new CustomException('Callout Data Id is required to execute the batch');
        }

        return Database.getQueryLocator(query);
    }

    //Execute method to update the Account records with current balance from the Callout Data Item
    public void execute(Database.BatchableContext BC, List<sObject> scope){

        Map<Id, Account> accountMap = new Map<Id, Account>();
        List<Application_Log__c> applicationLogs = new List<Application_Log__c>(); 
        Map<Id, Callout_Data_Item__c> accIdWithCDIMap = new Map<Id, Callout_Data_Item__c>();

        try {

            for(sObject s : scope){
                Callout_Data_Item__c dataItem = (Callout_Data_Item__c)s;
                try {
                    if (String.isNotBlank(dataItem.Record_Id__c)) {
                        accIdWithCDIMap.put(Id.valueOf(dataItem.Record_Id__c), dataItem);
                    }
                } catch(Exception exp) {
                    ApplicationLogger.logException(exp, dataItem.Id);
                }
            }

            if (accIdWithCDIMap != null && !accIdWithCDIMap.values().isEmpty()) {

                //Set to store the remote id from SAS. ie., Salesfore record id
                Set<Id> customerIdSet = new Set<Id>(accIdWithCDIMap.keySet());
                //Assign all account records retrieved using the customerIdSet to the account map
                accountMap.putAll(AccountData.queryAccounts(customerIdSet));

                for (Id customerId : customerIdSet) {
                    if (accountMap.containsKey(customerId)) {
                        accountMap.get(customerId).Current_Balance__c = accIdWithCDIMap.get(customerId).Current_Balance__c;
                    } else {
                        Application_Log__c log = new Application_Log__c(); 
                        log.Exception_Message__c = customerId + ' - Account does not exists'; 
                        log.Log_Type__c = 'Error'; 
                        log.Record_Id__c = accIdWithCDIMap.get(customerId).Id; 
                        log.Callout_Data_Item__c = accIdWithCDIMap.get(customerId).Id;
                        applicationLogs.add(log); 
                    }
                }

                //Update all the account records with the trust account balance from SAS
                for (Database.SaveResult srAccount : Database.update(accountMap.values(), false)) {
                    if (!srAccount.isSuccess()) {           
                        for (Database.Error err : srAccount.getErrors()) {
                            ApplicationLogger.logDMLException(
                                'Account fields that affected this error : ' + String.join(err.getFields(), ', '), 
                                srAccount.getId(), err.getStatuscode() + ': ' + err.getMessage()
                            );
                        }
                    }
                }

                //Insert all application log records and join it to callout data item records with no account records in current org (INVALID_CROSS_REFERENCE_KEY).
                for (Database.SaveResult srLog : Database.insert(applicationLogs, false)) {
                    if (!srLog.isSuccess()) {           
                        for (Database.Error err : srLog.getErrors()) {
                            ApplicationLogger.logDMLException(
                                'Application Log fields that affected this error : ' + String.join(err.getFields(), ', '), 
                                srLog.getId(), err.getStatuscode() + ': ' + err.getMessage()
                            );
                        }
                    }
                }
            }
        } catch (Exception exp) {
            ApplicationLogger.logException(exp, this.calloutDataId);
        }
    }

    public void finish(Database.BatchableContext BC){
    }
}