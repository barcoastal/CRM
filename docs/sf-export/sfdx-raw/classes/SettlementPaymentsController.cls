public with sharing class SettlementPaymentsController {
    
    @AuraEnabled
    public static ApexActionResult simulateSettlements(String offerDetails) {
        final String SCOPE = 'SettlementPaymentsController.simulateSettlements';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try {
            List<OfferAndPaymentWrapper> OfferAndPaymentWrapperList = new List<OfferAndPaymentWrapper> ();
            OfferAndPaymentWrapper OfferAndPaymentWrapper = new OfferAndPaymentWrapper();
            List<PaymentWrapper> paymentWrappers = new List<PaymentWrapper>();
            Draft__c lastDraft;
            Program_Plan__c prgmPlanRecord;
            OfferWrapper offerWrap = (OfferWrapper)JSON.deserialize(offerDetails, OfferWrapper.class);
            List<Debt_Details__c> debtDetial = DebtDetailsData.getProgramPlanByDebtDetials(offerWrap.debtDetailId);
            offerWrap = CreditorsTableController.calculateOfferRatios(offerWrap, debtDetial[0]);
            List<Settlement__c> offeredSettlements = SettlementData.querySettlements(offerWrap.offerId);
            List<Settlement__c> downPaymentSettlement = SettlementData.queryDownPaymentSettlement(offerWrap.offerId);
            List<SettlementWrapper> settlementWrappers = SettlementPaymentCalculator.calculateSettlementPayments(offerWrap, offeredSettlements ,downPaymentSettlement);
            putSimulatedSettlementsIntoPaymentWrapper(settlementWrappers, paymentWrappers);
            List<Settlement__c> existingSettlements = SettlementData.querySettlementsByOpportunityId(offerWrap.opportunityId);
            putExistingSettlementsIntoPaymentWrapper(existingSettlements, paymentWrappers);
            List<Program_Plan__c> programPlans = ProgramPlanData.queryActiveProgramPlans(new Set<Id>{offerWrap.accountId});
            if (programPlans != null && !programPlans.isEmpty()) {
                prgmPlanRecord = programPlans[0];
                List<Draft__c> existingDrafts = DraftData.queryDraftsByProgramPlanId(prgmPlanRecord.Id);
                lastDraft = existingDrafts[existingDrafts.size() - 1];
                putExistingDraftsIntoPaymentWrapper(existingDrafts, paymentWrappers);
               // getSettlementProgramFees(programPlans[0], offerWrap, paymentWrappers);
            }
            List<DraftWrapper> additionalDraftWrappers = simulateAdditionalDrafts(offerWrap, lastDraft, prgmPlanRecord);
            putAdditionalDraftWrappersIntoPaymentWrapper(additionalDraftWrappers, paymentWrappers);
            paymentWrappers.sort();
            Decimal runningBalance = 0.00;
            for (PaymentWrapper paymentWrapper : paymentWrappers) {
                if (paymentWrapper.paymentType == 'Settlement' || paymentWrapper.paymentType == 'Program Fee - Settlements') {
                    paymentWrapper.runningBalance = ApexUtil.roundOffAmount(runningBalance - paymentWrapper.amount);
                    paymentWrapper.colorCode = 'color:red';
                } else {
                    paymentWrapper.runningBalance = ApexUtil.roundOffAmount(runningBalance + paymentWrapper.amount);
                    paymentWrapper.colorCode = 'color:green';
                }
                runningBalance = paymentWrapper.runningBalance;
            }
            OfferAndPaymentWrapper.paymentWrappers = JSON.serialize(paymentWrappers);
            OfferAndPaymentWrapper.offerWrappers = JSON.serialize(new List<OfferWrapper>{offerWrap});
            result.data = JSON.serialize(OfferAndPaymentWrapper);
        } catch (Exception ex) {
            system.debug('error ' + ex);
            result.thrown(ex);
        }
        return result;
    }

    public static List<PaymentWrapper> getPayments(OfferWrapper offerWrap) {
        List<PaymentWrapper> paymentWrappers = new List<PaymentWrapper>();
        Draft__c lastDraft;
        Program_Plan__c prgmPlanRecord;
        List<Settlement__c> offeredSettlements = SettlementData.querySettlements(offerWrap.offerId);
        putExistingSettlementsIntoPaymentWrapper(offeredSettlements, paymentWrappers);
        List<Settlement__c> existingSettlements = SettlementData.querySettlementsByOpportunityId(offerWrap.opportunityId);
        putExistingSettlementsIntoPaymentWrapper(existingSettlements, paymentWrappers);
        List<Program_Plan__c> programPlans = ProgramPlanData.queryActiveProgramPlans(new Set<Id>{offerWrap.accountId});
        if (programPlans != null && !programPlans.isEmpty()) {
            prgmPlanRecord = programPlans[0];
            List<Draft__c> existingDrafts = DraftData.queryDraftsByProgramPlanId(prgmPlanRecord.Id);
            lastDraft = existingDrafts[existingDrafts.size() - 1];
            putExistingDraftsIntoPaymentWrapper(existingDrafts, paymentWrappers);
        }
        List<DraftWrapper> additionalDraftWrappers = simulateAdditionalDrafts(offerWrap, lastDraft, prgmPlanRecord);
        putAdditionalDraftWrappersIntoPaymentWrapper(additionalDraftWrappers, paymentWrappers);
        paymentWrappers.sort();
        Decimal runningBalance = 0.00;
        for (PaymentWrapper paymentWrapper : paymentWrappers) {
            if (paymentWrapper.paymentType == 'Settlement' || paymentWrapper.paymentType == 'Program Fee - Settlements') {
                paymentWrapper.runningBalance = ApexUtil.roundOffAmount(runningBalance - paymentWrapper.amount);
                paymentWrapper.colorCode = 'color:red';
            } else {
                paymentWrapper.runningBalance = ApexUtil.roundOffAmount(runningBalance + paymentWrapper.amount);
                paymentWrapper.colorCode = 'color:green';
            }
            runningBalance = paymentWrapper.runningBalance;
        }
        return paymentWrappers;
    } 

    @AuraEnabled
    public static ApexActionResult saveOfferAndSettlements(String offerAndPaymentsWrapperString) {
        String scope = 'SettlementPaymentsController.saveOffersAndSettlements';
        ApexActionResult result = new ApexActionResult(scope);
        try {
            if (String.isNotBlank(offerAndPaymentsWrapperString)) {
                OfferAndPaymentsWrapper offerAndPaymentsWrap = (OfferAndPaymentsWrapper)JSON.deserialize(offerAndPaymentsWrapperString, OfferAndPaymentsWrapper.class);
                if (offerAndPaymentsWrap != null) {
                    if (offerAndPaymentsWrap.offerWrap != null) {
                        Offer__c offerToDML = offerAndPaymentsWrap.offerWrap.getOfferInstance();

                        Id opportunityId;
                        Id accountId;

                        List<Debt_Details__c> debtDetails = [SELECT Id, Account__c, Opportunity__c FROM Debt_Details__c WHERE Id = :offerToDML.Debt_Details__c];
                        if (debtDetails != null && !debtDetails.isEmpty()) {
                            opportunityId = debtDetails[0].Opportunity__c;
                            accountId = debtDetails[0].Account__c;
                        }

                        offerToDML.Client_Account__c = accountId;
                        offerToDML.Opportunity__c = opportunityId;
                        upsert offerToDML;
                        result.data = offerToDML.Id;
                        if (offerAndPaymentsWrap.paymentWrappers != null && !offerAndPaymentsWrap.paymentWrappers.isEmpty()) {
                            List<Settlement__c> settlementsToDML = new List<Settlement__c>();
                            List<Draft__c> draftsToDML = new List<Draft__c>();
                            List<Fee__c> programFeesOfferedToDML = new List<Fee__c>();
                            for (PaymentWrapper paymentWrap : offerAndPaymentsWrap.paymentWrappers) {
                                if (paymentWrap.paymentType == 'Settlement') {
                                    Settlement__c settlementRecord = new Settlement__c();
                                    settlementRecord.Id = paymentWrap.recordId;
                                    if(paymentWrap.offerId == null){
                                        settlementRecord.Offer__c = offerToDML.Id;
                                    }else {
                                        settlementRecord.Offer__c = paymentWrap.offerId;
                                    }
                                    if (offerToDML.Offer_Status__c == 'Accepted') {
                                        settlementRecord.RecordTypeId = SettlementUtil.getRecordTypeId(SettlementUtil.RT_SETTLEMENTS);
                                        settlementRecord.Opportunity__c = opportunityId;
                                        settlementRecord.Client_Account__c = accountId;
                                        settlementRecord.Settlement_Status__c = 'Pending';
                                    } else {
                                        if(paymentWrap.recordTypeId == null && paymentWrap.recordTypeId != SettlementUtil.getRecordTypeId(SettlementUtil.RT_SETTLEMENTS)){
                                        settlementRecord.RecordTypeId = SettlementUtil.getRecordTypeId(SettlementUtil.RT_OFFERED_SETTLEMENTS);
                                        }else{
                                            settlementRecord.RecordTypeId = paymentWrap.recordTypeId;
                                        }
                                        settlementRecord.Settlement_Status__c = paymentWrap.paymentStatus;
                                    }
                                    settlementRecord.AmountToCreditor__c = paymentWrap.amount;
                                    settlementRecord.Payment_Method_Amount__c = paymentWrap.fees;
                                    settlementRecord.Settlement_Date__c = paymentWrap.paymentDate;
                                    settlementRecord.Is_Down_Payment__c = paymentWrap.downPayment != null ? paymentWrap.downPayment : false;
                                    settlementsToDML.add(settlementRecord);
                                } else if (offerToDML.Offer_Status__c == 'Accepted' && paymentWrap.paymentType == 'Additional Draft') {
                                    DraftWrapper draftWrap = new DraftWrapper();
                                    draftWrap.clientSFId = paymentWrap.accountId;
                                    draftWrap.programPlanId = paymentWrap.programPlanId;
                                    draftWrap.opportunityId = paymentWrap.opportunityId;
                                    draftWrap.paymentDate = paymentWrap.paymentDate;
                                    draftWrap.paymentAmount = paymentWrap.amount;
                                    draftWrap.processorFee = paymentWrap.processorFee;
                                    draftWrap.serviceFee = paymentWrap.serviceFee;
                                    draftWrap.citaldelFee = paymentWrap.citadelFee;
                                    draftWrap.draftStatus = 'Pending';
                                    Draft__c draftToDML = draftWrap.getDraftInstance();
                                    draftsToDML.add(draftToDML);
                                }
                            }
                            List<Settlement__c> settlementsToDelete = SettlementData.querySettlementsToDelete(offerToDML.Id,settlementsToDML);
                            delete settlementsToDelete;
                            upsert settlementsToDML;
                            upsert programFeesOfferedToDML;
                            insert draftsToDML;
                        }
                    }
                }
            }
            return result;
        } catch (Exception ex) {
            System.debug('eeror ' + ex);
            result.thrown(ex);
        }
        return result;
    }

    private static void putSimulatedSettlementsIntoPaymentWrapper(List<SettlementWrapper> settlementWrappers, List<PaymentWrapper> paymentWrappers) {
        for (SettlementWrapper settlWrap : settlementWrappers) {
            PaymentWrapper paymentWrap = new PaymentWrapper();
            paymentWrap.recordId = settlWrap.recordId;
            paymentWrap.opportunityId = settlWrap.opportunityId;
            paymentWrap.accountId = settlWrap.accountId;
            paymentWrap.paymentDate = settlWrap.settlementDate;
            paymentWrap.paymentType = 'Settlement';
            paymentWrap.paymentRecipient = settlWrap.creditorName;
            paymentWrap.totalAmount = settlWrap.totalSettlementAmount;
            paymentWrap.fees = settlWrap.paymentMethodAmount;
            paymentWrap.amount = settlWrap.amountToCreditor;
            paymentWrap.paymentStatus = 'Simulated';
            paymentWrap.downPayment = settlWrap.downPayment;
            paymentWrappers.add(paymentWrap);
        }
    }

    public static void putExistingSettlementsIntoPaymentWrapper(List<Settlement__c> settlements, List<PaymentWrapper> paymentWrappers) {
        for (Settlement__c settlement : settlements) {
            PaymentWrapper paymentWrap = new PaymentWrapper();
            paymentWrap.recordId = settlement.Id;
            paymentWrap.opportunityId = settlement.Opportunity__c;
            paymentWrap.accountId = settlement.Account__c;
            paymentWrap.paymentDate = settlement.Settlement_Date__c;
            paymentWrap.paymentType = 'Settlement';
            paymentWrap.paymentRecipient = settlement.Offer__r.Debt_Details__r.Creditor_Name__c;
            paymentWrap.totalAmount = settlement.SettlementAmount__c;
            paymentWrap.fees = settlement.Payment_Method_Amount__c;
            paymentWrap.amount = settlement.AmountToCreditor__c;
            paymentWrap.paymentStatus = settlement.Settlement_Status__c;
            paymentWrap.offerId = settlement.Offer__c;
            paymentWrap.recordTypeId = settlement.recordTypeId;
            paymentWrap.downPayment = settlement.is_Down_Payment__c;
            paymentWrappers.add(paymentWrap);
        }
    }


    private static void putExistingDraftsIntoPaymentWrapper(List<Draft__c> drafts, List<PaymentWrapper> paymentWrappers) {
        for (Draft__c draftRecord : drafts) {
            PaymentWrapper paymentWrap = new PaymentWrapper();
            paymentWrap.recordId = draftRecord.Id;
            paymentWrap.accountId = draftRecord.Account__c;
            paymentWrap.paymentDate = draftRecord.Draft_Date__c;
            paymentWrap.paymentType = 'Draft';
            paymentWrap.paymentRecipient = 'Escrow Account';
            paymentWrap.totalAmount = draftRecord.Draft_Total_Amount__c;
            paymentWrap.fees = draftRecord.Draft_Total_Amount__c - draftRecord.Draft_Amount__c;
            paymentWrap.amount = draftRecord.Draft_Amount__c;
            paymentWrap.paymentStatus = draftRecord.Draft_Status__c;
            paymentWrappers.add(paymentWrap);
        }
    }

    private static List<DraftWrapper> simulateAdditionalDrafts(OfferWrapper offerWrap, Draft__c lastDraft, Program_Plan__c prgmPlanRecord) {
        List<DraftWrapper> additionalDraftWrappers = new List<DraftWrapper>();
        if (offerWrap.diffInAmount != null && offerWrap.draftAmountPerPayment != null && lastDraft != null && lastDraft.Draft_Date__c != null) {
            List<Offer__c> offers = OfferData.queryOffersByOfferId(offerWrap.offerId);
            Offer__c offerRecInDB;
            if (offers != null && !offers.isEmpty()) {
                offerRecInDB = offers[0];
            }
            if (offerRecInDB != null && offerRecInDB.Offer_Status__c != 'Accepted') {
                Set<String> monthYearSet = new Set<String>();
                Decimal processorFee = 0.00;
                Decimal serviceFee = 0.00;
                Decimal citadelFee = 0.00;
                if (prgmPlanRecord != null && prgmPlanRecord.Payment_Processor__r.Monthly_Bank_Fee__c != null) {
                    processorFee = prgmPlanRecord.Payment_Processor__r.Monthly_Bank_Fee__c;
                } 
                PaymentCalculatorSettings settings = new PaymentCalculatorSettings();
                if (settings.serviceFee != null && settings.serviceFee > 0) {
                    serviceFee = settings.serviceFee;
                }
                Decimal tempCitadelFee = queryCitadelFee(prgmPlanRecord.Opportunity__c);
                if (tempCitadelFee != null && tempCitadelFee > 0) {
                    citadelFee = tempCitadelFee;
                }
                Integer noOfPayments = Integer.valueOf((offerWrap.diffInAmount/offerWrap.draftAmountPerPayment).round(System.RoundingMode.UP));
                if (noOfPayments != null && noOfPayments > 0) {
                    String firstMonthYearString = getMonthYearValue(lastDraft.Draft_Date__c);
                    monthYearSet.add(firstMonthYearString);
                    Date tempPaymentDate = lastDraft.Draft_Date__c.addDays(7);
                    Decimal sumOfPayments = 0.00;
                    for (Integer i = 1; i <= noOfPayments; i++) {
                        DraftWrapper draftWrap = new DraftWrapper();
                        draftWrap.clientSFId = lastDraft.Account__c;
                        draftWrap.programPlanId = prgmPlanRecord.Id;
                        draftWrap.paymentDate = tempPaymentDate;
                        String monthYearString = getMonthYearValue(draftWrap.paymentDate);
                        if (!monthYearSet.contains(monthYearString)) {
                            draftWrap.processorFee = processorFee;
                            draftWrap.citaldelFee = citadelFee;
                            monthYearSet.add(monthYearString);
                        } else {
                            draftWrap.processorFee = 0.00;
                            draftWrap.citaldelFee = 0.00;
                        }
                        draftWrap.serviceFee = serviceFee;
                        sumOfPayments += offerWrap.draftAmountPerPayment;
                        if (i == noOfPayments) {
                            draftWrap.paymentAmount = offerWrap.draftAmountPerPayment - (sumOfPayments - offerWrap.diffInAmount);
                        } else {
                            draftWrap.paymentAmount = offerWrap.draftAmountPerPayment;
                        }
                        draftWrap.totalAmount = draftWrap.paymentAmount + draftWrap.processorFee + draftWrap.serviceFee + draftWrap.citaldelFee;
                        additionalDraftWrappers.add(draftWrap);
                        tempPaymentDate = tempPaymentDate.addDays(7);
                    }
                }
            }
        }
        return additionalDraftWrappers;
    }

    private static Decimal queryCitadelFee(Id opportunityId) {
        Decimal citadelFee = 0.00;
        for (OpportunityLineItem oppLineItem : [SELECT Id, ProductCode, UnitPrice, Opportunity.Legal_Network__c FROM OpportunityLineItem WHERE OpportunityId = :opportunityId ORDER BY CreatedDate DESC]) {
            String targetProductCode = oppLineItem.Opportunity.Legal_Network__c == FileUtil.AGREEMENT_VICTORY
                ? FeeUtil.PRODUCT_VICTORY_FEE
                : FeeUtil.PRODUCT_CITADEL_FEE;
            if (oppLineItem.ProductCode == targetProductCode) {
                citadelFee = oppLineItem.UnitPrice;
                break;
            }
        }
        return citadelFee;
    }

    private static string getMonthYearValue(Date dateValue) {
        return dateValue.month() + '-' + dateValue.year();
    }

    private static void putAdditionalDraftWrappersIntoPaymentWrapper(List<DraftWrapper> additionalDraftWrappers, List<PaymentWrapper> paymentWrappers) {
        for (DraftWrapper draftWrap : additionalDraftWrappers) {
            PaymentWrapper paymentWrap = new PaymentWrapper();
            paymentWrap.accountId = draftWrap.clientSFId;
            paymentWrap.programPlanId = draftWrap.programPlanId;
            paymentWrap.paymentDate = draftWrap.paymentDate;
            paymentWrap.paymentType = 'Additional Draft';
            paymentWrap.paymentRecipient = 'Escrow Account';
            paymentWrap.totalAmount = draftWrap.totalAmount;
            paymentWrap.amount = draftWrap.paymentAmount;
            paymentWrap.fees = draftWrap.totalAmount - draftWrap.paymentAmount;
            paymentWrap.paymentStatus = 'Simulated';
            paymentWrap.programPlanId = draftWrap.programPlanId;
            paymentWrap.processorFee = draftWrap.processorFee;
            paymentWrap.serviceFee = draftWrap.serviceFee;
            paymentWrap.citadelFee = draftWrap.citaldelFee;
            paymentWrappers.add(paymentWrap);
        }
    }

  /*  private static void getSettlementProgramFees(Program_Plan__c prgmPlan, OfferWrapper offerWrap, List<PaymentWrapper> paymentWrappers) {
        if (prgmPlan.Settlement_Program_Fee__c != null && prgmPlan.Settlement_Program_Fee__c > 0) {
            Decimal totalDebtOfAllIncludedDebts;
            List<AggregateResult> aggregateResultList = DebtDetailsData.aggregateDebtDetails(offerWrap.opportunityId);
            if (aggregateResultList != null && !aggregateResultList.isEmpty()) {
                for (AggregateResult ar : aggregateResultList) {
                    totalDebtOfAllIncludedDebts = (Decimal)ar.get('totalDebt');
                }
            }
            if (totalDebtOfAllIncludedDebts != null && totalDebtOfAllIncludedDebts > 0) {
                List<Debt_Details__c> currentDebtDetails = DebtDetailsData.getDebtDetails(offerWrap.debtDetailId);
                if (currentDebtDetails != null && !currentDebtDetails.isEmpty()) {
                    Decimal currentDebt = currentDebtDetails[0].Debt_Amount__c;
                    Decimal currentDebtTotalDebtPercent = (currentDebt/totalDebtOfAllIncludedDebts) * 100;
                    Decimal settlementProgramFeeToCollect = (prgmPlan.Settlement_Program_Fee__c * currentDebtTotalDebtPercent/100);
                    Integer numberOfPayments = SettlementPaymentCalculator.getNumberOfPayments(offerWrap);
                    Date currentDate = offerWrap.settlementStartDate;
                    Decimal amountPerPayment = (settlementProgramFeeToCollect/numberOfPayments);
                    for (Integer i = 0; i < numberOfPayments; i++) {
                        PaymentWrapper paymentWrap = new PaymentWrapper();
                        paymentWrap.accountId = prgmPlan.Client__c;
                        paymentWrap.opportunityId = prgmPlan.Opportunity__c;
                        paymentWrap.paymentDate = currentDate;
                        paymentWrap.paymentType = 'Program Fee - Settlements';
                        paymentWrap.paymentRecipient = 'Coastal Debt';
                        paymentWrap.totalAmount = amountPerPayment;
                        paymentWrap.fees = 0;
                        paymentWrap.amount = amountPerPayment;
                        paymentWrap.paymentStatus = 'Simulated';
                        paymentWrappers.add(paymentWrap);
                        currentDate = SettlementPaymentCalculator.getNextPaymentDate(currentDate, offerWrap);
                    }
                }
            }
        }
    } */

    public class OfferAndPaymentWrapper {
        public String paymentWrappers;
        public String offerWrappers;
    }

    public class PaymentWrapper implements Comparable {
        public Id recordId;
        public Id opportunityId;
        public Id accountId;
        public Date paymentDate;
        public String paymentType;
        public String paymentRecipient;
        public Decimal totalAmount;
        public Decimal fees;
        public Decimal amount;
        public String paymentStatus;
        public Decimal runningBalance;
        public String colorCode;
        public Id offerId;
        public Id recordTypeId;
        public Id programPlanId;
        public Decimal processorFee;
        public Decimal serviceFee;
        public Decimal citadelFee;
        public Boolean downPayment;

        public Integer compareTo(Object compareTo) {
            PaymentWrapper other = (PaymentWrapper) compareTo;
            if (this.paymentDate > other.paymentDate)
              return 1;
            else if (this.paymentDate <= other.paymentDate)
              return 0;
            return -1;
        }
    }

    public class OfferAndPaymentsWrapper {
        public OfferWrapper offerWrap;
        public List<PaymentWrapper> paymentWrappers;
    }
}