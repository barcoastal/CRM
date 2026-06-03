public inherited sharing class PaymentSummaryService {

    private static Map<Id, Id> programPlanIdAccountIdMapGlobal;
    private static Map<Id, Id> opportunityIdAccountIdMapGlobal;
    public static Boolean isFromCreatePaymentSummariesMethod = false;
    
    public static void createPaymentSummaries(Set<Id> accountIds, Set<String> paymentTypes) {
      System.debug('paymentTypes inside summaires ' + paymentTypes);
      try{
        if (accountIds != null && !accountIds.isEmpty()) {
            Map<String, Payment_Summary__c> paymentSummaryMap = new Map<String, Payment_Summary__c>();
            Map<Id, Program_Plan__c> accountIdProgramPlanMap = ProgramPlanData.getProgramPlanOfAccounts(accountIds);
            Map<Id, OpportunityLineItem> accountIdOppLineItemMap = OpportunityData.queryOppLineItems(accountIds);
            Map<Id, Decimal> accountIdSettlementAmountMap = OfferData.aggregateSettlements(accountIds);
           // OfferData.aggregateSettlements(accountIds);
            for (Id accountId : accountIds) {
                if (paymentTypes == null || paymentTypes.isEmpty()) {
                    paymentTypes = PaymentSumaryUtil.PAYMENT_TYPES;
                }
                for (String paymentType : paymentTypes) {
                    Payment_Summary__c paymentSummaryToCreate = createPaymentSummary(accountId, paymentType);
                    if (accountIdProgramPlanMap.containsKey(accountId)) {
                        Program_Plan__c prgmPlan = accountIdProgramPlanMap.get(accountId);
                        OpportunityLineItem oppLineItem = accountIdOppLineItemMap.get(accountId);
                        if (paymentType == PaymentSumaryUtil.PAYMENT_TYPE_SETTLEMENT) {
                            if (accountIdSettlementAmountMap.containsKey(accountId)) {
                                paymentSummaryToCreate.Total_Amount__c = accountIdSettlementAmountMap.get(accountId);
                            }
                        } else {
                            paymentSummaryToCreate.Total_Amount__c = calculateTotalAmount(prgmPlan, paymentType, oppLineItem);
                        }
                    }
                    paymentSummaryMap.put(paymentSummaryToCreate.Unique_Id__c, paymentSummaryToCreate);
                }
            }   
            if (paymentTypes.contains(PaymentSumaryUtil.PAYMENT_TYPE_DRAFT)) {
                calculateDraftsAmount(accountIds, paymentSummaryMap);
            }
            if (paymentTypes.contains(PaymentSumaryUtil.PAYMENT_TYPE_SETTLEMENT)) {
                calculateSettlementsAmount(accountIds, paymentSummaryMap);
            }
            if (executeDraftFeePaymentTypes(paymentTypes)) {
                calculateDraftFeesAmount(accountIds, paymentSummaryMap, paymentTypes);
            }  
            if (paymentTypes.contains(PaymentSumaryUtil.PAYMENT_TYPE_PROGRAM_FEE_SETTLEMENTS)) {
                calculateSettlementFeesAmount(accountIds, paymentSummaryMap);
            }

            calculatePaymentCounts(accountIds, paymentSummaryMap);

            for (String paymentType : paymentSummaryMap.keyset()) {
                System.debug('payment Summary--->'+paymentSummaryMap.get(paymentType));
            }
            isFromCreatePaymentSummariesMethod = true;
            upsert paymentSummaryMap.values() Unique_Id__c;
        }
      }catch(Exception ex){
          ApplicationLogger.logDMLException('Payment Summary Upsert Failed', null, ex.getMessage());
      }
      isFromCreatePaymentSummariesMethod = false;
    }

    private static Payment_Summary__c createPaymentSummary(Id accountId, String paymentType) {
        Payment_Summary__c paymentSummaryRecord = new Payment_Summary__c();
        paymentSummaryRecord.Unique_Id__c = constructPaymentSummaryUniqueId(accountId, paymentType);
        paymentSummaryRecord.Client__c = accountId;
        paymentSummaryRecord.Payment_Type__c = paymentType;
        paymentSummaryRecord.Total_Amount__c = 0;
        paymentSummaryRecord.Amount_Collected__c = 0;
        paymentSummaryRecord.Amount_In_Schedule__c = 0;
        return paymentSummaryRecord;
    }

    private static void calculateDraftsAmount(Set<Id> accountIds, Map<String, Payment_Summary__c> paymentSummaryMap) {
        Map<Id, Id> programPlanIdAccountIdMap = ProgramPlanUtil.getActiveProgramPlanIdOfAccounts(accountIds);
        programPlanIdAccountIdMapGlobal = programPlanIdAccountIdMap;
        for (AggregateResult ar : DraftData.aggregateDrafts(programPlanIdAccountIdMap.keySet())) {
            Id programPlanId = (Id)ar.get('prgmPlanId');
            String draftStatus = (String)ar.get('draftStatus');
            Decimal amount = (Decimal)ar.get('amt');
            Decimal escrowAmount = (Decimal)ar.get('escrowAmount');
            Id accountId = programPlanIdAccountIdMap.get(programPlanId);
            Payment_Summary__c draftSummaryRecord = getPaymentSummaryRecord(accountId, PaymentSumaryUtil.PAYMENT_TYPE_DRAFT, paymentSummaryMap);
            Payment_Summary__c escrowAmountSummaryRecord = getPaymentSummaryRecord(accountId, PaymentSumaryUtil.PAYMENT_TYPE_ESCROW_AMOUNT, paymentSummaryMap);
            if (DraftUtil.DRAFT_STATUSES_COLLECTED.contains(draftStatus)) {
                draftSummaryRecord.Amount_Collected__c = (draftSummaryRecord.Amount_Collected__c == null ? 0 : draftSummaryRecord.Amount_Collected__c) + (amount == null ? 0.00 : amount);
                escrowAmountSummaryRecord.Amount_Collected__c = (escrowAmountSummaryRecord.Amount_Collected__c == null ? 0 : escrowAmountSummaryRecord.Amount_Collected__c) + (escrowAmount == null ? 0.00 : escrowAmount);
            } else if (DraftUtil.DRAFT_STATUSES_IN_SCHEDULE.contains(draftStatus)) {
                draftSummaryRecord.Amount_In_Schedule__c = (draftSummaryRecord.Amount_In_Schedule__c == null ? 0 : draftSummaryRecord.Amount_In_Schedule__c) + (amount == null ? 0.00 : amount);
                escrowAmountSummaryRecord.Amount_In_Schedule__c = (escrowAmountSummaryRecord.Amount_In_Schedule__c == null ? 0 : escrowAmountSummaryRecord.Amount_In_Schedule__c) + (escrowAmount == null ? 0.00 : escrowAmount);
            }
            paymentSummaryMap.put(draftSummaryRecord.Unique_Id__c, draftSummaryRecord);
            paymentSummaryMap.put(escrowAmountSummaryRecord.Unique_Id__c, escrowAmountSummaryRecord);
        }
    }

    private static void calculateDraftFeesAmount(Set<Id> accountIds, Map<String, Payment_Summary__c> paymentSummaryMap, Set<String> paymentTypes) {
        Map<Id, Id> programPlanIdAccountIdMap;
        if (programPlanIdAccountIdMapGlobal != null) {
            programPlanIdAccountIdMap = programPlanIdAccountIdMapGlobal;
        } else {
            programPlanIdAccountIdMap = ProgramPlanUtil.getActiveProgramPlanIdOfAccounts(accountIds);
        }
        Set<String> feeTypes = PaymentSumaryUtil.getFeeTypes(paymentTypes);
        for (AggregateResult ar : FeeData.aggregateDraftFees(programPlanIdAccountIdMap.keySet(), feeTypes)) {
            Id prgmPlanId = (Id)ar.get('prgmPlanId');
            String feeType = (String)ar.get('feeType');
            String feeStatus = (String)ar.get('feeStatus');
            Decimal amount = (Decimal)ar.get('amt');
            Id accountId = programPlanIdAccountIdMap.get(prgmPlanId);
            String paymentType = PaymentSumaryUtil.DRAFT_FEE_RT_PAYMENT_TYPE_MAP.get(feeType);
            Payment_Summary__c paymentSummaryRecord = getPaymentSummaryRecord(accountId, paymentType, paymentSummaryMap);
            if (FeeUtil.FEE_STATUSES_COLLECTED.contains(feeStatus)) {
                paymentSummaryRecord.Amount_Collected__c = (paymentSummaryRecord.Amount_Collected__c == null ? 0 : paymentSummaryRecord.Amount_Collected__c) + (amount == null ? 0.00 : amount);
            } else if (FeeUtil.FEE_STATUSES_IN_SCHEDULE.contains(feeStatus)) {
                paymentSummaryRecord.Amount_In_Schedule__c = (paymentSummaryRecord.Amount_In_Schedule__c == null ? 0 : paymentSummaryRecord.Amount_In_Schedule__c) + (amount == null ? 0.00 : amount);
            }
            paymentSummaryMap.put(paymentSummaryRecord.Unique_Id__c, paymentSummaryRecord);
        }
    }

    private static void calculateSettlementsAmount(Set<Id> accountIds, Map<String, Payment_Summary__c> paymentSummaryMap) {
        Map<Id, Id> opportunityIdAccountIdMap = OpportunityUtil.getActiveOpportunityIdOfAccounts(accountIds);
        opportunityIdAccountIdMapGlobal = opportunityIdAccountIdMap;
        for (AggregateResult ar : SettlementData.aggregateSettlements(opportunityIdAccountIdMap.keySet())) {
            Id oppId = (Id)ar.get('oppId');
            String settlementStatus = (String)ar.get('settlementStatus');
            Decimal amount = (Decimal)ar.get('amt');
            Id accountId = opportunityIdAccountIdMap.get(oppId);
            Payment_Summary__c paymentSummaryRecord = getPaymentSummaryRecord(accountId, PaymentSumaryUtil.PAYMENT_TYPE_SETTLEMENT, paymentSummaryMap);
            if (SettlementUtil.SETTLEMENT_STATUSES_COLLECTED.contains(settlementStatus)) {
                paymentSummaryRecord.Amount_Collected__c = (paymentSummaryRecord.Amount_Collected__c == null ? 0 : paymentSummaryRecord.Amount_Collected__c) + (amount == null ? 0.00 : amount);
                paymentSummaryRecord.Total_Amount__c = (paymentSummaryRecord.Amount_Collected__c == null ? 0 : paymentSummaryRecord.Amount_Collected__c) + (amount == null ? 0.00 : amount);
            } else if (SettlementUtil.SETTLEMENT_STATUSES_IN_SCHEDULE.contains(settlementStatus)) {
                paymentSummaryRecord.Total_Amount__c = (paymentSummaryRecord.Amount_In_Schedule__c == null ? 0 : paymentSummaryRecord.Amount_In_Schedule__c) + (amount == null ? 0.00 : amount);
                paymentSummaryRecord.Amount_In_Schedule__c = (paymentSummaryRecord.Amount_In_Schedule__c == null ? 0 : paymentSummaryRecord.Amount_In_Schedule__c) + (amount == null ? 0.00 : amount);
            }
            paymentSummaryMap.put(paymentSummaryRecord.Unique_Id__c, paymentSummaryRecord);
        }
    }

    private static void calculateSettlementFeesAmount(Set<Id> accountIds, Map<String, Payment_Summary__c> paymentSummaryMap) {
        Map<Id, Id> opportunityIdAccountIdMap;
        if (opportunityIdAccountIdMapGlobal != null) {
            opportunityIdAccountIdMap = opportunityIdAccountIdMapGlobal;
        } else {
            opportunityIdAccountIdMap = OpportunityUtil.getActiveOpportunityIdOfAccounts(accountIds);
        }
        for (AggregateResult ar : FeeData.aggregateSettlementFees(opportunityIdAccountIdMap.keySet())) {
            Id oppId = (Id)ar.get('oppId');
            String feeType = (String)ar.get('feeType');
            String feeStatus = (String)ar.get('feeStatus');
            Decimal amount = (Decimal)ar.get('amt');
            Id accountId = opportunityIdAccountIdMap.get(oppId);
            String paymentType = PaymentSumaryUtil.SETTLEMENT_FEE_RT_PAYMENT_TYPE_MAP.get(feeType);
            if (String.isNotBlank(paymentType)) {
                Payment_Summary__c paymentSummaryRecord = getPaymentSummaryRecord(accountId, paymentType, paymentSummaryMap);
                if (FeeUtil.FEE_STATUSES_COLLECTED.contains(feeStatus)) {
                    paymentSummaryRecord.Amount_Collected__c = (paymentSummaryRecord.Amount_Collected__c == null ? 0 : paymentSummaryRecord.Amount_Collected__c) + (amount == null ? 0.00 : amount);
                } else if (FeeUtil.FEE_STATUSES_IN_SCHEDULE.contains(feeStatus)) {
                    paymentSummaryRecord.Amount_In_Schedule__c = (paymentSummaryRecord.Amount_In_Schedule__c == null ? 0 : paymentSummaryRecord.Amount_In_Schedule__c) + (amount == null ? 0.00 : amount);
                }
                paymentSummaryMap.put(paymentSummaryRecord.Unique_Id__c, paymentSummaryRecord);
            }
        }
    }

    private static Payment_Summary__c getPaymentSummaryRecord(Id accountId, String paymentType, Map<String, Payment_Summary__c> paymentSummaryMap) {
        String paymentSummaryUniqueId = constructPaymentSummaryUniqueId(accountId, paymentType);
        Payment_Summary__c paymentSummaryRecord;
        if (paymentSummaryMap.containsKey(paymentSummaryUniqueId)) {
            paymentSummaryRecord = paymentSummaryMap.get(paymentSummaryUniqueId);
        } else {
            paymentSummaryRecord = new Payment_Summary__c();
            paymentSummaryRecord.Unique_Id__c = paymentSummaryUniqueId;
        }
        return paymentSummaryRecord;
    }

    private static String constructPaymentSummaryUniqueId(Id accountId, String paymentType) {
        return accountId + '-' + paymentType;
    }

    private static Boolean executeDraftFeePaymentTypes(Set<String> paymentTypes) {
        return (paymentTypes.contains(PaymentSumaryUtil.PAYMENT_TYPE_PROGRAM_FEE) 
            || paymentTypes.contains(PaymentSumaryUtil.PAYMENT_TYPE_RETAINER_FEE) 
            || paymentTypes.contains(PaymentSumaryUtil.PAYMENT_TYPE_SETUP_FEE) 
            || paymentTypes.contains(PaymentSumaryUtil.PAYMENT_TYPE_PROCESSOR_FEE) 
            || paymentTypes.contains(PaymentSumaryUtil.PAYMENT_TYPE_SERVICE_FEE) 
            || paymentTypes.contains(PaymentSumaryUtil.PAYMENT_TYPE_CITADEL_FEE)
        ); 
    }

    private static Decimal calculateTotalAmount(Program_Plan__c prgmPlanRecord, String paymentType, OpportunityLineItem oppLineItem) {
        Decimal totalAmount = 0;
        Decimal numberOfPayments = prgmPlanRecord.Payment_Frequency__c == 'Weekly' ? (Decimal.valueOf(prgmPlanRecord.Payment_Term__c) * 4) : Decimal.valueOf(prgmPlanRecord.Payment_Term__c);
        if (paymentType == PaymentSumaryUtil.PAYMENT_TYPE_PROGRAM_FEE) {
            totalAmount = calculateProgramFee(prgmPlanRecord);
        } else if (paymentType == PaymentSumaryUtil.PAYMENT_TYPE_RETAINER_FEE) {
            totalAmount = calculateRetainerFee(prgmPlanRecord);
        } else if (paymentType == PaymentSumaryUtil.PAYMENT_TYPE_SETUP_FEE) {
            totalAmount = calculateSetupFee(prgmPlanRecord);
        } else if (paymentType == PaymentSumaryUtil.PAYMENT_TYPE_PROCESSOR_FEE) {
            totalAmount = calculateProcessorFee(prgmPlanRecord, Decimal.valueOf(prgmPlanRecord.Payment_Term__c));
        } else if (paymentType == PaymentSumaryUtil.PAYMENT_TYPE_SERVICE_FEE) {
            totalAmount = calculateServiceFee(prgmPlanRecord, numberOfPayments);
        } else if (paymentType == PaymentSumaryUtil.PAYMENT_TYPE_CITADEL_FEE) {
            totalAmount = calculateCitadelFee(prgmPlanRecord, oppLineItem);
        } else if (paymentType == PaymentSumaryUtil.PAYMENT_TYPE_ESCROW_AMOUNT) {
            totalAmount = calculateEscrowAmount(prgmPlanRecord);
        } else if (paymentType == PaymentSumaryUtil.PAYMENT_TYPE_DRAFT) {
            totalAmount = calculateEscrowAmount(prgmPlanRecord) + calculateProgramFee(prgmPlanRecord) + calculateRetainerFee(prgmPlanRecord) 
                + calculateSetupFee(prgmPlanRecord) + calculateProcessorFee(prgmPlanRecord, Decimal.valueOf(prgmPlanRecord.Payment_Term__c))
                + calculateServiceFee(prgmPlanRecord, numberOfPayments) + calculateCitadelFee(prgmPlanRecord, oppLineItem);
        } else if (paymentType == PaymentSumaryUtil.PAYMENT_TYPE_PROGRAM_FEE_SETTLEMENTS) {
            totalAmount = calculateSettlementProgramFee(prgmPlanRecord);
        }
        return totalAmount;
    }

    private static Decimal calculateProgramFee(Program_Plan__c prgmPlanRecord) {
        
        return prgmPlanRecord.Total_Debt__c != null && prgmPlanRecord.Program_Fee_Percentage__c != null ? prgmPlanRecord.Total_Debt__c * (Decimal.valueOf(prgmPlanRecord.Program_Fee_Percentage__c)/100) : 0;
    }

    private static Decimal calculateRetainerFee(Program_Plan__c prgmPlanRecord) {
        return prgmPlanRecord.Total_Debt__c != null && prgmPlanRecord.Retainer_Percentage__c != null ? prgmPlanRecord.Total_Debt__c * (Decimal.valueOf(prgmPlanRecord.Retainer_Percentage__c)/100) : 0;
    }

    private static Decimal calculateSetupFee(Program_Plan__c prgmPlanRecord) {
        return SetupFeeMappingData.getSetupFee(
            prgmPlanRecord.Opportunity__r.Legal_Network__c,
            prgmPlanRecord.Opportunity__r.Legal_Plan_Required__c
        );
    }

    private static Decimal calculateProcessorFee(Program_Plan__c prgmPlanRecord, Decimal numberOfPayments) {
        return (prgmPlanRecord.Payment_Processor__r.Monthly_Bank_Fee__c * numberOfPayments ) + prgmPlanRecord.Payment_Processor__r.Bank_Setup_Fee__c;
    }

    private static Decimal calculateServiceFee(Program_Plan__c prgmPlanRecord, Decimal numberOfPayments) {
        PaymentCalculatorSettings settings = new PaymentCalculatorSettings();
        return numberOfPayments != null && settings.serviceFee != null ?  (numberOfPayments -1) * settings.serviceFee : 0;
    }

    private static Decimal calculateCitadelFee(Program_Plan__c prgmPlanRecord, OpportunityLineItem oppLineItem) {
        if (oppLineItem != null && oppLineItem.TotalPrice != null && prgmPlanRecord.Payment_Term__c != null) {
            return Decimal.valueOf(prgmPlanRecord.Payment_Term__c) * oppLineItem.TotalPrice;
        }
        return 0;
    }

    private static Decimal calculateEscrowAmount(Program_Plan__c prgmPlanRecord) {
        return prgmPlanRecord.Total_Debt__c != null && prgmPlanRecord.Settlement_Percentage__c != null ?  prgmPlanRecord.Total_Debt__c * (Decimal.valueOf(prgmPlanRecord.Settlement_Percentage__c)/100) : 0;
    }

    private static Decimal calculateSettlementProgramFee(Program_Plan__c prgmPlanRecord) {
        return prgmPlanRecord.Settlement_Program_Fee__c == null ? 0 : prgmPlanRecord.Settlement_Program_Fee__c;
    }

    @auraEnabled
    public static void calcualtePaymentSummaryRecordsOnLoad(Id accountId){
        PaymentSummaryService.createPaymentSummaries(new Set<Id> {accountId},null);
    }

    private static void calculatePaymentCounts(Set<Id> accountIds, Map<String, Payment_Summary__c> paymentSummaryMap) {

        Map<Id, Integer> totalMap = new Map<Id, Integer>();
        Map<Id, Integer> completedMap = new Map<Id, Integer>();
        Map<Id, Integer> nsfMap = new Map<Id, Integer>();

        for (AggregateResult ar : [
            SELECT Program_Plan__r.Client__c acct,
                   COUNT(Id) cnt,
                   Draft_Status__c ds
            FROM Draft__c
            WHERE Program_Plan__r.Client__c IN :accountIds
            AND (
                Program_Plan__r.Opportunity__r.Version_Status__c IN ('Active','Archived') OR
                Program_Plan__r.Opportunity__r.Opportunity__c = null
            )
            AND (
                Draft_Status__c != :DraftUtil.STATUS_CANCELLED AND 
                Draft_Status__c != :DraftUtil.STATUS_SKIPPED
            )
            GROUP BY Program_Plan__r.Client__c, Draft_Status__c
        ]) {
            Id acctId = (Id)ar.get('acct');
            Integer cnt = ((Decimal)ar.get('cnt')).intValue();
            String status = (String)ar.get('ds');

            totalMap.put(acctId, (totalMap.containsKey(acctId) ? totalMap.get(acctId) : 0) + cnt);
            if (status == DraftUtil.STATUS_COMPLETED) {
                completedMap.put(acctId, (completedMap.containsKey(acctId) ? completedMap.get(acctId) : 0) + cnt);
            }  else if (status == DraftUtil.STATUS_NSF) {
                nsfMap.put(acctId, (nsfMap.containsKey(acctId) ? nsfMap.get(acctId) : 0) + cnt);
            }
        }

        for (Payment_Summary__c ps : paymentSummaryMap.values()) {
            Id acctId = ps.Client__c;
            if (ps.Payment_Type__c == PaymentSumaryUtil.PAYMENT_TYPE_DRAFT) {
                Integer totalCount = totalMap.containsKey(acctId) ? totalMap.get(acctId) : 0;
                Integer completedCount = completedMap.containsKey(acctId) ? completedMap.get(acctId) : 0;
                Integer nsfCount = nsfMap.containsKey(acctId) ? nsfMap.get(acctId) : 0;
                ps.Total_Payments__c = totalCount;
                ps.Completed_Payments__c = completedCount;
                ps.NSF_Payments__c = nsfCount;
                ps.Remaining_Payments__c = totalCount - completedCount - nsfCount;
            }
        }
    }
}