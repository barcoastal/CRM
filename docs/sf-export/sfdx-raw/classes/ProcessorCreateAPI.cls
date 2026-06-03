public inherited sharing class ProcessorCreateAPI implements Queueable ,Database.AllowsCallouts {
    
    private final Integer noOfDraftsToProcess = 40;
    Id acctId;
    Id opportunityId;
    Id debtDetailId;
    Program_Plan__c prgmPlanRecord;
    String procType;
    PaymentProcessor paymentProcInstance;

    String accountProcId;
    Account acctRecord;
    Contact contRecord;
    Offer__c offerRecord;
    Blob contractData;
    List<Draft__c> draftList;
    List<Draft__c> pendingDraftList;
    List<Settlement__c> settlementList;
    Set<Id> draftIds;

    Integer totalDrafts = 0;
    Integer successfulDrafts = 0;
    Integer failedDrafts = 0;

    Integer totalSettlements = 0;
    Integer successfulSettlements = 0;
    Integer failedSettlements = 0;

    Account acctToUpdate;
    Program_Plan__c programPlanToUpdate;
    Opportunity oppToUpdate;
    List<Draft__c> draftsToUpdate = new List<Draft__c>();
    List<Settlement__c> settlementsToUpdate = new List<Settlement__c>();

    ApexActionResult result = new ApexActionResult();

    public ProcessorCreateAPI(Id sObjectId) {
        result.message = '';
        if (sObjectId != null) {
            String sObjectName = ApexUtil.getSObjectName(sObjectId);
            if (sObjectName == AccountUtil.getSObjectName()) {
                ApexUtil.requireValue('Account Id', sObjectId);
                this.acctId = sObjectId;
            } else if (sObjectName == DebtDetailUtil.getSObjectName()) {
                ApexUtil.requireValue('Debt Detail Id', sObjectId);
                this.debtDetailId = sObjectId;
            }
        } else {
            result.status = ApexActionResult.Statuses.ERROR;
            result.message = 'SObject Id is Blank in ProcessorCreateAPI Apex Class.';
        }
    }
    
        public ProcessorCreateAPI(Id acctId, List<Draft__c> remainingDrafts) {
        this.acctId = acctId;
        this.draftList = remainingDrafts;
        this.result = new ApexActionResult();
    }
    
    public ProcessorCreateAPI(Set<Id> draftIds, String acctId) {   
        if(acctId != null){                 
             this.acctId = acctId;              
             this.draftIds = draftIds;
         }
    }
    
     public void execute(QueueableContext context) {
        queryNeededData(); 
        syncRecords();
    }
    
    public ApexActionResult syncDrafts(){
        queryNeededDataForDraftSync();              
        paymentProcInstance = ProcessorAPI.getInstance(procType);
        createDraftAPI();
        createDraftAPIBulk();
        dmlOnProgramPlan();
        dmlOnOpportunity();
        dmlOnDrafts();        
        return result;
    }

    public ApexActionResult syncRecords() {
        
        if (this.acctId != null || this.debtDetailId != null) {
            //OpportunityTriggerHandler.preventOpportunityLock = true;
            //ProgramPlanTriggerHandler.preventProgramPlanLock = true;
            queryNeededData();
            if (clientSyncContext()) {
                paymentProcInstance = ProcessorAPI.getInstance(procType);
                createClientAPI();
                createBankAccountAPI();
                createDraftAPI();
                createDraftAPIBulk();
                initiateDocumentSync();
                dmlOnAccount();
                dmlOnProgramPlan();
                dmlOnOpportunity();
                dmlOnDrafts();
                dmlOnApplicationLogs();
                chainQueueableJob();
            } else if (creditorSyncContext()) {
                syncPayees();
            }
            //ProgramPlanTriggerHandler.preventProgramPlanLock = false;
            //OpportunityTriggerHandler.preventOpportunityLock = false;
        }                
        return result;
    }

    public ApexActionResult syncSettlements() {
        queryNeededDataForSettlementsSync();
        doSettlementsBulkAPI();
        dmlOnSettlements();
        dmlOnApplicationLogs();
        return result;
    }
    
    private void queryNeededDataForDraftSync() {
       
        acctRecord = ProcessorAPI.getAccountDetailsWithoutSyncStatusFilter(acctId);
        prgmPlanRecord = ProcessorAPI.getProgramPlan(acctId);
        if(prgmPlanRecord != null) {
            ApexUtil.requireValue('Program Plan', prgmPlanRecord);
            procType = prgmPlanRecord.Payment_Processor__r.Processor_Type__c;
            ApexUtil.requireValue('Processor Type', procType);
            ProcessorAPI.validateProgramPlan(prgmPlanRecord);
            accountProcId = String.valueOf(acctRecord.get('External_' + procType + '_Id__c'));
            if(draftIds != null){
                draftList = ProcessorAPI.getDraftDetails(prgmPlanRecord.Id, acctId);
            }
        }else  {
            throw new CustomException('The Client does not have any active opportunity.');
        }
    }

    private void queryNeededData() {
        /* Querying account without filter to sync draft payments with processor and to prevent null point exception. */
        acctRecord = ProcessorAPI.getAccountDetailsWithoutSyncStatusFilter(acctId);
        ProcessorAPI.validateAccount(acctRecord);
        if (clientSyncContext()) {
            contRecord = getContact(acctRecord);
            ProcessorAPI.validateContact(contRecord);
            prgmPlanRecord = ProcessorAPI.getProgramPlan(acctId);
            if(prgmPlanRecord != null) {
                procType = prgmPlanRecord.Payment_Processor__r.Processor_Type__c;
                ApexUtil.requireValue('Processor Type', procType);
                ProcessorAPI.validateProgramPlan(prgmPlanRecord);
                contractData = ProcessorAPI.getContractDetails(acctId);
                if (this.draftList == Null) {
                   draftList = ProcessorAPI.getDraftDetails(prgmPlanRecord.Id, acctId);
                }
            } else  {
                throw new CustomException('The Client does not have any active opportunity.');
            }
        } else if (creditorSyncContext()) {
            contRecord = ProcessorAPI.getContact(acctRecord);
            ProcessorAPI.validateContact(contRecord);
        }
    }

    private Boolean clientSyncContext() {
        return acctRecord.RecordType.DeveloperName == AccountUtil.RT_CLIENT || acctRecord.RecordType.DeveloperName == AccountUtil.RT_BUSINESS_ACCOUNT;
    }

    private Boolean creditorSyncContext() {
        return acctRecord.RecordType.DeveloperName == AccountUtil.RT_CREDITOR;
    }

    private void queryNeededDataForSettlementsSync() {
        if (debtDetailId != null) {
            List<Debt_Details__c> debtDetails = DebtDetailsData.getDebtDetails(debtDetailId);
            if (debtDetails != null && !debtDetails.isEmpty()) {
                Debt_Details__c debtDetail = debtDetails[0];
                acctId = debtDetail.Account__c;
                if (acctId != null) {
                    prgmPlanRecord = ProcessorAPI.getProgramPlan(acctId);
                    ProcessorAPI.validateProgramPlan(prgmPlanRecord);
                    procType = prgmPlanRecord.Payment_Processor__r.Processor_Type__c;
                    ApexUtil.requireValue('Processor Type', procType);
                    acctRecord = (Account)debtDetail.getSObject('Account__r');
                    accountProcId = String.valueOf(acctRecord.get('External_' + procType + '_Id__c'));
                }
            } else {
                result.status = ApexActionResult.Statuses.ERROR;
                result.message = 'Debt Detail is not linked with the Account.';
            }
            List<Offer__c> offersList = OfferData.queryOffersByDebtDetailId(debtDetailId);
            if (offersList != null && !offersList.isEmpty()) {
                Map<Id, Offer__c> offerMap = new Map<Id, Offer__c>(offersList);
                acctId = offersList[0].Client_Account__c;
                settlementList = ProcessorAPI.getSettlementDetailsByOfferId(offerMap.keySet());
            } else {
                result.status = ApexActionResult.Statuses.ERROR;
                result.message = 'The Creditor does not have any accepted offer';
            }
        }
    }

    private void createClientAPI() {
        if (acctRecord != null) {
            accountProcId = String.valueOf(acctRecord.get('External_' + procType + '_Id__c'));
            if (acctRecord.Sync_Status__c != 'In Sync') {
                ProcessorWrapper.CreateClientRequest clientRequest = constructClientRequest();
                ProcessorWrapper.CreateBankAccountRequest bankAccountRequest = constructBankAccountRequest();
                ProcessorWrapper.API_Response apiResponse = paymentProcInstance.createClient(clientRequest, bankAccountRequest);
                if (apiResponse != null) {
                    acctToUpdate = new Account();
                    acctToUpdate.Id = acctRecord.Id;
                    if (apiResponse.isSuccess == false) {
                        result.status = ApexActionResult.Statuses.ERROR;
                        result.message = apiResponse.message;
                        acctToUpdate.Sync_Status__c = 'Sync Failed';
                    } else if (apiResponse.isSuccess == true) {
                        if (String.isBlank(accountProcId)) {
                            accountProcId = apiResponse.externalId;
                            acctToUpdate.put('External_' + procType + '_Id__c', accountProcId);
                            acctToUpdate.Status__c = 'Active';
                        }
                        acctToUpdate.Sync_Status__c = 'In Sync';
                        result.message = 'The client is synced successfully with ' + procType + '.';
                    }
                }
            }
        }
    }
    
    public static void updateClient(String acctId, String oppId){
        try{
            ApexUtil.requireValue('Account Id', acctId);
            Account acctRecord = ProcessorAPI.getAccountDetailsWithoutSyncStatusFilter(acctId);
            Program_Plan__c prgmPlanRecord = ProcessorAPI.getProgramPlan(acctId, oppId);
            ApexUtil.requireValue('Program Plan', prgmPlanRecord);
            String procType = prgmPlanRecord.Payment_Processor__r.Processor_Type__c;
            ApexUtil.requireValue('Processor Type', procType);
            String accountProcId = String.valueOf(acctRecord.get('External_' + procType + '_Id__c'));
            PaymentProcessor paymentProcInstance = ProcessorAPI.getInstance(procType);
            Contact contRecord = getContact(acctRecord);
            Blob contractData = ProcessorAPI.getContractDetails(acctRecord.Id);
            
             if (String.isNotBlank(accountProcId)) {
                ApexActionResult result = new ApexActionResult();
                ProcessorWrapper.UpdateClientRequest updateRequest = new ProcessorWrapper.UpdateClientRequest();
                updateRequest.clientWrap = new ClientWrapper(acctRecord, contRecord, contractData);
                ProcessorWrapper.API_Response apiResponse = paymentProcInstance.updateClient(updateRequest);
                if (apiResponse != null) {
                    Account acctToUpdate = new Account();
                    acctToUpdate.Id = acctRecord.Id;
                    if (apiResponse.isSuccess == false) {
                        result.status = ApexActionResult.Statuses.ERROR;
                        result.message = apiResponse.message;
                        acctToUpdate.Sync_Status__c = 'Sync Failed';
                        createActivityTask(acctRecord, 'Failure: Phone Number Sync Status','The customer has update the phone number, but the sync to the payment processor has failed. Please retry the sync manually.' );  
                    } else if (apiResponse.isSuccess == true) {
                        if (String.isBlank(accountProcId)) {
                            accountProcId = apiResponse.externalId;
                            acctToUpdate.put('External_' + procType + '_Id__c', accountProcId);
                            acctToUpdate.Status__c = 'Active';
                        }
                        acctToUpdate.Sync_Status__c = 'In Sync';
                        result.message += 'The client phone number is updated successfully with ' + procType + '.';
                        Task systemTask = SystemActivityService.createSystemActivity('Success: Phone Number Sync Status',
                            'The customer has updated the phone number, and the sync to the payment processor was completed successfully.',
                            acctRecord.Id);
                         INSERT systemTask; 
                    }
                }
            }
        }catch(Exception ex) {
            ApplicationLogger.logException(ex, acctId);
        }
    }

    private void createBankAccountAPI() {
        if (String.isNotBlank(accountProcId)) {
            ProcessorWrapper.CreateBankAccountRequest bankAccountRequest = constructBankAccountRequest();
            ProcessorWrapper.API_Response apiResponse = paymentProcInstance.createBankAccount(bankAccountRequest);
            if (apiResponse != null) {
                if (acctToUpdate == null) {
                    acctToUpdate = new Account();
                    acctToUpdate.Id = acctRecord.Id;
                }
                if (apiResponse.isSuccess == false) {
                    result.status = ApexActionResult.Statuses.ERROR;
                    result.message += apiResponse.message;
                    acctToUpdate.Bank_Account_Sync_Status__c = 'Sync Failed';
                } else if (apiResponse.isSuccess == true) {
                    acctToUpdate.Bank_Account_Sync_Status__c = 'In Sync';
                    result.message += 'The Bank Account is synced successfully with  ' + procType + '.';
                }
            }
        }
    }
    
    public static void createBankAccountAPI(String acctId, String oppId){
        try{
            ApexUtil.requireValue('Account Id', acctId);
            Account acctInstance = ProcessorAPI.getAccountDetailsWithoutSyncStatusFilter(acctId);
            Program_Plan__c prgmPlanRecord = ProcessorAPI.getProgramPlan(acctId, oppId);
            ApexUtil.requireValue('Program Plan', prgmPlanRecord);
            String procType = prgmPlanRecord.Payment_Processor__r.Processor_Type__c;
            ApexUtil.requireValue('Processor Type', procType);
            String accountProcId = String.valueOf(acctInstance.get('External_' + procType + '_Id__c'));
            PaymentProcessor paymentProcInstance = ProcessorAPI.getInstance(procType);
                        
            if (String.isNotBlank(accountProcId)) {
                ApexActionResult result = new ApexActionResult();
                ProcessorWrapper.CreateBankAccountRequest bankAccountRequest = new ProcessorWrapper.CreateBankAccountRequest();
                bankAccountRequest.bankAccountWrap = new BankAccountWrapper(acctInstance, procType);
                ProcessorWrapper.API_Response apiResponse = paymentProcInstance.createBankAccount(bankAccountRequest);
                if (apiResponse != null) {
                    Account acctToUpdate = new Account();
                    acctToUpdate.Id = acctInstance.Id;
                    if (apiResponse.isSuccess == false) {
                        result.status = ApexActionResult.Statuses.ERROR;
                        result.message += apiResponse.message;
                        acctToUpdate.Bank_Account_Sync_Status__c = 'Sync Failed';
                        createActivityTask(acctInstance, 'Failure: Bank Change Contract Sign and Sync Status','The customer has signed the Bank Change Contract, but the sync to the payment processor has failed. Please retry the sync manually.' );  
                    } else if (apiResponse.isSuccess == true) {
                        acctToUpdate.Bank_Account_Sync_Status__c = 'In Sync';
                        result.message += 'The Bank Account is synced successfully with  ' + procType + '.';
                        Task systemTask = SystemActivityService.createSystemActivity('Success: Bank Change Contract Sign and Sync Status',
                            'The customer has signed the Bank Change Contract, and the sync to the payment processor was completed successfully.',
                            acctInstance.Id);
                         INSERT systemTask; 
                    }
                     if (acctToUpdate != null) {
                        AccountHandler.skipAccountTrigger = true;
                        update acctToUpdate;
                        AccountHandler.skipAccountTrigger = false;
                    }
                }
            }
        }catch(Exception ex) {
            ApplicationLogger.logException(ex, acctId);
        }       
    }
    
    private static void createActivityTask(Account acct, String subject, String description){
        Task newTask = new Task();
        newTask.recordTypeId = TaskUtil.getRecordTypeId(TaskUtil.RT_ACTIVITY);
        newTask.Subject = subject;
        newTask.Status = 'Pending';
        newTask.Description = description;
        newTask.whatId = acct.Id;
        newTask.ownerId = acct.OwnerId;
        INSERT newTask;
    }
    
    private void createDraftAPI() {
        if (String.isNotBlank(accountProcId) && draftList != null && !draftList.isEmpty() && procType == PaymentProcessorUtil.PROC_RAM) {
            Integer totalDrafts = draftList.size();
            Integer successfulDrafts = 0;
            Integer failedDrafts = 0;
                 
           List<Draft__c> draftsToProcess = new List<Draft__c>();
           pendingDraftList = new List<Draft__c>(); 

            if (totalDrafts > noOfDraftsToProcess) {
                for (Integer i = 0; i < draftList.size(); i++) {
                    if (i < noOfDraftsToProcess) {
                        draftsToProcess.add(draftList.get(i));
                    } else {
                        pendingDraftList.add(draftList.get(i));
                    }
                }
            } else {
                draftsToProcess = draftList;
            }
            for (Draft__c draftRecord : draftsToProcess) {
                ProcessorWrapper.CreateDraftRequest draftRequest = constructDraftRequest(draftRecord);
                if (String.isNotBlank(accountProcId)) {
                    draftRequest.draftWrap.clientExternalProcId = accountProcId;
                } else {
                    if (procType == 'SAS') {
                        draftRequest.draftWrap.clientExternalProcId = draftRecord.Program_Plan__r.Client__r.External_SAS_Id__c;
                    } else if (procType == 'RAM') {
                        draftRequest.draftWrap.clientExternalProcId = draftRecord.Program_Plan__r.Client__r.External_RAM_Id__c;
                    }
                }
                if (draftRecord.Sync_Status__c != 'In Sync') {                    
                    ProcessorWrapper.API_Response apiResponse = paymentProcInstance.createDraft(draftRequest);
                    if (apiResponse != null) {
                        if (apiResponse.isSuccess == false) {
                            failedDrafts++;
                            draftRecord.Sync_Status__c = 'Sync Failed';
                        } else if (apiResponse.isSuccess == true) {
                            successfulDrafts++;
                            draftRecord.put('External_' + procType + '_Id__c', apiResponse.externalId);
                            draftRecord.Sync_Status__c = 'In Sync';
                            if (draftRecord.Draft_Status__c != DraftUtil.STATUS_CANCELLED && draftRecord.Draft_Status__c != DraftUtil.STATUS_SKIPPED) {
                                draftRecord.Draft_Status__c = 'Scheduled';
                            }
                        }
                        draftsToUpdate.add(draftRecord);
                    }
                }
            }
            String apiResult = 'Draft Sync Status => Total Drafts: ' + totalDrafts + ' Synced Successfully: ' + successfulDrafts + ' Sync Failed: ' + failedDrafts;
            if (procType == PaymentProcessorUtil.PROC_RAM && successfulDrafts > 0){
                if (prgmPlanRecord.Opportunity__c != null && prgmPlanRecord.Opportunity__r.External_Debit_Schedule_Id__c == null) {
                    oppToUpdate = new Opportunity();
                    oppToUpdate.Id = prgmPlanRecord.Opportunity__c;
                    oppToUpdate.External_Debit_Schedule_Id__c = accountProcId;
                }
            }    
            if (failedDrafts > 0) {
                result.status = ApexActionResult.Statuses.ERROR;
            }
            if(successfulDrafts + failedDrafts < totalDrafts){
                apiResult += '. The remaining drafts are queued for processing and will be synced shortly.';
            }
            result.message += apiResult;
            ApplicationLogger.insertStoredLogs();
        }
    }

    private void createDraftAPIBulk() {
        if (String.isNotBlank(accountProcId) && draftList != null && !draftList.isEmpty() && procType == PaymentProcessorUtil.PROC_SAS) {
            List<DraftWrapper> draftWrappersCreateList = new List<DraftWrapper>();
            List<DraftWrapper> draftWrappersAddList = new List<DraftWrapper>();
            List<DraftWrapper> draftWrappersUpdateList = new List<DraftWrapper>();
            List<DraftWrapper> draftWrappersCancelList = new List<DraftWrapper>();
            for (Draft__c draftRecord : draftList) {
                DraftWrapper draftWrap = new DraftWrapper(draftRecord);
                draftWrap.clientExternalProcId = accountProcId;
                if (String.isBlank(draftWrap.debitScheduleId) && draftWrap.draftStatus == DraftUtil.STATUS_PENDING) {
                    draftWrappersCreateList.add(draftWrap);
                    totalDrafts++;
                } else {
                    if (String.isBlank(draftWrap.externalSASId) && draftWrap.draftStatus == DraftUtil.STATUS_PENDING) {
                        draftWrappersAddList.add(draftWrap);
                        totalDrafts++;
                    } else if (String.isNotBlank(draftWrap.externalSASId)) {
                        if (draftWrap.draftStatus == DraftUtil.STATUS_CANCELLED || draftWrap.draftStatus == DraftUtil.STATUS_SKIPPED) {
                            draftWrappersCancelList.add(draftWrap);
                            totalDrafts++;
                        } else {
                            draftWrappersUpdateList.add(draftWrap);
                            totalDrafts++;
                        }
                    }
                }
            }
            if (!draftWrappersCreateList.isEmpty()) {
                initiateDraftsBulkAPI(draftWrappersCreateList, DraftUtil.SAS_API_CREATE_DEBIT_SCHEDULE);
            }
            if (!draftWrappersAddList.isEmpty()) {
                initiateDraftsBulkAPI(draftWrappersAddList, DraftUtil.SAS_API_ADD_DEBIT_SCHEDULE);
            }
            if (!draftWrappersUpdateList.isEmpty()) {
                initiateDraftsBulkAPI(draftWrappersUpdateList, DraftUtil.SAS_API_UPDATE_DEBIT_SCHEDULE);
            }
            if (!draftWrappersCancelList.isEmpty()) {
                initiateDraftsBulkAPI(draftWrappersCancelList, DraftUtil.SAS_API_CANCEL_DEBIT_SCHEDULE);
            }
        }
    }

    private void initiateDraftsBulkAPI(List<DraftWrapper> draftWrapList, String apiMethod) {
        ProcessorWrapper.SyncDraftsRequest draftsRequest = new ProcessorWrapper.SyncDraftsRequest();
        draftsRequest.draftWrapList = draftWrapList;
        draftsRequest.apiMethod = apiMethod;
        ProcessorWrapper.API_Response debitScheduleResults = SASApi.syncDrafts(draftsRequest);
        processDraftsAPIResults(debitScheduleResults, apiMethod, draftWrapList);
    }

    private void processDraftsAPIResults(ProcessorWrapper.API_Response debitScheduleResults, String apiMethod, List<DraftWrapper> draftWrapperList) {
        if (debitScheduleResults != null) {
            if (debitScheduleResults.isSuccess == true) {
                if (debitScheduleResults.results != null && !debitScheduleResults.results.isEmpty()) {
                    Integer counter = 0;
                    for (ProcessorWrapper.LineItemResponse apiResult : debitScheduleResults.results) {
                        DraftWrapper draftWrapperRecord = draftWrapperList[counter];
                        Draft__c draftToUpdate = new Draft__c();
                        draftToUpdate.Id = apiResult.sfId;
                        if (apiResult.isSuccess == true) {
                            successfulDrafts++;
                            draftToUpdate.Sync_Status__c = 'In Sync';
                            draftToUpdate.External_SAS_Id__c = apiResult.externalId;
                            if (draftWrapperRecord.draftStatus != DraftUtil.STATUS_CANCELLED && draftWrapperRecord.draftStatus != DraftUtil.STATUS_SKIPPED) {
                                draftToUpdate.Draft_Status__c = 'Scheduled';
                            }
                        } else {
                            failedDrafts++;
                            draftToUpdate.Sync_Status__c = 'Sync Failed';
                            ApplicationLogger.logException('Sync to Payment Processor Failed', draftToUpdate.Id, apiResult.errorMessage);
                        }
                        draftsToUpdate.add(draftToUpdate);
                        counter++;
                    }
                }
                if (apiMethod == DraftUtil.SAS_API_CREATE_DEBIT_SCHEDULE) {
                    programPlanToUpdate = new Program_Plan__c();
                    programPlanToUpdate.Id = prgmPlanRecord.Id;
                    programPlanToUpdate.Debit_Schedule_Id__c = debitScheduleResults.externalId;
                    
                    if (prgmPlanRecord.Opportunity__c != null) {
                        oppToUpdate = new Opportunity();
                        oppToUpdate.Id = prgmPlanRecord.Opportunity__c;
                        oppToUpdate.External_Debit_Schedule_Id__c = debitScheduleResults.externalId;
                    }
                }
            }
        }
    }

    private void doSettlementsBulkAPI() {
        if (procType == PaymentProcessorUtil.PROC_SAS && String.isNotBlank(accountProcId)) {
            if (settlementList != null && !settlementList.isEmpty()) {
                List<SettlementWrapper> settlementWrappersCreateList = new List<SettlementWrapper>();
                List<SettlementWrapper> settlementWrappersUpdateList = new List<SettlementWrapper>();
                List<SettlementWrapper> settlementWrappersCancelList = new List<SettlementWrapper>();
                for (Settlement__c settlementRecord : settlementList) {
                    SettlementWrapper settlementWrap = new SettlementWrapper(settlementRecord);
                    settlementWrap.debitScheduleId = prgmPlanRecord.Debit_Schedule_Id__c;
                    if (String.isBlank(settlementWrap.settlementExternalProcId)) {
                        settlementWrappersCreateList.add(settlementWrap);
                        totalSettlements++;
                    } else if (String.isNotBlank(settlementWrap.settlementExternalProcId)) {
                        if (settlementWrap.settlementStatus == SettlementUtil.STATUS_CANCELLED) {
                            settlementWrappersCancelList.add(settlementWrap);
                            totalSettlements++;
                        } else {
                            settlementWrappersUpdateList.add(settlementWrap);
                            totalSettlements++;
                        }
                    }
                }
                if (!settlementWrappersCreateList.isEmpty()) {
                    initiateSettlementsBulkAPI(settlementWrappersCreateList, SettlementUtil.SAS_API_CREATE_SETTLEMENT_SCHEDULE);
                } 
                if (!settlementWrappersUpdateList.isEmpty()) {
                    initiateSettlementsBulkAPI(settlementWrappersUpdateList, SettlementUtil.SAS_API_UPDATE_PAYOUTS);
                } 
                if (!settlementWrappersCancelList.isEmpty()) {
                    initiateSettlementsBulkAPI(settlementWrappersCancelList, SettlementUtil.SAS_API_CANCEL_PAYOUTS);
                } 
                if (totalSettlements == successfulSettlements) {
                    result.status = ApexActionResult.Statuses.SUCCESS;
                } else {
                    result.status = ApexActionResult.Statuses.ERROR;
                }
                result.message = 'Number of Settlements Processed: ' + totalSettlements + ' Number of Settlements Synced Successfully: ' + successfulSettlements + ' Number of settlements failed: ' + failedSettlements;
            } else {
                result.status = ApexActionResult.Statuses.ERROR;
                result.message = 'No Settlements are Sync Pending for this Creditor.';
            }
        } else {
            result.status = ApexActionResult.Statuses.ERROR;
            result.message = 'Client is not synced with the Payment Processor.';
        }
    }
    
    private void chainQueueableJob() {
        if (pendingDraftList != null && !pendingDraftList.isEmpty()) {    
            if (Limits.getQueueableJobs() < Limits.getLimitQueueableJobs()) {
                 System.enqueueJob(new ProcessorCreateAPI(this.acctId, this.pendingDraftList));
            } else {
                ApplicationLogger.logException('Queueable limit reached for draft processing.','', this.acctId);
            }
        }
    }

    private void initiateSettlementsBulkAPI(List<SettlementWrapper> settlementWrapList, String apiMethod) {
        ProcessorWrapper.SyncSettlementsRequest settlementRequest = new ProcessorWrapper.SyncSettlementsRequest();
        settlementRequest.settlementWrapList = settlementWrapList;
        settlementRequest.apiMethod = apiMethod;
        ProcessorWrapper.API_Response settlementScheduleResults = SASApi.syncSettlements(settlementRequest);
        processSettlementsAPIResults(settlementScheduleResults, apiMethod, settlementWrapList);
    }

    private void processSettlementsAPIResults(ProcessorWrapper.API_Response settlementScheduleResults, String apiMethod, List<SettlementWrapper> settlementWrapList) {
        if (settlementScheduleResults != null) {
            if (settlementScheduleResults.isSuccess == true) {
                if (settlementScheduleResults.results != null && !settlementScheduleResults.results.isEmpty()) {
                    Integer counter = 0;
                    Boolean hasError = false;
                    for (ProcessorWrapper.LineItemResponse apiResult : settlementScheduleResults.results) {
                        SettlementWrapper settlementWrapperRecord = settlementWrapList[counter];
                        Settlement__c settlementToUpdate = new Settlement__c();
                        settlementToUpdate.Id = apiResult.sfId;
                        if (apiResult.isSuccess == true) {
                            successfulSettlements++;
                            settlementToUpdate.Sync_Status__c = 'In Sync';
                            settlementToUpdate.External_SAS_Id__c = apiResult.externalId;
                            if (settlementWrapperRecord.settlementStatus != DraftUtil.STATUS_CANCELLED) {
                                settlementToUpdate.Settlement_Status__c = 'Scheduled';
                            }
                        } else {
                            failedSettlements++;
                            settlementToUpdate.Sync_Status__c = 'Sync Failed';
                            ApplicationLogger.logException('Sync to Payment Processor Failed', settlementToUpdate.Id, apiResult.errorMessage);
                        }
                        settlementsToUpdate.add(settlementToUpdate);
                        counter++;
                    }
                }
            }
        }
    }

    private ProcessorWrapper.CreateClientRequest constructClientRequest() {
        ProcessorWrapper.CreateClientRequest createClientRequest = new ProcessorWrapper.CreateClientRequest();
        createClientRequest.clientWrap = new ClientWrapper(acctRecord, contRecord, contractData);
        return createClientRequest;
    }

    private ProcessorWrapper.CreateBankAccountRequest constructBankAccountRequest() {
        ProcessorWrapper.CreateBankAccountRequest createBankAccountRequest = new ProcessorWrapper.CreateBankAccountRequest();        
        createBankAccountRequest.bankAccountWrap = new BankAccountWrapper(acctRecord, procType);
        return createBankAccountRequest;
    }
    
    private ProcessorWrapper.CreateDraftRequest constructDraftRequest(Draft__c draftRecord) {
        ProcessorWrapper.CreateDraftRequest createDraftRequest = new ProcessorWrapper.CreateDraftRequest();        
        createDraftRequest.draftWrap = new DraftWrapper(draftRecord);
        return createDraftRequest;
    }

    private void syncPayees() {
        try {
            ClientWrapper clientWrap = new ClientWrapper(acctRecord, contRecord, null);
            PaymentProcessor paymentProcInstance = ProcessorAPI.getInstance(PaymentProcessorUtil.PROC_SAS);
            ProcessorWrapper.API_Response apiResponse;
            ProcessorWrapper.PayeeRequest payeeRequest = new ProcessorWrapper.PayeeRequest();
            payeeRequest.clientWrap = clientWrap;
            apiResponse = paymentProcInstance.syncPayee(payeeRequest);
            if (apiResponse != null) {
                Account accountToDML = new Account();
                accountToDML.Id = acctRecord.Id;
                if (apiResponse.isSuccess == false) {
                    accountToDML.Sync_Status__c = 'Sync Failed';
                    ApplicationLogger.logException(null, accountToDML.Id, apiResponse.message);
                    result.status = ApexActionResult.Statuses.Error;
                    result.message = 'Failed: ' + (apiResponse.message != null ? apiResponse.message : '');
                } else if (apiResponse.isSuccess == true) {
                    accountToDML.Sync_Status__c = 'In Sync';
                    accountToDML.External_SAS_Id__c = apiResponse.externalId;
                    result.status = ApexActionResult.Statuses.SUCCESS;
                    result.message = 'Payee Details are successfully synced with Payment Processor.';
                }
                update accountToDML;
            }  
            ApplicationLogger.insertStoredLogs();
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, acctId);
        }
    }

    private void dmlOnAccount() {
        if (acctToUpdate != null) {
            AccountHandler.skipAccountTrigger = true;
            update acctToUpdate;
            AccountHandler.skipAccountTrigger = false;
        }
    }

    private void dmlOnProgramPlan() {
        if (programPlanToUpdate != null) {
            OpportunityLockService.disableOppLockForSystemUpdates();
            update programPlanToUpdate;
            OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        }
    }
    
    private void dmlOnOpportunity() {
        if (oppToUpdate != null) {
            OpportunityLockService.disableOppLockForSystemUpdates();
            update oppToUpdate;
            OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        }
    }

    private void dmlOnDrafts() {
        if (draftsToUpdate != null && !draftsToUpdate.isEmpty()) {
            OpportunityLockService.disableOppLockForSystemUpdates();
            update draftsToUpdate;
            OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        }
    }

    private void dmlOnSettlements() {
        if (settlementsToUpdate != null && !settlementsToUpdate.isEmpty()) {
            update settlementsToUpdate;
        }
    }

    private void dmlOnApplicationLogs() {
        ApplicationLogger.insertStoredLogs();
    }

    private void initiateDocumentSync() {
        if (String.isNotBlank(accountProcId) && acctRecord.Contract_Sync_Status__c != 'In Sync') {
            syncDocuments(acctId);
        }
    }

    @future(callout=true)
    private static void syncDocuments(Id acctId) {
        try {
            Set<Id> contentDocumentIds = ProcessorAPI.getContentDocumentIdsForContractSync(acctId);
            ProcessorAPI.uploadContracts(contentDocumentIds);
        } catch(Exception ex) {
            ApplicationLogger.logException(ex, acctId);
        }
    }

    public static Contact getContact(Account acct) {
        Contact contWithoutSOQLMemory;
        if (acct != null) {
            List<Contact> contactList = ContactData.getPrimaryContact(acct);
            if (contactList != null && !contactList.isEmpty()) {
                contWithoutSOQLMemory = (Contact)ApexUtil.removeSOQLMemory(contactList[0]);
            }
        }
        return contWithoutSOQLMemory;
    }
}