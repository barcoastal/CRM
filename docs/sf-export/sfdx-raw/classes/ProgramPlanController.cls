public without sharing class ProgramPlanController {

    public static List<Draft__c> draftsToUpsert = new List<Draft__c>();
    public static List<Draft__c> draftsToDelete = new List<Draft__c>();
    public static Map<String, Integer> monthYearNoOfPaymentsMap = new Map<String, Integer>();
    public static final List<String> STATUS_TO_SKIP_FOR_RETAINER_FEE = new List<String>{'Completed', 'Processing', 'NSF','Cancelled'};
    private static Set<String> monthYearSetForCitadel = new Set<String>();
    private static Decimal citadelFee = 0.00;
    private static Boolean fetchCitadelFee = false;
    private static Set<String> COMPLETED_STATUS = new Set<String>{'Completed', 'Processing'};


    @AuraEnabled
    public static ApexActionResult changeFutureDraftDays(
        String oppId,
        String updatedDrafts,
        String newPaymentDay
    ) {
        final String SCOPE = 'ProgramPlanController.changeFutureDraftDays';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            List<DraftWrapper> draftUpdates =
                (List<DraftWrapper>) JSON.deserialize(updatedDrafts, List<DraftWrapper>.class);

            List<Draft__c> draftsToUpdate = new List<Draft__c>();
            for (DraftWrapper upd : draftUpdates) {
                if (String.isBlank(upd.recordId)) {
                    continue;
                }
                Draft__c draftRecord = new Draft__c(Id = upd.recordId);
                draftRecord.Draft_Date__c      = Date.valueOf(upd.paymentDate);
                draftRecord.Processor_Fee__c   = upd.processorFee;
                draftRecord.Service_Fee__c     = upd.serviceFee;
                draftRecord.Citadel_Fee__c     = upd.citaldelFee;
                draftRecord.Draft_Amount__c = upd.paymentAmount;
                draftsToUpdate.add(draftRecord);
            }

            if (!draftsToUpdate.isEmpty()) {
                OpportunityLockService.disableOppLockForSystemUpdates();
                update draftsToUpdate;
                OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
            }
            if (String.isNotBlank(newPaymentDay) && String.isNotBlank(oppId)) {
                List<Program_Plan__c> plans = ProgramPlanData.getProgramPlansByOpportunityId(oppId);
                if (!plans.isEmpty()) {
                    OpportunityLockService.disableOppLockForSystemUpdates();
                    update new Program_Plan__c(
                        Id = plans[0].Id,
                        Weekly_Payment_Day__c = newPaymentDay
                    );
                    OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
                }
            }

        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }

    @AuraEnabled(cacheable=true)
    public static Decimal getWirePaymentFee(Id opportunityId) {
        try {
            List<Program_Plan__c> plans = [
                SELECT Payment_Processor__r.Name
                FROM Program_Plan__c
                WHERE Opportunity__c = :opportunityId
                LIMIT 1
            ];
            String processorName = (!plans.isEmpty() && plans[0].Payment_Processor__r != null)
                ? plans[0].Payment_Processor__r.Name
                : null;
            List<Wire_Payment_Config__mdt> configs = [
                SELECT Wire_Fee_Amount__c
                FROM Wire_Payment_Config__mdt
                WHERE Label = :processorName
                LIMIT 1
            ];
            return (!configs.isEmpty()) ? configs[0].Wire_Fee_Amount__c : 0;
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
    }

    @AuraEnabled
    public static Id upsertWireDraft(Draft__c draft) {
        try {
            OpportunityLockService.disableOppLockForSystemUpdates();
            upsert draft;
            OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
            return draft.Id;
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
    }

    @AuraEnabled
    public static void linkWirePaymentFile(List<Id> contentDocumentIds, Id opportunityId, Id accountId, Id draftId) {
        try {
            List<ContentDocumentLink> links = new List<ContentDocumentLink>();
            for (Id docId : contentDocumentIds) {
                if (opportunityId != null) {
                    links.add(new ContentDocumentLink(
                        ContentDocumentId = docId,
                        LinkedEntityId = opportunityId,
                        ShareType = 'V',
                        Visibility = 'AllUsers'
                    ));
                }
                if (accountId != null) {
                    links.add(new ContentDocumentLink(
                        ContentDocumentId = docId,
                        LinkedEntityId = accountId,
                        ShareType = 'V',
                        Visibility = 'AllUsers'
                    ));
                }
                if (draftId != null) {
                    links.add(new ContentDocumentLink(
                        ContentDocumentId = docId,
                        LinkedEntityId = draftId,
                        ShareType = 'V',
                        Visibility = 'AllUsers'
                    ));
                }
            }
            if (!links.isEmpty()) {
                OpportunityLockService.disableOppLockForSystemUpdates();
                Database.insert(links, false);
                OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
            }
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
    }

    @AuraEnabled
    public static List<Map<String, Object>> getWireDraftFiles(Id draftId) {
        try {
            List<Map<String, Object>> files = new List<Map<String, Object>>();
            for (ContentDocumentLink cdl : [
                SELECT ContentDocument.Id, ContentDocument.Title,
                       ContentDocument.FileExtension, ContentDocument.ContentSize,
                       ContentDocument.LastModifiedDate
                FROM ContentDocumentLink
                WHERE LinkedEntityId = :draftId
                ORDER BY ContentDocument.LastModifiedDate DESC
            ]) {
                Map<String, Object> fileInfo = new Map<String, Object>();
                fileInfo.put('documentId', (String) cdl.ContentDocument.Id);
                fileInfo.put('name', cdl.ContentDocument.Title);
                fileInfo.put('extension', cdl.ContentDocument.FileExtension);
                fileInfo.put('size', cdl.ContentDocument.ContentSize);
                files.add(fileInfo);
            }
            return files;
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteWireFiles(List<Id> contentDocumentIds) {
        try {
            delete [SELECT Id FROM ContentDocument WHERE Id IN :contentDocumentIds];
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
    }

    @AuraEnabled
    public static void renameWireFiles(List<Id> contentDocumentIds, Boolean addSuffix) {
        try {
            List<ContentDocument> docs = [SELECT Id, Title FROM ContentDocument WHERE Id IN :contentDocumentIds];
            for (ContentDocument doc : docs) {
                if (addSuffix) {
                    if (!doc.Title.endsWith(' (draft)')) {
                        doc.Title = doc.Title + ' (draft)';
                    }
                } else {
                    if (doc.Title.endsWith(' (draft)')) {
                        doc.Title = doc.Title.removeEnd(' (draft)');
                    }
                }
            }
            if (!docs.isEmpty()) {
                update docs;
            }
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static Payment_Calculator_Setting__mdt getPaymentCalculatorSetting(String settingName) {
        try {
            return [
                SELECT DeveloperName, Active__c, First_Payment_Max_Business_Days__c,Retainer_Amount_Adjustment_Range__c
                FROM Payment_Calculator_Setting__mdt 
                WHERE DeveloperName = :settingName
                LIMIT 1
            ];
        } catch (Exception e) {
            return null;
        }
    } 

    @AuraEnabled
    public static ApexActionResult getDebtDetails(Id opportunityId) {
        final String SCOPE = 'ProgramPlanController.getDebtDetails';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            ApexUtil.requireValue('Opportunity Id', opportunityId);
            List<DebtAggregation> debtAggregationWrapList = new List<DebtAggregation>();
            for (AggregateResult aggResult : DebtDetailsData.aggregateDebtDetails(opportunityId)) {
                DebtAggregation debtAggregationWrap = new DebtAggregation();
                debtAggregationWrap.noOfDebts = (Integer)aggResult.get('noOfDebts');
                debtAggregationWrap.totalDebt = (Decimal)aggResult.get('totalDebt');
                debtAggregationWrapList.add(debtAggregationWrap);
            }
            result.data = JSON.serialize(debtAggregationWrapList);
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }

         
    @AuraEnabled
    public static Opportunity getOpportunityBasedOnAccountId(Id accountId) {
        Opportunity opp = [
            SELECT Id, Name, StageName, CloseDate 
            FROM Opportunity 
            WHERE AccountId = :accountId AND Active_Opportunity__c = true 
            LIMIT 1
        ];
        
        return opp;
    }

    @AuraEnabled
    public static ApexActionResult getCurrentRecordDetails(Id oppId) {
        final String SCOPE = 'ProgramPlanController.getCurrentRecordDetails';
        ApexActionResult result = new ApexActionResult(SCOPE);
        ProgramPlanResult prgmPlanResult = new ProgramPlanResult();
        try {
            ApexUtil.requireValue('Opportunity Id', oppId);
            List<Program_Plan__c> prgmPlans = ProgramPlanData.queryProgramPlanDetails(
                oppId, 
                new List<String>(ProgramPlanWrapper.programPlanFields)
            );
            if (!prgmPlans.isEmpty()) {
                ProgramPlanWrapper prgmPlanWrapper = new ProgramPlanWrapper(prgmPlans[0]);
                List<DraftWrapper> draftWrappers;
                if (prgmPlanWrapper.programRescheduledAlready()) {
                    draftWrappers = queryDrafts(prgmPlanWrapper.accountId, prgmPlanWrapper.opportunityId);
                }
                prgmPlanResult.prgmPlanWrapper = prgmPlanWrapper;
                prgmPlanResult.draftWrappers = draftWrappers;
                result.data = JSON.serialize(prgmPlanResult);
            }
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
        return result;
    }

    private static List<DraftWrapper> queryDrafts(Id accountId, Id opportunityId) {
        List<DraftWrapper> draftWrappers = new List<DraftWrapper>();
        List<Opportunity> oppList = OpportunityData.getOpportunityDataById(opportunityId);

        for (Draft__c draftRecord : DraftData.queryDrafts(accountId, opportunityId)) {
            if((oppList[0].Version_Status__c == 'Archived' 
            && draftRecord.Program_Plan__r.Opportunity__c == opportunityId) || 
            (oppList[0].Version_Status__c != 'Archived')) {
            DraftWrapper draftWrap = new DraftWrapper(draftRecord);
            draftWrappers.add(draftWrap);
        }
        }
        return draftWrappers;
    }

    public class ProgramPlanResult {
        public ProgramPlanWrapper prgmPlanWrapper;
        public List<DraftWrapper> draftWrappers;
    }
    
    @AuraEnabled
    public static ApexActionResult getSetupFeeMapping(String legalNetworkType) {

        final String SCOPE = 'ProgramPlanController.getSetupFeeMapping';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            SetupFeeWrapper feeWrap = new SetupFeeWrapper();
            feeWrap.fee1 = SetupFeeMappingData.getSetupFee(legalNetworkType, true);
            feeWrap.fee2 = SetupFeeMappingData.getSetupFee(legalNetworkType, false);
            result.data = JSON.serialize(feeWrap);
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
        return result;
    }

    @AuraEnabled(cacheable=true)
    public static Boolean checkCompletedPaymentValidation(Id opportunityId, Id clientId) {
        Decimal totalAmount = 0;
        Decimal rescheduleAmount = 0;
        
        List<Opportunity> opportunityList  = OpportunityData.getOpportunityDataById(opportunityId);
        Id parentOppId = opportunityList[0].Opportunity__c;

        if (parentOppId != null) {
            List<AggregateResult> aggResults = DraftData.getCompletedDraftDetails(parentOppId, clientId);
            if (!aggResults.isEmpty()) {
                for (AggregateResult ar : aggResults) {
                    if (ar.get('completedDraftsAmount') != null) {
                        totalAmount += (Decimal)ar.get('completedDraftsAmount');
                    }
                }
            }
        }

        List<Program_Plan__c> programPlanList = ProgramPlanData.getProgramPlansByOpportunityId(opportunityId);
        for (Program_Plan__c pp : programPlanList) {
            if (pp.Completed_Amount_During_Reschedule__c != null) {
                rescheduleAmount += pp.Completed_Amount_During_Reschedule__c;
            }
        }
        return (totalAmount.setScale(2, RoundingMode.HALF_UP) == rescheduleAmount.setScale(2, RoundingMode.HALF_UP));
    }

    @AuraEnabled
    public static ApexActionResult rescheduleProgram(String paymentCalcElements) {
        final String SCOPE = 'ProgramPlanController.rescheduleProgram';
        ApexActionResult result = new ApexActionResult(SCOPE);
        RescheduleResult resultWrap = new RescheduleResult();
        try {
            List<DraftWrapper> draftWrappers = new List<DraftWrapper>();
            PaymentCalculatorElements paymentCalcElementWrapper = (PaymentCalculatorElements)JSON.deserialize(paymentCalcElements, PaymentCalculatorElements.class);
            List<Program_Plan__c> programPlanList = ProgramPlanData.getActiveProgramPlan(paymentCalcElementWrapper.opportunityId);

            if (programPlanList != null && !programPlanList.isEmpty()) {
                Program_Plan__c prgmPlan = programPlanList[0];
                paymentCalcElementWrapper.parentProgramPlanId = prgmPlan.Id;
                paymentCalcElementWrapper.completedDraftsAmount = prgmPlan.Completed_Drafts_Amount__c;
                paymentCalcElementWrapper.completedDraftsCount = (Integer)prgmPlan.Completed_Drafts_Count__c;
                paymentCalcElementWrapper.lastDraftCompletedDate = prgmPlan.Last_Completed_Draft_Date__c;
            }
            List<Program_Plan__c> currentProgramPlanList = ProgramPlanData.getProgramPlanById(paymentCalcElementWrapper.parentProgramPlanId);
            Set<String> monthYearForCompletedPayments = new Set<String>();
            List<Draft__c> paymentRecords = DraftData.queryLockedDrafts(currentProgramPlanList[0].Client__c , currentProgramPlanList[0].Opportunity__c);
            List<DraftWrapper> payments = new List<DraftWrapper>();
            paymentCalcElementWrapper.isRetainerPayment = false;
            Decimal completedDraftRetainerAmount = 0;
            Integer completedDraftRetainerCount = 0;
            Decimal completedDraftAmount = 0;
            Integer completedDraftCount = 0;
            Integer draftPaymentCount = 0;
            for(Draft__c dr : paymentRecords) {
                if(!dr.Retainer_SetupFee_Draft__c) {
                    DraftWrapper df = new DraftWrapper(dr);
                    payments.add(df);
                    draftPaymentCount++;
                    if(dr.Draft_Status__c == 'Completed') {
                        completedDraftAmount = completedDraftAmount + dr.Draft_Total_Amount__c;
                        completedDraftCount++;
                    }
                } else {
                    DraftWrapper df = new DraftWrapper(dr);
                    payments.add(df);
                    paymentCalcElementWrapper.isRetainerPayment = true;
                    if(dr.Retainer_SetupFee_Draft__c && dr.Draft_Status__c == 'Completed') {
                        completedDraftRetainerAmount = completedDraftRetainerAmount + dr.Draft_Total_Amount__c;
                        completedDraftRetainerCount++;
                    }
                }
                if(COMPLETED_STATUS.contains(dr.Draft_Status__c)) {
                    monthYearForCompletedPayments.add(getMonthYearValueFromDate(dr.Draft_Date__c));
                }

            }
        
            Decimal lockedAmout = 0;Integer nonnsfCount = 0;
            for(DraftWrapper drPayment : payments) {
                if( drPayment.totalAmount  != null && !DraftUtil.CancledAndNsfStatus.contains(drPayment.draftStatus) && drPayment.draftStatus!= DraftUtil.STATUS_SKIPPED) {
                    lockedAmout = lockedAmout + drPayment.totalAmount;
                    if( paymentCalcElementWrapper.firstPaymentDateValue  < System.today()) {
                         paymentCalcElementWrapper.firstPaymentDateValue = System.today();
                    }
                }
                if(!drPayment.retainerSetupFeeRecord && 
                   (DraftUtil.CancledAndNsfStatus.contains(drPayment.draftStatus) || drPayment.draftStatus == DraftUtil.STATUS_SKIPPED)) {
                    nonnsfCount++;
                }
            }
            
            paymentCalcElementWrapper.completedRetainerAmount = completedDraftRetainerAmount;
            paymentCalcElementWrapper.completedRetainerCount = completedDraftRetainerCount;
            paymentCalcElementWrapper.completedDraftsAmount = completedDraftAmount;
            paymentCalcElementWrapper.completedDraftsCount = completedDraftCount;

            if ((!paymentCalcElementWrapper.isRetainerPayment  || paymentCalcElementWrapper.isCompletedRetainer) && String.isNotBlank(paymentCalcElementWrapper.firstPaymentDate)) {
                String dtString = paymentCalcElementWrapper.firstPaymentDate.substringBefore('T');
                List<String> dateElements = dtString.Split('-');
                paymentCalcElementWrapper.firstPaymentDateValue = Date.newInstance(
                    Integer.valueOf(dateElements[0]), 
                    Integer.valueOf(dateElements[1]), 
                    Integer.valueOf(dateElements[2])
                );
            }
            PaymentCalculator paymentCalc = new PaymentCalculator(paymentCalcElementWrapper);
            if (paymentCalcElementWrapper != null && 
                String.isNotBlank(paymentCalcElementWrapper.monthYearSetForCitadel)) {
                paymentCalc.monthYearSetForCitadel = (Set<String>) JSON.deserialize(
                    paymentCalcElementWrapper.monthYearSetForCitadel, Set<String>.class);
                
                paymentCalc.monthYearToSkip = (Set<String>) JSON.deserialize(
                    paymentCalcElementWrapper.monthYearSetForCitadel, Set<String>.class);
                
                if (paymentCalc.monthYearSetForCitadel != null) {
                    for (String monthYear : paymentCalc.monthYearSetForCitadel) {
                        paymentCalc.monthYearNoOfPaymentsMap.put(monthYear, 0);
                    }
                }
            }
            if(monthYearForCompletedPayments.size() > 0) {
                paymentCalc.monthYearSetForCitadel.addAll(monthYearForCompletedPayments);
                paymentCalc.monthYearToSkip.addAll(monthYearForCompletedPayments);
                for (String monthYear : monthYearForCompletedPayments) {
                    paymentCalc.monthYearNoOfPaymentsMap.put(monthYear, 0);
                }
            }
            paymentCalc.payCalcElements.noOfActualPayments =  paymentCalc.payCalcElements.noOfActualPayments - (draftPaymentCount - nonnsfCount);
            paymentCalc.payCalcElements.totalPaymentAmount = paymentCalc.payCalcElements.totalPaymentAmount;
            List<DraftWrapper> rescheduledDraftWrapper = paymentCalc.rescheduleProgram();
            payments.addAll(rescheduledDraftWrapper);
            resultWrap.payments = payments;
            resultWrap.childPayments = rescheduledDraftWrapper[0].childrens;
            resultWrap.retainerFee = rescheduledDraftWrapper[0].retainerFee;
            resultWrap.setupFee = rescheduledDraftWrapper[0].setupFee;
            /*Decimal runningBalance = 0.00;
            for (Draft__c draftInstance : DraftData.queryLockedDrafts(paymentCalcElementWrapper.parentProgramPlanId)) {
                DraftWrapper lockedDraftWrap = new DraftWrapper(draftInstance);
                runningBalance += lockedDraftWrap.totalAmount;
                lockedDraftWrap.runningBalance = runningBalance;
                draftWrappers.add(lockedDraftWrap);
            }
            List<Draft__c> unlockedDrafts = DraftData.queryUnlockedDrafts(paymentCalcElementWrapper.parentProgramPlanId);
            draftsToDelete = unlockedDrafts.clone();
            Integer i = 0;
            for (DraftWrapper draftWrap : rescheduledDraftWrapper) {
                Draft__c draftInstance = draftWrap.getDraftInstance();
                if (i < unlockedDrafts.size()) {
                    draftInstance.Id = unlockedDrafts[i].Id;
                    draftWrap.recordId = unlockedDrafts[i].Id;
                    if (draftWrap.retainerSetupFeeRecord == true) {
                        runningBalance = 0;
                    } else {
                        runningBalance += draftWrap.totalAmount;
                    }
                    draftWrap.runningBalance = runningBalance;
                    draftsToDelete.remove(0);
                    i++;
                }
                draftsToUpsert.add(draftInstance);
                /*if (i == 1) {
                    DraftWrapper draftWrapTemp = new DraftWrapper();
                    draftWrapTemp.runningBalance = 1;
                    draftWrap.childrens = new List<DraftWrapper> {draftWrapTemp};
                }*/
                /*draftWrappers.add(draftWrap);
            }*/
            result.data = JSON.serialize(resultWrap);
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }

    public class RescheduleResult {
        public List<DraftWrapper> payments;
        public List<DraftWrapper> childPayments;
        public Decimal retainerFee;
        public Decimal setupFee;
    }
    
    @AuraEnabled
    public static ApexActionResult createSkippedPaymentDrafts(string draftRecord){
        final String SCOPE = 'ProgramPlanController.createSkippedPaymentDrafts';
        ApexActionResult result = new ApexActionResult(SCOPE);
        skippedResult resultWrap = new skippedResult();
        try {
            Map<String, Object> draftMap = (Map<String, Object>) JSON.deserializeUntyped(draftRecord); 
            String paymentsString = (String) draftMap.get('payments');
            DraftWrapper payments = (DraftWrapper) JSON.deserialize(paymentsString, DraftWrapper.class);
            Draft__c draftInstance = payments.getDraftInstance();
            Draft__c clonedDraft = draftInstance.clone(false, false, false, false);
            clonedDraft.Draft_Status__c = DraftUtil.STATUS_PENDING;
            if(FeatureManagement.checkPermission('Edit_Payments')) {
                OpportunityLockService.disableOppLockForSystemUpdates();
            }
            insert clonedDraft;
            if(FeatureManagement.checkPermission('Edit_Payments')) {
              OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
            }
            DraftWrapper clonedDraftWrapper = new DraftWrapper(clonedDraft);
            resultWrap.draftPayment = clonedDraftWrapper;
            result.data = JSON.serialize(resultWrap);       
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }
    public class skippedResult {
        public DraftWrapper draftPayment;
    }

    @AuraEnabled
    public static ApexActionResult saveProgram(String programPlan, List<String> updatedDraftIds, Boolean isReschedule) {
        final String SCOPE = 'ProgramPlanController.saveProgram';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            Boolean allowPaymentToEdit = false;
            if(FeatureManagement.checkPermission('Edit_Payments')) {
                allowPaymentToEdit = true;
            }
            List<Draft__c> draftsToUpsert = new List<Draft__c>();
            List<Fee__c> feesToUpsert = new List<Fee__c>();
            List<Fee__c> feesToDeleteList = new List<Fee__c>();
            List<Draft__c> draftsToDelete = new List<Draft__c>();
            Map<String, Object> programPlanMap = (Map<String, Object>) JSON.deserializeUntyped(programPlan);

            // Iterate through the map and print key-value pairs
            for (String key : programPlanMap.keySet()) {
                System.debug('Key: ' + key + ', Value: ' + programPlanMap.get(key));
            }

            Opportunity oppInstance = new Opportunity();
             Id accountId;
            Decimal completedAmount = 0;
            Integer completedCount = 0;
            //Added the opportunity Id assignment - CRM-218
            if (programPlanMap.containsKey('opportunityId')) {
                oppInstance.Id = Id.valueOf((String)programPlanMap.get('opportunityId'));
            }
            if (programPlanMap.containsKey('completedCount')) {
                completedCount = (Integer) programPlanMap.get('completedCount');
            }
            if (programPlanMap.containsKey('completedAmount')) {
                completedAmount = (Decimal) programPlanMap.get('completedAmount');
            }

            if (programPlanMap.containsKey('program')) {
                String programString = (String)programPlanMap.get('program');
                ProgramPlanWrapper prgmPlanWrap = (ProgramPlanWrapper)JSON.deserialize(programString, ProgramPlanWrapper.class);
                Program_Plan__c prgmPlan = prgmPlanWrap.getProgramPlanInstance();                
                prgmPlan.Last_Rescheduled_By__c = UserInfo.getUserId();
                prgmPlan.Last_Rescheduled_Date_Time__c = System.now();
         prgmPlan.Completed_Amount_During_Reschedule__c = completedAmount;  
                prgmPlan.Completed_Count_During_Reschedule__c = completedCount;
                if (programPlanMap.containsKey('paymentProcessorId')) {
                    ID processorID = (ID) programPlanMap.get('paymentProcessorId');
                    if (processorID != null) {
                        prgmPlan.Payment_Processor__c = processorID;
                        // Fetch the existing program plan details to compare the current processor
                        // This is necessary to determine if the processor is being manually overridden
                        Map<ID, Program_Plan__c> existingProgramPlanMap = new Map<ID, Program_Plan__c>(ProgramPlanData.getProgramPlans(new Set<ID>{prgmPlan.ID}));
                        
                        // Check if the existing program plan has a different payment processor
                        // This condition ensures we only mark as manually overridden if there's an actual change
                        if (existingProgramPlanMap.containsKey(prgmPlan.ID) && existingProgramPlanMap.get(prgmPlan.ID).Payment_Processor__c != processorID) {
                            // Set the Processor_Manually_Overridden__c flag to true
                            // This indicates that the user has manually changed the payment processor, overriding any automatic assignment
                            prgmPlan.Processor_Manually_Overridden__c = true;
                        }
                    }
                }       
            if(allowPaymentToEdit) {
                    OpportunityLockService.disableOppLockForSystemUpdates();
            }
                upsert prgmPlan;
        if(allowPaymentToEdit) {
                    OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
                }

                //Clearing the Reschedule program plan pending flag once the program plan is rescheduled and saved.
                List<Program_Plan__c> programPlans = [SELECT Id, Client__c FROM Program_Plan__c WHERE Id = :prgmPlan.Id];
                if (programPlans != null && !programPlans.isEmpty()) {
                    Account acctToMDL = new Account();
                    acctToMDL.Id = programPlans[0].Client__c;
                    acctToMDL.Reschedule_Program_Pending__c = false;
                    update acctToMDL;
                }

                //Assigning program plan fields to opportunity for DocuSign document generation.
                oppInstance.Id = prgmPlan.Opportunity__c;
                oppInstance.DS_First_Payment_Date__c = prgmPlan.First_Payment_Date__c;
                oppInstance.DS_Payment_Term__c = prgmPlan.Payment_Term__c;
                oppInstance.DS_Payment_Frequency__c = prgmPlan.Payment_Frequency__c;
                oppInstance.DS_Program_Fee_Percentage__c = Decimal.valueOf(prgmPlan.Program_Fee_Percentage__c);
                oppInstance.DS_Retainer_Percentage__c = Decimal.valueOf(prgmPlan.Retainer_Percentage__c);
                oppInstance.DS_Settlement_Percentage__c = Decimal.valueOf(prgmPlan.Settlement_Percentage__c);
            }
            if (programPlanMap.containsKey('payments')) {
                queryCitadelFee(oppInstance.Id);
                String paymentsString = (String)programPlanMap.get('payments');
                List<DraftWrapper> payments = (List<DraftWrapper>)JSON.deserialize(paymentsString, List<DraftWrapper>.class);
                if (payments != null && !payments.isEmpty()) {
                    Id programPlanId = payments[payments.size() - 1].programPlanId;
                    accountId = getAccountId(programPlanId);
                    List<Draft__c> draftsInDB = DraftData.queryUnlockedDrafts(programPlanId);
                    draftsToDelete = draftsInDB.clone();
                    if (String.isBlank(oppInstance.Id)) {
                        oppInstance.Id = payments[payments.size() - 1].opportunityId;
                    }
                    Integer i = 0;
                    //Boolean setupFeeApplied = false;
                    for (DraftWrapper draftWrap : payments) {
                        Draft__c draftInstance = draftWrap.getDraftInstance();
                        if(!STATUS_TO_SKIP_FOR_RETAINER_FEE.contains(draftInstance.Draft_Status__c)  &&  draftInstance.Draft_Status__c != DraftUtil.STATUS_SKIPPED) {
                        draftInstance.Id = null;
                        if (i < draftsInDB.size()) {
                            draftInstance.Id = draftsInDB[i].Id;
                            draftInstance.Draft_Status__c = draftsInDB[i].Draft_Status__c;
                            draftsToDelete.remove(0);
                            i++;    
                        }
                        if (draftInstance.Id == null || draftInstance.Program_Plan__c == null) {
                            draftInstance.Program_Plan__c = programPlanId;
                        }
                        if (draftInstance.Id == null || draftInstance.Account__c == null) {
                            draftInstance.Account__c = accountId;
                        }
                        /*if (DraftUtil.unlockedStatuses.contains(draftWrap.draftStatus)) {
                            draftInstance.Citadel_Fee__c = getCitadelFee(oppInstance.Id, draftWrap, setupFeeApplied);
                            if (!setupFeeApplied && draftWrap.setupFee != null && draftWrap.setupFee > 0) {
                                setupFeeApplied = true;
                            }
                            System.debug('draftInstance.Citadel_Fee__c--->'+draftInstance.Citadel_Fee__c);
                        }*/ 
                        if(!STATUS_TO_SKIP_FOR_RETAINER_FEE.contains(draftInstance.Draft_Status__c)  &&  draftInstance.Draft_Status__c != DraftUtil.STATUS_SKIPPED) {
                            draftsToUpsert.add(draftInstance);
                        }
                    }
                    }
                  
                    Integer j = 0;
                       //Commented out the Child Fees Handling logic as it is moved to Trigger Level.
                  /*  for (Draft__c draftRecord : draftsToUpsert) {
                        List<Fee__c> existingFees;
                        if (j < draftsInDB.size()) {
                            existingFees = draftsInDB[j].Fees__r;
                            j++;    
                        }
                        FeesEvaulation feeEvaulationWrapper = constructFees(draftRecord, existingFees);
                        if (feeEvaulationWrapper != null) {
                            if (feeEvaulationWrapper.feesToUpsert != null && !feeEvaulationWrapper.feesToUpsert.isEmpty()) {
                                feesToUpsert.addAll(feeEvaulationWrapper.feesToUpsert);
                            }
                            if (feeEvaulationWrapper.feesToDelete != null && !feeEvaulationWrapper.feesToDelete.isEmpty()) {
                                feesToDeleteList.addAll(feeEvaulationWrapper.feesToDelete);
                            }
                        }
                    }
                    if (!feesToUpsert.isEmpty()) {
                        upsert feesToUpsert;
                    }
                    if (!feesToDeleteList.isEmpty()) {
                        delete feesToDeleteList;
                    }
                    */
                    if (String.isNotBlank(programPlanId) && payments[0].paymentDate != null) {
                        Program_Plan__c prgmPlan = new Program_Plan__c();
                        prgmPlan.Id = programPlanId;
                        prgmPlan.Weekly_Draft_Amount__c = payments[payments.size() - 1].totalAmount;
                        if(programPlanMap.containsKey('firstPaymentDate')) {
                            String paymentsDateStr = (String)programPlanMap.get('firstPaymentDate');
                            Date paymentsDate =  Date.valueOf(paymentsDateStr);
                            prgmPlan.First_Payment_Date__c = paymentsDate;   
                        } else {
                            prgmPlan.First_Payment_Date__c = payments[0].paymentDate;
                        }                        
                        oppInstance.DS_First_Payment_Date__c = prgmPlan.First_Payment_Date__c;
                       if(allowPaymentToEdit) {
                           OpportunityLockService.disableOppLockForSystemUpdates();
                       }
                       update prgmPlan;
                       if(allowPaymentToEdit) {
                           OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
                       }
                    }
                }
            }
            if (oppInstance != null && oppInstance.Id != null) {
                if (programPlanMap.get('firstDraftAmount') != NULL) {
                    oppInstance.DS_First_Deposit_Amount__c = Decimal.valueOf((String)programPlanMap.get('firstDraftAmount'));
                }
                if (programPlanMap.get('firstRetSetFee') != NULL) {
                    oppInstance.DS_First_Retainer_Setup_Fee__c = Decimal.valueOf((String)programPlanMap.get('firstRetSetFee'));
                }
                if(allowPaymentToEdit) {
                    OpportunityLockService.disableOppLockForSystemUpdates();
                }
                update oppInstance;
        if(allowPaymentToEdit) {
                    OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
                }
            }
             if (!draftsToDelete.isEmpty()) {
                    List<Fee__c> feesToDelete = new List<Fee__c>();
                    for (Draft__c draftRecToDel : draftsToDelete) {
                        if (draftRecToDel != null && !draftRecToDel.Fees__r.isEmpty()) {
                            feesToDelete.addAll(draftRecToDel.Fees__r);
                        }
                    }
                     if(allowPaymentToEdit) {
                         OpportunityLockService.disableOppLockForSystemUpdates();
                     }
                    delete feesToDelete;
                    delete draftsToDelete;
                     if(allowPaymentToEdit) {
                         OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
                     }
                 
             }
              if (!draftsToUpsert.isEmpty()) {
                if(allowPaymentToEdit) {
                    OpportunityLockService.disableOppLockForSystemUpdates();
                }
                Database.UpsertResult[] results = Database.upsert(draftsToUpsert, false);
                for (Database.UpsertResult sr : results) {                        
                    if (sr.isSuccess() && !isReschedule) {
                        if (sr.isCreated()) {
                            updatedDraftIds.add(sr.getId());
                        }
                    }
                }
                if(allowPaymentToEdit) {
                    OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
                }
            }
            if(!isReschedule){
                syncDraftsWithProcessor(updatedDraftIds, oppInstance.Id);
            }
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }
    
    @AuraEnabled
    public static ApexActionResult syncDrafts(List<String> updatedDraftIds, String oppId) {
        final String SCOPE = 'ProgramPlanController.syncDrafts';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try{
            syncDraftsWithProcessor(updatedDraftIds, oppId);
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }
    
    @future(Callout=true)
    private static void syncDraftsWithProcessor(List<String> draftIds, String oppId){
        Set<Id> draftIdSet  = new Set<Id>((List<Id>)new List<String>(draftIds));
        draftIdSet.remove(null);
        Opportunity oppt = OpportunityData.queryOpportunity(oppId)[0];
        if(oppt.Lock_Opportunity__c){
            ProcessorCreateAPI procCreateApi = new ProcessorCreateAPI(draftIdSet, oppt.AccountId);
            procCreateApi.syncDrafts();
        }
    }

    /*private static Decimal getCitadelFee(Id opportunityId, DraftWrapper draftWrap, Boolean setupFeeApplied) {
        Decimal citadelFeeValue = citadelFee;
        String monthYearString = getMonthYearValueFromDate(draftWrap.paymentDate);
        System.debug('monthYearString--->'+monthYearString);
        System.debug('setupFeeApplied--->'+setupFeeApplied);
        if (!setupFeeApplied && ((draftWrap.setupFee != null && draftWrap.setupFee > 0) || (draftWrap.retainerFee != null && draftWrap.retainerFee > 0))) {
            monthYearSetForCitadel.add(monthYearString);
        }
        if (!monthYearSetForCitadel.contains(monthYearString)) {
            monthYearSetForCitadel.add(monthYearString);
            return ApexUtil.roundOffAmount(citadelFeeValue);
        } 
        return 0.00;
    }*/

    private static String getMonthYearValueFromDate(Date dateValue) {
        return dateValue.month() + '-' + dateValue.year();
    }

    public static void queryCitadelFee(Id opportunityId) {
        if (fetchCitadelFee == false) {
            fetchCitadelFee = true;
            for (OpportunityLineItem oppLineItem : [SELECT Id, ProductCode, UnitPrice, Opportunity.Legal_Network__c FROM OpportunityLineItem WHERE OpportunityId = :opportunityId ORDER BY CreatedDate DESC]) {
                String targetProductCode = oppLineItem.Opportunity.Legal_Network__c == FileUtil.AGREEMENT_VICTORY
                    ? FeeUtil.PRODUCT_VICTORY_FEE
                    : FeeUtil.PRODUCT_CITADEL_FEE;
                if (oppLineItem.ProductCode == targetProductCode) {
                    citadelFee = oppLineItem.UnitPrice;
                    break;
                }
            }
        }
    }
     private static Id getAccountId(Id programPlanId) {

        Id accountId;

        List<Program_Plan__c> programPlans = [SELECT Id, Client__c FROM Program_Plan__c WHERE Id = :programPlanId];

        if (programPlans != null && !programPlans.isEmpty()) {

            accountId = programPlans[0].Client__c;

        }

        return accountId;

    }

    /*public class FeesEvaulation {
        public List<Fee__c> feesToUpsert;
        public List<Fee__c> feesToDelete;
    }*/

    /*private static List<DraftWrapper> correctPayments(List<DraftWrapper> drafts) {
        List<DraftWrapper> correctedDrafts = new List<DraftWrapper>();
        for (DraftWrapper draftRecord : drafts) {
            if (draftRecord.retainerSetupFeeRecord == true) {
                if (draftRecord.childrens != null) {
                    for (DraftWrapper childDraft : draftRecord.childrens) {
                        correctedDrafts.add(childDraft);
                    }
                }
            } else {
                correctedDrafts.add(draftRecord);
            }
        }
        return correctedDrafts;
    }*/

 /*   private static FeesEvaulation constructFees(Draft__c draftInstance, List<Fee__c> fees) {
        FeesEvaulation feeEvaluationWrapper = new FeesEvaulation();
        List<Fee__c> feesToUpsert = new List<Fee__c>();
        List<Fee__c> feesToDelete = new List<Fee__c>();
        Map<String, Fee__c> feeMap = new Map<String, Fee__c>();
        if (fees != null && !fees.isEmpty()) {
            for (Fee__c feeRecord : fees) {
                feeMap.put(feeRecord.RecordType.DeveloperName, feeRecord);
            }
        }
        if (draftInstance.Retainer_Fee__c != null && draftInstance.Retainer_Fee__c > 0) {
            Fee__c fee = createFee(FeeUtil.RT_RETAINER_FEE, feeMap, draftInstance);
            fee.Fee_Amount__c = draftInstance.Retainer_Fee__c;
            feesToUpsert.add(fee);
        } else {
            if (feeMap.containsKey(FeeUtil.RT_RETAINER_FEE)) {
                Fee__c feeRecord = feeMap.get(FeeUtil.RT_RETAINER_FEE);
                feesToDelete.add(feeRecord);
            }
        }

        if (draftInstance.Setup_Fee__c != null && draftInstance.Setup_Fee__c > 0) {
            Fee__c fee = createFee(FeeUtil.RT_SETUP_FEE, feeMap, draftInstance);
            fee.Fee_Amount__c = draftInstance.Setup_Fee__c;
            feesToUpsert.add(fee);
        } else {
            if (feeMap.containsKey(FeeUtil.RT_SETUP_FEE)) {
                Fee__c feeRecord = feeMap.get(FeeUtil.RT_SETUP_FEE);
                feesToDelete.add(feeRecord);
            }
        }
        
        if (draftInstance.Processor_Fee__c != null && draftInstance.Processor_Fee__c > 0) {
            Fee__c fee = createFee(FeeUtil.RT_PROCESSOR_FEE, feeMap, draftInstance);
            fee.Fee_Amount__c = draftInstance.Processor_Fee__c;
            feesToUpsert.add(fee);
        } else {
            if (feeMap.containsKey(FeeUtil.RT_PROCESSOR_FEE)) {
                Fee__c feeRecord = feeMap.get(FeeUtil.RT_PROCESSOR_FEE);
                feesToDelete.add(feeRecord);
            }
        }

        if (draftInstance.Service_Fee__c != null && draftInstance.Service_Fee__c > 0) {
            Fee__c fee = createFee(FeeUtil.RT_SERVICE_FEE, feeMap, draftInstance);
            fee.Fee_Amount__c = draftInstance.Service_Fee__c;
            feesToUpsert.add(fee);
        } else {
            if (feeMap.containsKey(FeeUtil.RT_SERVICE_FEE)) {
                Fee__c feeRecord = feeMap.get(FeeUtil.RT_SERVICE_FEE);
                feesToDelete.add(feeRecord);
            }
        }

        if (draftInstance.Program_Fee__c != null && draftInstance.Program_Fee__c > 0) {
            Fee__c fee = createFee(FeeUtil.RT_PROGRAM_FEE, feeMap, draftInstance);
            fee.Fee_Amount__c = draftInstance.Program_Fee__c;
            feesToUpsert.add(fee);
        } else {
            if (feeMap.containsKey(FeeUtil.RT_PROGRAM_FEE)) {
                Fee__c feeRecord = feeMap.get(FeeUtil.RT_PROGRAM_FEE);
                feesToDelete.add(feeRecord);
            }
        }

        if (draftInstance.Citadel_Fee__c != null && draftInstance.Citadel_Fee__c > 0) {
            Fee__c fee = createFee(FeeUtil.RT_CITADEL_FEE, feeMap, draftInstance);
            fee.Fee_Amount__c = draftInstance.Citadel_Fee__c;
            feesToUpsert.add(fee);
        } else {
            if (feeMap.containsKey(FeeUtil.RT_CITADEL_FEE)) {
                Fee__c feeRecord = feeMap.get(FeeUtil.RT_CITADEL_FEE);
                feesToDelete.add(feeRecord);
            }
        }

        feeEvaluationWrapper.feesToUpsert = feesToUpsert;
        feeEvaluationWrapper.feesToDelete = feesToDelete;
        return feeEvaluationWrapper;
    }

    public static Fee__c createFee(String recordTypeName, Map<String, Fee__c> feeMap, Draft__c draftInstance) {
        Fee__c feeRecord = new Fee__c();
        if (feeMap.containsKey(recordTypeName)) {
            feeRecord.Id = feeMap.get(recordTypeName).Id;
        } 
        feeRecord.RecordTypeId = FeeUtil.getRecordTypeId(recordTypeName);
        feeRecord.Fee_Date__c = draftInstance.Draft_Date__c;
        fee_record.Fee_Amount__c = draftInstance.Draft_Amount__c;
        feeRecord.Draft__c = draftInstance.Id;
        feeRecord.Program_Plan__c = draftInstance.Program_Plan__c;
        feeRecord.Account__c = draftInstance.Account__c;
        return feeRecord;
    }
     */
    

    @AuraEnabled
    public static ApexActionResult getPaymentCalcSettings() {
        final String SCOPE = 'ProgramPlanController.getPaymentCalcSettings';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            result.data = JSON.serialize(new PaymentCalculatorSettings());  
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
        return result;
    }
    
    @AuraEnabled
    public static ProgramLengthWrapper getProgramLengthsForAmount(Integer totalAmount) {
        try {
            ProgramLengthWrapper result = new ProgramLengthWrapper();

            if (totalAmount == null) {
                return result;
            }

            List<Program_Length_Setting__mdt> settings = [
                SELECT From_Range__c,
                    To_Range__c,
                    Program_Length__c,
                    Qualified_For_Bonus_Program_Length__c
                FROM Program_Length_Setting__mdt
                LIMIT 10
            ];

            for (Program_Length_Setting__mdt setting : settings) {
                if (setting.From_Range__c != null && setting.From_Range__c <= totalAmount &&
                    ( setting.To_Range__c == null || setting.To_Range__c >= totalAmount)) {

                    if (String.isNotBlank(setting.Program_Length__c)) {
                        result.programLengths.addAll(
                            setting.Program_Length__c.split(',')
                        );
                    }

                    if (String.isNotBlank(setting.Qualified_For_Bonus_Program_Length__c)) {
                        result.bonusProgramLengths.addAll(
                            setting.Qualified_For_Bonus_Program_Length__c.split(',')
                        );
                    }
                    break;
                }
            }

            return result;
        } catch(Exception exp) {
            ApplicationLogger.logExceptionWithData(exp, '', 'ProgramPlanController.getProgramLengthsForAmount', ApplicationLogger.SEVERITY_HIGH);
            return null;
        }
    }


    @AuraEnabled
    public static ApexActionResult retrieveFeesFromOppProducts(Id opportunityId) {
        final String SCOPE = 'ProgramPlanController.retrieveFeesFromOppProducts';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            FeesWrapper feesWrap = new FeesWrapper();
            queryCitadelFee(opportunityId);
            feesWrap.citadelFee = citadelFee;
            result.data = JSON.serialize(feesWrap);  
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
        return result;
    }

    @AuraEnabled
    public static void updatePaymentRecord(String recordId, String draftStatus) {
        Draft__c recordToUpdate = new Draft__c();
        recordToUpdate.Id = recordId;
        recordToUpdate.Draft_Status__c = draftStatus;
        if(FeatureManagement.checkPermission('Edit_Payments')) {
            OpportunityLockService.disableOppLockForSystemUpdates();
        }
        update recordToUpdate;
        if(FeatureManagement.checkPermission('Edit_Payments')) {
            OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        }        
    }
    
    @AuraEnabled
    public static void editPaymentRecord(Draft__c recordToUpdate) {
        if(FeatureManagement.checkPermission('Edit_Payments')) {
            OpportunityLockService.disableOppLockForSystemUpdates();
        }
        update recordToUpdate;
        if(FeatureManagement.checkPermission('Edit_Payments')) {
            OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
        }        
    }

    public class FeesWrapper {
        public Decimal citadelFee;
    }

    /*@AuraEnabled
    public static ApexActionResult recalculateDatesInDrafts(String recalcDatesWrapper) {
        final String SCOPE = 'ProgramPlanController.recalculateDatesInDrafts';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            RecalculateDates recalculateWrap = (RecalculateDates)JSON.deserialize(recalcDatesWrapper, RecalculateDates.class);
            result.data = JSON.serialize(recalculateDates(recalculateWrap));
        } catch (Exception ex) {
            throw new AuraHandledException(ex.getMessage());
        }
        return result;
    }

    private static List<DraftWrapper> recalculateDates(RecalculateDates recalculateDatesWrapper) {
        Date tempDate = recalculateDatesWrapper.startDate;
        recalculateDatesWrapper.drafts.sort();
        for (DraftWrapper draftWrap : recalculateDatesWrapper.drafts) {
            if (draftWrap.retainerSetupFeeRecord == true || draftWrap.paymentDate <= System.today()) {
                if (draftWrap.paymentDate > tempDate) {
                    tempDate = draftWrap.paymentDate;
                }
            } else {
                if (recalculateDatesWrapper.frequency == ProgramPlanUtil.FREQUENCY_MONTHLY) {
                    draftWrap.paymentDate = monthlyNextPaymentDate(tempDate, recalculateDatesWrapper.firstPaymentDay);
                    tempDate = draftWrap.paymentDate;
                } else if (recalculateDatesWrapper.frequency == ProgramPlanUtil.FREQUENCY_BI_MONTHLY) {
                    draftWrap.paymentDate = bimonthlyNextPaymentDate(tempDate, recalculateDatesWrapper.firstPaymentDay, recalculateDatesWrapper.secondPaymentDay);
                    tempDate = draftWrap.paymentDate;
                } else if (recalculateDatesWrapper.frequency == ProgramPlanUtil.FREQUENCY_WEEKLY) {
                    draftWrap.paymentDate = weeklyNextPaymentDate(tempDate, recalculateDatesWrapper.weeklyPaymentDay);
                    tempDate = draftWrap.paymentDate;
                }
                addToMonthDate(draftWrap.paymentDate);
            }
        }
        for (DraftWrapper draftWrap : recalculateDatesWrapper.drafts) {
            if (draftWrap.retainerSetupFeeRecord == false && draftWrap.paymentDate > System.today()) {
                draftWrap.processorFee = ApexUtil.roundOffAmount(getProcessorFee(draftWrap));
            }
            
        }
        recalculateDatesWrapper.drafts.sort();
        return recalculateDatesWrapper.drafts;
    }

    private static Decimal getProcessorFee(DraftWrapper draftWrap) {
        Decimal processorFeeValue = 0.00;
        String monthYearString = getMonthYearValue(draftWrap.paymentDate);
        if (monthYearNoOfPaymentsMap.containsKey(monthYearString)) {
            //processorFeeValue = payCalcElements.getMonthlyBankFee()/monthYearNoOfPaymentsMap.get(monthYearString);
        }
        return processorFeeValue;
    }

    private static Date monthlyNextPaymentDate(Date dateValue, Integer firstPaymentDay) {
        Date nextMonthStartDate = dateValue.addMonths(1).toStartOfMonth();
        return nextMonthStartDate.addDays(firstPaymentDay-1);
    }

    private static Date bimonthlyNextPaymentDate(Date dateValue, Integer firstPaymentDay, Integer secondPaymentDay) {
        if (dateValue.day() < firstPaymentDay) {
            return Date.newInstance(dateValue.year(), dateValue.month(), firstPaymentDay);
        } else if (dateValue.day() < secondPaymentDay) {
            return Date.newInstance(dateValue.year(), dateValue.month(), secondPaymentDay);
        } else {
            Date nextMonthStartDate = dateValue.addMonths(1).toStartOfMonth();
            return Date.newInstance(nextMonthStartDate.year(), nextMonthStartDate.month(), firstPaymentDay);
        }
    }

    private static Date weeklyNextPaymentDate(Date dateValue, String weeklyPaymentDay) {
        PaymentCalculatorElements payCalcElements = new PaymentCalculatorElements();
        payCalcElements.weeklyPaymentDay = weeklyPaymentDay;
        Integer weeklyPaymentDayInteger = payCalcElements.getWeeklyPaymentDay();
        Date nextWeekStartDate = dateValue.addDays(7).toStartOfWeek();
        return nextWeekStartDate.addDays(weeklyPaymentDayInteger);
    }

    private static void addToMonthDate(Date dateValue) {
        String monthYearString = getMonthYearValue(dateValue);
        if (!monthYearNoOfPaymentsMap.containsKey(monthYearString)) {
            monthYearNoOfPaymentsMap.put(monthYearString, 0);
        }
        monthYearNoOfPaymentsMap.put(monthYearString, monthYearNoOfPaymentsMap.get(monthYearString) + 1);
    }

    private static string getMonthYearValue(Date dateValue) {
        return dateValue.month() + '-' + dateValue.year();
    }

    public class RecalculateDates {
        public List<DraftWrapper> drafts;
        public String frequency;
        public Integer firstPaymentDay;
        public Integer secondPaymentDay;
        public String weeklyPaymentDay;
        public Date startDate;
    }*/

    public class DebtAggregation {
        public Integer noOfDebts;
        public Decimal totalDebt;
    }
    
    public Class SetupFeeWrapper {
        public Decimal fee1;
        public Decimal fee2;
    }
        /**
     * Retrieves the monthly bank fee and bank setup fee for a specified payment processor.
     * This method is exposed to Lightning Web Components via the @AuraEnabled annotation,
     * allowing the frontend to dynamically fetch processor-specific fee information when
     * the payment processor selection changes in the program plans interface.
     * 
     * The method performs a SOQL query to find the Payment_Processor__c record by name,
     * extracts the relevant fee fields, and returns them in a structured wrapper format
     * serialized as JSON. This enables real-time fee updates in the UI without requiring
     * a page refresh or manual data entry.
     * 
     * @param processorName The name of the payment processor (e.g., "Stripe", "PayPal") 
     *                      for which to retrieve fee information. This parameter is required
     *                      and must match exactly with a Payment_Processor__c record name.
     * 
     * @return ApexActionResult A wrapper object containing the operation result. On success,
     *                          the 'data' field contains a JSON-serialized ProcessorFeesWrapper
     *                          with monthlyBankFee and bankSetupFee values. On failure, the
     *                          result contains error information from the caught exception.
     * 
     * @throws Exception If the processorName parameter is null/empty, or if no matching
     *                   Payment_Processor__c record is found, or if any database/query errors occur.
     *                   The exception is caught and stored in the ApexActionResult for proper
     *                   error handling in the calling Lightning component.
     * 
     * @example
     * // Calling from LWC JavaScript:
     * getProcessorFees({ processorName: 'Stripe' })
     *   .then(result => {
     *     if (result.resultStatus === 'SUCCESS') {
     *       const fees = JSON.parse(result.data);
     *       console.log('Monthly Fee:', fees.monthlyBankFee);
     *       console.log('Setup Fee:', fees.bankSetupFee);
     *     }
     *   });
     */
    @AuraEnabled(cacheable=true)
    public static List<Payment_Processor__c> getActivePaymentProcessors() {
        return PaymentProcessorData.getPaymentProcessors();
    }

    @AuraEnabled
    public static ApexActionResult getProcessorFees(String processorName) {
        // Define a unique scope identifier for this method, used for logging and error tracking
        final String SCOPE = 'ProgramPlanController.getProcessorFees';
        
        // Initialize the result wrapper with the method scope for consistent error reporting
        ApexActionResult result = new ApexActionResult(SCOPE);
        
        try {
            // Validate that the processor name parameter is provided and not null/empty
            // This prevents unnecessary database queries and provides clear error messaging
            ApexUtil.requireValue('Processor Name', processorName);
            
            // Query the Payment_Processor__c custom object to retrieve fee information
            // Uses a selective query to minimize data transfer and improve performance
            // LIMIT 1 ensures we get at most one record, assuming processor names are unique
            Payment_Processor__c processor = [
                SELECT Id, Monthly_Bank_Fee__c, Bank_Setup_Fee__c 
                FROM Payment_Processor__c 
                WHERE Name = :processorName 
                LIMIT 1
            ];
            
            // Create a wrapper object to structure the fee data for JSON serialization
            // This provides a clean, predictable data structure for the frontend
            ProcessorFeesWrapper feesWrapper = new ProcessorFeesWrapper();
            
            // Populate the wrapper with the retrieved fee values from the processor record
            // These values represent the ongoing monthly fee and one-time setup fee
            // charged by the payment processor for transaction processing
            feesWrapper.monthlyBankFee = processor.Monthly_Bank_Fee__c;
            feesWrapper.bankSetupFee = processor.Bank_Setup_Fee__c;
            
            // Serialize the fee wrapper to JSON format for transmission to the Lightning component
            // This allows the frontend to easily parse and use the fee data
            result.data = JSON.serialize(feesWrapper);
            
        } catch (Exception ex) {
            // Catch any exceptions that occur during execution (validation, query, serialization)
            // and store them in the result wrapper for proper error handling by the caller
            result.thrown(ex);
        }
        
        // Return the result wrapper containing either the fee data or error information
        return result;
    }

    /**
     * A simple data transfer object (DTO) that encapsulates the fee information
     * retrieved from a Payment_Processor__c record. This wrapper class provides
     * a structured format for serializing fee data to JSON, ensuring consistent
     * data exchange between the Apex backend and Lightning Web Components.
     * 
     * The class contains two public decimal fields representing the different
     * types of fees charged by payment processors. These fees are used in
     * program plan calculations to determine total costs and payment amounts.
     * 
     * @property monthlyBankFee The recurring monthly fee charged by the payment
     *                          processor for maintaining the merchant account and
     *                          processing transactions. This is typically a fixed
     *                          amount per month regardless of transaction volume.
     * 
     * @property bankSetupFee The one-time setup or activation fee charged by the
     *                        payment processor when establishing a new merchant
     *                        account. This is usually a flat fee paid once at
     *                        account creation.
     * 
     * @usage This wrapper is instantiated in getProcessorFees(), populated with
     *        database values, and then serialized to JSON for frontend consumption.
     *        The Lightning component can then access these fees to update UI
     *        elements and perform real-time calculations.
     */
    public class ProcessorFeesWrapper {
        /**
         * The monthly recurring fee charged by the payment processor.
         * This value is retrieved from Payment_Processor__c.Monthly_Bank_Fee__c
         * and represents ongoing costs for payment processing services.
         */
        public Decimal monthlyBankFee;
        
        /**
         * The one-time setup fee charged by the payment processor.
         * This value is retrieved from Payment_Processor__c.Bank_Setup_Fee__c
         * and represents initial costs for account establishment.
         */
        public Decimal bankSetupFee;
    }

    public class ProgramLengthWrapper {
        @AuraEnabled public List<String> programLengths;
        @AuraEnabled public List<String> bonusProgramLengths;

        public ProgramLengthWrapper() {
            programLengths = new List<String>();
            bonusProgramLengths  = new List<String>();
        }
    }


}