public with sharing class SyncToPaymentProcessorController {
    @AuraEnabled
    public static ApexActionResult initiateSync(String acctId) {
        final String SCOPE = 'SyncToPaymentProcessorController.initiateSync';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            List<Opportunity> oppList = AccountData.getActiveOppOfAccount(acctId);
            Id oppDebtSettlementRTId =  ApexUtil.getRecordTypeIdbyDeveloperName('Opportunity','Debt_Settlement');
            if(!opplist.isEmpty()){
                if(oppList[0].recordTypeId != oppDebtSettlementRTId){
                    Throw new auraException('Sync failed: Opportunity Record Type must be \'Debt Settlement\'.');
                }
            }
            ApexActionResult apiResult = ProcessorAPI.initiateCreateAPI(acctId); 
            copyApexActionResult(result, apiResult);       
        } catch (Exception ex) {
            ApplicationLogger.logException(ex, acctId);
            result.thrown(ex);
        }
        
        try{
            Account updateAccount = new Account(Id = acctId, Last_Synced_Date_Time__c = System.now(), Last_Synced_By__c = UserInfo.getUserId());
            UPDATE updateAccount;
        }catch(Exception ex){
            ApplicationLogger.logException(ex, acctId);        
        }
        return result;
    }

    @AuraEnabled
    public static String getPaymentProcessorType(String acctId) {
        List<Account> accounts = AccountData.queryAccount(acctId);
        if (accounts != null && !accounts.isEmpty()) {
            Account acctRecord = accounts[0];
            if (acctRecord.RecordType.DeveloperName == AccountUtil.RT_CREDITOR) {
                return 'SAS';
            } else {
                Program_Plan__c prgmPlan = ProcessorAPI.getProgramPlan(acctId);
                ProcessorAPI.validateProgramPlan(prgmPlan);
                return prgmPlan.Payment_Processor__r.Processor_Type__c;
            }
        }
        return null;
    }

    @AuraEnabled
    public static ApexActionResult syncPaymentProcessorIds(String acctId) {
        final String SCOPE = 'SyncToPaymentProcessorController.syncSFSASIds';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            String clientMessage = '';
            String debitScheduleMessage = '';
            String draftMessage = '';
            List<Account> accountsToUpdate = new List<Account>();
            List<Program_Plan__c> programPlansToUpdate = new List<Program_Plan__c>();
            List<Draft__c> draftsToUpdate = new List<Draft__c>();
            Program_Plan__c prgmPlanRecord = ProcessorAPI.getProgramPlan(acctId);
            String procType = prgmPlanRecord.Payment_Processor__r.Processor_Type__c;
            if (procType == 'SAS') {
                Integer noOfDraftsAlreadySynced = 0;
                Map<String, String> draftSFIdSASIdMap;
                List<Account> accounts = AccountData.queryAccount(acctId);
                List<Draft__c> drafts = DraftData.queryDraftsByProgramPlanId(prgmPlanRecord.Id);
                if (accounts != null && !accounts.isEmpty()) {
                    String clientSASId;
                    Account acctRecord = accounts[0];
                    ProcessorWrapper.API_Response customerResponse = SASApi.getCustomerDetails(acctId);
                    if(customerResponse.isSuccess == true){
                        clientSASId = customerResponse.externalId;
                    }
                    if (String.isBlank(clientSASId)) {
                        clientMessage += 'Client is not found in SAS. ';
                    } else if (acctRecord.External_SAS_Id__c == clientSASId) {
                        clientMessage += 'Client SAS Id is already synced. ';
                    } else {
                        Account accountToUpdate = new Account();
                        accountToUpdate.Id = acctId;
                        accountToUpdate.External_SAS_Id__c = clientSASId;
                        accountsToUpdate.add(accountToUpdate);
                    }
                    ProcessorWrapper.API_Response getDraftsResponse = SASApi.getDrafts(acctId);
                    if (getDraftsResponse != null && getDraftsResponse.getDebits != null && getDraftsResponse.getDebits.debitScheduleId != null) {
                        String debitScheduleIdSAS = getDraftsResponse.getDebits.debitScheduleId;
                        if (prgmPlanRecord.Debit_Schedule_Id__c == debitScheduleIdSAS) {
                            debitScheduleMessage += 'Debit Schedule SAS Id is already synced. ';
                        } else {
                            Program_Plan__c programPlanToUpdate = new Program_Plan__c();
                            programPlanToUpdate.Id = prgmPlanRecord.Id;
                            programPlanToUpdate.Debit_Schedule_Id__c = debitScheduleIdSAS;
                            programPlansToUpdate.add(programPlanToUpdate);
                        }
                        if (getDraftsResponse.getDebits.sfIdSasIdMap != null && !getDraftsResponse.getDebits.sfIdSasIdMap.isEmpty()) {
                            draftSFIdSASIdMap = getDraftsResponse.getDebits.sfIdSasIdMap;
                            if (draftSFIdSASIdMap != null && !draftSFIdSASIdMap.isEmpty()) {
                                for (Draft__c draftRecord : drafts) {
                                    if (draftSFIdSASIdMap.containsKey(draftRecord.Id)) {
                                        if (draftSFIdSASIdMap.get(draftRecord.Id) == draftRecord.External_SAS_Id__c) {
                                            noOfDraftsAlreadySynced++;
                                        } else {
                                            Draft__c draftToUpdate = new Draft__c();
                                            draftToUpdate.Id = draftRecord.Id;
                                            draftToUpdate.External_SAS_Id__c = draftSFIdSASIdMap.get(draftRecord.Id);
                                            draftsToUpdate.add(draftToUpdate);
                                        }
                                    }
                                }
                                if (noOfDraftsAlreadySynced > 0) {
                                    draftMessage += noOfDraftsAlreadySynced + ' draft Ids are already synced. ';
                                }
                            }
                        }
                    } else {
                        debitScheduleMessage += 'Debit Schedule is not found in SAS. ';
                    }
                }
                //OpportunityTriggerHandler.preventOpportunityLock = true;
                //ProgramPlanTriggerHandler.preventProgramPlanLock = true;
                if (!accountsToUpdate.isEmpty()) {
                    update accountsToUpdate;
                    clientMessage += 'Client SAS Id is synced. ';
                }
                if (!programPlansToUpdate.isEmpty()) {
                    OpportunityLockService.disableOppLockForSystemUpdates();
                    update programPlansToUpdate;
                    OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
                    debitScheduleMessage += 'Debit Schedule SAS Id is synced. ';
                }
                if (!draftsToUpdate.isEmpty()) {
                    update draftsToUpdate;
                    draftMessage += draftsToUpdate.size() + ' draft Ids are synced. ';
                    Integer remaining = (drafts.size() - noOfDraftsAlreadySynced - draftsToUpdate.size());
                    if (remaining > 0) {
                        draftMessage += remaining + ' drafts not found in SAS. ';
                    }
                }
                //OpportunityTriggerHandler.preventOpportunityLock = false;
                //ProgramPlanTriggerHandler.preventProgramPlanLock = false;
                result.message = clientMessage + debitScheduleMessage + draftMessage;
            } else {
                result.message = 'Sync Ids are supported only for SAS for now.';
            }
        } catch (Exception ex) {
            ApplicationLogger.logException(ex, acctId);
            result.thrown(ex);
        }
        return result;
    }
    @AuraEnabled(cacheable=true)
    public static Opportunity getLatestActiveOpportunityByAccount(Id accountId) {

        List<Opportunity> oppList = OpportunityData.getLatestActiveOpportunityByAccount(accountId);
        Map<Id, Opportunity> latestActiveMap = new Map<Id, Opportunity>();

        for (Opportunity opp : oppList) {
            if (opp.Version_Status__c != 'Active' && opp.Opportunity__c != null) {
                continue;
            }
            Id parentId = (opp.Opportunity__c != null) ? opp.Opportunity__c : opp.Id;
            if (!latestActiveMap.containsKey(parentId)) {
                latestActiveMap.put(parentId, opp);
            }
        }

        return !latestActiveMap.isEmpty() 
            ? latestActiveMap.values().iterator().next() 
            : null;
    }

    private static void copyApexActionResult(ApexActionResult source, ApexActionResult target) {
        source.status = target.status;
        source.message = target.message;
        source.data = target.data;
    }
}