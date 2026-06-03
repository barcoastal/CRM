/**
 * @Description: Batch class to update the customer information in the Account record based on the SAS getCustomerRecords Bulk API response.
 */
public inherited sharing class BatchSASUpdateAccountInfo  implements Database.Batchable<sObject>{

    public Id calloutDataId;

    //Constructor to assign the Callout Data Id using the Id from the predecessor Batch
    public BatchSASUpdateAccountInfo(Id dataId) {
        this.calloutDataId = dataId;
    }

    //Start method to query the Callout Data Item record related the Callout Data created in the predecessor batch
    public Database.QueryLocator start(Database.BatchableContext BC){

        String query;
        
        if (String.isNotBlank(this.calloutDataId)) {
            query = 'SELECT '+ SASUtility.getCDIfieldsToQuery('GetCustomerRecords') 
            + ' FROM Callout_Data_Item__c WHERE Callout_Data__c = \''+ this.calloutDataId + '\'';
        } else {
            throw new CustomException('Callout Data Id is required to execute the batch');
        }
        return Database.getQueryLocator(query);
    }

    //Execute method to update the Account records with customer information from the Callout Data Item
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

                Map<String, String> accIdWithLeadNumber = new Map<String, String>();
                
                for (Id customerId : customerIdSet) {
                    if (accountMap.containsKey(customerId)) {
                        Account acctInstance = accountMap.get(customerId);
                        Callout_Data_Item__c cdiInstance = accIdWithCDIMap.get(customerId);
                        if (acctInstance.IsPersonAccount) {
                            acctInstance.FirstName = cdiInstance.FirstName__c;
                            acctInstance.LastName = cdiInstance.LastName__c;
                            acctInstance.PersonEmail = cdiInstance.Email__c;
                            acctInstance.PersonMailingCountry = cdiInstance.Country__c;
                            acctInstance.PersonMailingCountryCode = 'US';
                            acctInstance.PersonMailingStreet = cdiInstance.AddressLine1__c;
                            acctInstance.PersonMailingCity = cdiInstance.City__c;
                            acctInstance.PersonMailingStateCode = cdiInstance.State__c;
                            acctInstance.PersonMailingPostalCode = cdiInstance.Postal_Code__c;
                        } else {
                            accIdWithLeadNumber.put(customerId, acctInstance.Lead_Number__c);
                        }
                        acctInstance.Phone = cdiInstance.Phone1__c;
                        //acctInstance.SSN__c = cdiInstance.SSN__c;
                        acctInstance.Status__c = cdiInstance.Customer_Status__c;
                        accountMap.put(customerId, acctInstance);
                    } else {
                        Application_Log__c log = new Application_Log__c(
                            Exception_Message__c = customerId + ' - Account does not exists', Log_Type__c = 'Error', 
                            Callout_Data_Item__c = accIdWithCDIMap.get(customerId).Id
                        );
                        applicationLogs.add(log); 
                    }
                }

                if (!accIdWithLeadNumber.isEmpty()) {
                    
                    List<Contact> contactList = ContactData.queryContacts(accIdWithLeadNumber);
                    
                    for (Contact cont : contactList) {
                        
                        Callout_Data_Item__c cdiInstance = accIdWithCDIMap.get(cont.AccountId);
                        
                        if (cont.AccountId != null && cont.Lead_Number__c != null 
                            && accIdWithLeadNumber.get(cont.AccountId).equals(cont.Lead_Number__c)
                        ) {
                            cont.FirstName = cdiInstance.FirstName__c;
                            cont.LastName = cdiInstance.LastName__c;
                            cont.Email = cdiInstance.Email__c;
                            cont.MailingStreet = cdiInstance.AddressLine1__c;                            
                            cont.MailingCountry = cdiInstance.Country__c;
                            cont.MailingCountryCode = 'US';
                            cont.MailingCity = cdiInstance.City__c;                            
                            cont.MailingStateCode = cdiInstance.State__c;
                            cont.MailingPostalCode = cdiInstance.Postal_Code__c;
                            cont.Phone = cdiInstance.Phone1__c;
                        }
                    }
                    //Update all the contact records related to the Business Account with the trust account information from SAS
                    for (Database.SaveResult srContact : Database.update(contactList, false)) {
                        if (!srContact.isSuccess()) {           
                            for (Database.Error err : srContact.getErrors()) {
                                ApplicationLogger.logDMLException(
                                    'Contact fields that affected this error : ' + String.join(err.getFields(), ', '), 
                                    srContact.getId(), err.getStatuscode() + ': ' + err.getMessage()
                                );
                            }
                        }
                    }
                }
                
                //Update all the account records with the trust account information from SAS
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