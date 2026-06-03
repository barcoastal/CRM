/**
 * @Description: Class contains generic methods to invoke the API callout methods based on the Processor Type
 */
public inherited sharing class ProcessorAPI {

    public static ApexActionResult initiateCreateAPI(Id acctId) {
        ProcessorCreateAPI procCreateApi = new ProcessorCreateAPI(acctId);
        return procCreateApi.syncRecords();
   }

    public static ApexActionResult initiateSettlementsSyncAPI(Id sObjectId) {
        ProcessorCreateAPI procCreateApi = new ProcessorCreateAPI(sObjectId);
        return procCreateApi.syncSettlements();
    }
 
    /**
     * @Description: A container method which invokes UploadContractsAPI class to do the pre-processing of request construction 
     * and invoke the payment processor to do the API call
    */
    public static void uploadContracts(Set<Id> contentDocumentIds) {
        UploadContractsAPI.uploadContracts(contentDocumentIds);  
    }

    public static Boolean cancelClient(Id acctId) {
        Account acct = getAccountDetailsWithoutSyncStatusFilter(acctId);
        validateAccount(acct);
        String procType = ProcessorAPI.getProcessorType(acct);
        ApexUtil.requireValue('Processor Type', procType);
        ProcessorWrapper.CancelClientRequest cancelClientRequest = new ProcessorWrapper.CancelClientRequest();
        cancelClientRequest.clientWrap = new ClientWrapper(acct, null, null);
        PaymentProcessor paymentProcInstance = ProcessorAPI.getInstance(procType);
        ProcessorWrapper.API_Response result = paymentProcInstance.cancelClient(cancelClientRequest);
        Boolean isSuccess = apiResultAccountDML(result, acctId);
        return isSuccess;
    }
    
    public static Boolean setCustomerStatus(Id acctId, String customerStatus) {
        Boolean isSuccess = false;
            Account acct = getAccountDetailsWithoutSyncStatusFilter(acctId);
        validateAccount(acct);
        String procType = ProcessorAPI.getProcessorType(acct);
        ApexUtil.requireValue('Processor Type', procType);
            ProcessorWrapper.SetCustomerStatuRequest setCustomerStatusRequest = new ProcessorWrapper.SetCustomerStatuRequest();
            setCustomerStatusRequest.clientWrap = new ClientWrapper(acct, null, null);
            PaymentProcessor paymentProcInstance = ProcessorAPI.getInstance(procType);
            ProcessorWrapper.API_Response result = paymentProcInstance.setCustomerStatus(setCustomerStatusRequest, customerStatus);
            isSuccess = apiResultAccountDML(result, acctId);
        return isSuccess;
    }

    private static Boolean apiResultAccountDML(ProcessorWrapper.API_Response result, Id acctId) {
        Account accountToUpdate = new Account();
        Boolean isSuccess = false;
        accountToUpdate.Id = acctId;
        if (result.isSuccess == true || result.statusCode == '200') {
            accountToUpdate.Sync_Status__c = 'In Sync';
            isSuccess = true;
        } else {
            accountToUpdate.Sync_Status__c = 'Sync Failed';
        }
        update accountToUpdate;
        return isSuccess;
    }

    /**
     * @Description: Method to invoke the callout to get the trust balances for all of the customers based on the Processor Type
     * @param processorType - Name of the Processor
     * @return apiResponse - Wrapper class to store the response from the callout
     */
    public static ProcessorWrapper.API_Response getBalances(String processorType) {
        ProcessorWrapper.API_Response apiResponse;
        try {
            PaymentProcessor paymentProcInstance = getInstance(processorType);
            apiResponse = paymentProcInstance.getBalances();
        } catch (System.Exception exp) {
            ApplicationLogger.logException(exp, null);
        }
        return apiResponse;
    }

    /**
     * @Description: Method to invoke the callout to get the all the customer information based on the Processor Type
     * @param processorType - Name of the Processor
     * @return apiResponse - Wrapper class to store the response from the callout
     */
    public static ProcessorWrapper.API_Response getCustomerRecords(String processorType, Datetime startDateTime, Datetime endDateTime) {
        ProcessorWrapper.API_Response apiResponse;
        try {
            PaymentProcessor paymentProcInstance = getInstance(processorType);
            apiResponse = paymentProcInstance.getCustomerRecords(startDateTime, endDateTime);
        } catch (System.Exception exp) {
            ApplicationLogger.logException(exp, null);
        }
        return apiResponse;
    }

    /**
     * @Description: Method to invoke the callout to get the status of the payment based on primary key or invoice number
     * @param processorType - Name of the Processor
     * @return apiResponse - Wrapper class to store the response from the callout
     */
    public static ProcessorWrapper.API_Response getPaymentStatus(String processorType) {
        ProcessorWrapper.API_Response apiResponse;
        try {
            PaymentProcessor paymentProcInstance = getInstance(processorType);
            apiResponse = paymentProcInstance.getPaymentStatus();
        } catch (System.Exception exp) {
            ApplicationLogger.logException(exp, null);
        }
        return apiResponse;
    }

    public static Program_Plan__c getProgramPlan(Id acctId) {
        Program_Plan__c prgmPlanWithoutSOQLMemory;
        List<Program_Plan__c> programPlans = ProgramPlanData.getActiveProgramPlan(acctId);
        if (programPlans != null && !programPlans.isEmpty()) {
            prgmPlanWithoutSOQLMemory = (Program_Plan__c)ApexUtil.removeSOQLMemory(programPlans[0]);
        }
        return prgmPlanWithoutSOQLMemory;
    }

    public static Program_Plan__c getProgramPlan(Id acctId, Id opptId) {
        Program_Plan__c prgmPlanWithoutSOQLMemory;
        List<Program_Plan__c> programPlans = ProgramPlanData.getActiveProgramPlan(acctId, opptId);
        if (programPlans != null && !programPlans.isEmpty()) {
            prgmPlanWithoutSOQLMemory = (Program_Plan__c)ApexUtil.removeSOQLMemory(programPlans[0]);
        }
        return prgmPlanWithoutSOQLMemory;
    }

    public static void validateProgramPlan(Program_Plan__c prgmPlan) {
        if (prgmPlan == null) {
            throw new CustomException('The Client does not have any active opportunity.');
        } else if (prgmPlan.Payment_Processor__c == null || prgmPlan.Payment_Processor__r.Processor_Type__c == null) {
            throw new CustomException('Program Plan does not have valid payment processor');
        } 
    }

    public static void validateAccount(Account acct) {
        if (acct == null) {
            throw new CustomException('No accounts found for the account Id');
        } 
    }

    public static void validateContact(Contact cont) {
        if (cont == null) {
            throw new CustomException('Contact is not found for this account');
        } 
    }

    public static Account getAccountDetails(Id acctId) {
        Account acctWithoutSOQLMemory;
        if (acctId != null) {
            List<Account> acctList = AccountData.queryAccountWithUnSyncedStatus(acctId);
            if (acctList != null && !acctList.isEmpty()) {
                acctWithoutSOQLMemory = (Account)ApexUtil.removeSOQLMemory(acctList[0]);
            }
        }
        return acctWithoutSOQLMemory;
    }

    public static Account getAccountDetailsWithoutSyncStatusFilter(Id acctId) {
        Account acctWithoutSOQLMemory;
        if (acctId != null) {
            List<Account> acctList = AccountData.queryAccount(acctId);
            if (acctList != null && !acctList.isEmpty()) {
                acctWithoutSOQLMemory = (Account)ApexUtil.removeSOQLMemory(acctList[0]);
            }
        }
        return acctWithoutSOQLMemory;
    }

    public static String getProcessorType(Account acct) {
        String procType;
        if (acct.External_SAS_Id__c != null) {
            procType = PaymentProcessorSvc.PROC_SAS;
        } else if(acct.External_RAM_Id__c != null){
            procType = PaymentProcessorSvc.PROC_RAM;
        }
        return procType;
    }

    public static List<Account> getAccountDetails(Set<Id> acctIds) {
        List<Account> acctsWithoutSOQLMemory;
        List<Account> acctList = AccountData.queryAccounts(acctIds);
        if (acctList != null && !acctList.isEmpty()) {
            acctsWithoutSOQLMemory = (List<Account>)ApexUtil.removeSOQLMemory(acctList);
        }
        return acctsWithoutSOQLMemory;
    }

    public static Contact getContact(Account acct) {
        Contact contWithoutSOQLMemory;
        if (acct != null) {
            List<Contact> contactList = ContactData.queryContact(acct);
            if (contactList != null && !contactList.isEmpty()) {
                contWithoutSOQLMemory = (Contact)ApexUtil.removeSOQLMemory(contactList[0]);
            }
        }
        return contWithoutSOQLMemory;
    }

    public static Account getBankAccountDetails(Id acctId) {
        Account acctWithoutSOQLMemory;
        if (acctId != null) {
            List<Account> acctList = AccountData.queryBankAccountDetails(acctId);
            if (acctList != null && !acctList.isEmpty()) {
                acctWithoutSOQLMemory = (Account)ApexUtil.removeSOQLMemory(acctList[0]);
            }
        }
        return acctWithoutSOQLMemory;
    }

    /**
     * @description: Query the contract content of the client agreement document of the account record.
    **/
    public static Blob getContractDetails(Id acctId) {
        Blob contractDetails;
        if (acctId != null) {
            Opportunity oppRecord = OpportunityData.getActiveOpportunityId(acctId);
            if (oppRecord != null) {
                contractDetails = FileData.getContractData(oppRecord);
            }
        }
        return contractDetails;
    }

    public static Set<Id> getContentDocumentIdsForContractSync(Id acctId) {
        Set<Id> contentDocumentIds;
        if (acctId != null) {
            Opportunity oppRecord = OpportunityData.getActiveOpportunityId(acctId);
            if (oppRecord != null) {
                contentDocumentIds = FileData.getContentDocumentIdsForSync(oppRecord);
            }
        }
        return contentDocumentIds;
    }
    
    /*public static Map<String, Id> getContentDocumentIdsForRAMContractSync(Id acctId) {
        //Set<Id> contentDocumentIds;
        Map<String, Id> fileMap = new Map<String, Id>();
        if (acctId != null) {
            Opportunity oppRecord = OpportunityData.getActiveOpportunityId(acctId);
            if (oppRecord != null) {
                fileMap = FileData.getContentDocumentIdsForRAMContractSync(oppRecord);
                if(fileMap != null && fileMap.values() !=  null){
                    for(Id contentId : fileMap.values()){
                        system.debug(':::contentId::'+contentId);
                        contentDocumentIds.add(contentId);
                    }
                    //contentDocumentIds.addAll(fileMap.values());
                }
            }
        }
       return fileMap;
    }
    
    public static Set<Id> getContentDocumentIdsForDriverLicense(Id acctId) {
        Set<Id> contentDocumentIds;
        if (acctId != null) {
            Opportunity oppRecord = OpportunityData.getActiveOpportunityId(acctId);
            if (oppRecord != null) {
                ContentVersion con = FileData.getDriverLicenceDocument(oppRecord);
                if(con != null && con.ContentDocumentId != null){
                    contentDocumentIds = new Set<Id>{con.ContentDocumentId};
                }                
            }
        }
        return contentDocumentIds;
    }*/

    public static List<Draft__c> getDraftDetails(Id programPlanId,Id accountId) {
        List<Draft__c> draftsWithoutSOQLMemory;
        List<Draft__c> draftList = DraftData.queryDraftsWithUnSyncedStatus(programPlanId, accountId);
        if (draftList != null && !draftList.isEmpty()) {
            draftsWithoutSOQLMemory = (List<Draft__c>)ApexUtil.removeSOQLMemory(draftList);
        }
        return draftsWithoutSOQLMemory;
    }

    public static List<Draft__c> getDraftDetails(Set<Id> draftIds) {
        List<Draft__c> draftsWithoutSOQLMemory;
        if (draftIds != null && !draftIds.isEmpty()) {
            List<Draft__c> draftList = DraftData.queryDraftsWithUnSyncedStatus(draftIds);
            if (draftList != null && !draftList.isEmpty()) {
                draftsWithoutSOQLMemory = (List<Draft__c>)ApexUtil.removeSOQLMemory(draftList);
            }
        }
        return draftsWithoutSOQLMemory;
    }

    public static List<Settlement__c> getSettlementDetailsByOfferId(Set<Id> offerIds) {
        List<Settlement__c> settlementsWithoutSOQLMemory;
        List<Settlement__c> settlementList = querySettlementsWithUnSyncedStatusByOfferId(offerIds);
        if (settlementList != null && !settlementList.isEmpty()) {
            settlementsWithoutSOQLMemory = (List<Settlement__c>)ApexUtil.removeSOQLMemory(settlementList);
        }
        return settlementsWithoutSOQLMemory;
    }

    public static PaymentProcessor getInstance(String processorName) {
        PaymentProcessor paymentProcInstance;
        Type t = Type.forName(processorName + 'Api');
        paymentProcInstance = (PaymentProcessor)t.newInstance();
        return paymentProcInstance;
    }
    
    /**
     * @Description: Method to invoke the callout to get the debit schedule 
     * @param processorType - Name of the Processor
     * @return apiResponse - Wrapper class to store the response from the callout
     */
    public static ProcessorWrapper.API_Response getDebitSchedule(String processorType, Datetime startDateTime, Datetime endDateTime, Integer currentPage, Integer pageSize) {
        ProcessorWrapper.API_Response apiResponse;
        try {
            PaymentProcessor paymentProcInstance = getInstance(processorType);
            apiResponse = paymentProcInstance.getDebitSchedule(startDateTime, endDateTime, currentPage, pageSize);
        } catch (System.Exception exp) {
            ApplicationLogger.logException(exp, null);
        }
        return apiResponse;
    }

    public static List<Settlement__c> querySettlementsWithUnSyncedStatusByOfferId(Set<Id> offerIds) {
        return [SELECT Id, External_SAS_Id__c, Settlement_Date__c, SettlementAmount__c, Settlement_Status__c, Offer__r.Debt_Details__r.Current_Creditor__r.External_SAS_Id__c, 
            Client_Account__c, Client_Account__r.External_SAS_Id__c FROM Settlement__c WHERE Offer__c = :offerIds AND Sync_Status__c IN ('Sync Pending', 'Sync Failed', null)
            ORDER BY Settlement_Date__c
        ];
    }

}